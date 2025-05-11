require('dotenv').config();
const fs = require('fs').promises;
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to prompt for input
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Function to check and get environment variables
async function checkEnvironmentVariables() {
    const envVars = {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        SELLAUTH_API_KEY: process.env.SELLAUTH_API_KEY,
        SHOP_ID: process.env.SHOP_ID
    };

    const missingVars = [];
    for (const [key, value] of Object.entries(envVars)) {
        if (!value) {
            missingVars.push(key);
        }
    }

    if (missingVars.length > 0) {
        console.log('Missing environment variables detected. Please provide the following:');
        
        for (const varName of missingVars) {
            let question = `Enter your ${varName}: `;
            if (varName === 'DISCORD_TOKEN') {
                question = 'Enter your Discord Bot Token: ';
            } else if (varName === 'CLIENT_ID') {
                question = 'Enter your Discord Application Client ID: ';
            } else if (varName === 'SELLAUTH_API_KEY') {
                question = 'Enter your Sellauth API Key: ';
            } else if (varName === 'SHOP_ID') {
                question = 'Enter your Sellauth Shop ID: ';
            }
            
            const value = await prompt(question);
            process.env[varName] = value;
        }

        // Save to .env file
        try {
            let envContent = '';
            for (const [key, value] of Object.entries(process.env)) {
                if (['DISCORD_TOKEN', 'CLIENT_ID', 'SELLAUTH_API_KEY', 'SHOP_ID'].includes(key)) {
                    envContent += `${key}=${value}\n`;
                }
            }
            await fs.writeFile('.env', envContent);
            console.log('Environment variables have been saved to .env file');
        } catch (error) {
            console.error('Error saving to .env file:', error);
        }
    }

    rl.close();
}

// Store server configurations
let serverConfigs = new Map();

// Load configurations from file
async function loadConfigurations() {
    try {
        const data = await fs.readFile('config.json', 'utf8');
        const configs = JSON.parse(data);
        serverConfigs = new Map(Object.entries(configs));
        console.log('Configurations loaded successfully');
    } catch (error) {
        console.log('No existing configurations found, starting fresh');
        serverConfigs = new Map();
    }
}

// Save configurations to file
async function saveConfigurations() {
    try {
        const configs = Object.fromEntries(serverConfigs);
        await fs.writeFile('config.json', JSON.stringify(configs, null, 2));
        console.log('Configurations saved successfully');
    } catch (error) {
        console.error('Error saving configurations:', error);
    }
}

module.exports = {
    checkEnvironmentVariables,
    loadConfigurations,
    saveConfigurations,
    serverConfigs
}; 