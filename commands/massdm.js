const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('massdm')
        .setDescription('Send a direct message to multiple users (Admin only)')
        .addStringOption(option =>
            option.setName('users')
                .setDescription('User IDs or mentions (comma-separated, e.g., 123456789,987654321 or @user1,@user2)')
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

        const usersInput = interaction.options.getString('users');
        const message = interaction.options.getString('message');

        // Parse user IDs (remove mentions, commas, spaces)
        const userIds = usersInput
            .split(/[,,\s]+/)
            .map(id => id.replace(/[<@!>]/g, '').trim())
            .filter(id => id.length > 0);

        if (userIds.length === 0) {
            return await interaction.reply({ 
                content: '❌ No valid user IDs provided.', 
                ephemeral: true 
            });
        }

        // Defer the reply since sending DMs might take a while
        await interaction.deferReply({ ephemeral: true });

        const RESPONSE_CHANNEL_ID = '1458694568626356316'; // dm-responses channel
        const results = {
            success: [],
            failed: [],
            notFound: [],
            bots: []
        };

        // Process each user
        for (const userId of userIds) {
            try {
                // Fetch user (in case they're not in cache)
                const targetUser = await interaction.client.users.fetch(userId).catch(() => null);

                if (!targetUser) {
                    results.notFound.push(userId);
                    continue;
                }

                // Skip bots
                if (targetUser.bot) {
                    results.bots.push(targetUser.tag);
                    continue;
                }

                // Try to send the DM
                await targetUser.send(message);
                results.success.push({
                    tag: targetUser.tag,
                    id: targetUser.id
                });

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                // Try to get user tag for better error reporting
                let userTag = userId;
                try {
                    const user = await interaction.client.users.fetch(userId);
                    userTag = user.tag;
                } catch {}

                results.failed.push({
                    tag: userTag,
                    id: userId,
                    error: error.code === 50007 ? 'DMs disabled' : error.message
                });
            }
        }

        // Build summary message
        const total = userIds.length;
        const successful = results.success.length;
        const failedCount = results.failed.length;
        const notFoundCount = results.notFound.length;
        const botsCount = results.bots.length;

        let summary = `**Mass DM Summary**\n`;
        summary += `Total: ${total} | ✅ Success: ${successful} | ❌ Failed: ${failedCount}`;
        if (notFoundCount > 0) summary += ` | 🔍 Not Found: ${notFoundCount}`;
        if (botsCount > 0) summary += ` | 🤖 Bots Skipped: ${botsCount}`;

        // Add details if there are failures
        let details = '';
        if (results.failed.length > 0) {
            details += '\n\n**Failed DMs:**\n';
            results.failed.slice(0, 10).forEach(user => {
                details += `• ${user.tag} (${user.id}): ${user.error}\n`;
            });
            if (results.failed.length > 10) {
                details += `... and ${results.failed.length - 10} more\n`;
            }
        }

        if (results.notFound.length > 0) {
            details += '\n**Users Not Found:**\n';
            results.notFound.slice(0, 10).forEach(id => {
                details += `• ${id}\n`;
            });
            if (results.notFound.length > 10) {
                details += `... and ${results.notFound.length - 10} more\n`;
            }
        }

        await interaction.editReply({ 
            content: summary + details
        });

        // Send detailed response to dm-responses channel
        try {
            const responseChannel = interaction.client.channels.cache.get(RESPONSE_CHANNEL_ID);
            if (responseChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Mass DM Sent')
                    .setDescription(`**From:** ${interaction.user.tag} (${interaction.user.id})\n**Message:**\n${message}`)
                    .addFields(
                        { name: 'Total Users', value: total.toString(), inline: true },
                        { name: '✅ Successful', value: successful.toString(), inline: true },
                        { name: '❌ Failed', value: failedCount.toString(), inline: true }
                    )
                    .setColor(successful > 0 ? 0x57F287 : 0xED4245) // Green if any success, red if all failed
                    .setTimestamp()
                    .setFooter({ text: 'ACARS Bot Mass DM Log' });

                if (results.success.length > 0) {
                    const successList = results.success.slice(0, 10).map(u => `${u.tag} (${u.id})`).join('\n');
                    embed.addFields({ 
                        name: `Recipients (${results.success.length})`, 
                        value: successList.length > 1000 ? successList.substring(0, 1000) + '...' : successList,
                        inline: false 
                    });
                }

                if (failedCount > 0) {
                    const failedList = results.failed.slice(0, 5).map(u => `${u.tag}: ${u.error}`).join('\n');
                    embed.addFields({ 
                        name: 'Failures', 
                        value: failedList.length > 1000 ? failedList.substring(0, 1000) + '...' : failedList,
                        inline: false 
                    });
                }

                await responseChannel.send({ embeds: [embed] });
            }
        } catch (channelError) {
            console.error('Error sending response to dm-responses channel:', channelError);
        }

        // Log the action
        console.log(`Mass DM sent by ${interaction.user.tag} (${interaction.user.id}) to ${total} users. Success: ${successful}, Failed: ${failedCount}`);
    },
};
