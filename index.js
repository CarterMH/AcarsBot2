const { Client, GatewayIntentBits, Collection, Events, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const AnnouncementService = require('./services/announcementService');
const QuoteService = require('./services/quoteService');
require('dotenv').config();

// Supabase configuration for bot-side features (flight status, etc.)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
let supabaseClient = null;

// Store the server URL for map proxy (will be set when server starts)
let MAP_PROXY_BASE_URL = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client for bot features enabled');
} else {
    console.log('Supabase URL or ANON key missing - flight status features disabled');
}

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // Required for slash commands
        GatewayIntentBits.GuildMessages, // For sending messages
        GatewayIntentBits.DirectMessages, // For receiving DMs
        GatewayIntentBits.MessageContent, // For reading message content (privileged - enable in Discord Developer Portal)
        // Add more intents below if needed:
        // GatewayIntentBits.GuildMembers, // For accessing member list (privileged - enable in Discord Developer Portal)
    ],
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`Loaded command: ${command.data.name}`);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Initialize services (will be set when client is ready)
let announcementService = null;
let quoteService = null;
let statusRotationInterval = null;
let quoteInterval = null;
let flightStatusInterval = null;

// In-memory tracking of flight state to detect events (takeoff/landing, etc.)
const flightState = new Map();

const FLIGHT_STATUS_CHANNEL_ID = process.env.FLIGHT_STATUS_CHANNEL_ID || '1458721716002881789';
const FLIGHT_POLL_INTERVAL_MS = Number(process.env.FLIGHT_POLL_INTERVAL_MS || 15000);

/**
 * Determine a simple flight phase from altitude.
 * @param {number|null|undefined} altitude
 * @returns {'ground'|'airborne'}
 */
function getPhaseFromAltitude(altitude) {
    const alt = typeof altitude === 'number' ? altitude : 0;
    // Below ~500 ft considered ground, above that airborne
    return alt > 500 ? 'airborne' : 'ground';
}

/**
 * Choose map zoom level based on altitude (ft).
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
 * Build a static map URL centered on the aircraft with an airline-style marker.
 * Uses a static map service that returns direct PNG images compatible with Discord embeds.
 */
function buildFlightMapUrl(latitude, longitude, altitude, callsign) {
    // Handle string/number conversion
    const latNum = latitude !== null && latitude !== undefined ? Number(latitude) : null;
    const lonNum = longitude !== null && longitude !== undefined ? Number(longitude) : null;
    
    if (latNum === null || lonNum === null || Number.isNaN(latNum) || Number.isNaN(lonNum)) {
        return null;
    }

    const zoom = getZoomForAltitude(altitude !== null && altitude !== undefined ? Number(altitude) : 0);
    const width = 600;
    const height = 400;

    // Use our proxy endpoint to serve the map as a direct PNG image
    // This ensures Discord can embed it properly
    if (!MAP_PROXY_BASE_URL) {
        // Fallback to direct URL if proxy not available (shouldn't happen in normal operation)
        const center = `${latNum},${lonNum}`;
        const markerParam = `${latNum},${lonNum},red-pushpin`;
        return `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=${zoom}&size=${width}x${height}&markers=${markerParam}`;
    }
    
    // Build proxy URL - our server will fetch the OpenStreetMap image and serve it as PNG
    const mapUrl = `${MAP_PROXY_BASE_URL}/api/map?lat=${latNum}&lon=${lonNum}&zoom=${zoom}&width=${width}&height=${height}`;
    
    // Debug logging
    console.log(`🗺️ Generated map proxy URL for ${callsign || 'flight'}: ${mapUrl}`);
    console.log(`   Coordinates: lat=${latNum}, lon=${lonNum}, zoom=${zoom}`);
    
    return mapUrl;
}

/**
 * Get vertical speed in FPM either from row data or calculating from previous sample.
 */
