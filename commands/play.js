const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Join a voice channel and play Johncena.mp3')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel to join')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)),
    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.options.getChannel('channel');
        const filePath = 'Johncena.mp3';

        // Resolve file path
        const resolvedPath = path.resolve(process.cwd(), filePath);

        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
            return await interaction.editReply(`❌ Error: File not found at \`${filePath}\``);
        }

        try {
            // Join the voice channel
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            // Create audio player
            const player = createAudioPlayer();

            // Create FFmpeg process to convert MP3 to Opus
            const ffmpegProcess = spawn('ffmpeg', [
                '-i', resolvedPath,
                '-f', 'opus',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1'
            ], {
                stdio: ['ignore', 'pipe', 'ignore']
            });

            // Create audio resource
            const resource = createAudioResource(ffmpegProcess.stdout, {
                inputType: 'opus',
            });

            // Play the audio
            player.play(resource);

            // Subscribe the connection to the player
            connection.subscribe(player);

            // Handle when playback finishes
            player.on(AudioPlayerStatus.Idle, () => {
                try {
                    connection.destroy();
                    interaction.editReply(`✅ Finished playing \`${filePath}\` in ${channel.name} and left the channel.`).catch(console.error);
                } catch (error) {
                    console.error('Error in idle handler:', error);
                }
            });

            // Handle player errors
            player.on('error', (error) => {
                console.error('Audio player error:', error);
                try {
                    connection.destroy();
                    interaction.editReply(`❌ Error playing audio: ${error.message}`).catch(console.error);
                } catch (err) {
                    console.error('Error in error handler:', err);
                }
            });

            // Handle connection errors
            connection.on('error', (error) => {
                console.error('Voice connection error:', error);
                try {
                    connection.destroy();
                    interaction.editReply(`❌ Connection error: ${error.message}`).catch(console.error);
                } catch (err) {
                    console.error('Error handling connection error:', err);
                }
            });

            await interaction.editReply(`🎵 Now playing \`${filePath}\` in ${channel.name}...`);

        } catch (error) {
            console.error('Error in play command:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    },
};
