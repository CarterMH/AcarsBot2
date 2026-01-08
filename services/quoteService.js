const { EmbedBuilder } = require('discord.js');

/**
 * Service for sending inspirational quotes
 */
class QuoteService {
    constructor(client) {
        this.client = client;
        this.quotes = [
            "Don't crash into things. That's aviation rule number one. - George Washington",
            "The best way to land a plane is on the runway, not in a tree. Trust me on this. - Abraham Lincoln",
            "If you see a mountain, don't fly into it. Fly around it. Very important. - Theodore Roosevelt",
            "Always check your fuel before takeoff. Running out of gas mid-flight is considered bad form. - Franklin D. Roosevelt",
            "Birds can fly. Planes can fly. But if you mix them up, you're gonna have a bad time. - John F. Kennedy",
            "The ground is not your friend when you're supposed to be in the air. Stay up there. - Ronald Reagan",
            "Two wings are better than one. Three wings? That's just showing off. - George W. Bush",
            "If your plane is on fire, that's usually a sign something went wrong. - Barack Obama",
            "Always remember: up is good, down is bad, sideways is concerning. - Donald Trump",
            "The sky is the limit, but only if you remember to check your altitude. - Joe Biden",
            "Flying is 90% confidence and 10% not hitting things. - Dwight D. Eisenhower",
            "A good pilot knows when to land. A great pilot knows when NOT to land. - Harry S. Truman",
            "If you're upside down, you're probably doing it wrong. - Lyndon B. Johnson",
            "The runway is that long flat thing. Try to land on it, not next to it. - Richard Nixon",
            "Gravity is not a suggestion. It's a law. Plan accordingly. - Gerald Ford",
            "If your co-pilot is screaming, you might want to listen. - Jimmy Carter",
            "Flying backwards is impressive, but not recommended for commercial flights. - Bill Clinton",
            "The best landing is the one where everyone walks away. - George H.W. Bush",
            "If you see another plane coming at you, turn. Just turn. - Thomas Jefferson",
            "Altitude is your friend. The ground is not. Remember this. - James Madison",
            "A plane that's on fire is a plane that needs attention. Immediately. - Andrew Jackson",
            "The sky is big. Use all of it. Don't just use the part near the ground. - Ulysses S. Grant",
            "If your plane has more holes than it should, that's a problem. - Woodrow Wilson",
            "Flying is easy. Landing is the hard part. Try to do both. - Calvin Coolidge",
            "The best way to avoid a crash is to not crash. Revolutionary, I know. - Herbert Hoover",
            "If you're lost, ask for directions. Preferably before you run out of fuel. - John Adams",
            "A plane should have wings. This is not optional. - James Monroe",
            "The faster you go, the less time you have to make mistakes. Plan ahead. - William McKinley",
            "If you can't see where you're going, slow down. Or stop. Stopping is good too. - Warren G. Harding",
            "Flying is 10% skill and 90% not panicking when things go wrong. - William Howard Taft",
            "The best pilot is the one who lands safely. Everything else is just style points. - James K. Polk",
            "If your plane is making sounds it shouldn't make, that's your cue to land. - Martin Van Buren",
            "The sky is free. Use it wisely. Don't waste it by crashing. - John Quincy Adams",
            "A good landing is when you can use the plane again. A great landing is when you can use it immediately. - Andrew Johnson",
            "If you're not sure if you should fly, the answer is probably no. - Chester A. Arthur",
            "The ground will always be there. The sky won't wait for you. But still, don't rush. - Grover Cleveland",
            "Flying is like walking, but higher up and with more consequences. - Benjamin Harrison",
            "If you see a bird, don't try to race it. You'll lose. - William Henry Harrison",
            "The best way to learn to fly is to not crash on your first try. - Zachary Taylor",
            "Altitude is not a suggestion. It's a requirement. - Millard Fillmore"
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