function getVerticalSpeedFpm(currentRow, previousState, now) {
    // Prefer explicit vertical speed fields if present
    if (typeof currentRow.vertical_speed_fpm === 'number') return currentRow.vertical_speed_fpm;
    if (typeof currentRow.vertical_speed === 'number') return currentRow.vertical_speed;

    if (!previousState || typeof currentRow.altitude !== 'number' || typeof previousState.altitude !== 'number') {
        return null;
    }

    const dtSeconds = (now - previousState.timestamp) / 1000;
    if (!dtSeconds || dtSeconds <= 0) return null;

    const feetDelta = currentRow.altitude - previousState.altitude;
    const fpm = (feetDelta / dtSeconds) * 60;
    return Math.round(fpm);
}

/**
 * Get a random embed color.
 */
function getRandomEmbedColor() {
    return Math.floor(Math.random() * 0xFFFFFF);
}

/**
 * Send a nicely formatted embed to the flight status channel.
 */
async function sendFlightStatusEmbed(type, flight, options = {}) {
    const channelId = FLIGHT_STATUS_CHANNEL_ID;
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
        console.error(`❌ Flight status channel ${channelId} not found. Make sure the bot has access to this channel.`);
        return;
    }

    const {
        verticalSpeedFpm = null,
        extraDescription = '',
    } = options;

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

    let title = '';
    // Always use a random color for the embed sidebar
    const color = getRandomEmbedColor();

    if (type === 'takeoff') {
        title = `🚀 Takeoff detected - ${callsign}`;
    } else if (type === 'landing') {
        title = `🛬 Landing detected - ${callsign}`;
    } else {
        title = `✈️ Flight update - ${callsign}`;
    }

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

    if (extraDescription) {
        description += `\n${extraDescription}`;
    }

    // Include any engine-related info if available in the row
    const engineInfoParts = [];
    if (flight.engine_type) engineInfoParts.push(`Type: ${flight.engine_type}`);
    if (flight.engine_model) engineInfoParts.push(`Model: ${flight.engine_model}`);
    if (flight.engine_count) engineInfoParts.push(`Count: ${flight.engine_count}`);
    if (flight.engines) engineInfoParts.push(`Info: ${flight.engines}`);

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

    if (engineInfoParts.length > 0) {
        embed.addFields({ name: 'Engine Info', value: engineInfoParts.join('\n') });
    }

    // Add a static map image if we have coordinates
    const mapUrl = buildFlightMapUrl(latitudeNum, longitudeNum, altitudeNum, callsign);
    if (mapUrl) {
        console.log(`✅ Adding map image to embed for ${callsign}: ${mapUrl}`);
        embed.setImage(mapUrl);
    } else {
        console.log(`❌ No map URL generated for ${callsign} - lat: ${latitudeNum}, lon: ${longitudeNum}`);
    }

    try {
        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('❌ Failed to send flight status embed:', err);
    }
}

/**
 * Poll Supabase for active flights and emit events for takeoff/landing.
 */
async function pollActiveFlights() {
    if (!supabaseClient || !FLIGHT_STATUS_CHANNEL_ID) {
        return;
    }

    const now = Date.now();

    try {
        const { data, error } = await supabaseClient
            .from('active_flights')
            .select('*');

        if (error) {
            console.error('❌ Error fetching active flights from Supabase:', error.message);
            return;
        }

        if (!Array.isArray(data)) {
            return;
        }

        // Track which flights we saw this poll, for cleanup
        const seenIds = new Set();

        for (const flight of data) {
            const id = flight.id || flight.uuid || flight.callsign;
            if (!id) continue;

            seenIds.add(id);

            const prev = flightState.get(id);
            const currentPhase = getPhaseFromAltitude(flight.altitude);
            const vsFpm = getVerticalSpeedFpm(flight, prev, now);

            // First time we see this flight - just store state, and optionally send a "tracking" message
            if (!prev) {
                flightState.set(id, {
                    altitude: typeof flight.altitude === 'number' ? flight.altitude : null,
                    phase: currentPhase,
                    timestamp: now,
                });

                // Optional: send an initial flight tracking message
                await sendFlightStatusEmbed('update', flight, {
                    verticalSpeedFpm: vsFpm,
                    extraDescription: '**Status:** Flight entered active tracking.',
                });

                continue;
            }

            // Detect phase transitions
            if (prev.phase === 'ground' && currentPhase === 'airborne') {
                await sendFlightStatusEmbed('takeoff', flight, {
                    verticalSpeedFpm: vsFpm,
                    extraDescription: '**Event:** Takeoff detected.',
                });
            } else if (prev.phase === 'airborne' && currentPhase === 'ground') {
                await sendFlightStatusEmbed('landing', flight, {
                    verticalSpeedFpm: vsFpm,
                    extraDescription: '**Event:** Landing detected.',
                });
            }

            // Update stored state
            flightState.set(id, {
                altitude: typeof flight.altitude === 'number' ? flight.altitude : prev.altitude,
                phase: currentPhase,
                timestamp: now,
            });
        }

        // Clean up flights that are no longer active
        for (const id of flightState.keys()) {
            if (!seenIds.has(id)) {
                flightState.delete(id);
            }
        }
    } catch (err) {
        console.error('❌ Unexpected error while polling active flights:', err);
    }
}

