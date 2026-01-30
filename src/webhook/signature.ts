import crypto from 'crypto';

/**
 * Verify the webhook signature from Meta
 * 
 * @param payload - The raw request body as a string
 * @param signature - The X-Hub-Signature-256 header value
 * @param appSecret - Your WhatsApp app secret
 * @returns true if the signature is valid
 */
export function verifySignature(
  payload: string,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) {
    console.warn('No signature provided in request');
    return false;
  }

  // Signature format: "sha256=<hash>"
  const [algorithm, hash] = signature.split('=');
  
  if (algorithm !== 'sha256' || !hash) {
    console.warn('Invalid signature format');
    return false;
  }

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch {
    return false;
  }
}

