import { google } from 'googleapis';
import { config } from '../config';

export interface GuestEntry {
  timestamp: string;
  guestName: string;
  phoneNumber: string;
  group: string;
  addedBy: string;
}

function getSheetsClient() {
  let credentials;
  
  try {
    credentials = JSON.parse(config.google.serviceAccountJson);
  } catch {
    throw new Error('Invalid Google service account credentials');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function appendGuestToSheet(entry: GuestEntry): Promise<void> {
  if (!config.google.sheetId || !config.google.serviceAccountJson) {
    console.warn('⚠️ Google Sheets not configured, skipping');
    return;
  }

  const sheets = getSheetsClient();
  
  const values = [[
    entry.timestamp,
    entry.guestName,
    entry.phoneNumber,
    entry.group,
    entry.addedBy,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.google.sheetId,
    range: 'Sheet1!A:E',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  console.log(`✅ Added to sheet: ${entry.guestName}`);
}

export async function initializeSheetHeaders(): Promise<void> {
  if (!config.google.sheetId || !config.google.serviceAccountJson) {
    return;
  }

  try {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A1:E1',
    });

    if (response.data.values && response.data.values.length > 0) {
      return;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A1:E1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Timestamp', 'Guest Name', 'Phone Number', 'Group', 'Added By']],
      },
    });

    console.log('✅ Sheet headers initialized');
  } catch (error) {
    console.error('Failed to init headers:', error);
  }
}
