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

export function saveDatabase(): void {
  if (!db) return;
  
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export async function initDatabase(): Promise<void> {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('✅ Created new database');
  }

  // Create/update sessions table with new columns
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      user_id INTEGER PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'NEW',
      phone_numbers TEXT,
      selected_phone TEXT,
      guest_name TEXT,
      selected_person TEXT,
      selected_type TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  // Add new columns if they don't exist (migration for existing DBs)
  try {
    db.run(`ALTER TABLE sessions ADD COLUMN selected_person TEXT`);
  } catch { /* column exists */ }
  
  try {
    db.run(`ALTER TABLE sessions ADD COLUMN selected_type TEXT`);
  } catch { /* column exists */ }

  saveDatabase();

  // Auto-save every 30 seconds
  setInterval(saveDatabase, 30000);
}
