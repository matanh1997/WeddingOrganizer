export type SessionState = 
  | 'NEW' 
  | 'AWAITING_NAME' 
  | 'PICK_PERSON'      // Leehe or Matan
  | 'PICK_TYPE'        // Family, Friends, or Family Friends
  | 'PICK_FAMILY'      // Heled/Maimon or Keisari/Maggor
  | 'PICK_NUM_GUESTS'  // How many guests
  | 'PICK_LIKELY'      // Will likely arrive?
  | 'CONFIRM_REPLACE'  // Confirm replacing existing guest
  | 'DONE';

export interface Session {
  user_id: number;
  state: SessionState;
  phone_numbers: string | null;
  selected_phone: string | null;
  guest_name: string | null;
  selected_person: string | null;
  selected_type: string | null;
  selected_group: string | null;   // Final group name
  num_guests: number | null;       // Number of guests
  likely_arrive: boolean | null;   // Will likely arrive
}

// Simple in-memory store
const sessions = new Map<number, Session>();

export function getSession(userId: number): Session | null {
  return sessions.get(userId) || null;
}

export function createSession(userId: number): Session {
  const session: Session = {
    user_id: userId,
    state: 'NEW',
    phone_numbers: null,
    selected_phone: null,
    guest_name: null,
    selected_person: null,
    selected_type: null,
    selected_group: null,
    num_guests: null,
    likely_arrive: null,
  };
  sessions.set(userId, session);
  return session;
}

export function updateSession(
  userId: number,
  updates: Partial<Omit<Session, 'user_id'>>
): void {
  const session = sessions.get(userId);
  if (session) {
    Object.assign(session, updates);
  }
}

export function deleteSession(userId: number): void {
  sessions.delete(userId);
}

export function getSessionCount(): number {
  return sessions.size;
}
