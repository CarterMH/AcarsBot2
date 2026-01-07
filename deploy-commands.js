const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Get client ID from environment or use guild-specific deployment
        const clientId = process.env.CLIENT_ID;
        
        if (!clientId) {
            console.error('ERROR: CLIENT_ID is not set in your .env file!');
            console.log('You can find your Client ID in the Discord Developer Portal under "General Information"');
            process.exit(1);
        }

        // For guild commands (faster, updates immediately)
        const guildId = process.env.GUILD_ID;
        
        if (guildId) {
            // Deploy to specific guild (updates immediately)
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands in guild ${guildId}.`);
        } else {
            // Deploy globally (can take up to 1 hour to update)
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
            console.log('Note: Global commands can take up to 1 hour to update in Discord.');
        }
    } catch (error) {
        console.error(error);
    }
})();