// When the client is ready, run this code
client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    console.log(`ACARS bot is now online!`);
    
    // Initialize services
    announcementService = new AnnouncementService(client);
    quoteService = new QuoteService(client);
    
    // Set up rotating bot status (ACARS / aviation themed, slightly comedic)
    const statuses = [
        { name: 'MSG: SLOW DOWN ✈️', type: ActivityType.Watching },
        { name: 'MSG: YOU\'RE LATE ⏰', type: ActivityType.Watching },
        { name: 'MSG: WHERE\'S THE PAPERWORK? 📑', type: ActivityType.Watching },
        { name: 'MSG: ARE WE THERE YET? 🧳', type: ActivityType.Watching },
        { name: 'MSG: BLOCK TIME 📡', type: ActivityType.Watching },
        { name: 'MSG: FUEL NUMBERS ⛽', type: ActivityType.Watching },
        { name: 'MSG: GATE CHANGE 🎫', type: ActivityType.Watching },
        { name: 'MSG: LATE PUSH 😅', type: ActivityType.Watching },
        { name: 'MSG: COMPANY UPDATE 💼', type: ActivityType.Watching },
        { name: 'MSG: ETD SLIPPING 🌇', type: ActivityType.Watching },
    ];
    
    let statusIndex = 0;
    const updateStatus = () => {
        const status = statuses[statusIndex];
        client.user.setPresence({
            activities: [status],
            status: 'online'
        });
        statusIndex = (statusIndex + 1) % statuses.length;
    };
    
    // Set initial status
    updateStatus();
    
    // Rotate status every 30 seconds
    statusRotationInterval = setInterval(updateStatus, 30000);
    
    // Set up inspirational quotes (every 3-5 minutes)
    const QUOTE_USER_ID = '800272062630854667';
    const sendQuote = async () => {
        try {
            console.log(`Attempting to send inspirational quote to user ${QUOTE_USER_ID}...`);
            await quoteService.sendQuote(QUOTE_USER_ID);
        } catch (error) {
            console.error(`❌ Error sending inspirational quote to user ${QUOTE_USER_ID}:`, error.message);
            console.error('Full error:', error);
        }
    };
    
    // Schedule next quote with random delay (3-5 minutes)
    const scheduleNextQuote = () => {
        const delay = Math.floor(Math.random() * 120000) + 180000; // 180000-300000 ms (3-5 minutes)
        quoteInterval = setTimeout(() => {
            sendQuote();
            scheduleNextQuote(); // Schedule the next one
        }, delay);
    };
    
    // Send first quote after 30 seconds, then schedule recurring quotes
    setTimeout(() => {
        sendQuote();
        scheduleNextQuote();
    }, 30000);

    // Start Supabase-driven flight status updates
    if (supabaseClient && FLIGHT_STATUS_CHANNEL_ID) {
        console.log(`Starting flight status polling every ${FLIGHT_POLL_INTERVAL_MS} ms for channel ${FLIGHT_STATUS_CHANNEL_ID}`);
        flightStatusInterval = setInterval(pollActiveFlights, FLIGHT_POLL_INTERVAL_MS);
    } else {
        console.log('Flight status polling not started (missing Supabase client or channel ID)');
    }

    startWebServer();
});

