/**
 * API Key authentication utilities
 * For platforms that use simple API key authentication (Vercel, Railway)
 */

import { getEnvConfig } from '../config/env.js';
import { encrypt, decrypt } from '../config/security.js';

export interface ApiKeyConfig {
  token: string;
  platform: string;
  encrypted?: boolean;
}

/**
 * Store API key securely (encrypted)
 */
export function storeApiKey(config: ApiKeyConfig): string {
  const envConfig = getEnvConfig();

  if (!envConfig.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured. Cannot store API key securely.');
  }

  if (config.encrypted) {
    // Already encrypted, return as-is
    return config.token;
  }

  // Encrypt the token
  return encrypt(config.token);
}

/**
 * Retrieve and decrypt API key
 */
export function retrieveApiKey(encryptedToken: string): string {
  const envConfig = getEnvConfig();

  if (!envConfig.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured. Cannot retrieve API key.');
  }

  try {
    return decrypt(encryptedToken);
  } catch (error) {
    throw new Error(`Failed to decrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate API key format (platform-specific)
 */
export function validateApiKey(token: string, platform: 'vercel' | 'railway' | 'google-ai'): boolean {
  if (!token || typeof token !== 'string' || token.length < 10) {
    return false;
  }

  switch (platform) {
    case 'vercel':
      // Vercel tokens typically start with a prefix
      return token.length >= 40;
    case 'railway':
      // Railway tokens are typically long strings
      return token.length >= 32;
    case 'google-ai':
      // Google AI API keys start with specific prefixes
      return token.startsWith('AIza') || token.length >= 32;
    default:
      return false;
  }
}

