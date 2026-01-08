const { EmbedBuilder } = require('discord.js');

/**
 * Service for sending inspirational quotes
 */
class QuoteService {
    constructor(client) {
        this.client = client;
        this.quotes = [
            "The only way to do great work is to love what you do. - Steve Jobs",
            "Innovation distinguishes between a leader and a follower. - Steve Jobs",
            "Life is what happens to you while you're busy making other plans. - John Lennon",
            "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
            "It is during our darkest moments that we must focus to see the light. - Aristotle",
            "The way to get started is to quit talking and begin doing. - Walt Disney",
            "Don't let yesterday take up too much of today. - Will Rogers",
            "You learn more from failure than from success. Don't let it stop you. Failure builds character. - Unknown",
            "If you are working on something exciting that you really care about, you don't have to be pushed. The vision pulls you. - Steve Jobs",
            "People who are crazy enough to think they can change the world, are the ones who do. - Rob Siltanen",
            "We may encounter many defeats but we must not be defeated. - Maya Angelou",
            "The only impossible journey is the one you never begin. - Tony Robbins",
            "In this life we cannot do great things. We can only do small things with great love. - Mother Teresa",
            "What lies behind us and what lies before us are tiny matters compared to what lies within us. - Ralph Waldo Emerson",
            "It is never too late to be what you might have been. - George Eliot",
            "Do what you can, with what you have, where you are. - Theodore Roosevelt",
            "The best time to plant a tree was 20 years ago. The second best time is now. - Chinese Proverb",
            "An unexamined life is not worth living. - Socrates",
            "Happiness is not something readymade. It comes from your own actions. - Dalai Lama",
            "If you want to lift yourself up, lift up someone else. - Booker T. Washington",
            "I attribute my success to this: I never gave or took any excuse. - Florence Nightingale",
            "Dream big and dare to fail. - Norman Vaughan",
            "We become what we think about. - Earl Nightingale",
            "People say nothing is impossible, but I do nothing every day. - Winnie the Pooh",
            "Everything you've ever wanted is on the other side of fear. - George Addair",
            "You miss 100% of the shots you don't take. - Wayne Gretzky",
            "Whether you think you can or you think you can't, you're right. - Henry Ford",
            "The only person you are destined to become is the person you decide to be. - Ralph Waldo Emerson",
            "Go confidently in the direction of your dreams. Live the life you have imagined. - Henry David Thoreau",
            "When one door of happiness closes, another opens, but often we look so long at the closed door that we do not see the one which has been opened for us. - Helen Keller",
            "Great minds discuss ideas; average minds discuss events; small minds discuss people. - Eleanor Roosevelt",
            "Those who dare to fail miserably can achieve greatly. - John F. Kennedy",
            "Believe you can and you're halfway there. - Theodore Roosevelt",
            "I can't change the direction of the wind, but I can adjust my sails to always reach my destination. - Jimmy Dean",
            "Nothing will work unless you do. - Maya Angelou",
            "The most difficult thing is the decision to act, the rest is merely tenacity. - Amelia Earhart",
            "Either you run the day, or the day runs you. - Jim Rohn",
            "Knowledge is power. Information is liberating. Education is the premise of progress, in every society, in every family. - Kofi Annan",
            "I find that the harder I work, the more luck I seem to have. - Thomas Jefferson",
            "The two most important days in your life are the day you are born and the day you find out why. - Mark Twain"
        ];
    }

    /**
     * Get a random inspirational quote
     * @returns {string} A random quote
     */
    getRandomQuote() {
        return this.quotes[Math.floor(Math.random() * this.quotes.length)];
    }

    /**
     * Send an inspirational quote to a user via DM
     * @param {string} userId - The Discord user ID
     * @returns {Promise<Object>} The sent message
     */
    async sendQuote(userId) {
        const quote = this.getRandomQuote();
        const [quoteText, author] = quote.split(' - ');

        // Get the user - try cache first, then fetch if not found
        let user = this.client.users.cache.get(userId);
        if (!user) {
            try {
                user = await this.client.users.fetch(userId);
                console.log(`Fetched user ${userId} from Discord API`);
            } catch (fetchError) {
                throw new Error(`User with ID ${userId} not found or not accessible: ${fetchError.message}`);
            }
        }

        // Check if trying to DM a bot
        if (user.bot) {
            throw new Error(`Cannot send DMs to bots`);
        }

        // Create embed with styled quote
        const embed = new EmbedBuilder()
            .setTitle('💡 Daily Inspiration')
            .setDescription(`"${quoteText}"`)
            .setColor(0x5865F2) // Discord blurple
            .setFooter({ text: author || 'Unknown' })
            .setTimestamp();

        // Send the quote via DM
        try {
            const sentMessage = await user.send({ embeds: [embed] });
            console.log(`✅ Inspirational quote sent to user ${userId} (${user.tag || 'Unknown'})`);
            return sentMessage;
        } catch (sendError) {
            // Common error: User has DMs disabled
            if (sendError.code === 50007) {
                throw new Error(`Cannot send DM to ${user.tag}. They may have DMs disabled or the bot blocked.`);
            }
            console.error(`Failed to send quote to user ${userId}:`, sendError);
            throw new Error(`Failed to send DM: ${sendError.message}`);
        }
    }
}

module.exports = QuoteService;
