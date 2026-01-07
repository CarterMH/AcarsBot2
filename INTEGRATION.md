# Website Integration Guide

This guide shows how to integrate the Discord announcement API into your Supabase website.

## API Endpoint

**URL:** `POST /api/announce`

**Base URL:** Your bot server URL (e.g., `http://localhost:3000` or your deployed URL)

## Authentication

The API supports two authentication methods:

### 1. Supabase JWT (Recommended for website integration)

Send the Supabase session token in the Authorization header:

```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

const response = await fetch('http://your-bot-url/api/announce', {
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
```

### 2. Password Authentication (Fallback)

For testing or if Supabase is not configured:

```javascript
const response = await fetch('http://your-bot-url/api/announce', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    password: 'your-admin-password',
    title: 'Announcement Title',
    message: 'Your announcement message here',
    color: '0x5865F2', // Optional
    channelId: '123456789012345678' // Optional
  })
});
```

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | The announcement title |
| `message` | string | Yes | The announcement message/description |
| `color` | string | No | Hex color code (e.g., "0x5865F2"). Defaults to Discord blurple |
| `channelId` | string | No | Specific Discord channel ID. Uses `ANNOUNCEMENT_CHANNEL_ID` from env if not provided |
| `password` | string | Conditional | Required only if using password auth (no Supabase) |

## Response

### Success (200)
```json
{
  "success": true,
  "message": "Announcement sent successfully"
}
```

### Error (400/401/500)
```json
{
  "error": "Error message here"
}
```

## Example: React Component

```jsx
import { useState } from 'react';
import { supabase } from './supabaseClient';

function AnnouncementForm() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [color, setColor] = useState('0x5865F2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const BOT_API_URL = 'http://localhost:3000'; // Change to your bot URL

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Get Supabase session
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
        body: JSON.stringify({
          title,
          message,
          color
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send announcement');
      }

      setSuccess(true);
      setTitle('');
      setMessage('');
    } catch (err) {
      setError(err.message);
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
      <input
        type="text"
        placeholder="Color (0x5865F2)"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Announcement'}
      </button>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">Announcement sent!</div>}
    </form>
  );
}

export default AnnouncementForm;
```

## Environment Variables

Add these to your bot's `.env` file:

```env
# Supabase Configuration (for website integration)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,https://yourwebsite.com
# Or use '*' to allow all origins (not recommended for production)

# Discord Configuration
ANNOUNCEMENT_CHANNEL_ID=your_default_channel_id
ADMIN_PASSWORD=your_fallback_password
```

## Color Options

Common Discord embed colors:
- `0x5865F2` - Discord Blurple (default)
- `0x57F287` - Green
- `0xFEE75C` - Yellow
- `0xED4245` - Red
- `0xEB459E` - Pink
- `0xF37F20` - Orange
- `0x1ABC9C` - Teal
- `0x3498DB` - Blue

## CORS Configuration

The API supports CORS for cross-origin requests. Configure allowed origins in your `.env`:

```env
ALLOWED_ORIGINS=http://localhost:5173,https://yourwebsite.com
```

Or set to `*` to allow all origins (development only).
