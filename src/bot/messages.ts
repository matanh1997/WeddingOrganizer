/**
 * Bot message templates
 * All user-facing text in one place for easy editing
 */

export const MESSAGES = {
  // Welcome / Start
  WELCOME: '👋 Welcome to Leehe & Matan\'s Wedding Guest Manager!\n\nTo add a guest, please share a contact card.',
  
  // Error states
  NEED_CONTACT: '📱 Please share a contact card to add a guest.\n\nJust tap the attachment icon and select "Contact".',
  
  NO_PHONE_IN_CONTACT: '❌ This contact doesn\'t have a phone number.\n\nPlease share a contact that includes a phone number.',
  
  // Phone selection (when multiple numbers)
  PHONE_SELECTED: (phone: string) => 
    `✅ Got it! Using: ${phone}\n\nNow please type the guest's full name:`,
  
  // Name prompt
  ASK_NAME: '📝 Please type the guest\'s full name:',
  
  // Name received
  NAME_RECEIVED: (name: string) =>
    `✅ Name: ${name}\n\nNow choose which group this guest belongs to:`,
  
  // Success
  GUEST_ADDED: (name: string, phone: string, group: string) =>
    `🎉 Guest added successfully!\n\n` +
    `👤 Name: ${name}\n` +
    `📞 Phone: ${phone}\n` +
    `👥 Group: ${group}\n\n` +
    `Send another contact to add more guests.`,
  
  // Errors
  INVALID_GROUP: '❌ Please select a group from the list.',
  
  ERROR_GENERIC: '❌ Something went wrong. Please try again.\n\nSend a contact card to start over.',
  
  // Help
  HELP: '📖 How to use this bot:\n\n' +
    '1. Share a contact card (tap 📎 → Contact)\n' +
    '2. If the contact has multiple numbers, select one\n' +
    '3. Type the guest\'s name\n' +
    '4. Choose a group (Leehe/Matan - Friends/Family)\n\n' +
    'The guest will be added to your wedding spreadsheet!',
} as const;

