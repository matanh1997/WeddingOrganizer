import { getDb, saveDatabase } from './database';

export type SessionState = 'NEW' | 'PICK_PHONE' | 'AWAITING_NAME' | 'AWAITING_GROUP' | 'DONE';

export interface Session {
  sender_id: string;
  state: SessionState;
  phone_numbers: string | null;
  selected_phone: string | null;
  guest_name: string | null;
  updated_at: number;
}

export function getSession(senderId: string): Session | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM sessions WHERE sender_id = ?');
  stmt.bind([senderId]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return {
      sender_id: row.sender_id as string,
      state: row.state as SessionState,
      phone_numbers: row.phone_numbers as string | null,
      selected_phone: row.selected_phone as string | null,
      guest_name: row.guest_name as string | null,
      updated_at: row.updated_at as number,
    };
  }
  
  stmt.free();
  return null;
}

export function createSession(senderId: string): Session {
  const db = getDb();
  const now = Date.now();
  
  // Use INSERT OR REPLACE to handle existing sessions
  db.run(
    `INSERT OR REPLACE INTO sessions (sender_id, state, phone_numbers, selected_phone, guest_name, updated_at)
     VALUES (?, 'NEW', NULL, NULL, NULL, ?)`,
    [senderId, now]
  );

  saveDatabase();

  return {
    sender_id: senderId,
    state: 'NEW',
    phone_numbers: null,
    selected_phone: null,
    guest_name: null,
    updated_at: now,
  };
}

export function updateSession(
  senderId: string,
  updates: Partial<Omit<Session, 'sender_id' | 'updated_at'>>
): void {
  const db = getDb();
  const now = Date.now();
  
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];

  if (updates.state !== undefined) {
    setClauses.push('state = ?');
    values.push(updates.state);
  }
  if (updates.phone_numbers !== undefined) {
    setClauses.push('phone_numbers = ?');
    values.push(updates.phone_numbers);
  }
  if (updates.selected_phone !== undefined) {
    setClauses.push('selected_phone = ?');
    values.push(updates.selected_phone);
  }
  if (updates.guest_name !== undefined) {
    setClauses.push('guest_name = ?');
    values.push(updates.guest_name);
  }

  values.push(senderId);
  
  db.run(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE sender_id = ?`,
    values
  );

  saveDatabase();
}

export function resetSession(senderId: string): void {
  createSession(senderId);
}
