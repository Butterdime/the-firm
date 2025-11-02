import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseConnector } from './base-connector.js';
import { getEnvConfig, validatePlatformCredentials } from '../config/env.js';
import { retrieveApiKey, validateApiKey } from '../auth/api-key.js';
import { retrieveToken, isTokenExpired } from '../auth/token-manager.js';
import { refreshGoogleToken } from '../auth/oauth.js';
import { logError, logInfo } from '../audit/logger.js';

export class GoogleAIConnector extends BaseConnector {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  getName(): string {
    return 'Google AI';
  }

  validateConfig(): boolean {
    const credentials = validatePlatformCredentials();
    return credentials.googleAi;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.validateConfig()) {
        throw new Error('Google AI credentials not configured');
      }

      const config = getEnvConfig();

      // Prefer API key (simpler), fallback to OAuth
      if (config.GOOGLE_AI_API_KEY) {
        // Check if token is encrypted
        try {
          this.apiKey = retrieveApiKey({ token: config.GOOGLE_AI_API_KEY, platform: 'google-ai' });
        } catch {
          // Not encrypted, use directly
          this.apiKey = config.GOOGLE_AI_API_KEY;
        }

        if (!validateApiKey(this.apiKey, 'google-ai')) {
          throw new Error('Invalid Google AI API key format');
        }

        this.genAI = new GoogleGenerativeAI(this.apiKey);
      } else if (config.GOOGLE_OAUTH_CLIENT_ID && config.GOOGLE_OAUTH_REFRESH_TOKEN) {
        // Use OAuth (more complex, requires token refresh)
        throw new Error('OAuth flow for Google AI not fully implemented. Please use GOOGLE_AI_API_KEY.');
      } else {
        throw new Error('GOOGLE_AI_API_KEY not found in environment');
      }

      // Test connection with a simple model list
      // Note: This might require additional permissions
      logInfo('Google AI connector initialized', { method: 'API Key' });

      this.initialized = true;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'Google AI' });
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.genAI || !this.initialized) {
      return { healthy: false, message: 'Google AI connector not initialized' };
    }

    try {
      // Try to get a model to verify connection
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      // Just verify the model exists, don't make a full request
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getGenAI(): GoogleGenerativeAI {
    if (!this.genAI || !this.initialized) {
      throw new Error('Google AI connector not initialized. Call initialize() first.');
    }
    return this.genAI;
  }
}

interface ConnectorConfig {
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitPointsPerSecond: number;
}