// Handle incoming DMs
client.on(Events.MessageCreate, async message => {
    // Ignore messages from bots (including itself)
    if (message.author.bot) return;
    
    // Only handle DMs (messages not in a guild/server)
    if (message.guild) return;
    
    // Log the DM
    console.log(`📩 DM received from ${message.author.tag} (${message.author.id}): ${message.content}`);
    
    // Forward DM to the dm-responses channel
    const DM_RESPONSE_CHANNEL_ID = process.env.DM_RESPONSE_CHANNEL_ID || '1458694568626356316'; // dm-responses channel
    
    try {
        const responseChannel = client.channels.cache.get(DM_RESPONSE_CHANNEL_ID);
        if (!responseChannel) {
            console.error(`❌ DM response channel ${DM_RESPONSE_CHANNEL_ID} not found. Make sure the bot has access to this channel.`);
            return;
        }

        // Create embed for the forwarded DM
        const embed = new EmbedBuilder()
            .setTitle('📩 Incoming DM')
            .setDescription(`**From:** ${message.author.tag} (${message.author.id})\n**Message:**\n${message.content || '*No text content*'}`)
            .setColor(0x5865F2) // Blurple
            .setTimestamp()
            .setFooter({ text: 'ACARS Bot DM Forward' })
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

        // If there are attachments, mention them
        if (message.attachments.size > 0) {
            const attachmentList = message.attachments.map(att => `[${att.name}](${att.url})`).join('\n');
            embed.addFields({ name: 'Attachments', value: attachmentList });
        }

        await responseChannel.send({ embeds: [embed] });
        console.log(`✅ Forwarded DM from ${message.author.tag} to channel ${DM_RESPONSE_CHANNEL_ID}`);
    } catch (error) {
        console.error('❌ Error forwarding DM to channel:', error);
    }
});

// Handle slash commands and autocomplete
client.on(Events.InteractionCreate, async interaction => {
    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found for autocomplete.`);
            return;
        }

        try {
            if (command.autocomplete) {
                await command.autocomplete(interaction);
            }
        } catch (error) {
            console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
        }
        return;
    }

    // Handle chat input commands
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}`);
        console.error(error);
        
        const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Handle errors
client.on(Events.Error, error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Cleanup intervals on shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (statusRotationInterval) clearInterval(statusRotationInterval);
    if (quoteInterval) clearTimeout(quoteInterval);
    if (flightStatusInterval) clearInterval(flightStatusInterval);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down...');
    if (statusRotationInterval) clearInterval(statusRotationInterval);
    if (quoteInterval) clearTimeout(quoteInterval);
    if (flightStatusInterval) clearInterval(flightStatusInterval);
    process.exit(0);
});

