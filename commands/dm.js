const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message to a user (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to send a DM to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Check if user has administrator permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ You do not have permission to use this command. You need Administrator permissions.', 
                ephemeral: true 
            });
        }

        const targetUser = interaction.options.getUser('user');
        const message = interaction.options.getString('message');

        // Validate user
        if (!targetUser) {
            return await interaction.reply({ 
                content: '❌ Invalid user specified.', 
                ephemeral: true 
            });
        }

        // Check if trying to DM a bot
        if (targetUser.bot) {
            return await interaction.reply({ 
                content: '❌ Cannot send DMs to bots.', 
                ephemeral: true 
            });
        }

        // Defer the reply since sending the DM might take a moment
        await interaction.deferReply({ ephemeral: true });

        try {
            // Try to send the DM
            await targetUser.send(message);

            await interaction.editReply({ 
                content: `✅ Successfully sent DM to ${targetUser.tag} (${targetUser.id})` 
            });

            // Log the action
            console.log(`DM sent by ${interaction.user.tag} (${interaction.user.id}) to ${targetUser.tag} (${targetUser.id}): ${message}`);
        } catch (error) {
            console.error('Error sending DM:', error);
            
            // Common error: User has DMs disabled
            if (error.code === 50007) {
                await interaction.editReply({ 
                    content: `❌ Cannot send DM to ${targetUser.tag}. They may have DMs disabled or the bot blocked.` 
                });
            } else {
                await interaction.editReply({ 
                    content: `❌ Failed to send DM: ${error.message}` 
                });
            }
        }
    },
};
