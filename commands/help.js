const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('ACARS Bot Commands')
            .setDescription('Here are all the available commands:')
            .addFields(
                { name: '/ping', value: 'Check if the bot is responsive', inline: true },
                { name: '/help', value: 'Show this help message', inline: true },
                { name: '/serverinfo', value: 'Get information about this server', inline: true },
                { name: '/userinfo', value: 'Get information about a user', inline: true },
                { name: '/roll', value: 'Roll a dice (1-100)', inline: true },
                { name: '/flip', value: 'Flip a coin', inline: true },
                { name: '/8ball', value: 'Ask the magic 8-ball a question', inline: true },
                { name: '/say', value: 'Make the bot say something', inline: true },
                { name: '/avatar', value: 'Get a user\'s avatar', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'ACARS Bot' });

        await interaction.reply({ embeds: [embed] });
    },
};
