export default {
  async fetch(request, env) {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only handle POST requests to /api/announce
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/announce') {
      try {
        const body = await request.json();
        const { title, message, color, channelId, password } = body;
        const authHeader = request.headers.get('Authorization');

        // Verify Supabase auth if configured
        let user = null;
        if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
          user = await verifySupabaseAuth(authHeader, env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
        }

        // Fallback to password auth
        if (!user) {
          if (password !== env.ADMIN_PASSWORD) {
            return jsonResponse({ error: 'Invalid authentication' }, 401);
          }
        }

        // Validate required fields
        if (!title || !message) {
          return jsonResponse({ error: 'Title and message are required' }, 400);
        }

        // Use provided channelId or fallback to default
        const targetChannelId = channelId || env.ANNOUNCEMENT_CHANNEL_ID;
        if (!targetChannelId) {
          return jsonResponse({ error: 'Channel ID is required' }, 400);
        }

        // Parse color
        let embedColor = parseInt(color || '0x5865F2', 16);
        if (isNaN(embedColor)) {
          embedColor = 0x5865F2;
        }

        // Create embed
        const embed = {
          title: title,
          description: message,
          color: embedColor,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'ACARS Bot Announcement'
          }
        };

        // Send to Discord via REST API
        const discordResponse = await fetch(
          `https://discord.com/api/v10/channels/${targetChannelId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${env.DISCORD_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              embeds: [embed]
            }),
          }
        );

        if (!discordResponse.ok) {
          const error = await discordResponse.text();
          return jsonResponse({ error: `Discord API error: ${error}` }, 500);
        }

        return jsonResponse({ success: true, message: 'Announcement sent successfully' });
      } catch (error) {
        return jsonResponse({ error: error.message }, 500);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

async function verifySupabaseAuth(authHeader, supabaseUrl, supabaseKey) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    return null;
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
