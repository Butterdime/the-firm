import axios, { AxiosInstance } from 'axios';
import { BaseConnector } from './base-connector.js';
import { getEnvConfig, validatePlatformCredentials } from '../config/env.js';
import { retrieveApiKey, validateApiKey } from '../auth/api-key.js';
import { logError, logInfo } from '../audit/logger.js';

export class VercelConnector extends BaseConnector {
  private client: AxiosInstance | null = null;
  private token: string | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  getName(): string {
    return 'Vercel';
  }

  validateConfig(): boolean {
    const credentials = validatePlatformCredentials();
    return credentials.vercel;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.validateConfig()) {
        throw new Error('Vercel credentials not configured');
      }

      const config = getEnvConfig();

      if (!config.VERCEL_TOKEN) {
        throw new Error('VERCEL_TOKEN not found in environment');
      }

      // Check if token is encrypted
      try {
        this.token = retrieveApiKey({ token: config.VERCEL_TOKEN, platform: 'vercel' });
      } catch {
        // Not encrypted, use directly
        this.token = config.VERCEL_TOKEN;
      }

      if (!validateApiKey(this.token, 'vercel')) {
        throw new Error('Invalid Vercel token format');
      }

      this.client = axios.create({
        baseURL: 'https://api.vercel.com',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      // Test connection
      const response = await this.client.get('/v2/user');
      logInfo('Vercel connector initialized', { username: response.data.user?.username });

      this.initialized = true;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'Vercel' });
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.client || !this.initialized) {
      return { healthy: false, message: 'Vercel connector not initialized' };
    }

    try {
      await this.client.get('/v2/user');
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getClient(): AxiosInstance {
    if (!this.client || !this.initialized) {
      throw new Error('Vercel connector not initialized. Call initialize() first.');
    }
    return this.client;
  }
}

interface ConnectorConfig {
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitPointsPerSecond: number;
}

