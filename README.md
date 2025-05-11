# SellAuth Bot

A Discord bot for SellAuth invoice verification and ticket management.

## Features

- Invoice verification through SellAuth API
- Ticket system for customer support
- Staff role management
- Ticket transcripts
- Configuration management

## Commands

- `/invoice <invoice_id>` - Check an invoice status
- `/ticket` - Set up the ticket system
- `/config staff <role>` - Configure the staff role
- `/config category <category>` - Set the ticket category
- `/config transcript <channel>` - Set the transcript channel
- `/config reset` - Reset all configurations

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sellauth-bot.git
cd sellauth-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
SELLAUTH_API_KEY=your_sellauth_api_key
SHOP_ID=your_shop_id
```

4. Start the bot:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Project Structure

```
sellauth-bot/
├── src/
│   ├── commands/        # Command definitions
│   ├── events/         # Event handlers
│   ├── handlers/       # Command and event handlers
│   ├── utils/          # Utility functions
│   └── index.js        # Main bot file
├── .env                # Environment variables
├── config.json         # Server configurations
├── package.json        # Project dependencies
└── README.md          # Documentation
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository.

## About

This bot was created to streamline the process of verifying SellAuth purchases and managing customer support tickets in Discord servers. 