const { EmbedBuilder } = require('discord.js');

function createInvoiceEmbed(invoice) {
    let statusEmoji = '';
    let statusColor = 0; // Default Discord color
    
    switch (invoice.status.toLowerCase()) {
        case 'completed':
        case 'paid':
            statusEmoji = '✅';
            statusColor = 0x2ecc71; // Green
            break;
        case 'pending':
            statusEmoji = '⏳';
            statusColor = 0xf1c40f; // Yellow
            break;
        case 'cancelled':
        case 'failed':
            statusEmoji = '❌';
            statusColor = 0xe74c3c; // Red
            break;
        default:
            statusEmoji = '❓';
            statusColor = 0x95a5a6; // Gray
    }
    
    // Extract product name from invoice data - fixes the "Unknown" product issue
    let productName = 'Unknown';
    if (invoice.product) {
        // If product is directly available
        productName = invoice.product.name || invoice.product.title || invoice.product;
    } else if (invoice.product_id && invoice.product_name) {
        // If product_name is available
        productName = invoice.product_name;
    } else if (invoice.items && invoice.items.length > 0 && invoice.items[0].product) {
        // If product is in items array
        productName = invoice.items[0].product.name || invoice.items[0].product.title || invoice.items[0].product;
    } else if (invoice.product_id) {
        // Just show the product ID if nothing else is available
        productName = `Product ID: ${invoice.product_id}`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`Invoice ${invoice.id} Status`)
        .addFields(
            {
                name: 'Status',
                value: `${statusEmoji} ${invoice.status}`,
                inline: true
            },
            {
                name: 'Product',
                value: productName,
                inline: true
            },
            {
                name: 'Amount',
                value: `${invoice.price} ${invoice.currency}`,
                inline: true
            },
            {
                name: 'Created At',
                value: new Date(invoice.created_at).toLocaleString(),
                inline: true
            }
        )
        .setFooter({ text: 'SellAuth Invoice Checker' })
        .setTimestamp();

    // Add completed_at if it exists
    if (invoice.completed_at) {
        embed.addFields({
            name: 'Completed At',
            value: new Date(invoice.completed_at).toLocaleString(),
            inline: true
        });
    }
    
    return embed;
}

function createTicketEmbed() {
    return new EmbedBuilder()
        .setTitle('🎫 Support Ticket System')
        .setDescription('Click the button below to create a support ticket.')
        .setColor('#0099ff');
}

function createErrorEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#ff0000')
        .setDescription(description)
        .setTimestamp();

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

module.exports = {
    createInvoiceEmbed,
    createTicketEmbed,
    createErrorEmbed
}; 