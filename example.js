// Discord Bot to check SellAuth invoice payment status
const { Client, GatewayIntentBits, Events, ApplicationCommandOptionType, REST, Routes } = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SELLAUTH_API_KEY = process.env.SELLAUTH_API_KEY;
const SHOP_ID = process.env.SHOP_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || 5; // Minutes between invoice checks

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Configuration file path
const configPath = path.join(__dirname, 'config.json');

// Load config
let config = {
    invoiceChannelId: null,
    autoCheckEnabled: false,
    lastCheckedInvoiceId: 0,
    processedInvoices: {}
};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (error) {
    console.error('Error loading config:', error);
}

// Save config
function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Command definitions
const commands = [
    {
        name: 'check-invoice',
        description: 'Check if a SellAuth invoice has been paid',
        options: [
            {
                name: 'invoice-id',
                description: 'The ID of the invoice to check',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'channel',
                description: 'The channel to send the invoice status to (optional)',
                type: ApplicationCommandOptionType.Channel,
                required: false
            }
        ]
    },
    {
        name: 'set-invoice-channel',
        description: 'Set the default channel for automatic invoice status updates',
        options: [
            {
                name: 'channel',
                description: 'The channel to send invoice status updates to',
                type: ApplicationCommandOptionType.Channel,
                required: true
            }
        ]
    },
    {
        name: 'toggle-auto-check',
        description: 'Toggle automatic checking of new invoices',
        options: [
            {
                name: 'enabled',
                description: 'Enable or disable automatic checking',
                type: ApplicationCommandOptionType.Boolean,
                required: true
            }
        ]
    }
];

// Register commands when bot is ready
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    try {
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('Slash commands registered successfully!');
        
        // Start automatic invoice checking if enabled
        if (config.autoCheckEnabled) {
            console.log('Starting automatic invoice checking...');
            startAutoCheck();
        }
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// Handle commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    
    if (commandName === 'check-invoice') {
        await interaction.deferReply();
        
        const invoiceId = interaction.options.getString('invoice-id');
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        
        try {
            // Check invoice status
            const response = await checkInvoiceStatus(invoiceId);
            
            if (response) {
                const embed = createInvoiceEmbed(response);
                
                if (targetChannel.id !== interaction.channel.id) {
                    // Send to the target channel
                    await targetChannel.send({ embeds: [embed] });
                    await interaction.editReply(`Invoice ${invoiceId} status has been posted in <#${targetChannel.id}>`);
                } else {
                    // Send in the current channel
                    await interaction.editReply({ embeds: [embed] });
                }
            } else {
                await interaction.editReply(`❌ Invoice ${invoiceId} not found.`);
            }
        } catch (error) {
            console.error('Error checking invoice:', error);
            await interaction.editReply(`❌ Error checking invoice: ${error.message}`);
        }
    }
    
    else if (commandName === 'set-invoice-channel') {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ 
                content: 'You need administrator permissions to use this command.', 
                ephemeral: true 
            });
        }
        
        const channel = interaction.options.getChannel('channel');
        
        // Save the channel ID in the config
        config.invoiceChannelId = channel.id;
        saveConfig();
        
        await interaction.reply(`Invoice status updates will now be sent to <#${channel.id}>`);
    }
    
    else if (commandName === 'toggle-auto-check') {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ 
                content: 'You need administrator permissions to use this command.', 
                ephemeral: true 
            });
        }
        
        const enabled = interaction.options.getBoolean('enabled');
        
        // Update config
        config.autoCheckEnabled = enabled;
        saveConfig();
        
        if (enabled) {
            await interaction.reply('Automatic invoice checking has been enabled.');
            startAutoCheck();
        } else {
            await interaction.reply('Automatic invoice checking has been disabled.');
            if (global.autoCheckInterval) {
                clearInterval(global.autoCheckInterval);
            }
        }
    }
});

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
    
    const embed = {
        color: statusColor,
        title: `Invoice ${invoice.id} Status`,
        fields: [
            {
                name: 'Status',
                value: `${statusEmoji} ${invoice.status}`,
                inline: true
            },
            {
                name: 'Product',
                value: invoice.product ? invoice.product.name : 'Unknown',
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
        ],
        footer: {
            text: 'SellAuth Invoice Checker'
        },
        timestamp: new Date()
    };
    
    // Add completed_at if it exists
    if (invoice.completed_at) {
        embed.fields.push({
            name: 'Completed At',
            value: new Date(invoice.completed_at).toLocaleString(),
            inline: true
        });
    }
    
    return embed;
}

