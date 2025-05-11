const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

/**
 * Validates all required environment variables and API credentials
 * @returns {Promise<{isValid: boolean, errors: string[]}>}
 */
async function validateEnvironment() {
    const errors = [];
    const requiredEnvVars = [
        'DISCORD_TOKEN',
        'CLIENT_ID',
        'SELLAUTH_API_KEY',
        'SHOP_ID'
    ];

    // Check if all required environment variables exist
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            errors.push(`Missing required environment variable: ${envVar}`);
        }
    }

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    try {
        // Validate Discord token
        const discordClient = new Client({
            intents: [GatewayIntentBits.Guilds]
        });

        try {
            await discordClient.login(process.env.DISCORD_TOKEN);
            await discordClient.destroy();
        } catch (error) {
            errors.push('Invalid Discord token');
        }

        // Validate SellAuth API credentials
        try {
            const response = await axios.get('https://api.sellauth.com/v1/shop', {
                headers: {
                    'Authorization': `Bearer ${process.env.SELLAUTH_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            // Check if the shop ID matches
            if (response.data.id !== process.env.SHOP_ID) {
                errors.push('Invalid Shop ID');
            }
        } catch (error) {
            if (error.response?.status === 401) {
                errors.push('Invalid SellAuth API key');
            } else {
                errors.push('Failed to validate SellAuth credentials');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    } catch (error) {
        errors.push('Unexpected error during validation');
        return { isValid: false, errors };
    }
}

module.exports = {
    validateEnvironment
}; 