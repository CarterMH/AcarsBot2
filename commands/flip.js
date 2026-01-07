const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Flip a coin'),
    async execute(interaction) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const emoji = result === 'Heads' ? '🪙' : '🪙';
        
        await interaction.reply(`${emoji} **${result}!**`);
    },
};
