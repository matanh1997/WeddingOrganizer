import { config, validateConfig } from './config';
import { initializeSheetHeaders, loadExistingGuests } from './services/sheets';
import { bot } from './bot';

async function start() {
  console.log('🚀 Starting Wedding Guest Bot...\n');

  // Validate configuration
  validateConfig();

  // Initialize Google Sheets headers
  await initializeSheetHeaders();
  
  // Load existing guests into memory for duplicate detection
  await loadExistingGuests();

  // Start bot
  if (config.webhookDomain) {
    // Webhook mode (for production on Railway/Render)
    await bot.launch({
      webhook: {
        domain: config.webhookDomain,
        port: config.port,
      },
    });
    
    console.log(`✅ Bot running in webhook mode on port ${config.port}`);
  } else {
    // Polling mode (for local development)
    await bot.launch();
    console.log('✅ Bot running in polling mode');
  }

  console.log('\n📋 Groups configured:');
  console.log('   - Leehe: Friends, Family (Keisari/Maggor), Family Friends');
  console.log('   - Matan: Friends, Family (Heled/Maimon), Family Friends');
  console.log('\n🎉 Bot is ready! Send a contact to add a guest.\n');
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start().catch((error) => {
  console.error('❌ Failed to start:', error);
  process.exit(1);
});
