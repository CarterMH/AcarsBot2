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
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ALLOWED_ORIGINS=http://localhost:5173,https://yourwebsite.com
   PORT=3000
   ```
   
   - **DISCORD_TOKEN**: Your bot's token (from Bot section)
   - **CLIENT_ID**: Your application's Client ID (from General Information)
   - **GUILD_ID**: (Optional) Your Discord server ID for faster command updates
   - **ADMIN_PASSWORD**: Password for fallback authentication (change from default!)
   - **ANNOUNCEMENT_CHANNEL_ID**: The Discord channel ID where announcements will be sent
   - **SUPABASE_URL**: Your Supabase project URL (for website integration)
   - **SUPABASE_ANON_KEY**: Your Supabase anon/public key (for website integration)
   - **ALLOWED_ORIGINS**: Comma-separated list of allowed CORS origins (your website URLs)
   - **PORT**: (Optional) Port for the web server (defaults to 3000)

**Note:** The `.env` file is gitignored for security. Never commit it to version control.

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

## Deployment

**⚠️ Important:** Discord bots **CANNOT** run on Cloudflare Workers or Cloudflare Pages because they require persistent WebSocket connections. Discord bots must run on platforms that support long-running processes.

### Recommended Deployment Platforms

#### Railway (Recommended)
1. Go to [Railway](https://railway.app)
2. Create a new project and connect your GitHub repo
3. Add environment variables in the **Variables** tab:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `ANNOUNCEMENT_CHANNEL_ID`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ALLOWED_ORIGINS`
   - `ADMIN_PASSWORD`
   - `PORT` (optional, defaults to 3000)
4. Railway will automatically detect Node.js and deploy

#### Render
1. Go to [Render](https://render.com)
2. Create a new **Web Service**
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables in the **Environment** section

#### Heroku
1. Go to [Heroku](https://heroku.com)
2. Create a new app
3. Connect your GitHub repo
4. Add environment variables via CLI or dashboard:
   ```bash
   heroku config:set DISCORD_TOKEN=your_token
   heroku config:set CLIENT_ID=your_client_id
   # ... etc
   ```

#### VPS (DigitalOcean, AWS EC2, etc.)
1. SSH into your server
2. Clone your repository
3. Install Node.js and npm
4. Create a `.env` file with your credentials
5. Install PM2: `npm install -g pm2`
6. Start the bot: `pm2 start index.js --name acars-bot`
7. Save PM2 config: `pm2 save`

### Environment Variables

For all platforms, you'll need to set these environment variables:

```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_bot_client_id
ANNOUNCEMENT_CHANNEL_ID=your_channel_id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
ALLOWED_ORIGINS=https://yourwebsite.com
ADMIN_PASSWORD=your_secure_password
PORT=3000
```

**Note:** The `.env` file is gitignored for security. Set environment variables in your deployment platform's dashboard.

## Website Integration

The bot provides a REST API endpoint that your website can call to send announcements.

### API Endpoint

**URL:** `POST /api/announce`

**Base URL:** Your bot server URL (e.g., `https://your-bot.railway.app` or your deployed URL)

### Authentication

The API supports Supabase JWT authentication. Send the Supabase session token in the Authorization header:

```javascript
// In your website code
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

const response = await fetch('https://your-bot-url/api/announce', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Announcement Title',
    message: 'Your announcement message here',
    color: '0x5865F2', // Optional: hex color code
    channelId: '123456789012345678' // Optional: specific channel ID
  })
});

const data = await response.json();
if (data.success) {
  console.log('Announcement sent!');
}
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | The announcement title |
| `message` | string | Yes | The announcement message/description |
| `color` | string | No | Hex color code (e.g., "0x5865F2"). Defaults to Discord blurple |
| `channelId` | string | No | Specific Discord channel ID. Uses `ANNOUNCEMENT_CHANNEL_ID` from env if not provided |

### Example: React Component

```jsx
import { useState } from 'react';
import { supabase } from './supabaseClient';

function AnnouncementForm() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const BOT_API_URL = 'https://your-bot-url'; // Your bot's API URL

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${BOT_API_URL}/api/announce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title, message })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      alert('Announcement sent!');
      setTitle('');
      setMessage('');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Announcement'}
      </button>
    </form>
  );
}
```

### CORS Configuration

Make sure to add your website URL to `ALLOWED_ORIGINS` in your environment variables:

```env
ALLOWED_ORIGINS=https://yourwebsite.com,https://www.yourwebsite.com
```

For Cloudflare, set this in the dashboard under Environment Variables.

## Notes

- Make sure your bot has the necessary permissions in your Discord server
- The bot uses Discord.js v14 with slash commands
- Commands are automatically loaded from the `commands/` directory
- The web server runs on port 3000 by default (configurable via `PORT` in `.env`)
- The `.env` file is gitignored - never commit it to version control
- For Cloudflare deployments, set all environment variables in the Cloudflare dashboard