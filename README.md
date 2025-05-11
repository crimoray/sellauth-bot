# SellAuth Invoice Checker Discord Bot

A Discord bot that helps manage and verify SellAuth invoice payments through a ticket system.

## Features

- **Ticket System**
  - Create support tickets for invoice verification
  - Automatic invoice checking in tickets
  - Ticket transcripts on closure
  - Staff role notifications for paid invoices

- **Invoice Management**
  - Check invoice status (paid, pending, expired)
  - Automatic invoice status updates
  - Cached invoice lookups for better performance
  - Beautiful embed messages for status display

- **Configuration Options**
  - Set staff role for notifications
  - Configure ticket category
  - Set up transcript channel
  - Customizable ticket system

## Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/sellauth-invoice-bot.git
   cd sellauth-invoice-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   Create a `.env` file with the following:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_client_id
   SELLAUTH_API_KEY=your_sellauth_api_key
   SHOP_ID=your_sellauth_shop_id
   ```

4. **Start the Bot**
   - Windows: Run `start.bat`
   - Linux/Mac: Run `./start.sh`

## Commands

### User Commands
- `/invoice <invoice_id>` - Check an invoice's status
- `/close` - Close the current ticket

### Admin Commands
- `/embed ticket` - Create a ticket system embed
- `/config ticket <staff_role>` - Set the staff role for notifications
- `/config category <category>` - Set the ticket category
- `/config transcript <channel>` - Set the transcript channel
- `/config reset` - Reset all bot configurations

## Ticket System

1. Users click the "Create Ticket" button to open a support ticket
2. The bot creates a private channel for the user
3. User provides their invoice ID
4. Bot checks the invoice status:
   - If valid (paid/pending): Stops checking further messages
   - If invalid: Shows error message
5. For paid invoices, staff is notified
6. Tickets can be closed with the `/close` command
7. Transcripts are saved when tickets are closed

## Configuration

The bot stores its configuration in `config.json`. This includes:
- Staff role IDs
- Ticket category IDs
- Transcript channel IDs
- Server-specific settings

## Error Handling

The bot includes comprehensive error handling for:
- Invalid invoice IDs
- API authentication failures
- Network issues
- Permission problems

## Support

For support, please create an issue in this repository or contact the bot administrator.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 