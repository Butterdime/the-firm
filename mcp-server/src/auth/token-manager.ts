/**
 * Token management utilities for OAuth tokens
 * Handles storage, rotation, and validation
 */

import { encrypt, decrypt } from '../config/security.js';
import { getEnvConfig } from '../config/env.js';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

export interface StoredTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

/**
 * Store OAuth token securely
 */
export function storeToken(tokenData: TokenData): StoredTokenData {
  const envConfig = getEnvConfig();

  if (!envConfig.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured. Cannot store token securely.');
  }

  // Encrypt tokens
  const stored: StoredTokenData = {
    accessToken: encrypt(tokenData.accessToken),
    tokenType: tokenData.tokenType || 'Bearer',
    scope: tokenData.scope,
    expiresAt: tokenData.expiresAt,
  };

  if (tokenData.refreshToken) {
    stored.refreshToken = encrypt(tokenData.refreshToken);
  }

  return stored;
}

/**
 * Retrieve and decrypt OAuth token
 */
export function retrieveToken(storedTokenData: StoredTokenData): TokenData {
  const envConfig = getEnvConfig();

  if (!envConfig.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured. Cannot retrieve token.');
  }

  try {
    const tokenData: TokenData = {
      accessToken: decrypt(storedTokenData.accessToken),
      tokenType: storedTokenData.tokenType || 'Bearer',
      scope: storedTokenData.scope,
      expiresAt: storedTokenData.expiresAt,
    };

    if (storedTokenData.refreshToken) {
      tokenData.refreshToken = decrypt(storedTokenData.refreshToken);
    }

    return tokenData;
  } catch (error) {
    throw new Error(`Failed to decrypt token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(tokenData: TokenData): boolean {
  if (!tokenData.expiresAt) {
    return false; // No expiration info, assume valid
  }

  const now = Math.floor(Date.now() / 1000);
  return tokenData.expiresAt <= now;
}

/**
 * Check if token needs rotation (within 5 minutes of expiration)
 */
export function needsRotation(tokenData: TokenData): boolean {
  if (!tokenData.expiresAt) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;
  return tokenData.expiresAt - now <= fiveMinutes;
}

