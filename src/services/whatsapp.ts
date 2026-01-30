import axios from 'axios';
import { config, GROUPS, Group } from '../config';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

/**
 * Send a text message to a WhatsApp user
 */
export async function sendTextMessage(to: string, text: string): Promise<void> {
  try {
    await axios.post<WhatsAppApiResponse>(
      `${WHATSAPP_API_URL}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Sent text message to ${to}`);
  } catch (error) {
    console.error('❌ Failed to send text message:', error);
    throw error;
  }
}

/**
 * Send an interactive list message for phone number selection
 */
export async function sendPhoneSelectionList(
  to: string,
  phoneNumbers: string[]
): Promise<void> {
  const rows = phoneNumbers.map((phone, index) => ({
    id: `phone_${index}`,
    title: phone.slice(0, 24), // Max 24 chars for title
    description: `Select this number`,
  }));

  try {
    await axios.post<WhatsAppApiResponse>(
      `${WHATSAPP_API_URL}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: {
            type: 'text',
            text: 'Multiple Numbers Found',
          },
          body: {
            text: 'This contact has multiple phone numbers. Please select which one to use:',
          },
          action: {
            button: 'Select Number',
            sections: [
              {
                title: 'Phone Numbers',
                rows,
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Sent phone selection list to ${to}`);
  } catch (error) {
    console.error('❌ Failed to send phone selection list:', error);
    throw error;
  }
}

/**
 * Send an interactive list message for group selection
 */
export async function sendGroupSelectionList(to: string): Promise<void> {
  const rows = GROUPS.map((group: Group) => ({
    id: group.id,
    title: group.displayName,
    description: `Add guest to ${group.displayName}`,
  }));

  try {
    await axios.post<WhatsAppApiResponse>(
      `${WHATSAPP_API_URL}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: {
            type: 'text',
            text: 'Choose a Group',
          },
          body: {
            text: 'Which group does this guest belong to?',
          },
          action: {
            button: 'Select Group',
            sections: [
              {
                title: 'Guest Groups',
                rows,
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Sent group selection list to ${to}`);
  } catch (error) {
    console.error('❌ Failed to send group selection list:', error);
    throw error;
  }
}

