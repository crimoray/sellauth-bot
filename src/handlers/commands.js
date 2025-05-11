const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { serverConfigs, saveConfigurations } = require('../utils/config');
const { checkInvoiceStatus, createInvoiceEmbed } = require('../utils/invoice');
const { checkServerConfig, processedTickets, generateTranscript } = require('../utils/ticket');

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

module.exports = {
    handleInvoiceCommand,
    handleTicketEmbed,
    handleTicketConfig,
    handleCategoryConfig,
    handleTranscriptConfig,
    handleConfigReset,
    handleTicketCreation,
    handleTicketClose
}; 