const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const AnnouncementService = require('./services/announcementService');
require('dotenv').config();

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // Required for slash commands
        GatewayIntentBits.GuildMessages, // For sending messages
        // Add more intents below if needed:
        // GatewayIntentBits.MessageContent, // For reading message content (privileged - enable in Discord Developer Portal)
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

// Initialize announcement service (will be set when client is ready)
let announcementService = null;

// When the client is ready, run this code
client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    console.log(`ACARS bot is now online!`);
    
    // Set bot status
    client.user.setPresence({
        activities: [{
            name: 'COMPANY MSG',
            type: ActivityType.Watching
        }],
        status: 'online'
    });
    
    announcementService = new AnnouncementService(client);
    startWebServer();
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
        console.log(`API server running on http://localhost:${PORT}`);
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
