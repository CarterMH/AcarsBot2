const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();

/**
 * Get zoom level based on altitude (ft).
 * Higher altitude = zoomed out (wider area).
 * Maximum zoom out is capped at ~300nm (zoom level 7).
 */
function getZoomForAltitude(altitude) {
    const alt = typeof altitude === 'number' ? altitude : 0;
    if (alt <= 3000) return 11;        // airport / local pattern view (~10-20nm)
    if (alt <= 8000) return 9;         // city-scale (~50-100nm)
    if (alt <= 20000) return 7;        // regional (~200-300nm)
    return 7;                          // Maximum zoom out capped at ~300nm
}

/**
 * Draw an aircraft icon on a canvas at the specified position and rotation.
 */
function drawAircraftIcon(ctx, x, y, heading = 0, size = 20) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((heading * Math.PI) / 180); // Convert degrees to radians
    
    // Draw aircraft icon (simple triangle pointing up, rotated by heading)
    ctx.fillStyle = '#FF0000'; // Red color
    ctx.strokeStyle = '#FFFFFF'; // White outline
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    // Aircraft shape: triangle pointing up (nose)
    ctx.moveTo(0, -size / 2); // Nose
    ctx.lineTo(-size / 3, size / 2); // Left wing tip
    ctx.lineTo(0, size / 4); // Tail
    ctx.lineTo(size / 3, size / 2); // Right wing tip
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
}

/**
 * Calculate pixel position within a tile from lat/lon coordinates.
 */
function latLonToPixel(lat, lon, zoom, tileX, tileY) {
    const n = Math.pow(2, zoom);
    const pixelX = ((lon + 180) / 360) * n * 256 - tileX * 256;
    const pixelY = ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * n * 256 - tileY * 256;
    return { x: pixelX, y: pixelY };
}

/**
 * Fetch a static map image using multiple free map tile services with fallbacks.
 * Overlays an aircraft icon at the exact location with orientation.
 */
async function fetchMapImage(latitude, longitude, altitude, callsign, heading = null) {
    // Handle string/number conversion
    const latNum = latitude !== null && latitude !== undefined ? Number(latitude) : null;
    const lonNum = longitude !== null && longitude !== undefined ? Number(longitude) : null;
    
    if (latNum === null || lonNum === null || Number.isNaN(latNum) || Number.isNaN(lonNum)) {
        console.log(`⚠️ Invalid coordinates for map: lat=${latitude}, lon=${longitude}`);
        return null;
    }

    const altNum = altitude !== null && altitude !== undefined ? Number(altitude) : 0;
    const zoom = getZoomForAltitude(altNum);

    // Calculate tile coordinates from lat/lon
    const n = Math.pow(2, zoom);
    const tileX = Math.floor((lonNum + 180) / 360 * n);
    const tileY = Math.floor((1 - Math.log(Math.tan(latNum * Math.PI / 180) + 1 / Math.cos(latNum * Math.PI / 180)) / Math.PI) / 2 * n);

    console.log(`🗺️ Fetching map tile for ${callsign || 'flight'}`);
    console.log(`   Coordinates: lat=${latNum}, lon=${lonNum}, zoom=${zoom}, tile: ${tileX}/${tileY}`);

    // Try multiple free map tile services with fallbacks
    const tileServices = [
        {
            name: 'CartoDB Positron',
            url: `https://a.basemaps.cartocdn.com/light_all/${zoom}/${tileX}/${tileY}.png`
        },
        {
            name: 'CartoDB Dark Matter',
            url: `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${tileX}/${tileY}.png`
        },
        {
            name: 'Stamen Terrain',
            url: `https://stamen-tiles.a.ssl.fastly.net/terrain/${zoom}/${tileX}/${tileY}.png`
        },
        {
            name: 'Stamen Toner',
            url: `https://stamen-tiles.a.ssl.fastly.net/toner/${zoom}/${tileX}/${tileY}.png`
        }
    ];

    // Try each service until one works
    for (const service of tileServices) {
        try {
            console.log(`   Trying ${service.name}...`);
            const buffer = await new Promise((resolve, reject) => {
                https.get(service.url, (res) => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`${service.name} returned status ${res.statusCode}`));
                    }

                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        if (buffer.length > 0) {
                            resolve(buffer);
                        } else {
                            reject(new Error(`${service.name} returned empty response`));
                        }
                    });
                }).on('error', (error) => {
                    reject(error);
                });
            });

            console.log(`✅ Map tile fetched from ${service.name} (${buffer.length} bytes)`);
            
            // Overlay aircraft icon if we have coordinates
            if (latNum !== null && lonNum !== null) {
                try {
                    // Load the tile image
                    const tileImage = await loadImage(buffer);
                    const canvas = createCanvas(256, 256);
                    const ctx = canvas.getContext('2d');
                    
                    // Draw the tile
                    ctx.drawImage(tileImage, 0, 0);
                    
                    // Calculate pixel position of aircraft within the tile
                    const pixelPos = latLonToPixel(latNum, lonNum, zoom, tileX, tileY);
                    
                    // Draw aircraft icon at the exact position
                    const aircraftHeading = heading !== null && !Number.isNaN(Number(heading)) ? Number(heading) : 0;
                    drawAircraftIcon(ctx, pixelPos.x, pixelPos.y, aircraftHeading, 24);
                    
                    // Convert canvas to buffer
                    const finalBuffer = canvas.toBuffer('image/png');
                    console.log(`✅ Aircraft icon overlaid on map (heading: ${aircraftHeading}°)`);
                    return finalBuffer;
                } catch (error) {
                    console.warn(`⚠️ Failed to overlay aircraft icon: ${error.message}, using plain tile`);
                    // Return original tile if overlay fails
                    return buffer;
                }
            }
            
            return buffer;
        } catch (error) {
            console.warn(`⚠️ ${service.name} failed: ${error.message}`);
            // Continue to next service
        }
    }

    // If all services failed, throw error
    throw new Error('All map tile services failed');
}

