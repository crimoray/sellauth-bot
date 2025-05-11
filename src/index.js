require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { validateEnvironment } = require('./utils/validation');
const fs = require('fs');
const path = require('path');
const { checkEnvironmentVariables, loadConfigurations } = require('./config');
const { handleInvoiceCommand } = require('./commands/invoice');
const { 
    handleTicketEmbed, 
    handleTicketConfig, 
    handleCategoryConfig, 
    handleTranscriptConfig, 
    handleConfigReset 
} = require('./commands/ticket');
const { 
    handleTicketCreation, 
    handleTicketClose, 
    handleTicketMessage 
} = require('./events/ticketEvents');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize collections
client.commands = new Collection();
client.buttons = new Collection();

async function startBot() {
    try {
        // Validate environment variables and credentials
        console.log('Validating environment variables and credentials...');
        const validation = await validateEnvironment();
        
        if (!validation.isValid) {
            console.error('Validation failed:');
            validation.errors.forEach(error => console.error(`- ${error}`));
            process.exit(1);
        }
        
        console.log('All validations passed successfully!');

        // Load commands
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            client.commands.set(command.data.name, command);
        }

        // Load events
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }

        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('Error starting bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot(); 