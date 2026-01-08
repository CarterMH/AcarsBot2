#!/bin/sh
set -e

echo "Deploying Discord slash commands..."
if node deploy-commands.js; then
    echo "✅ Commands deployed successfully!"
else
    echo "⚠️ Warning: Command deployment had issues, but continuing..."
fi

echo "Starting Discord bot..."
exec npm start
