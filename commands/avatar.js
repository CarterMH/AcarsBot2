const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Get a user\'s avatar')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose avatar you want to see')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 512 });
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${user.username}'s Avatar`)
            .setImage(avatarURL)
            .setTimestamp()
            .setFooter({ text: 'ACARS Bot' });
        
        await interaction.reply({ embeds: [embed] });
    },
};
