const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { serverConfigs } = require('../utils/config');
const { checkInvoiceStatus, createInvoiceEmbed } = require('../utils/invoice');
const { processedTickets, checkServerConfig } = require('../utils/ticket');

async function handleMessageCreate(message) {
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
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setColor('#ff0000')
                .setDescription('❌ Invalid invoice ID. Please provide a valid invoice ID or contact staff for assistance.')
                .addFields(
                    { name: 'Invoice ID', value: invoiceId, inline: true }
                )
                .setTimestamp();

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

        const embed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ff0000')
            .setDescription('❌ Error checking invoice status')
            .addFields(
                { name: 'Invoice ID', value: invoiceId, inline: true }
            )
            .setTimestamp();

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

module.exports = {
    handleMessageCreate
}; 