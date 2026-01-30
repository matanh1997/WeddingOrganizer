import { 
  getSession, 
  createSession, 
  updateSession, 
  Session, 
  SessionState 
} from '../db/sessions';
import { parseContactMessage, formatPhoneForDisplay } from './contactParser';
import { MESSAGES } from './messages';
import { 
  sendTextMessage, 
  sendPhoneSelectionList, 
  sendGroupSelectionList 
} from '../services/whatsapp';
import { appendGuestToSheet } from '../services/sheets';
import { GROUPS } from '../config';

/**
 * WhatsApp incoming message types
 */
interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'contacts' | 'interactive' | 'image' | 'audio' | 'video' | 'document' | 'location';
  text?: { body: string };
  contacts?: Array<{
    name?: { formatted_name?: string; first_name?: string; last_name?: string };
    phones?: Array<{ phone?: string; type?: string; wa_id?: string }>;
  }>;
  interactive?: {
    type: 'list_reply' | 'button_reply';
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
}

/**
 * Main message handler - routes messages based on conversation state
 */
export async function handleIncomingMessage(
  senderId: string,
  message: WhatsAppMessage
): Promise<void> {
  // Get or create session
  let session = getSession(senderId);
  if (!session) {
    session = createSession(senderId);
  }

  console.log(`🔄 State machine: ${session.state} for ${senderId}`);

  try {
    switch (session.state) {
      case 'NEW':
      case 'DONE':
        await handleNewState(senderId, message, session);
        break;

      case 'PICK_PHONE':
        await handlePickPhoneState(senderId, message, session);
        break;

      case 'AWAITING_NAME':
        await handleAwaitingNameState(senderId, message, session);
        break;

      case 'AWAITING_GROUP':
        await handleAwaitingGroupState(senderId, message, session);
        break;

      default:
        console.warn(`Unknown state: ${session.state}`);
        await sendTextMessage(senderId, MESSAGES.ERROR_GENERIC);
        createSession(senderId);
    }
  } catch (error) {
    console.error('Error in state machine:', error);
    await sendTextMessage(senderId, MESSAGES.ERROR_GENERIC);
  }
}

/**
 * Handle NEW or DONE state - expecting a contact card
 */
async function handleNewState(
  senderId: string,
  message: WhatsAppMessage,
  session: Session
): Promise<void> {
  // Check for help command
  if (message.type === 'text' && message.text?.body.toLowerCase() === 'help') {
    await sendTextMessage(senderId, MESSAGES.HELP);
    return;
  }

  // Expect a contact card
  if (message.type !== 'contacts' || !message.contacts) {
    await sendTextMessage(senderId, MESSAGES.NEED_CONTACT);
    return;
  }

  // Parse the contact
  const { phoneNumbers } = parseContactMessage(message.contacts);

  if (phoneNumbers.length === 0) {
    await sendTextMessage(senderId, MESSAGES.NO_PHONE_IN_CONTACT);
    return;
  }

  // Store phone numbers in session
  updateSession(senderId, {
    phone_numbers: JSON.stringify(phoneNumbers),
  });

  if (phoneNumbers.length === 1) {
    // Single phone number - go directly to name prompt
    updateSession(senderId, {
      state: 'AWAITING_NAME',
      selected_phone: phoneNumbers[0],
    });
    
    const displayPhone = formatPhoneForDisplay(phoneNumbers[0]);
    await sendTextMessage(senderId, MESSAGES.PHONE_SELECTED(displayPhone));
  } else {
    // Multiple phone numbers - ask user to select
    updateSession(senderId, {
      state: 'PICK_PHONE',
    });
    
    const displayNumbers = phoneNumbers.map(formatPhoneForDisplay);
    await sendPhoneSelectionList(senderId, displayNumbers);
  }
}

/**
 * Handle PICK_PHONE state - expecting phone selection from list
 */
