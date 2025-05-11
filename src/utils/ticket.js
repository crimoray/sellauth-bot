const { EmbedBuilder } = require('discord.js');
const { serverConfigs } = require('./config');

// Add this at the top of initializeBot function, after serverConfigs declaration
const processedTickets = new Set();

async function checkServerConfig(guild) {
    const config = serverConfigs.get(guild.id) || {};
    const missingConfigs = [];

    if (!config.staffRole) missingConfigs.push('staff role');
    if (!config.ticketCategory) missingConfigs.push('ticket category');
    if (!config.transcriptChannel) missingConfigs.push('transcript channel');

    if (missingConfigs.length > 0) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Server Configuration Required')
            .setDescription(`Please configure the following settings using the commands below:\n\n${missingConfigs.map(setting => `• \`/config ${setting.split(' ')[0]}\` - Set ${setting}`).join('\n')}`)
            .setColor('#ff9900')
            .setTimestamp();

        // Try to find a channel to send the message
        const systemChannel = guild.systemChannel || guild.channels.cache.find(channel => 
            channel.type === ChannelType.GuildText && 
            channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
        );

        if (systemChannel) {
            await systemChannel.send({ embeds: [embed] });
        }
        return false;
    }
    return true;
}

async function generateTranscript(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        let transcript = '';
        
        // Process messages in chronological order
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        
        for (const msg of sortedMessages.values()) {
            const timestamp = new Date(msg.createdTimestamp).toLocaleString();
            let content = `[${timestamp}] ${msg.author.tag}: `;
            
            // Add message content
            if (msg.content) {
                content += msg.content;
            }
            
            // Add embeds
            if (msg.embeds && msg.embeds.length > 0) {
                content += '\n[Embeds:';
                msg.embeds.forEach((embed, index) => {
                    content += `\n  Embed ${index + 1}:`;
                    if (embed.title) content += `\n    Title: ${embed.title}`;
                    if (embed.description) content += `\n    Description: ${embed.description}`;
                    if (embed.fields && embed.fields.length > 0) {
                        content += '\n    Fields:';
                        embed.fields.forEach(field => {
                            content += `\n      ${field.name}: ${field.value}`;
                        });
                    }
                });
                content += '\n]';
            }
            
            transcript += content + '\n';
        }

        const transcriptEmbed = new EmbedBuilder()
            .setTitle(`Ticket Transcript - ${channel.name}`)
            .setDescription(`Transcript for ticket ${channel.name}`)
            .setColor('#0099ff')
            .setTimestamp();

        const transcriptChannel = channel.guild.channels.cache.get(
            serverConfigs.get(channel.guild.id)?.transcriptChannel
        );

        if (transcriptChannel) {
            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                files: [{
                    attachment: Buffer.from(transcript),
                    name: `transcript-${channel.name}.txt`
                }]
            });
        }
    } catch (error) {
        console.error('Error generating transcript:', error);
    }
}

module.exports = {
    processedTickets,
    checkServerConfig,
    generateTranscript
}; 