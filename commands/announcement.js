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
                .setDescription('Color hex code (e.g., 5865F2) - optional, defaults to Discord blurple')
                .setRequired(false))
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
};
