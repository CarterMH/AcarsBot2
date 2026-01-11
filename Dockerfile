# Use Node.js LTS version (Debian-based for native module support)
FROM node:20-slim

# Install build dependencies, opus libraries, libsodium (runtime), and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libopus-dev \
    libsodium-dev \
    libsodium23 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install ALL dependencies first (needed for native module compilation)
# Then we can prune dev dependencies if needed, but @discordjs/opus needs to compile properly
RUN npm install --no-package-lock && \
    npm list @discordjs/opus && \
    node -e "const opus = require('@discordjs/opus'); console.log('Opus loaded:', typeof opus); console.log('Opus version check passed');"

# Copy application files
COPY . .

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Create a non-root user for security
RUN groupadd -r -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port the app runs on
EXPOSE 3000

# Health check to ensure the bot is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r ? 0 : 1)}).on('error', () => process.exit(1))"

# Use entrypoint script to deploy commands then start bot
ENTRYPOINT ["./docker-entrypoint.sh"]
