const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Check how long the bot has been online'),
    async execute(interaction) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Bot Uptime')
            .setDescription(`ACARS has been online for **${uptimeString}**`)
            .setTimestamp()
            .setFooter({ text: 'ACARS Bot' });
        
        await interaction.reply({ embeds: [embed] });
    },
};
