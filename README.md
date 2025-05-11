# SellAuth Discord Bot

A Discord bot that integrates with SellAuth to handle invoice verification and support tickets.

## Setup

1. Clone the repository:
```bash
git clone https://github.com/crimoray/sellauth-bot.git
cd sellauth-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_client_id
SELLAUTH_API_KEY=your_sellauth_api_key
SHOP_ID=your_sellauth_shop_id
```

4. Start the bot:
```bash
# On Windows
start.bat

# On Linux/Mac
./start.sh
```

The bot will automatically prompt you for any missing environment variables during startup.

## Commands

- `/invoice` - Check invoice status
- `/embed` - Create ticket system embed
- `/config` - Configure bot settings
- `/close` - Close current ticket

## Features

### Ticket System
- **Automated Ticket Creation**: Users can create support tickets with a single click
- **Invoice Verification**: Automatic checking of invoice status in tickets
- **Transcript Generation**: Automatic ticket transcript generation on closure
- **Staff Notifications**: Instant notifications for staff when invoices are paid

### Invoice Management
- **Real-time Status Checks**: Check invoice status (paid, pending, expired)
- **Automatic Updates**: Bot automatically updates invoice status
- **Cached Lookups**: Improved performance with cached invoice data
- **Beautiful Embeds**: Clean and informative status displays

### Configuration Options
- **Customizable Settings**: Configure staff roles, ticket categories, and more
- **Server-specific Settings**: Different configurations for different servers
- **Easy Setup**: Simple configuration through commands

## Ticket System Workflow

1. User clicks "Create Ticket" button
2. Bot creates a private channel
3. User provides their invoice ID
4. Bot verifies the invoice:
   - If valid (paid/pending): Stops checking further messages
   - If invalid: Shows error message
5. Staff is notified for paid invoices
6. Ticket can be closed with `/close`
7. Transcript is saved on closure

## Error Handling

The bot includes comprehensive error handling for:
- Invalid invoice IDs
- API authentication failures
- Network issues
- Permission problems

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository.

## About

This bot was created to streamline the process of verifying SellAuth purchases and managing customer support tickets in Discord servers. 