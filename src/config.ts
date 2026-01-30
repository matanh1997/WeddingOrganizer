import dotenv from 'dotenv';

dotenv.config();

export interface Group {
  id: string;
  displayName: string;
}

export const GROUPS: Group[] = [
  { id: 'leehe_friends', displayName: 'Leehe - Friends' },
  { id: 'leehe_family', displayName: 'Leehe - Family' },
  { id: 'matan_friends', displayName: 'Matan - Friends' },
  { id: 'matan_family', displayName: 'Matan - Family' },
];

export const config = {
  // WhatsApp Cloud API
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },

  // Webhook
  webhook: {
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
  },

  // Google Sheets
  google: {
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
    sheetId: process.env.GOOGLE_SHEET_ID || '',
  },

  // Server
  port: parseInt(process.env.PORT || '3000', 10),
};

export function validateConfig(): void {
  const required = [
    ['WHATSAPP_TOKEN', config.whatsapp.token],
    ['WHATSAPP_PHONE_NUMBER_ID', config.whatsapp.phoneNumberId],
    ['WEBHOOK_VERIFY_TOKEN', config.webhook.verifyToken],
    ['GOOGLE_SHEET_ID', config.google.sheetId],
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  }
}

