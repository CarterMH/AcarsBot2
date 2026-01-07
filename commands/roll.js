const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll a dice (1-100)')
        .addIntegerOption(option =>
            option.setName('max')
                .setDescription('Maximum number (default: 100)')
                .setMinValue(1)
                .setMaxValue(1000)
                .setRequired(false)),
    async execute(interaction) {
        const max = interaction.options.getInteger('max') || 100;
        const result = Math.floor(Math.random() * max) + 1;
        
        await interaction.reply(`🎲 You rolled a **${result}** (1-${max})`);
    },
};
