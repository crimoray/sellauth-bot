require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
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
                    .setName('staff')
                    .setDescription('Configure staff role')
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
            .setDescription('Close the current ticket'),

        new SlashCommandBuilder()
            .setName('check')
            .setDescription('Manually check an invoice status')
            .addStringOption(option =>
                option.setName('invoice_id')
                    .setDescription('The invoice ID to check')
                    .setRequired(true))
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

    // Add this at the top of initializeBot function, after serverConfigs declaration
    const processedTickets = new Set();

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
                if (interaction.options.getSubcommand() === 'staff') {
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
            case 'check':
                await handleInvoiceCommand(interaction);
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

    // Update handleInvoiceCommand to use the new functions
    async function handleInvoiceCommand(interaction) {
        const invoiceId = interaction.options.getString('invoice_id');
        
        try {
            await interaction.deferReply();

            console.log(`Making API request to check invoice: ${invoiceId}`);
            const invoiceData = await checkInvoiceStatus(invoiceId);

            if (!invoiceData) {
                const embed = new EmbedBuilder()
                    .setTitle('Error')
                    .setColor('#ff0000')
                    .setDescription('❌ Invalid invoice ID. Please try again with a valid invoice ID.')
                    .addFields(
                        { name: 'Invoice ID', value: invoiceId, inline: true }
                    )
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = createInvoiceEmbed(invoiceData);
            await interaction.editReply({ embeds: [embed] });

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
                        embed.setDescription('❌ Invalid invoice ID. Please try again with a valid invoice ID.');
                        break;
                    case 401:
                        embed.setDescription('❌ Authentication failed. Please check the API key.');
                        break;
                    default:
                        embed.setDescription('❌ Error checking invoice. Please try again later.');
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
        }
    }

    async function handleTicketEmbed(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ You need administrator permissions to use this command.',
                flags: [4096]
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket System')
            .setDescription('Click the button below to create a support ticket.')
            .setColor('#0099ff');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ 
            content: '✅ Ticket system has been set up!',
            flags: [4096]
        });
    }

    async function handleTicketConfig(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ You need administrator permissions to use this command.',
                flags: [4096]
            });
        }

        const staffRole = interaction.options.getRole('staff_role');
        
        // Store the configuration
        if (!serverConfigs.has(interaction.guildId)) {
            serverConfigs.set(interaction.guildId, {});
        }
        serverConfigs.get(interaction.guildId).staffRole = staffRole.id;
        
        // Save configurations
        await saveConfigurations();

        await interaction.reply({ 
            content: `✅ Staff role has been set to ${staffRole.name}`,
            flags: [4096]
        });
    }

    async function handleCategoryConfig(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ You need administrator permissions to use this command.',
                flags: [4096]
            });
        }

        const category = interaction.options.getChannel('category');
        
        // Store the configuration
        if (!serverConfigs.has(interaction.guildId)) {
            serverConfigs.set(interaction.guildId, {});
        }
        serverConfigs.get(interaction.guildId).ticketCategory = category.id;
        
        // Save configurations
        await saveConfigurations();

        await interaction.reply({ 
            content: `✅ Ticket category has been set to ${category.name}`,
            flags: [4096]
        });
    }

    async function handleTranscriptConfig(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ You need administrator permissions to use this command.',
                flags: [4096]
            });
        }

        const channel = interaction.options.getChannel('channel');
        
        // Store the configuration
        if (!serverConfigs.has(interaction.guildId)) {
            serverConfigs.set(interaction.guildId, {});
        }
        serverConfigs.get(interaction.guildId).transcriptChannel = channel.id;
        
        // Save configurations
        await saveConfigurations();

        await interaction.reply({ 
            content: `✅ Transcript channel has been set to ${channel}`,
            flags: [4096]
        });
    }

    async function handleConfigReset(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ You need administrator permissions to use this command.',
                flags: [4096]
            });
        }

        // Reset configurations for this server
        serverConfigs.delete(interaction.guildId);
        
        // Save configurations
        await saveConfigurations();

        await interaction.reply({ 
            content: '✅ All bot configurations have been reset for this server.',
            flags: [4096]
        });
    }

    // Add this after loadConfigurations function
    async function checkServerConfig(guild) {
        const config = serverConfigs.get(guild.id) || {};
        const missingConfigs = [];

        if (!config.staffRole) missingConfigs.push('staff role');
        if (!config.ticketCategory) missingConfigs.push('ticket category');
        if (!config.transcriptChannel) missingConfigs.push('transcript channel');

        if (missingConfigs.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Server Configuration Required')
                .setDescription(`Please configure the following settings using the commands below:\n\n${missingConfigs.map(setting => `• \`/config ${setting.split(' ')[0]}\` - Set ${setting}`).join('\n')}`)
                .setColor('#ff9900')
                .setTimestamp();

            // Try to find a channel to send the message
            const systemChannel = guild.systemChannel || guild.channels.cache.find(channel => 
                channel.type === ChannelType.GuildText && 
                channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
            );

            if (systemChannel) {
                await systemChannel.send({ embeds: [embed] });
            }
            return false;
        }
        return true;
    }

    // Modify the generateTranscript function to include embeds
    async function generateTranscript(channel) {
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            let transcript = '';
            
            // Process messages in chronological order
            const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            for (const msg of sortedMessages.values()) {
                const timestamp = new Date(msg.createdTimestamp).toLocaleString();
                let content = `[${timestamp}] ${msg.author.tag}: `;
                
                // Add message content
                if (msg.content) {
                    content += msg.content;
                }
                
                // Add embeds
                if (msg.embeds && msg.embeds.length > 0) {
                    content += '\n[Embeds:';
                    msg.embeds.forEach((embed, index) => {
                        content += `\n  Embed ${index + 1}:`;
                        if (embed.title) content += `\n    Title: ${embed.title}`;
                        if (embed.description) content += `\n    Description: ${embed.description}`;
                        if (embed.fields && embed.fields.length > 0) {
                            content += '\n    Fields:';
                            embed.fields.forEach(field => {
                                content += `\n      ${field.name}: ${field.value}`;
                            });
                        }
                    });
                    content += '\n]';
                }
                
                transcript += content + '\n';
            }

            const transcriptEmbed = new EmbedBuilder()
                .setTitle(`Ticket Transcript - ${channel.name}`)
                .setDescription(`Transcript for ticket ${channel.name}`)
                .setColor('#0099ff')
                .setTimestamp();

            const transcriptChannel = channel.guild.channels.cache.get(
                serverConfigs.get(channel.guild.id)?.transcriptChannel
            );

            if (transcriptChannel) {
                await transcriptChannel.send({
                    embeds: [transcriptEmbed],
                    files: [{
                        attachment: Buffer.from(transcript),
                        name: `transcript-${channel.name}.txt`
                    }]
                });
            }
        } catch (error) {
            console.error('Error generating transcript:', error);
        }
    }

    // Modify the client.on('ready') event to check configurations
    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        await loadConfigurations();
        
        // Check configurations for all guilds
        for (const guild of client.guilds.cache.values()) {
            await checkServerConfig(guild);
        }
    });

    // Add guild join event handler
    client.on('guildCreate', async guild => {
        await checkServerConfig(guild);
    });

    // Modify handleTicketCreation to check configuration
    async function handleTicketCreation(interaction) {
        try {
            const guild = interaction.guild;
            const user = interaction.user;

            // Check if server is properly configured
            if (!await checkServerConfig(guild)) {
                return await interaction.reply({
                    content: '❌ Please configure the bot settings first using the configuration commands.',
                    ephemeral: true
                });
            }

            // Check if user already has an open ticket
            const existingTicket = guild.channels.cache.find(
                channel => channel.name === `ticket-${user.id}`
            );

            if (existingTicket) {
                return await interaction.reply({
                    content: '❌ You already have an open ticket!',
                    ephemeral: true
                });
            }

            // Get or create the configured category
            let category = null;
            const categoryId = serverConfigs.get(guild.id)?.ticketCategory;
            
            if (categoryId) {
                category = guild.channels.cache.get(categoryId);
            }
            
            if (!category) {
                // Create a new category if it doesn't exist
                category = await guild.channels.create({
                    name: 'Tickets',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        }
                    ]
                });
                
                // Store the new category ID in config
                if (!serverConfigs.has(guild.id)) {
                    serverConfigs.set(guild.id, {});
                }
                serverConfigs.get(guild.id).ticketCategory = category.id;
                await saveConfigurations();
            }

            // Get the staff role
            const staffRoleId = serverConfigs.get(guild.id)?.staffRole;
            const staffRole = staffRoleId ? guild.roles.cache.get(staffRoleId) : null;

            // Create permission overwrites
            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                }
            ];

            // Add staff role permissions if it exists
            if (staffRole) {
                permissionOverwrites.push({
                    id: staffRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                });
            }

            // Create ticket channel
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.id}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: permissionOverwrites
            });

            const embed = new EmbedBuilder()
                .setTitle('🎫 Support Ticket')
                .setDescription('Please provide your invoice ID to check its status.')
                .setColor('#0099ff');

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            await ticketChannel.send({
                content: `${user} Welcome to your ticket! Please provide your invoice ID.`,
                embeds: [embed],
                components: [row]
            });

            // Try to reply to the interaction, but handle potential timeout
            try {
                await interaction.reply({
                    content: `✅ Your ticket has been created: ${ticketChannel}`,
                    ephemeral: true
                });
            } catch (error) {
                if (error.code === 10062) {
                    // Interaction already timed out, send a follow-up message in the ticket channel
                    await ticketChannel.send({
                        content: `${user} Your ticket has been created!`
                    });
                } else {
                    throw error; // Re-throw other errors
                }
            }
        } catch (error) {
            console.error('Error creating ticket:', error);
            try {
                await interaction.reply({
                    content: '❌ An error occurred while creating your ticket. Please try again.',
                    ephemeral: true
                });
            } catch (replyError) {
                if (replyError.code !== 10062) {
                    console.error('Error sending error message:', replyError);
                }
            }
        }
    }

    // Update handleTicketClose to clean up processed tickets
    async function handleTicketClose(interaction) {
        const channel = interaction.channel;
        
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        // Defer the reply to extend the interaction timeout
        await interaction.deferReply();

        // Clean up processed tickets when closing
        processedTickets.delete(channel.id);

        await interaction.editReply('🔒 This ticket will be closed in 5 seconds...');
        
        // Generate and send transcript before closing
        await generateTranscript(channel);
        
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (error) {
                console.error('Error deleting channel:', error);
            }
        }, 5000);
    }

    // Update the message handler
    client.on('messageCreate', async message => {
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
    });

    client.login(process.env.DISCORD_TOKEN);
}

// Start the bot
initializeBot().catch(console.error);

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