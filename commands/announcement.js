const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const AnnouncementService = require('../services/announcementService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announcement')
        .setDescription('Send an announcement to a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the announcement')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The announcement message')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color for the announcement (select from list or enter hex code) - optional, defaults to Discord blurple')
                .setRequired(false)
                .setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        // Check if user has permission to manage messages
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({ 
                content: '❌ You do not have permission to use this command. You need the "Manage Messages" permission.', 
                ephemeral: true 
            });
        }

        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const message = interaction.options.getString('message');
        const colorOption = interaction.options.getString('color');

        // Validate channel
        if (!channel) {
            return await interaction.reply({ 
                content: '❌ Invalid channel specified.', 
                ephemeral: true 
            });
        }

        // Check if bot has permission to send messages in the channel
        if (!channel.permissionsFor(interaction.client.user).has(PermissionFlagsBits.SendMessages)) {
            return await interaction.reply({ 
                content: `❌ I don't have permission to send messages in ${channel}.`, 
                ephemeral: true 
            });
        }

        // Defer the reply since sending the announcement might take a moment
        await interaction.deferReply({ ephemeral: true });

        try {
            // Create announcement service instance
            const announcementService = new AnnouncementService(interaction.client);

            // Parse color if provided
            let color = '0x5865F2'; // Default Discord blurple
            if (colorOption) {
                // Remove # if present and add 0x prefix if not present
                let colorHex = colorOption.replace('#', '');
                if (!colorHex.startsWith('0x')) {
                    colorHex = '0x' + colorHex;
                }
                color = colorHex;
            }

            // Send the announcement
            await announcementService.sendAnnouncement(channel.id, title, message, color);

            await interaction.editReply({ 
                content: `✅ Announcement sent to ${channel}!` 
            });
        } catch (error) {
            console.error('Error in announcement command:', error);
            await interaction.editReply({ 
                content: `❌ Failed to send announcement: ${error.message}` 
            });
        }
    },
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'color') {
            const colors = [
                { name: '🔵 Discord Blurple', value: '5865F2' },
                { name: '🟢 Green', value: '57F287' },
                { name: '🔴 Red', value: 'ED4245' },
                { name: '🟡 Yellow', value: 'FEE75C' },
                { name: '🟣 Purple', value: 'EB459E' },
                { name: '⚫ White', value: 'FFFFFF' },
                { name: '⚪ Light Gray', value: 'B9BBBE' },
                { name: '🔵 Blue', value: '3498DB' },
                { name: '🟠 Orange', value: 'E67E22' },
                { name: '🔵 Cyan', value: '1ABC9C' },
                { name: '🟢 Lime', value: '2ECC71' },
                { name: '🔴 Dark Red', value: 'C0392B' },
                { name: '🟣 Pink', value: 'E91E63' },
                { name: '🟡 Gold', value: 'F1C40F' },
                { name: '🔵 Navy', value: '34495E' },
                { name: '🟢 Emerald', value: '10B981' },
                { name: '🔴 Crimson', value: 'DC143C' },
                { name: '🟣 Lavender', value: '9B59B6' },
                { name: '🟡 Amber', value: 'FFBF00' },
                { name: '🔵 Sky Blue', value: '87CEEB' },
                { name: '🟢 Mint', value: '98FB98' },
                { name: '🔴 Rose', value: 'FF69B4' },
                { name: '🟣 Magenta', value: 'FF00FF' },
                { name: '⚫ Black', value: '000000' },
                { name: '⚪ Silver', value: 'C0C0C0' },
            ];

            const searchTerm = focusedOption.value.toLowerCase();
            let filtered = colors.filter(color => 
                color.name.toLowerCase().includes(searchTerm) ||
                color.value.toLowerCase().includes(searchTerm)
            );

            // If user is typing a hex code, try to match it or add it as an option
            if (searchTerm && /^[0-9a-f]{0,6}$/i.test(searchTerm)) {
                // Check if it's a valid hex code that's not already in the list
                const isCustomHex = !colors.some(c => c.value.toLowerCase() === searchTerm);
                if (isCustomHex && searchTerm.length >= 3) {
                    filtered.unshift({ name: `🎨 Custom: #${searchTerm.toUpperCase()}`, value: searchTerm.toUpperCase() });
                }
            }

            // Limit to 25 options (Discord's limit)
            filtered = filtered.slice(0, 25);

            await interaction.respond(
                filtered.map(color => ({ name: color.name, value: color.value }))
            );
        }
    },
};
