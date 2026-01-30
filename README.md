# 💍 Leehe & Matan Wedding Guest Bot (Telegram)

A Telegram bot that collects wedding guest information and saves to Google Sheets.

## Quick Start (5 minutes!)

### 1. Create Telegram Bot (2 min)

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Name: `Leehe Matan Wedding Bot`
4. Username: `leehe_matan_wedding_bot` (must be unique)
5. Copy the token: `7123456789:AAH...`

### 2. Set Up Google Sheet (3 min)

1. Create a new Google Sheet
2. Copy the Sheet ID from URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
3. Create a Google Cloud service account (see detailed guide below)
4. Share the sheet with the service account email

### 3. Run Locally

```bash
# Install dependencies
npm install

# Create .env file
cat > .env << EOF
TELEGRAM_BOT_TOKEN=your_bot_token_here
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_SHEET_ID=your_sheet_id
EOF

# Start bot
npm run dev
```

### 4. Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Add environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `GOOGLE_SERVICE_ACCOUNT_JSON`
   - `GOOGLE_SHEET_ID`
   - `WEBHOOK_DOMAIN` (your Railway URL, e.g., `https://xxx.up.railway.app`)
5. Deploy!

## How It Works

1. 📱 Share a contact with the bot
2. ✏️ Type the guest's name
3. 👥 Select a group (Leehe/Matan - Friends/Family)
4. ✅ Guest saved to Google Sheets!

## Commands

- `/start` - Start/restart the bot
- `/help` - Show help
- `/cancel` - Cancel current operation

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON (minified) |
| `GOOGLE_SHEET_ID` | Spreadsheet ID from URL |
| `WEBHOOK_DOMAIN` | (Production only) Your app URL |

## Google Service Account Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: `Wedding Bot`
3. Enable Google Sheets API
4. Create Service Account → Download JSON key
5. Share your Sheet with the service account email
6. Minify the JSON and add to environment

---

Built with ❤️ for Leehe & Matan
