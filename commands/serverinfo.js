const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get information about this server'),
    async execute(interaction) {
        const guild = interaction.guild;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Server Info: ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '🆔 Server ID', value: guild.id, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '📝 Channels', value: `${guild.channels.cache.size}`, inline: true },
                { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                { name: '✅ Verification Level', value: guild.verificationLevel.toString(), inline: true },
                { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '🚀 Boost Level', value: `${guild.premiumTier}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'ACARS Bot' });

        await interaction.reply({ embeds: [embed] });
    },
};
