import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'wedding.db');

let db: Database;

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Save the database to disk
 */
export function saveDatabase(): void {
  if (!db) return;
  
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export async function initDatabase(): Promise<void> {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize SQL.js
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ Loaded existing database from:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('✅ Created new database at:', DB_PATH);
  }

  // Create sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sender_id TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'NEW',
      phone_numbers TEXT,
      selected_phone TEXT,
      guest_name TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create processed_messages table for idempotency
  db.run(`
    CREATE TABLE IF NOT EXISTS processed_messages (
      message_id TEXT PRIMARY KEY,
      processed_at INTEGER NOT NULL
    )
  `);

  // Save initial schema
  saveDatabase();

  // Auto-save every 30 seconds
  setInterval(() => {
    saveDatabase();
  }, 30000);

  console.log('✅ Database initialized');
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
  }
}
