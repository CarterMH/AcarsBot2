const { EmbedBuilder } = require('discord.js');

/**
 * Service for sending Discord announcements
 */
class AnnouncementService {
    constructor(client) {
        this.client = client;
    }

    /**
     * Send an announcement to a Discord channel
     * @param {string} channelId - The Discord channel ID
     * @param {string} title - The announcement title
     * @param {string} message - The announcement message
     * @param {string|number} color - The embed color (hex string like "0x5865F2" or number)
     * @returns {Promise<Object>} The sent message
     */
    async sendAnnouncement(channelId, title, message, color = '0x5865F2') {
        // Validate channel ID
        if (!channelId) {
            throw new Error('Channel ID is required');
        }

        // Get the channel
        const channel = this.client.channels.cache.get(channelId);
        if (!channel) {
            throw new Error(`Channel with ID ${channelId} not found`);
        }

        // Validate required fields
        if (!title || !message) {
            throw new Error('Title and message are required');
        }

        // Parse color (handle both 0x and # formats)
        let embedColor = parseInt(color || '0x5865F2', 16);
        if (isNaN(embedColor)) {
            embedColor = 0x5865F2; // Default Discord blurple
        }

        // Create embed with styled announcement
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(embedColor)
            .setTimestamp()
            .setFooter({ text: 'ACARS Bot Announcement' });

        // Send the announcement
        const sentMessage = await channel.send({ embeds: [embed] });

        console.log(`Announcement sent: "${title}" to channel ${channelId}`);
        return sentMessage;
    }
}

module.exports = AnnouncementService;