// Function to check a specific invoice status
async function checkInvoiceStatus(invoiceId) {
    try {
        const response = await axios.get(
            `https://api.sellauth.com/v1/shops/${SHOP_ID}/invoices/${invoiceId}`,
            {
                headers: {
                    'Authorization': `Bearer ${SELLAUTH_API_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );
        
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // Invoice not found
        }
        throw new Error(`Failed to check invoice: ${error.message}`);
    }
}

// Function to get all recent invoices
async function getRecentInvoices() {
    try {
        const response = await axios.get(
            `https://api.sellauth.com/v1/shops/${SHOP_ID}/invoices`,
            {
                headers: {
                    'Authorization': `Bearer ${SELLAUTH_API_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );
        
        return response.data.data; // The data field contains the invoices array
    } catch (error) {
        console.error('Error fetching recent invoices:', error);
        return [];
    }
}

// Function to start automatic invoice checking
function startAutoCheck() {
    // Clear existing interval if there is one
    if (global.autoCheckInterval) {
        clearInterval(global.autoCheckInterval);
    }
    
    // Set up interval to check for new invoices
    global.autoCheckInterval = setInterval(async () => {
        if (!config.invoiceChannelId) {
            console.log('Auto-check enabled but no channel set. Skipping check.');
            return;
        }
        
        try {
            const invoices = await getRecentInvoices();
            const invoiceChannel = client.channels.cache.get(config.invoiceChannelId);
            
            if (!invoiceChannel) {
                console.error('Configured invoice channel not found!');
                return;
            }
            
            // Sort invoices by ID to process in order
            invoices.sort((a, b) => a.id - b.id);
            
            for (const invoice of invoices) {
                // Skip if we've already processed this invoice
                if (config.processedInvoices[invoice.id]) {
                    continue;
                }
                
                // Mark as highest ID we've seen
                if (invoice.id > config.lastCheckedInvoiceId) {
                    config.lastCheckedInvoiceId = invoice.id;
                }
                
                // For new invoices, send the update
                if (!config.processedInvoices[invoice.id]) {
                    const embed = createInvoiceEmbed(invoice);
                    await invoiceChannel.send({ 
                        content: `New invoice detected: #${invoice.id}`,
                        embeds: [embed] 
                    });
                    
                    // Mark as processed
                    config.processedInvoices[invoice.id] = {
                        status: invoice.status,
                        processedAt: new Date().toISOString()
                    };
                }
                // For status changes, update
                else if (config.processedInvoices[invoice.id].status !== invoice.status) {
                    const embed = createInvoiceEmbed(invoice);
                    await invoiceChannel.send({ 
                        content: `Status update for invoice #${invoice.id}:`,
                        embeds: [embed] 
                    });
                    
                    // Update status
                    config.processedInvoices[invoice.id] = {
                        status: invoice.status,
                        processedAt: new Date().toISOString()
                    };
                }
            }
            
            // Prune old entries from processedInvoices to prevent it from growing too large
            // Keep only the 100 most recent
            const invoiceIds = Object.keys(config.processedInvoices).map(Number).sort((a, b) => b - a);
            if (invoiceIds.length > 100) {
                const newProcessedInvoices = {};
                for (let i = 0; i < 100; i++) {
                    if (i < invoiceIds.length) {
                        newProcessedInvoices[invoiceIds[i]] = config.processedInvoices[invoiceIds[i]];
                    }
                }
                config.processedInvoices = newProcessedInvoices;
            }
            
            // Save config with updated invoice IDs
            saveConfig();
            
        } catch (error) {
            console.error('Error in auto check:', error);
        }
    }, CHECK_INTERVAL * 60 * 1000); // Convert minutes to milliseconds
}

// Log in to Discord
client.login(DISCORD_TOKEN);