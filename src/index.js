require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
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
const { checkServerConfig } = require('./utils/ticket');
const { handleMessageCreate } = require('./handlers/events');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
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

        // When the client is ready, run this code (only once)
        client.once(Events.ClientReady, async () => {
            console.log(`Logged in as ${client.user.tag}!`);
            
            // Check environment variables
            await checkEnvironmentVariables();
            
            // Check configurations for all guilds
            for (const guild of client.guilds.cache.values()) {
                await checkServerConfig(guild);
            }
        });

        // Handle guild join
        client.on(Events.GuildCreate, async (guild) => {
            await checkServerConfig(guild);
        });

        // Handle interactions
        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isCommand()) return;

            const { commandName } = interaction;

            try {
                switch (commandName) {
                    case 'invoice':
                        await handleInvoiceCommand(interaction);
                        break;
                    case 'ticket':
                        await handleTicketEmbed(interaction);
                        break;
                    case 'config':
                        const subcommand = interaction.options.getSubcommand();
                        switch (subcommand) {
                            case 'staff':
                                await handleTicketConfig(interaction);
                                break;
                            case 'category':
                                await handleCategoryConfig(interaction);
                                break;
                            case 'transcript':
                                await handleTranscriptConfig(interaction);
                                break;
                            case 'reset':
                                await handleConfigReset(interaction);
                                break;
                        }
                        break;
                    case 'check':
                        await handleInvoiceCommand(interaction);
                        break;
                }
            } catch (error) {
                console.error('Error handling command:', error);
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                });
            }
        });

        // Handle button interactions
        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;

            try {
                switch (interaction.customId) {
                    case 'create_ticket':
                        await handleTicketCreation(interaction);
                        break;
                    case 'close_ticket':
                        await handleTicketClose(interaction);
                        break;
                }
            } catch (error) {
                console.error('Error handling button interaction:', error);
                await interaction.reply({
                    content: 'There was an error while processing your request!',
                    ephemeral: true
                });
            }
        });

        // Handle messages
        client.on(Events.MessageCreate, handleMessageCreate);
    } catch (error) {
        console.error('Error starting bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot(); 