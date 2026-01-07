const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('What should the bot say?')
                .setRequired(true)),
    async execute(interaction) {
        const message = interaction.options.getString('message');
        
        await interaction.reply(message);
    },
};
