import { Telegraf, Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { config, GROUPS, GroupId } from './config';
import { getSession, createSession, updateSession, Session } from './db/sessions';
import { 
  appendGuestToSheet, 
  getExistingGuest, 
  deleteGuest,
  normalizePhoneNumber,
  ExistingGuest 
} from './services/sheets';

// Create bot instance
export const bot = new Telegraf(config.telegram.token);

// Helper to format phone number for display
function formatPhone(phone: string): string {
  // First normalize the phone
  const normalized = normalizePhoneNumber(phone);
  
  if (normalized.startsWith('+972') && normalized.length >= 13) {
    const local = normalized.slice(4);
    return `+972-${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  }
  return normalized;
}

// Extract and normalize phone from contact
function extractPhone(contact: Message.ContactMessage['contact']): string | null {
  if (!contact.phone_number) return null;
  return normalizePhoneNumber(contact.phone_number);
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

  const phone = extractPhone(contact);
  
  if (!phone) {
    await ctx.reply('❌ לאיש הקשר אין מספר טלפון. נסו איש קשר אחר.');
    return;
  }

  // Check if this phone already exists
  const existingGuest = getExistingGuest(phone);
  
  if (existingGuest) {
    // Show existing entry and ask if they want to replace
    updateSession(userId, {
      state: 'CONFIRM_REPLACE',
      selected_phone: phone,
    });

    await ctx.reply(
      `⚠️ *מספר זה כבר קיים ברשימה!*\n\n` +
      `👤 *שם:* ${existingGuest.guestName}\n` +
      `📞 *טלפון:* ${formatPhone(existingGuest.phoneNumber)}\n` +
      `👥 *קבוצה:* ${existingGuest.group}\n` +
      `📅 *נוסף:* ${new Date(existingGuest.timestamp).toLocaleDateString('he-IL')}\n\n` +
      `האם למחוק ולהחליף?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ כן, החלף / Yes, replace', 'replace:yes')],
          [Markup.button.callback('❌ לא, בטל / No, cancel', 'replace:no')],
        ])
      }
    );
    return;
  }

  // No duplicate, proceed normally
  updateSession(userId, {
    state: 'AWAITING_NAME',
    phone_numbers: JSON.stringify([phone]),
    selected_phone: phone,
  });

  const displayPhone = formatPhone(phone);
  await ctx.reply(
    `✅ *מספר:* ${displayPhone}\n\n` +
    '📝 עכשיו הקלידו את *שם האורח המלא*:',
    { parse_mode: 'Markdown' }
  );
});

// Handle replace confirmation
bot.action(/^replace:(yes|no)$/, async (ctx) => {
  const userId = ctx.from!.id;
  const choice = ctx.match[1];
  
  const session = getSession(userId);
  if (!session || session.state !== 'CONFIRM_REPLACE') {
    await ctx.answerCbQuery('שלחו איש קשר להתחלה');
    return;
  }

  const phone = session.selected_phone;
  
  if (choice === 'no' || !phone) {
    createSession(userId);
    await ctx.answerCbQuery('בוטל');
    await ctx.editMessageText('❌ בוטל. שלחו איש קשר להוספת אורח חדש.');
    return;
  }

  // Delete existing and proceed
  await ctx.answerCbQuery('מוחק...');
  
  const deleted = await deleteGuest(phone);
  if (!deleted) {
    await ctx.editMessageText('❌ שגיאה במחיקה. נסו שוב.');
    createSession(userId);
    return;
  }

  // Now proceed with adding
  updateSession(userId, {
    state: 'AWAITING_NAME',
    phone_numbers: JSON.stringify([phone]),
  });

  const displayPhone = formatPhone(phone);
  await ctx.editMessageText(
    `🗑️ הרשומה הקודמת נמחקה.\n\n` +
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

    case 'CONFIRM_REPLACE':
      await ctx.reply('👆 בחרו מהכפתורים למעלה.');
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
