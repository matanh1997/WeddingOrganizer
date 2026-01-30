import dotenv from 'dotenv';

dotenv.config();

// Final group options (what gets saved to the sheet)
export const GROUPS = {
  // Leehe
  leehe_friends: 'Leehe - Friends',
  leehe_family_keisari: 'Leehe - Family - Keisari',
  leehe_family_maggor: 'Leehe - Family - Maggor',
  leehe_familyfriends_keisari: 'Leehe - Family Friends - Keisari',
  leehe_familyfriends_maggor: 'Leehe - Family Friends - Maggor',
  // Matan
  matan_friends: 'Matan - Friends',
  matan_family_heled: 'Matan - Family - Heled',
  matan_family_maimon: 'Matan - Family - Maimon',
  matan_familyfriends_heled: 'Matan - Family Friends - Heled',
  matan_familyfriends_maimon: 'Matan - Family Friends - Maimon',
} as const;

export type GroupId = keyof typeof GROUPS;

export const config = {
  // Telegram Bot
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  // Google Sheets
  google: {
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
    sheetId: process.env.GOOGLE_SHEET_ID || '',
  },

  // Server (for webhook mode, optional)
  port: parseInt(process.env.PORT || '3000', 10),
  webhookDomain: process.env.WEBHOOK_DOMAIN || '',
};

export function validateConfig(): void {
  if (!config.telegram.token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required!');
  }
}