/**
 * Create a flight status embed for a flight object.
 */
function createFlightEmbed(flight) {
    const callsign = flight.callsign || 'Unknown';
    const aircraft = flight.aircraft_type || flight.aircraft || 'Unknown';
    const origin = flight.origin || 'Unknown';
    const destination = flight.destination || 'Unknown';
    const altitudeNum = flight.altitude !== null && flight.altitude !== undefined ? Number(flight.altitude) : null;
    const altitudeAglNum = flight.altitude_agl !== null && flight.altitude_agl !== undefined ? Number(flight.altitude_agl) : null;
    const latitudeNum = flight.latitude !== null && flight.latitude !== undefined ? Number(flight.latitude) : null;
    const longitudeNum = flight.longitude !== null && flight.longitude !== undefined ? Number(flight.longitude) : null;

    const altitude = typeof altitudeNum === 'number' && !Number.isNaN(altitudeNum) ? `${altitudeNum.toFixed(0)} ft` : 'N/A';
    const altitudeAgl = typeof altitudeAglNum === 'number' && !Number.isNaN(altitudeAglNum) ? `${altitudeAglNum.toFixed(0)} ft` : null;
    const latitude = typeof latitudeNum === 'number' && !Number.isNaN(latitudeNum) ? latitudeNum.toFixed(4) : null;
    const longitude = typeof longitudeNum === 'number' && !Number.isNaN(longitudeNum) ? longitudeNum.toFixed(4) : null;
    const verticalSpeedFpm = typeof flight.vertical_speed_fpm === 'number' ? flight.vertical_speed_fpm : 
                              (typeof flight.vertical_speed === 'number' ? flight.vertical_speed : null);

    const title = `✈️ Flight update - ${callsign}`;
    // Random color for each test embed
    const color = Math.floor(Math.random() * 0xFFFFFF);

    let description = `**Aircraft:** ${aircraft}\n**Route:** ${origin} ➝ ${destination}\n**Altitude:** ${altitude}`;
    if (altitudeAgl) {
        description += ` (${altitudeAgl} AGL)`;
    }

    if (verticalSpeedFpm !== null && !Number.isNaN(verticalSpeedFpm)) {
        description += `\n**Vertical Speed:** ${verticalSpeedFpm} fpm`;
    }

    if (latitude !== null && longitude !== null) {
        description += `\n**Position:** ${latitude}, ${longitude}`;
    }

    description += `\n**Status:** [DEV] Active flight status`;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: 'ACARS Bot Flight Status (Test)' });

    // Add engine info if available
    const engineInfoParts = [];
    if (flight.engine_type) engineInfoParts.push(`Type: ${flight.engine_type}`);
    if (flight.engine_model) engineInfoParts.push(`Model: ${flight.engine_model}`);
    if (flight.engine_count) engineInfoParts.push(`Count: ${flight.engine_count}`);
    if (flight.engines) engineInfoParts.push(`Info: ${flight.engines}`);

    if (engineInfoParts.length > 0) {
        embed.addFields({ name: 'Engine Info', value: engineInfoParts.join('\n') });
    }

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testflight')
        .setDescription('Send all active flights from Supabase to flight status channel (Admin only, for dev/testing)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Check if user has administrator permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ You do not have permission to use this command. You need Administrator permissions.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // Check Supabase configuration
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return await interaction.editReply({ 
                content: '❌ Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables.' 
            });
        }

        const FLIGHT_STATUS_CHANNEL_ID = process.env.FLIGHT_STATUS_CHANNEL_ID || '1458721716002881789';
        const channel = interaction.client.channels.cache.get(FLIGHT_STATUS_CHANNEL_ID);

        if (!channel) {
            return await interaction.editReply({ 
                content: `❌ Flight status channel ${FLIGHT_STATUS_CHANNEL_ID} not found. Make sure the bot has access to this channel.` 
            });
        }

        try {
            // Create Supabase client
            const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // Fetch all active flights
            const { data, error } = await supabaseClient
                .from('active_flights')
                .select('*');

            if (error) {
                console.error('❌ Error fetching active flights:', error);
                return await interaction.editReply({ 
                    content: `❌ Failed to fetch active flights: ${error.message}` 
                });
            }

            if (!Array.isArray(data) || data.length === 0) {
                return await interaction.editReply({ 
                    content: '✅ No active flights found in Supabase.' 
                });
            }

            // Send an embed for each active flight
            let successCount = 0;
            let errorCount = 0;

            for (const flight of data) {
                try {
                    const embed = createFlightEmbed(flight);
                    
                    // Fetch and attach map image if coordinates are available
                    let mapAttachment = null;
                    const latitudeNum = flight.latitude !== null && flight.latitude !== undefined ? Number(flight.latitude) : null;
                    const longitudeNum = flight.longitude !== null && flight.longitude !== undefined ? Number(flight.longitude) : null;
                    const altitudeNum = flight.altitude !== null && flight.altitude !== undefined ? Number(flight.altitude) : null;
                    
                    if (latitudeNum !== null && longitudeNum !== null) {
                        try {
                            // Get heading/bearing from flight data (try multiple possible field names)
                            const heading = flight.heading !== null && flight.heading !== undefined ? Number(flight.heading) :
                                           (flight.bearing !== null && flight.bearing !== undefined ? Number(flight.bearing) :
                                           (flight.course !== null && flight.course !== undefined ? Number(flight.course) : null));
                            
                            const mapBuffer = await fetchMapImage(latitudeNum, longitudeNum, altitudeNum, flight.callsign || 'Unknown', heading);
                            if (mapBuffer) {
                                mapAttachment = new AttachmentBuilder(mapBuffer, { name: 'map.png' });
                                embed.setImage('attachment://map.png');
                                console.log(`✅ Map image attached for ${flight.callsign || flight.id}`);
                            }
                        } catch (error) {
                            console.error(`❌ Failed to fetch map image for ${flight.callsign || flight.id}:`, error.message);
                        }
                    }
                    
                    const messageOptions = { embeds: [embed] };
                    if (mapAttachment) {
                        messageOptions.files = [mapAttachment];
                    }
                    
                    await channel.send(messageOptions);
                    successCount++;
                } catch (err) {
                    console.error(`❌ Failed to send embed for flight ${flight.callsign || flight.id}:`, err);
                    errorCount++;
                }
            }

            await interaction.editReply({ 
                content: `✅ Sent ${successCount} flight status update(s) to flight status channel.${errorCount > 0 ? ` (${errorCount} failed)` : ''}` 
            });
        } catch (err) {
            console.error('❌ Unexpected error:', err);
            await interaction.editReply({ 
                content: `❌ Failed to process active flights: ${err.message}` 
            });
        }
    },
};
