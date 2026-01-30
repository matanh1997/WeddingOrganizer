/**
 * WhatsApp Contact Message structure
 */
export interface WhatsAppContact {
  name?: {
    formatted_name?: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: Array<{
    phone?: string;
    type?: string;
    wa_id?: string;
  }>;
}

export interface ParsedContact {
  name: string | null;
  phoneNumbers: string[];
}

/**
 * Parse a contact message from WhatsApp webhook payload
 * Returns the contact's name and all phone numbers
 */
export function parseContactMessage(contacts: WhatsAppContact[]): ParsedContact {
  if (!contacts || contacts.length === 0) {
    return { name: null, phoneNumbers: [] };
  }

  const contact = contacts[0];

  // Extract name
  let name: string | null = null;
  if (contact.name) {
    name = contact.name.formatted_name ||
      [contact.name.first_name, contact.name.last_name].filter(Boolean).join(' ') ||
      null;
  }

  // Extract phone numbers
  const phoneNumbers: string[] = [];
  if (contact.phones && Array.isArray(contact.phones)) {
    for (const phone of contact.phones) {
      if (phone.phone) {
        // Clean up the phone number (remove spaces, keep + and digits)
        const cleaned = phone.phone.replace(/[^\d+]/g, '');
        if (cleaned) {
          phoneNumbers.push(cleaned);
        }
      }
    }
  }

  return { name, phoneNumbers };
}

/**
 * Format a phone number for display (add some readability)
 */
export function formatPhoneForDisplay(phone: string): string {
  // If it's an international number starting with +
  if (phone.startsWith('+')) {
    // For Israeli numbers (+972...)
    if (phone.startsWith('+972') && phone.length >= 12) {
      const local = phone.slice(4); // Remove +972
      return `+972-${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
    }
    // Generic international format
    return phone;
  }
  
  // For local numbers (assume Israeli format)
  if (phone.length === 10 && phone.startsWith('0')) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  
  return phone;
}

