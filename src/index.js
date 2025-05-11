const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
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

// Initialize bot
async function initializeBot() {
    await checkEnvironmentVariables();

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ],
        partials: ['MESSAGE', 'CHANNEL', 'REACTION']
    });

    // Create commands
    const commands = [
        new SlashCommandBuilder()
            .setName('invoice')
            .setDescription('Check if an invoice has been paid')
            .addStringOption(option =>
                option.setName('invoice_id')
                    .setDescription('The invoice ID to check')
                    .setRequired(true)),
        
        new SlashCommandBuilder()
            .setName('embed')
            .setDescription('Create a ticket embed')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('ticket')
                    .setDescription('Create a ticket system embed')),
        
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Configure bot settings')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('ticket')
                    .setDescription('Configure ticket settings')
                    .addRoleOption(option =>
                        option.setName('staff_role')
                            .setDescription('The role to ping for paid invoices')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('category')
                    .setDescription('Configure ticket category')
                    .addChannelOption(option =>
                        option.setName('category')
                            .setDescription('The category for ticket channels')
                            .addChannelTypes(ChannelType.GuildCategory)
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('transcript')
                    .setDescription('Configure ticket transcript channel')
                    .addChannelOption(option =>
                        option.setName('channel')
                            .setDescription('The channel for ticket transcripts')
                            .addChannelTypes(ChannelType.GuildText)
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('reset')
                    .setDescription('Reset all bot configurations for this server')),
        
        new SlashCommandBuilder()
            .setName('close')
            .setDescription('Close the current ticket')
    ].map(command => command.toJSON());

    // Register commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    (async () => {
        try {
            console.log('Started refreshing application (/) commands.');

            // Register commands globally
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );

            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            console.error('Error registering commands:', error);
        }
    })();

    // Handle commands
    client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;

        switch (interaction.commandName) {
            case 'invoice':
                await handleInvoiceCommand(interaction);
                break;
            case 'embed':
                if (interaction.options.getSubcommand() === 'ticket') {
                    await handleTicketEmbed(interaction);
                }
                break;
            case 'config':
                if (interaction.options.getSubcommand() === 'ticket') {
                    await handleTicketConfig(interaction);
                } else if (interaction.options.getSubcommand() === 'category') {
                    await handleCategoryConfig(interaction);
                } else if (interaction.options.getSubcommand() === 'transcript') {
                    await handleTranscriptConfig(interaction);
                } else if (interaction.options.getSubcommand() === 'reset') {
                    await handleConfigReset(interaction);
                }
                break;
            case 'close':
                await handleTicketClose(interaction);
                break;
        }
    });

    // Handle button interactions
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'create_ticket') {
            await handleTicketCreation(interaction);
        } else if (interaction.customId === 'close_ticket') {
            await handleTicketClose(interaction);
        }
    });

    // Handle messages
    client.on('messageCreate', handleTicketMessage);

    // Login to Discord
    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        await loadConfigurations();
    });

    client.login(process.env.DISCORD_TOKEN);
}

// Start the bot
initializeBot().catch(console.error); 