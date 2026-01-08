const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Get zoom level based on altitude (ft).
 * Higher altitude = zoomed out (wider area, e.g. US-wide above ~20k).
 */
function getZoomForAltitude(altitude) {
    const alt = typeof altitude === 'number' ? altitude : 0;
    if (alt <= 3000) return 11;        // airport / local pattern view
    if (alt <= 8000) return 9;         // city-scale
    if (alt <= 20000) return 7;        // regional
    return 4;                          // US-wide / large area
}

/**
 * Build a static map URL centered on the aircraft with an airline-style marker.
 * Uses OpenStreetMap static map service.
 */
function buildFlightMapUrl(latitude, longitude, altitude, callsign) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    const zoom = getZoomForAltitude(altitude);
    const size = '600x400';
    const markerColor = 'red-pushpin';
    const markerParam = `${latitude},${longitude},${markerColor}`;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=${zoom}&size=${size}&markers=${markerParam}`;
}

/**
 * Create a flight status embed for a flight object.
 */
function createFlightEmbed(flight) {
    const callsign = flight.callsign || 'Unknown';
    const aircraft = flight.aircraft_type || flight.aircraft || 'Unknown';
    const origin = flight.origin || 'Unknown';
    const destination = flight.destination || 'Unknown';
    const altitude = typeof flight.altitude === 'number' ? `${flight.altitude.toFixed(0)} ft` : 'N/A';
    const altitudeAgl = typeof flight.altitude_agl === 'number' ? `${flight.altitude_agl.toFixed(0)} ft` : null;
    const latitude = typeof flight.latitude === 'number' ? flight.latitude.toFixed(4) : null;
    const longitude = typeof flight.longitude === 'number' ? flight.longitude.toFixed(4) : null;
    const verticalSpeedFpm = typeof flight.vertical_speed_fpm === 'number' ? flight.vertical_speed_fpm : 
                              (typeof flight.vertical_speed === 'number' ? flight.vertical_speed : null);

    const title = `✈️ Flight update - ${callsign}`;
    const color = 0x5865F2; // default blurple

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

    // Add map if coordinates provided
    const rawLat = typeof flight.latitude === 'number' ? flight.latitude : null;
    const rawLon = typeof flight.longitude === 'number' ? flight.longitude : null;
    const rawAlt = typeof flight.altitude === 'number' ? flight.altitude : null;

    const mapUrl = buildFlightMapUrl(rawLat, rawLon, rawAlt, callsign);
    if (mapUrl) {
        embed.setImage(mapUrl);
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
                    await channel.send({ embeds: [embed] });
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