// Web server setup
function startWebServer() {
    const app = express();
    const PORT = process.env.PORT || 3000;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this in .env
    const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];

    // Initialize Supabase client if credentials are provided
    let supabase = null;
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase integration enabled');
    }

    // Middleware
    app.use(cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || ALLOWED_ORIGINS.includes('*')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true
    }));
    app.use(bodyParser.json());

    // Map proxy endpoint - fetches OpenStreetMap static map and serves as PNG for Discord embeds
    app.get('/api/map', async (req, res) => {
        try {
            const { lat, lon, zoom, width = 600, height = 400 } = req.query;
            
            if (!lat || !lon || !zoom) {
                return res.status(400).json({ error: 'Missing required parameters: lat, lon, zoom' });
            }

            const latNum = Number(lat);
            const lonNum = Number(lon);
            const zoomNum = Number(zoom);

            if (Number.isNaN(latNum) || Number.isNaN(lonNum) || Number.isNaN(zoomNum)) {
                return res.status(400).json({ error: 'Invalid coordinates or zoom' });
            }

            // Build OpenStreetMap static map URL
            const center = `${latNum},${lonNum}`;
            const markerParam = `${latNum},${lonNum},red-pushpin`;
            const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=${zoomNum}&size=${width}x${height}&markers=${markerParam}`;

            // Fetch the image from OpenStreetMap
            https.get(osmUrl, (osmRes) => {
                // Set proper headers for Discord embed
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
                
                // Pipe the image data to the response
                osmRes.pipe(res);
            }).on('error', (error) => {
                console.error('Error fetching map from OpenStreetMap:', error);
                res.status(500).json({ error: 'Failed to fetch map image' });
            });
        } catch (error) {
            console.error('Error in map proxy:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Helper function to verify Supabase JWT
    async function verifySupabaseAuth(authHeader) {
        if (!supabase) {
            return null;
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.substring(7);
        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) {
                return null;
            }
            return user;
        } catch (error) {
            console.error('Supabase auth error:', error);
            return null;
        }
    }

    // API endpoint for Supabase-authenticated requests (for your website)
    app.post('/api/announce', async (req, res) => {
        try {
            const { title, message, color, channelId } = req.body;
            const authHeader = req.headers.authorization;

            // Try Supabase authentication first
            let user = null;
            if (supabase) {
                user = await verifySupabaseAuth(authHeader);
            }

            // Fallback to password authentication if Supabase is not configured or auth fails
            if (!user) {
                const { password } = req.body;
                if (password !== ADMIN_PASSWORD) {
                    return res.status(401).json({ error: 'Invalid authentication' });
                }
            }

            // Validate required fields
            if (!title || !message) {
                return res.status(400).json({ error: 'Title and message are required' });
            }

            // Use provided channelId or fallback to default
            const targetChannelId = channelId || ANNOUNCEMENT_CHANNEL_ID;
            if (!targetChannelId) {
                return res.status(400).json({ error: 'Channel ID is required (either in request or ANNOUNCEMENT_CHANNEL_ID env var)' });
            }

            // Send announcement using the service
            await announcementService.sendAnnouncement(targetChannelId, title, message, color);

            const authMethod = user ? 'Supabase' : 'Password';
            console.log(`Announcement sent: "${title}" by ${authMethod} auth`);
            res.json({ success: true, message: 'Announcement sent successfully' });
        } catch (error) {
            console.error('Error sending announcement:', error);
            res.status(500).json({ error: 'Failed to send announcement: ' + error.message });
        }
    });

    app.listen(PORT, () => {
        // Set the map proxy base URL for use in buildFlightMapUrl
        MAP_PROXY_BASE_URL = process.env.MAP_PROXY_BASE_URL || `http://localhost:${PORT}`;
        
        console.log(`API server running on http://localhost:${PORT}`);
        console.log(`🗺️ Map proxy endpoint available at: ${MAP_PROXY_BASE_URL}/api/map`);
        if (supabase) {
            console.log(`Supabase integration enabled - API ready for website integration`);
        }
    });
}

// Login to Discord with your client's token
// Check if we're in a build environment (Cloudflare, Vercel, etc.)
const isBuildEnv = process.env.CI || process.env.CF_PAGES || process.env.VERCEL || process.env.NETLIFY || process.env.CF_PAGES_BRANCH;

// If this is a Cloudflare build, don't start the bot - the worker.js handles API requests
if (isBuildEnv) {
    console.log('Build environment detected - skipping Discord bot startup');
    console.log('For Cloudflare Workers, use worker.js instead of index.js');
    // Exit successfully so build doesn't fail
    process.exit(0);
}

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('ERROR: DISCORD_TOKEN is not set!');
    console.error('Please set DISCORD_TOKEN in your environment variables.');
    console.error('For local development: Add it to your .env file');
    process.exit(1);
}

// Only attempt login if we have a token and we're not just building
client.login(token).catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
});
