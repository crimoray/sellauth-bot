const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

// Optimize the invoice lookup by adding caching
const invoiceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function checkInvoice(invoiceId) {
    const cached = invoiceCache.get(invoiceId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    const response = await axios.get(
        `https://api.sellauth.com/v1/shops/${process.env.SHOP_ID}/invoices/${invoiceId}`,
        {
            headers: {
                'Authorization': `Bearer ${process.env.SELLAUTH_API_KEY}`,
                'Accept': 'application/json'
            }
        }
    );

    const data = response.data;
    invoiceCache.set(invoiceId, {
        data,
        timestamp: Date.now()
    });

    return data;
}

// Function to check a specific invoice status
async function checkInvoiceStatus(invoiceId) {
    try {
        const response = await axios.get(
            `https://api.sellauth.com/v1/shops/${process.env.SHOP_ID}/invoices/${invoiceId}`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.SELLAUTH_API_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );
        
        // Log the structure of the invoice data for debugging
        console.log('Invoice data structure:', JSON.stringify(response.data, null, 2));
        
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // Invoice not found
        }
        throw new Error(`Failed to check invoice: ${error.message}`);
    }
}

// Function to create invoice embed message
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
    
    // Extract product name from invoice data
    let productName = 'Unknown';
    if (invoice.product) {
        productName = invoice.product.name || invoice.product.title || invoice.product;
    } else if (invoice.product_id && invoice.product_name) {
        productName = invoice.product_name;
    } else if (invoice.items && invoice.items.length > 0 && invoice.items[0].product) {
        productName = invoice.items[0].product.name || invoice.items[0].product.title || invoice.items[0].product;
    } else if (invoice.product_id) {
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

    if (invoice.completed_at) {
        embed.addFields({
            name: 'Completed At',
            value: new Date(invoice.completed_at).toLocaleString(),
            inline: true
        });
    }
    
    return embed;
}

module.exports = {
    checkInvoice,
    checkInvoiceStatus,
    createInvoiceEmbed
}; 