async function handlePickPhoneState(
  senderId: string,
  message: WhatsAppMessage,
  session: Session
): Promise<void> {
  // Must be an interactive list reply
  if (message.type !== 'interactive' || !message.interactive?.list_reply) {
    await sendTextMessage(senderId, 'Please select a phone number from the list.');
    
    // Re-send the list
    const phoneNumbers = JSON.parse(session.phone_numbers || '[]') as string[];
    const displayNumbers = phoneNumbers.map(formatPhoneForDisplay);
    await sendPhoneSelectionList(senderId, displayNumbers);
    return;
  }

  // Get the selected phone index from the id (format: "phone_0", "phone_1", etc.)
  const selectedId = message.interactive.list_reply.id;
  const indexMatch = selectedId.match(/phone_(\d+)/);
  
  if (!indexMatch) {
    await sendTextMessage(senderId, MESSAGES.ERROR_GENERIC);
    createSession(senderId);
    return;
  }

  const index = parseInt(indexMatch[1], 10);
  const phoneNumbers = JSON.parse(session.phone_numbers || '[]') as string[];
  
  if (index < 0 || index >= phoneNumbers.length) {
    await sendTextMessage(senderId, MESSAGES.ERROR_GENERIC);
    createSession(senderId);
    return;
  }

  const selectedPhone = phoneNumbers[index];

  // Update session with selected phone and move to name state
  updateSession(senderId, {
    state: 'AWAITING_NAME',
    selected_phone: selectedPhone,
  });

  const displayPhone = formatPhoneForDisplay(selectedPhone);
  await sendTextMessage(senderId, MESSAGES.PHONE_SELECTED(displayPhone));
}

/**
 * Handle AWAITING_NAME state - expecting text with guest name
 */
async function handleAwaitingNameState(
  senderId: string,
  message: WhatsAppMessage,
  session: Session
): Promise<void> {
  // Must be a text message
  if (message.type !== 'text' || !message.text?.body) {
    await sendTextMessage(senderId, MESSAGES.ASK_NAME);
    return;
  }

  const guestName = message.text.body.trim();

  // Basic validation - at least 2 characters
  if (guestName.length < 2) {
    await sendTextMessage(senderId, 'Please enter a valid name (at least 2 characters).');
    return;
  }

  // Store name and move to group selection
  updateSession(senderId, {
    state: 'AWAITING_GROUP',
    guest_name: guestName,
  });

  await sendTextMessage(senderId, MESSAGES.NAME_RECEIVED(guestName));
  await sendGroupSelectionList(senderId);
}

/**
 * Handle AWAITING_GROUP state - expecting group selection from list
 */
async function handleAwaitingGroupState(
  senderId: string,
  message: WhatsAppMessage,
  session: Session
): Promise<void> {
  // Must be an interactive list reply
  if (message.type !== 'interactive' || !message.interactive?.list_reply) {
    await sendTextMessage(senderId, MESSAGES.INVALID_GROUP);
    await sendGroupSelectionList(senderId);
    return;
  }

  const selectedGroupId = message.interactive.list_reply.id;
  
  // Validate group ID
  const group = GROUPS.find(g => g.id === selectedGroupId);
  if (!group) {
    await sendTextMessage(senderId, MESSAGES.INVALID_GROUP);
    await sendGroupSelectionList(senderId);
    return;
  }

  // Get stored data
  const guestName = session.guest_name;
  const selectedPhone = session.selected_phone;

  if (!guestName || !selectedPhone) {
    await sendTextMessage(senderId, MESSAGES.ERROR_GENERIC);
    createSession(senderId);
    return;
  }

  // Append to Google Sheets
  try {
    await appendGuestToSheet({
      timestamp: new Date().toISOString(),
      guestName,
      phoneNumber: selectedPhone,
      group: group.displayName,
      addedBy: senderId,
    });

    // Success! Send confirmation and reset to DONE
    updateSession(senderId, { state: 'DONE' });
    
    const displayPhone = formatPhoneForDisplay(selectedPhone);
    await sendTextMessage(
      senderId, 
      MESSAGES.GUEST_ADDED(guestName, displayPhone, group.displayName)
    );
  } catch (error) {
    console.error('Failed to append to Google Sheets:', error);
    await sendTextMessage(
      senderId, 
      '❌ Failed to save to the spreadsheet. Please try again.'
    );
    // Don't reset state - let them try again
  }
}

