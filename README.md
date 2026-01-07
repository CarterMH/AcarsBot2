# ACARS Discord Bot

A Discord bot built with Discord.js v14.

## Setup Instructions

### 1. Prerequisites
- Node.js (v16.9.0 or higher)
- npm or yarn
- A Discord application and bot token

### 2. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it "ACARS"
3. Go to the "Bot" section
4. Click "Add Bot" and confirm
5. Under "Token", click "Reset Token" and copy the token
6. **Optional**: Enable Privileged Gateway Intents (only if you need these features):
   - Message Content Intent (for reading message content)
   - Server Members Intent (for accessing member list)
   - Note: The bot works fine with just the default intents for slash commands
7. Go to "OAuth2" > "URL Generator"
8. Select scopes: `bot` and `applications.commands`
9. Select bot permissions as needed
10. Copy the generated URL and open it in your browser to invite the bot to your server

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

1. Create a `.env` file in the project root:
   ```bash
   touch .env
   ```

2. Open `.env` and add your Discord bot credentials:
   ```
   DISCORD_TOKEN=your_actual_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   GUILD_ID=your_server_id_here
   ADMIN_PASSWORD=your_secure_admin_password_here
   ANNOUNCEMENT_CHANNEL_ID=your_announcement_channel_id_here
   PORT=3000
   ```
   
   - **DISCORD_TOKEN**: Your bot's token (from Bot section)
   - **CLIENT_ID**: Your application's Client ID (from General Information)
   - **GUILD_ID**: (Optional) Your Discord server ID for faster command updates
   - **ADMIN_PASSWORD**: Password for accessing the admin panel (change from default!)
   - **ANNOUNCEMENT_CHANNEL_ID**: The Discord channel ID where announcements will be sent
   - **PORT**: (Optional) Port for the web server (defaults to 3000)

### 5. Deploy Slash Commands

Before running the bot, you need to register the slash commands with Discord:

```bash
npm run deploy-commands
```

This only needs to be run once, or whenever you add/modify commands.

### 6. Run the Bot

```bash
npm start
```

Or for development:
```bash
npm run dev
```

## Project Structure

```
discordbot/
├── commands/          # Slash command files
├── index.js          # Main bot file
├── package.json      # Dependencies and scripts
├── .env              # Environment variables (not in git)
├── .env.example      # Example environment file
└── README.md         # This file
```

## Adding Commands

Create new command files in the `commands/` directory. Each command should export:
- `data`: A SlashCommandBuilder object defining the command
- `execute`: An async function that handles the command execution

Example command structure:
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction) {
        await interaction.reply('Pong!');
    },
};
```

## Admin Panel

The bot includes a web-based admin panel for sending styled announcements to Discord.

### Accessing the Admin Panel

1. Start the bot (the web server starts automatically)
2. Open your browser and navigate to `http://localhost:3000` (or your configured PORT)
3. Enter your admin password (set in `.env` as `ADMIN_PASSWORD`)
4. Fill in the announcement title and message
5. Choose a color theme for the announcement
6. Click "Send Announcement"

### Features

- **Styled Embeds**: Announcements are sent as Discord embeds with:
  - Colored side bar (customizable color)
  - Styled text box with title and description
  - Timestamp and footer
- **Live Preview**: See how your announcement will look before sending
- **Color Themes**: Choose from 8 pre-defined color themes
- **Secure**: Password-protected admin panel

### Getting Your Channel ID

To get your announcement channel ID:
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on your announcement channel
3. Click "Copy ID"
4. Paste it into your `.env` file as `ANNOUNCEMENT_CHANNEL_ID`

### Bot Permissions

Make sure your bot has the following permissions in the announcement channel:
- Send Messages
- Embed Links

## Notes

- Make sure your bot has the necessary permissions in your Discord server
- The bot uses Discord.js v14 with slash commands
- Commands are automatically loaded from the `commands/` directory
- The web server runs on port 3000 by default (configurable via `PORT` in `.env`)