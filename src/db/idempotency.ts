import { getDb, saveDatabase } from './database';

/**
 * Check if a message has already been processed
 */
export function isMessageProcessed(messageId: string): boolean {
  const db = getDb();
  const stmt = db.prepare('SELECT 1 FROM processed_messages WHERE message_id = ?');
  stmt.bind([messageId]);
  const hasRow = stmt.step();
  stmt.free();
  return hasRow;
}

/**
 * Mark a message as processed
 */
export function markMessageProcessed(messageId: string): void {
  const db = getDb();
  const now = Date.now();
  
  db.run(
    `INSERT OR IGNORE INTO processed_messages (message_id, processed_at) VALUES (?, ?)`,
    [messageId, now]
  );

  saveDatabase();
}

/**
 * Clean up old processed messages (older than 7 days)
 * Call this periodically to prevent the table from growing indefinitely
 */
export function cleanupOldMessages(): number {
  const db = getDb();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  db.run('DELETE FROM processed_messages WHERE processed_at < ?', [sevenDaysAgo]);
  
  // Get the number of changes
  const stmt = db.prepare('SELECT changes() as count');
  stmt.step();
  const result = stmt.getAsObject() as { count: number };
  stmt.free();
  
  if (result.count > 0) {
    saveDatabase();
  }
  
  return result.count;
}
