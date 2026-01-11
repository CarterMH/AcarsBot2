const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Use system ffmpeg (installed via Alpine package manager)
const ffmpegPath = 'ffmpeg';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Join a voice channel and play an MP3 file')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel to join')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice))
        .addStringOption(option =>
            option.setName('file')
                .setDescription('Path to the MP3 file (optional, defaults to Johncena.mp3)')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.options.getChannel('channel');
        const filePath = interaction.options.getString('file') || 'Johncena.mp3';

        // Resolve file path (relative to bot directory if relative, absolute if absolute)
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
            return await interaction.editReply(`❌ Error: File not found at \`${filePath}\``);
        }

        // Check if file is an MP3
        if (!resolvedPath.toLowerCase().endsWith('.mp3')) {
            return await interaction.editReply('❌ Error: File must be an MP3 file');
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

            // Create audio resource using FFmpeg to convert MP3 to Opus
            const resource = createAudioResource(
                spawn(ffmpegPath, [
                    '-i', resolvedPath,
                    '-f', 'opus',
                    '-ar', '48000',
                    '-ac', '2',
                    'pipe:1'
                ], { stdio: ['ignore', 'pipe', 'ignore'] }).stdout,
                {
                    inputType: 'opus',
                }
            );

            // Play the audio
            player.play(resource);

            // Handle when playback finishes
            player.on(AudioPlayerStatus.Idle, () => {
                // Disconnect from voice channel
                try {
                    connection.destroy();
                    interaction.editReply(`✅ Finished playing \`${path.basename(resolvedPath)}\` in ${channel.name} and left the channel.`).catch(err => console.error('Error editing reply:', err));
                } catch (error) {
                    console.error('Error in idle handler:', error);
                }
            });

            // Handle errors
            player.on('error', (error) => {
                console.error('Audio player error:', error);
                try {
                    connection.destroy();
                    interaction.editReply(`❌ Error playing audio: ${error.message}`).catch(err => console.error('Error editing reply:', err));
                } catch (err) {
                    console.error('Error in error handler:', err);
                }
            });

            // Handle connection errors
            connection.on('error', (error) => {
                console.error('Voice connection error:', error);
                try {
                    connection.destroy();
                    interaction.editReply(`❌ Connection error: ${error.message}`).catch(err => console.error('Error editing reply:', err));
                } catch (err) {
                    console.error('Error handling connection error:', err);
                }
            });

            connection.subscribe(player);

            await interaction.editReply(`🎵 Now playing \`${path.basename(resolvedPath)}\` in ${channel.name}...`);

        } catch (error) {
            console.error('Error in play command:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    },
};
