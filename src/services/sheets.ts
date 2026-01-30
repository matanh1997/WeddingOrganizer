import { google } from 'googleapis';
import { config } from '../config';

/**
 * Guest entry to be added to the spreadsheet
 */
export interface GuestEntry {
  timestamp: string;
  guestName: string;
  phoneNumber: string;
  group: string;
  addedBy: string;
}

/**
 * Get authenticated Google Sheets client
 */
function getSheetsClient() {
  let credentials;
  
  try {
    // Try to parse JSON from environment variable
    credentials = JSON.parse(config.google.serviceAccountJson);
  } catch {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
    throw new Error('Invalid Google service account credentials');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Append a guest entry to the Google Sheet
 * Uses spreadsheets.values.append to automatically find the next empty row
 */
export async function appendGuestToSheet(entry: GuestEntry): Promise<void> {
  if (!config.google.sheetId) {
    console.warn('⚠️ Google Sheet ID not configured, skipping append');
    return;
  }

  if (!config.google.serviceAccountJson) {
    console.warn('⚠️ Google service account not configured, skipping append');
    return;
  }

  const sheets = getSheetsClient();
  
  // Format the row data
  // Columns: Timestamp | Guest Name | Phone Number | Group | Added By
  const values = [[
    entry.timestamp,
    entry.guestName,
    entry.phoneNumber,
    entry.group,
    entry.addedBy,
  ]];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A:E', // Will append to the first sheet
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });

    console.log(`✅ Appended guest to sheet: ${entry.guestName}`);
  } catch (error) {
    console.error('❌ Failed to append to Google Sheet:', error);
    throw error;
  }
}

/**
 * Initialize the sheet with headers if it's empty
 * Call this once during setup
 */
export async function initializeSheetHeaders(): Promise<void> {
  if (!config.google.sheetId || !config.google.serviceAccountJson) {
    console.warn('⚠️ Google Sheets not configured, skipping header initialization');
    return;
  }

  const sheets = getSheetsClient();

  try {
    // Check if the sheet already has data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A1:E1',
    });

    if (response.data.values && response.data.values.length > 0) {
      console.log('📊 Sheet already has headers');
      return;
    }

    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A1:E1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Timestamp', 'Guest Name', 'Phone Number', 'Group', 'Added By']],
      },
    });

    console.log('✅ Initialized sheet headers');
  } catch (error) {
    console.error('❌ Failed to initialize sheet headers:', error);
    // Don't throw - this is not critical for the bot to function
  }
}

