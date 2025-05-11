const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { serverConfigs, saveConfigurations } = require('../config');
const { createTicketEmbed, createErrorEmbed } = require('../utils/embeds');

async function handleTicketEmbed(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
            content: '❌ You need administrator permissions to use this command.',
            flags: [4096]
        });
    }

    const embed = createTicketEmbed();
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

module.exports = {
    handleTicketEmbed,
    handleTicketConfig,
    handleCategoryConfig,
    handleTranscriptConfig,
    handleConfigReset
}; 