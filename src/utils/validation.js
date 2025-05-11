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

    console.log('[validateEnvironment] Checking required environment variables...');
    // Check if all required environment variables exist
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            errors.push(`Missing required environment variable: ${envVar}`);
        }
    }

    if (errors.length > 0) {
        console.log('[validateEnvironment] Missing environment variables:', errors);
        return { isValid: false, errors };
    }

    try {
        // Validate Discord token
        console.log('[validateEnvironment] Validating Discord token...');
        const discordClient = new Client({
            intents: [GatewayIntentBits.Guilds]
        });

        try {
            await discordClient.login(process.env.DISCORD_TOKEN);
            await discordClient.destroy();
            console.log('[validateEnvironment] Discord token is valid.');
        } catch (error) {
            console.log('[validateEnvironment] Invalid Discord token:', error.message);
            errors.push('Invalid Discord token');
        }

        // Validate SellAuth API credentials
        console.log('[validateEnvironment] Validating SellAuth API credentials...');
        try {
            const response = await axios.get(`https://api.sellauth.com/v1/shops/${process.env.SHOP_ID}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.SELLAUTH_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            // Skip shop ID validation
            console.log('[validateEnvironment] SellAuth API credentials are valid.');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('[validateEnvironment] Invalid SellAuth API key:', error.message);
                errors.push('Invalid SellAuth API key');
            } else {
                console.log('[validateEnvironment] Failed to validate SellAuth credentials:', error.message);
                errors.push('Failed to validate SellAuth credentials');
            }
        }

        console.log('[validateEnvironment] Validation complete. Errors:', errors);
        return {
            isValid: errors.length === 0,
            errors
        };
    } catch (error) {
        console.log('[validateEnvironment] Unexpected error during validation:', error.message);
        errors.push('Unexpected error during validation');
        return { isValid: false, errors };
    }
}

module.exports = {
    validateEnvironment
}; 