import express from 'express';
import { config, validateConfig } from './config';
import { webhookRoutes } from './webhook/routes';
import { initDatabase } from './db/database';
import { initializeSheetHeaders } from './services/sheets';

const app = express();

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook routes
app.use('/webhook', webhookRoutes);

// Start server
async function start() {
  validateConfig();
  
  // Initialize database
  await initDatabase();
  
  // Initialize Google Sheets headers (if not already set)
  await initializeSheetHeaders();
  
  app.listen(config.port, () => {
    console.log(`🚀 Wedding Bot server running on port ${config.port}`);
    console.log(`📱 Webhook URL: http://localhost:${config.port}/webhook`);
    console.log(`\n📋 Groups configured:`);
    console.log('   - Leehe - Friends');
    console.log('   - Leehe - Family');
    console.log('   - Matan - Friends');
    console.log('   - Matan - Family');
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

