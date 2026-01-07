const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`User Info: ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 User ID', value: user.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'ACARS Bot' });

        if (member) {
            embed.addFields(
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎭 Roles', value: member.roles.cache.size > 1 ? `${member.roles.cache.size - 1}` : 'None', inline: true },
                { name: '👑 Highest Role', value: member.roles.highest.toString(), inline: true }
            );
        }

        await interaction.reply({ embeds: [embed] });
    },
};
