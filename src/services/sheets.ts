import { google } from 'googleapis';
import { config } from '../config';

export interface GuestEntry {
  timestamp: string;
  guestName: string;
  phoneNumber: string;
  group: string;
  numGuests: number;
  likelyArrive: boolean;
  addedBy: string;
}

export interface ExistingGuest {
  rowIndex: number;
  timestamp: string;
  guestName: string;
  phoneNumber: string;
  group: string;
  numGuests: number;
  likelyArrive: boolean;
  addedBy: string;
}

// In-memory cache of existing guests (phone -> guest data)
const existingGuests = new Map<string, ExistingGuest>();

// Normalize phone number to +972 format for consistent comparison
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with 0, replace with +972 (Israeli local format)
  if (cleaned.startsWith('0')) {
    cleaned = '+972' + cleaned.slice(1);
  }
  // If starts with 972 without +, add the +
  else if (cleaned.startsWith('972')) {
    cleaned = '+' + cleaned;
  }
  // If doesn't start with +, assume it needs +972
  else if (!cleaned.startsWith('+')) {
    cleaned = '+972' + cleaned;
  }
  
  return cleaned;
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

// Load all existing guests from the sheet into memory
export async function loadExistingGuests(): Promise<number> {
  existingGuests.clear();
  
  if (!config.google.sheetId || !config.google.serviceAccountJson) {
    console.warn('⚠️ Google Sheets not configured, skipping load');
    return 0;
  }

  try {
    const sheets = getSheetsClient();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A:G',
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      console.log('📊 No existing guests in sheet');
      return 0;
    }

    // Skip header row (index 0), start from row 1
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length >= 3) {
        const phoneRaw = row[2]?.toString() || '';
        const phone = normalizePhoneNumber(phoneRaw.replace(/^'/, ''));
        
        if (phone) {
          existingGuests.set(phone, {
            rowIndex: i + 1,
            timestamp: row[0] || '',
            guestName: row[1] || '',
            phoneNumber: phone,
            group: row[3] || '',
            numGuests: parseInt(row[4]) || 1,
            likelyArrive: row[5]?.toLowerCase() === 'yes' || row[5]?.toLowerCase() === 'כן',
            addedBy: row[6] || '',
          });
        }
      }
    }

    console.log(`📊 Loaded ${existingGuests.size} existing guests from sheet`);
    return existingGuests.size;
  } catch (error) {
    console.error('Failed to load existing guests:', error);
    return 0;
  }
}

// Check if a phone number already exists
export function getExistingGuest(phoneNumber: string): ExistingGuest | null {
  const normalized = normalizePhoneNumber(phoneNumber);
  return existingGuests.get(normalized) || null;
}

// Delete a guest by row index and remove from cache
export async function deleteGuest(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const guest = existingGuests.get(normalized);
  
  if (!guest || !config.google.sheetId) {
    return false;
  }

  try {
    const sheets = getSheetsClient();
    
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.google.sheetId,
    });
    
    const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId || 0;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.google.sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: guest.rowIndex - 1,
              endIndex: guest.rowIndex,
            },
          },
        }],
      },
    });

    existingGuests.delete(normalized);
    await loadExistingGuests();
    
    console.log(`🗑️ Deleted guest: ${guest.guestName}`);
    return true;
  } catch (error) {
    console.error('Failed to delete guest:', error);
    return false;
  }
}

export async function appendGuestToSheet(entry: GuestEntry): Promise<void> {
  if (!config.google.sheetId || !config.google.serviceAccountJson) {
    console.warn('⚠️ Google Sheets not configured, skipping');
    return;
  }

  const sheets = getSheetsClient();
  
  const normalizedPhone = normalizePhoneNumber(entry.phoneNumber);
  const phoneAsText = "'" + normalizedPhone;
  
  const values = [[
    entry.timestamp,
    entry.guestName,
    phoneAsText,
    entry.group,
    entry.numGuests,
    entry.likelyArrive ? 'Yes' : 'No',
    entry.addedBy,
  ]];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: config.google.sheetId,
    range: 'Sheet1!A:G',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  const updatedRange = response.data.updates?.updatedRange;
  const rowMatch = updatedRange?.match(/!A(\d+):/);
  const rowIndex = rowMatch ? parseInt(rowMatch[1]) : existingGuests.size + 2;
  
  existingGuests.set(normalizedPhone, {
    rowIndex,
    timestamp: entry.timestamp,
    guestName: entry.guestName,
    phoneNumber: normalizedPhone,
    group: entry.group,
    numGuests: entry.numGuests,
    likelyArrive: entry.likelyArrive,
    addedBy: entry.addedBy,
  });

  console.log(`✅ Added to sheet: ${entry.guestName} (${normalizedPhone})`);
}

export async function initializeSheetHeaders(): Promise<void> {
  if (!config.google.sheetId || !config.google.serviceAccountJson) {
    return;
  }

  try {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A1:G1',
    });

    if (response.data.values && response.data.values.length > 0) {
      // Check if we need to update headers (add new columns)
      const currentHeaders = response.data.values[0];
      if (currentHeaders.length < 7) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.google.sheetId,
          range: 'Sheet1!A1:G1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Timestamp', 'Guest Name', 'Phone Number', 'Group', 'Num Guests', 'Likely Arrive', 'Added By']],
          },
        });
        console.log('✅ Sheet headers updated with new columns');
      }
      return;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.google.sheetId,
      range: 'Sheet1!A1:G1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Timestamp', 'Guest Name', 'Phone Number', 'Group', 'Num Guests', 'Likely Arrive', 'Added By']],
      },
    });

    console.log('✅ Sheet headers initialized');
  } catch (error) {
    console.error('Failed to init headers:', error);
  }
}
