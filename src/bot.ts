import { Telegraf, Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { config, GROUPS, GroupId } from './config';
import { getSession, createSession, updateSession, Session } from './db/sessions';
import { appendGuestToSheet } from './services/sheets';

// Create bot instance
export const bot = new Telegraf(config.telegram.token);

// Helper to format phone number for display
function formatPhone(phone: string): string {
  if (phone.startsWith('+972') && phone.length >= 12) {
    const local = phone.slice(4);
    return `+972-${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  }
  return phone;
}

// Normalize phone number to +972 format
function normalizePhone(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with 0, replace with +972 (Israeli local format)
  if (cleaned.startsWith('0')) {
    cleaned = '+972' + cleaned.slice(1);
  }
  // If starts with 972 without +, add the +
  else if (cleaned.startsWith('972')) {
    cleaned = '+' + cleaned;
  }
  // If doesn't start with +, assume it needs +972
  else if (!cleaned.startsWith('+')) {
    cleaned = '+972' + cleaned;
  }
  
  return cleaned;
}

// Extract phone numbers from a contact
function extractPhones(contact: Message.ContactMessage['contact']): string[] {
  const phones: string[] = [];
  if (contact.phone_number) {
    const phone = normalizePhone(contact.phone_number);
    phones.push(phone);
  }
  return phones;
}

// /start command
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  createSession(userId);
  
  await ctx.reply(
    '👋 ברוכים הבאים לבוט האורחים של ליהיא ומתן!\n\n' +
    '🇮🇱 *איך להוסיף אורח:*\n' +
    '1. שלחו איש קשר (📎 → Contact)\n' +
    '2. הקלידו את שם האורח\n' +
    '3. בחרו קבוצה\n\n' +
    '🇬🇧 *To add a guest:*\n' +
    '1. Share a contact\n' +
    '2. Type the guest name\n' +
    '3. Choose a group\n\n' +
    'שלחו איש קשר כדי להתחיל! 📱',
    { parse_mode: 'Markdown' }
  );
});

// /help command
bot.help(async (ctx) => {
  await ctx.reply(
    '📖 *עזרה / Help*\n\n' +
    '*פקודות:*\n' +
    '/start - התחל מחדש\n' +
    '/cancel - בטל פעולה נוכחית',
    { parse_mode: 'Markdown' }
  );
});

// /cancel command
bot.command('cancel', async (ctx) => {
  const userId = ctx.from.id;
  createSession(userId);
  await ctx.reply('❌ בוטל. שלחו איש קשר להוספת אורח חדש.');
});

// Handle contact messages
bot.on('contact', async (ctx) => {
  const userId = ctx.from.id;
  const contact = ctx.message.contact;
  
  let session = getSession(userId);
  if (!session) {
    session = createSession(userId);
  }

  const phones = extractPhones(contact);
  
  if (phones.length === 0) {
    await ctx.reply('❌ לאיש הקשר אין מספר טלפון. נסו איש קשר אחר.');
    return;
  }

  const phone = phones[0];
  updateSession(userId, {
    state: 'AWAITING_NAME',
    phone_numbers: JSON.stringify(phones),
    selected_phone: phone,
  });

  const displayPhone = formatPhone(phone);
  await ctx.reply(
    `✅ *מספר:* ${displayPhone}\n\n` +
    '📝 עכשיו הקלידו את *שם האורח המלא*:',
    { parse_mode: 'Markdown' }
  );
});

// Handle text messages
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  if (text.startsWith('/')) return;

  let session = getSession(userId);
  if (!session) {
    session = createSession(userId);
  }

  switch (session.state) {
    case 'NEW':
    case 'DONE':
      await ctx.reply('📱 שלחו איש קשר כדי להוסיף אורח.\nלחצו על 📎 ובחרו "Contact"');
      break;

    case 'AWAITING_NAME':
      await handleNameInput(ctx, session, text);
      break;

    default:
      await ctx.reply('👆 בחרו מהכפתורים למעלה.');
  }
});

// Handle name input
async function handleNameInput(ctx: any, session: Session, name: string) {
  const userId = ctx.from!.id;
  
  if (name.length < 2) {
    await ctx.reply('❌ השם קצר מדי. הקלידו שם מלא:');
    return;
  }

  updateSession(userId, {
    state: 'PICK_PERSON',
    guest_name: name,
  });

  await ctx.reply(`✅ *שם:* ${name}`, { parse_mode: 'Markdown' });
  await sendPersonSelection(ctx);
}

// Step 1: Choose Leehe or Matan
async function sendPersonSelection(ctx: any) {
  await ctx.reply(
    '👫 של מי האורח?\n*Whose guest is this?*',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💃 ליהיא / Leehe', 'person:leehe')],
        [Markup.button.callback('🕺 מתן / Matan', 'person:matan')],
      ])
    }
  );
}

// Handle person selection (Leehe/Matan)
bot.action(/^person:(leehe|matan)$/, async (ctx) => {
  const userId = ctx.from!.id;
  const person = ctx.match[1];
  
  const session = getSession(userId);
  if (!session || session.state !== 'PICK_PERSON') {
    await ctx.answerCbQuery('שלחו איש קשר להתחלה');
    return;
  }

  updateSession(userId, {
    state: 'PICK_TYPE',
    selected_person: person,
  });

  await ctx.answerCbQuery();
  
  const personName = person === 'leehe' ? 'ליהיא' : 'מתן';
  await ctx.editMessageText(
    `✅ ${personName}\n\n👥 בחרו קטגוריה:\n*Choose category:*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🎉 חברים / Friends', 'type:friends')],
        [Markup.button.callback('👨‍👩‍👧‍👦 משפחה / Family', 'type:family')],
        [Markup.button.callback('👨‍👩‍👧‍👦🎉 חברי משפחה / Family Friends', 'type:familyfriends')],
      ])
    }
  );
});

