const axios = require('axios');

// Optimize the invoice lookup by adding caching
const invoiceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

module.exports = {
    checkInvoiceStatus,
    checkInvoice
}; 