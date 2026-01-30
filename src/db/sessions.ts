import { getDb, saveDatabase } from './database';

export type SessionState = 
  | 'NEW' 
  | 'AWAITING_NAME' 
  | 'PICK_PERSON'      // Leehe or Matan
  | 'PICK_TYPE'        // Family or Friends
  | 'PICK_FAMILY'      // Heled/Maimon or Keisari/Maggor
  | 'DONE';

export interface Session {
  user_id: number;
  state: SessionState;
  phone_numbers: string | null;
  selected_phone: string | null;
  guest_name: string | null;
  selected_person: string | null;  // 'leehe' or 'matan'
  selected_type: string | null;    // 'family' or 'friends'
  updated_at: number;
}

export function getSession(userId: number): Session | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM sessions WHERE user_id = ?');
  stmt.bind([userId]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return {
      user_id: row.user_id as number,
      state: row.state as SessionState,
      phone_numbers: row.phone_numbers as string | null,
      selected_phone: row.selected_phone as string | null,
      guest_name: row.guest_name as string | null,
      selected_person: row.selected_person as string | null,
      selected_type: row.selected_type as string | null,
      updated_at: row.updated_at as number,
    };
  }
  
  stmt.free();
  return null;
}

export function createSession(userId: number): Session {
  const db = getDb();
  const now = Date.now();
  
  db.run(
    `INSERT OR REPLACE INTO sessions (user_id, state, phone_numbers, selected_phone, guest_name, selected_person, selected_type, updated_at)
     VALUES (?, 'NEW', NULL, NULL, NULL, NULL, NULL, ?)`,
    [userId, now]
  );

  saveDatabase();

  return {
    user_id: userId,
    state: 'NEW',
    phone_numbers: null,
    selected_phone: null,
    guest_name: null,
    selected_person: null,
    selected_type: null,
    updated_at: now,
  };
}

export function updateSession(
  userId: number,
  updates: Partial<Omit<Session, 'user_id' | 'updated_at'>>
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
  if (updates.selected_person !== undefined) {
    setClauses.push('selected_person = ?');
    values.push(updates.selected_person);
  }
  if (updates.selected_type !== undefined) {
    setClauses.push('selected_type = ?');
    values.push(updates.selected_type);
  }

  values.push(userId);
  
  db.run(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE user_id = ?`,
    values
  );

  saveDatabase();
}
