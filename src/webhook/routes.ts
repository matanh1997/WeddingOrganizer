import { Router, Request, Response } from 'express';
import { config } from '../config';
import { verifySignature } from './signature';
import { handleIncomingMessage } from '../bot/stateMachine';
import { isMessageProcessed, markMessageProcessed } from '../db/idempotency';

export const webhookRoutes = Router();

/**
 * Webhook Verification (GET)
 * Meta sends a GET request to verify the webhook URL
 */
webhookRoutes.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('📥 Webhook verification request:', { mode, token: token ? '***' : undefined });

  if (mode === 'subscribe' && token === config.webhook.verifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.warn('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * Webhook Handler (POST)
 * Meta sends incoming messages here
 */
webhookRoutes.post('/', async (req: Request, res: Response) => {
  // Always respond quickly to Meta
  res.sendStatus(200);

  try {
    // Verify signature if app secret is configured
    if (config.whatsapp.appSecret) {
      const signature = req.headers['x-hub-signature-256'] as string;
      const body = JSON.stringify(req.body);
      
      if (!verifySignature(body, signature, config.whatsapp.appSecret)) {
        console.warn('❌ Invalid webhook signature');
        return;
      }
    }

    const body = req.body;

    // Check if this is a WhatsApp message webhook
    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    // Extract messages from the webhook payload
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      // This might be a status update, not an incoming message
      return;
    }

    for (const message of value.messages) {
      const senderId = message.from;
      const messageId = message.id;

      // Idempotency check
      if (isMessageProcessed(messageId)) {
        console.log(`⏭️ Skipping already processed message: ${messageId}`);
        continue;
      }

      console.log(`📨 Processing message from ${senderId}:`, {
        type: message.type,
        id: messageId,
      });

      // Handle the message
      await handleIncomingMessage(senderId, message);

      // Mark as processed
      markMessageProcessed(messageId);
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
  }
});

