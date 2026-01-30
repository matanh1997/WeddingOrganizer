# Leehe & Matan's Wedding Guest Bot 💍

A WhatsApp bot that collects wedding guest information (name, phone number, group) and saves it to Google Sheets.

## How It Works

1. **Share a contact card** with the bot
2. **Select phone number** (if the contact has multiple)
3. **Type the guest's name**
4. **Choose a group**: Leehe-Friends, Leehe-Family, Matan-Friends, or Matan-Family
5. Guest is automatically added to your Google Sheet!

## Prerequisites

- Node.js 20+
- A Meta Developer account with WhatsApp Business Platform access
- A Google Cloud service account with Sheets API access
- ngrok or Cloudflare Tunnel for local development

## Setup

### 1. WhatsApp Cloud API Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app → Select "Business" type
3. Add the WhatsApp product
4. Get your:
   - **Access Token** (from WhatsApp → API Setup)
   - **Phone Number ID** (from WhatsApp → API Setup)
   - **App Secret** (from App Settings → Basic)

### 2. Google Sheets Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin → Service Accounts
   - Create a new service account
   - Create a JSON key and download it
5. Create a Google Sheet and share it with the service account email (Editor access)
6. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

### 3. Environment Variables

Create a `.env` file in the project root:

```bash
# WhatsApp Cloud API Configuration
WHATSAPP_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_APP_SECRET=your_app_secret

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=create_your_own_secret_string

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
GOOGLE_SHEET_ID=your_spreadsheet_id

# Server Configuration
PORT=3000
```

**Note:** For `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the entire JSON content from your service account key file as a single line.

### 4. Configure Webhook in Meta Dashboard

1. Start your server (see below)
2. Start ngrok: `ngrok http 3000`
3. In Meta Developer Dashboard → WhatsApp → Configuration:
   - **Callback URL**: `https://your-ngrok-url.ngrok.io/webhook`
   - **Verify Token**: Same as your `WEBHOOK_VERIFY_TOKEN`
   - **Subscribe to**: `messages`

## Running Locally

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

## Running with Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f wedding-bot

# Stop
docker-compose down
```

## Project Structure

```
├── src/
│   ├── index.ts              # Express server entry
│   ├── config.ts             # Configuration & groups
│   ├── webhook/
│   │   ├── routes.ts         # Webhook endpoints
│   │   └── signature.ts      # Meta signature validation
│   ├── bot/
│   │   ├── stateMachine.ts   # Conversation logic
│   │   ├── messages.ts       # Message templates
│   │   └── contactParser.ts  # Contact card parsing
│   ├── services/
│   │   ├── whatsapp.ts       # WhatsApp API client
│   │   └── sheets.ts         # Google Sheets client
│   └── db/
│       ├── database.ts       # SQLite setup
│       ├── sessions.ts       # Session management
│       └── idempotency.ts    # Duplicate prevention
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Conversation States

| State | Description | Next Action |
|-------|-------------|-------------|
| `NEW` | Waiting for contact card | Share a contact |
| `PICK_PHONE` | Multiple phones found | Select from list |
| `AWAITING_NAME` | Phone selected | Type guest name |
| `AWAITING_GROUP` | Name received | Select group |
| `DONE` | Guest saved | Share another contact |

## Google Sheet Format

The bot creates/uses a sheet with these columns:

| Timestamp | Guest Name | Phone Number | Group | Added By |
|-----------|------------|--------------|-------|----------|
| 2026-01-30T10:00:00Z | David Cohen | +972541234567 | Matan - Friends | 972501234567 |

## Troubleshooting

### Webhook verification fails
- Ensure `WEBHOOK_VERIFY_TOKEN` matches exactly in both your `.env` and Meta dashboard
- Check that your ngrok tunnel is running

### Messages not arriving
- Verify the webhook is subscribed to the `messages` field
- Check the webhook URL in Meta dashboard is correct and using HTTPS

### Google Sheets not updating
- Verify the service account email has Editor access to the sheet
- Check that `GOOGLE_SHEET_ID` is correct
- Ensure `GOOGLE_SERVICE_ACCOUNT_JSON` is valid JSON

### Bot responding multiple times
- The idempotency system should prevent this
- Check logs for duplicate message processing

## License

MIT - Built with ❤️ for Leehe & Matan's wedding
