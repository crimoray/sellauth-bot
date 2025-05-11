const { checkInvoiceStatus } = require('../services/sellauth');
const { createInvoiceEmbed, createErrorEmbed } = require('../utils/embeds');

async function handleInvoiceCommand(interaction) {
    const invoiceId = interaction.options.getString('invoice_id');
    
    try {
        await interaction.deferReply();

        console.log(`Making API request to check invoice: ${invoiceId}`);
        const invoiceData = await checkInvoiceStatus(invoiceId);

        if (!invoiceData) {
            const embed = createErrorEmbed(
                'Error',
                '❌ Invalid invoice ID. Please try again with a valid invoice ID.',
                [{ name: 'Invoice ID', value: invoiceId, inline: true }]
            );
            
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

        const embed = createErrorEmbed(
            'Error',
            '❌ Error checking invoice status',
            [{ name: 'Invoice ID', value: invoiceId, inline: true }]
        );

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

module.exports = {
    handleInvoiceCommand
}; 