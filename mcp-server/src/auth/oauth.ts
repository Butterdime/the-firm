/**
 * OAuth2 flow handlers for GitHub and Google
 * Handles authorization code flow
 */

import { getEnvConfig } from '../config/env.js';
import { storeToken, TokenData } from './token-manager.js';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface AuthorizationUrlOptions {
  state?: string;
  additionalParams?: Record<string, string>;
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthorizationUrl(options: AuthorizationUrlOptions = {}): string {
  const config = getEnvConfig();

  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_REDIRECT_URI) {
    throw new Error('GitHub OAuth not configured. Missing GITHUB_CLIENT_ID or GITHUB_REDIRECT_URI.');
  }

  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: config.GITHUB_REDIRECT_URI,
    scope: 'repo workflow admin:repo_hook',
    state: options.state || generateState(),
    ...options.additionalParams,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange GitHub authorization code for access token
 */
export async function exchangeGitHubCode(code: string): Promise<TokenData> {
  const config = getEnvConfig();

  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    throw new Error('GitHub OAuth not configured. Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET.');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange GitHub code: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
    refresh_token?: string;
  };

  if (!data.access_token) {
    throw new Error('GitHub OAuth response missing access_token');
  }

  const expiresAt = data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined;

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
    expiresAt,
    refreshToken: data.refresh_token,
  };
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthorizationUrl(options: AuthorizationUrlOptions = {}): string {
  const config = getEnvConfig();

  if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error('Google OAuth not configured. Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_REDIRECT_URI.');
  }

  const params = new URLSearchParams({
    client_id: config.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: config.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/generative-language',
    access_type: 'offline',
    prompt: 'consent',
    state: options.state || generateState(),
    ...options.additionalParams,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange Google authorization code for access token
 */
export async function exchangeGoogleCode(code: string): Promise<TokenData> {
  const config = getEnvConfig();

  if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET || !config.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error('Google OAuth not configured. Missing required credentials.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: config.GOOGLE_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: config.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Google code: ${response.statusText} - ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };

  if (!data.access_token) {
    throw new Error('Google OAuth response missing access_token');
  }

  const expiresAt = data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined;

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
    expiresAt,
    refreshToken: data.refresh_token,
  };
}

/**
 * Refresh Google access token using refresh token
 */
export async function refreshGoogleToken(refreshToken: string): Promise<TokenData> {
  const config = getEnvConfig();

  if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('Google OAuth not configured. Missing required credentials.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: config.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Google token: ${response.statusText} - ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!data.access_token) {
    throw new Error('Google token refresh response missing access_token');
  }

  const expiresAt = data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined;

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
    expiresAt,
    refreshToken, // Keep the same refresh token
  };
}

/**
 * Generate random state string for OAuth
 */
function generateState(): string {
  return Buffer.from(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)).toString('base64');
}

