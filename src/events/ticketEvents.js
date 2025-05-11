const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { serverConfigs } = require('../config');
const { checkInvoiceStatus } = require('../services/sellauth');
const { createInvoiceEmbed, createErrorEmbed } = require('../utils/embeds');

// Store processed tickets to prevent duplicate processing
const processedTickets = new Set();

async function handleTicketCreation(interaction) {
    try {
        const guild = interaction.guild;
        const user = interaction.user;

        // Check if user already has an open ticket
        const existingTicket = guild.channels.cache.find(
            channel => channel.name === `ticket-${user.id}`
        );

        if (existingTicket) {
            return await interaction.reply({
                content: '❌ You already have an open ticket!',
                ephemeral: true
            });
        }

        // Get or create the configured category
        let category = null;
        const categoryId = serverConfigs.get(guild.id)?.ticketCategory;
        
        if (categoryId) {
            category = guild.channels.cache.get(categoryId);
        }
        
        if (!category) {
            // Create a new category if it doesn't exist
            category = await guild.channels.create({
                name: 'Tickets',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    }
                ]
            });
            
            // Store the new category ID in config
            if (!serverConfigs.has(guild.id)) {
                serverConfigs.set(guild.id, {});
            }
            serverConfigs.get(guild.id).ticketCategory = category.id;
            await saveConfigurations();
        }

        // Get the staff role
        const staffRoleId = serverConfigs.get(guild.id)?.staffRole;
        const staffRole = staffRoleId ? guild.roles.cache.get(staffRoleId) : null;

        // Create permission overwrites
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            }
        ];

        // Add staff role permissions if it exists
        if (staffRole) {
            permissionOverwrites.push({
                id: staffRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            });
        }

        // Create ticket channel
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.id}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: permissionOverwrites
        });

        const embed = createTicketEmbed();
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

        await ticketChannel.send({
            content: `${user} Welcome to your ticket! Please provide your invoice ID.`,
            embeds: [embed],
            components: [row]
        });

        // Try to reply to the interaction, but handle potential timeout
        try {
            await interaction.reply({
                content: `✅ Your ticket has been created: ${ticketChannel}`,
                ephemeral: true
            });
        } catch (error) {
            if (error.code === 10062) {
                // Interaction already timed out, send a follow-up message in the ticket channel
                await ticketChannel.send({
                    content: `${user} Your ticket has been created!`
                });
            } else {
                throw error; // Re-throw other errors
            }
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        try {
            await interaction.reply({
                content: '❌ An error occurred while creating your ticket. Please try again.',
                ephemeral: true
            });
        } catch (replyError) {
            if (replyError.code !== 10062) {
                console.error('Error sending error message:', replyError);
            }
        }
    }
}

async function handleTicketClose(interaction) {
    const channel = interaction.channel;
    
    if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({
            content: '❌ This command can only be used in ticket channels!',
            ephemeral: true
        });
    }

    // Clean up processed tickets when closing
    processedTickets.delete(channel.id);

    await interaction.reply('🔒 This ticket will be closed in 5 seconds...');
    
    // Generate and send transcript before closing
    await generateTranscript(channel);
    
    setTimeout(async () => {
        await channel.delete();
    }, 5000);
}

async function handleTicketMessage(message) {
    if (message.author.bot) return;
    if (!message.channel.name.startsWith('ticket-')) return;

    const ticketId = message.channel.id;
    
    // Skip if this ticket has already been processed
    if (processedTickets.has(ticketId)) {
        return;
    }

    const invoiceId = message.content.trim();
    
    try {
        console.log(`Making API request to check invoice: ${invoiceId}`);
        const invoiceData = await checkInvoiceStatus(invoiceId);

        if (!invoiceData) {
            const embed = createErrorEmbed(
                'Error',
                '❌ Invalid invoice ID. Please provide a valid invoice ID or contact staff for assistance.',
                [{ name: 'Invoice ID', value: invoiceId, inline: true }]
            );

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            return await message.reply({
                embeds: [embed],
                components: [row]
            });
        }

        // Mark this ticket as processed
        processedTickets.add(ticketId);

        const embed = createInvoiceEmbed(invoiceData);

        if (invoiceData.status.toLowerCase() === 'completed' || invoiceData.status.toLowerCase() === 'paid') {
            const staffRole = message.guild.roles.cache.get(serverConfigs.get(message.guild.id)?.staffRole);
            if (staffRole) {
                await message.reply({ content: staffRole.toString(), embeds: [embed] });
            } else {
                await message.reply({ embeds: [embed] });
            }
        } else if (invoiceData.status.toLowerCase() === 'pending') {
            embed.setDescription('Please complete the payment. If you need assistance, please mention a staff member.');
            await message.reply({ embeds: [embed] });
        } else {
            embed.setDescription('Please create a new invoice or contact staff for assistance.');
            await message.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error checking invoice:', error);
        console.error('Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers,
            url: error.config?.url
        });

        const embed = createErrorEmbed(
            'Error',
            '❌ Error checking invoice status',
            [{ name: 'Invoice ID', value: invoiceId, inline: true }]
        );

        if (error.response) {
            switch (error.response.status) {
                case 404:
                    embed.setDescription('❌ Invalid invoice ID. Please provide a valid invoice ID or contact staff for assistance.');
                    break;
                case 401:
                    embed.setDescription('❌ Authentication failed. Please contact staff for assistance.');
                    break;
                default:
                    embed.setDescription('❌ Error checking invoice. Please try again later or contact staff for assistance.');
            }
        }
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

        await message.reply({
            embeds: [embed],
            components: [row]
        });
    }
}

async function generateTranscript(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(msg => {
            const timestamp = new Date(msg.createdTimestamp).toLocaleString();
            return `[${timestamp}] ${msg.author.tag}: ${msg.content}`;
        }).join('\n');

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
    handleTicketCreation,
    handleTicketClose,
    handleTicketMessage
}; 