// Handle type selection (Friends/Family/Family Friends)
bot.action(/^type:(friends|family|familyfriends)$/, async (ctx) => {
  const userId = ctx.from!.id;
  const type = ctx.match[1];
  
  const session = getSession(userId);
  if (!session || session.state !== 'PICK_TYPE') {
    await ctx.answerCbQuery('שלחו איש קשר להתחלה');
    return;
  }

  const person = session.selected_person;
  
  if (type === 'friends') {
    // Friends - no further split, save directly
    const groupId: GroupId = person === 'leehe' ? 'leehe_friends' : 'matan_friends';
    await saveGuest(ctx, session, groupId);
  } else {
    // Family or Family Friends - need to pick specific family
    updateSession(userId, {
      state: 'PICK_FAMILY',
      selected_type: type,
    });

    await ctx.answerCbQuery();
    
    const typeLabel = type === 'family' ? 'משפחה' : 'חברי משפחה';
    
    if (person === 'leehe') {
      await ctx.editMessageText(
        `✅ ${typeLabel}\n\n👪 איזו משפחה?\n*Which family?*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('קיסרי / Keisari', 'family:keisari')],
            [Markup.button.callback('מגור / Maggor', 'family:maggor')],
          ])
        }
      );
    } else {
      await ctx.editMessageText(
        `✅ ${typeLabel}\n\n👪 איזו משפחה?\n*Which family?*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('חלד / Heled', 'family:heled')],
            [Markup.button.callback('מימון / Maimon', 'family:maimon')],
          ])
        }
      );
    }
  }
});

// Handle family selection
bot.action(/^family:(keisari|maggor|heled|maimon)$/, async (ctx) => {
  const userId = ctx.from!.id;
  const family = ctx.match[1];
  
  const session = getSession(userId);
  if (!session || session.state !== 'PICK_FAMILY') {
    await ctx.answerCbQuery('שלחו איש קשר להתחלה');
    return;
  }

  const person = session.selected_person;
  const type = session.selected_type; // 'family' or 'familyfriends'
  
  // Determine the final group ID
  let groupId: GroupId;
  if (person === 'leehe') {
    if (type === 'family') {
      groupId = family === 'keisari' ? 'leehe_family_keisari' : 'leehe_family_maggor';
    } else {
      groupId = family === 'keisari' ? 'leehe_familyfriends_keisari' : 'leehe_familyfriends_maggor';
    }
  } else {
    if (type === 'family') {
      groupId = family === 'heled' ? 'matan_family_heled' : 'matan_family_maimon';
    } else {
      groupId = family === 'heled' ? 'matan_familyfriends_heled' : 'matan_familyfriends_maimon';
    }
  }

  await saveGuest(ctx, session, groupId);
});

// Save guest to Google Sheets
async function saveGuest(ctx: any, session: Session, groupId: GroupId) {
  const userId = ctx.from!.id;
  const { guest_name, selected_phone } = session;
  
  if (!guest_name || !selected_phone) {
    await ctx.answerCbQuery('חסרים פרטים, התחילו מחדש');
    createSession(userId);
    return;
  }

  const groupName = GROUPS[groupId];

  try {
    await appendGuestToSheet({
      timestamp: new Date().toISOString(),
      guestName: guest_name,
      phoneNumber: selected_phone,
      group: groupName,
      addedBy: ctx.from!.username || ctx.from!.id.toString(),
    });

    updateSession(userId, { state: 'DONE' });

    await ctx.answerCbQuery('✅ נוסף בהצלחה!');
    
    await ctx.editMessageText(
      `🎉 *האורח נוסף בהצלחה!*\n\n` +
      `👤 *שם:* ${guest_name}\n` +
      `📞 *טלפון:* ${formatPhone(selected_phone)}\n` +
      `👥 *קבוצה:* ${groupName}\n\n` +
      `שלחו איש קשר נוסף להוספת אורח 📱`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Failed to save:', error);
    await ctx.answerCbQuery('שגיאה בשמירה, נסו שוב');
  }
}

// Error handling
bot.catch((err: any, ctx: any) => {
  console.error('Bot error:', err);
  ctx.reply('❌ אירעה שגיאה. נסו שוב או שלחו /start');
});
