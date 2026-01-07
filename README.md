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
   ```
   
   - **DISCORD_TOKEN**: Your bot's token (from Bot section)
   - **CLIENT_ID**: Your application's Client ID (from General Information)
   - **GUILD_ID**: (Optional) Your Discord server ID for faster command updates

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

## Notes

- Make sure your bot has the necessary permissions in your Discord server
- The bot uses Discord.js v14 with slash commands
- Commands are automatically loaded from the `commands/` directory
