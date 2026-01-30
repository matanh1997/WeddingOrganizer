import { config, validateConfig } from './config';
import { initDatabase } from './db/database';
import { initializeSheetHeaders } from './services/sheets';
import { bot } from './bot';

async function start() {
  console.log('🚀 Starting Wedding Guest Bot...\n');

  // Validate configuration
  validateConfig();

  // Initialize database
  await initDatabase();

  // Initialize Google Sheets headers
  await initializeSheetHeaders();

  // Start bot
  if (config.webhookDomain) {
    // Webhook mode (for production on Railway/Render)
    const secretPath = `/webhook/${bot.secretPathComponent()}`;
    
    await bot.telegram.setWebhook(`${config.webhookDomain}${secretPath}`);
    
    // Use launch with webhook
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
  console.log('   - Leehe - Friends');
  console.log('   - Leehe - Family');
  console.log('   - Matan - Friends');
  console.log('   - Matan - Family');
  console.log('\n🎉 Bot is ready! Send a contact to add a guest.\n');
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start().catch((error) => {
  console.error('❌ Failed to start:', error);
  process.exit(1);
});
