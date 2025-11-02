import axios, { AxiosInstance } from 'axios';
import { BaseConnector } from './base-connector.js';
import { getEnvConfig, validatePlatformCredentials } from '../config/env.js';
import { retrieveApiKey, validateApiKey } from '../auth/api-key.js';
import { logError, logInfo } from '../audit/logger.js';

export class RailwayConnector extends BaseConnector {
  private client: AxiosInstance | null = null;
  private token: string | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  getName(): string {
    return 'Railway';
  }

  validateConfig(): boolean {
    const credentials = validatePlatformCredentials();
    return credentials.railway;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.validateConfig()) {
        throw new Error('Railway credentials not configured');
      }

      const config = getEnvConfig();

      if (!config.RAILWAY_TOKEN) {
        throw new Error('RAILWAY_TOKEN not found in environment');
      }

      // Check if token is encrypted
      try {
        this.token = retrieveApiKey({ token: config.RAILWAY_TOKEN, platform: 'railway' });
      } catch {
        // Not encrypted, use directly
        this.token = config.RAILWAY_TOKEN;
      }

      if (!validateApiKey(this.token, 'railway')) {
        throw new Error('Invalid Railway token format');
      }

      this.client = axios.create({
        baseURL: 'https://backboard.railway.app/graphql/v2',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      // Test connection with a simple query
      // Railway GraphQL API expects query in request body
      const response = await this.client.post('', {
        query: `
          query {
            me {
              id
              name
            }
          }
        `,
      });

      if (response.data.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }

      logInfo('Railway connector initialized', { userId: response.data.data?.me?.id });

      this.initialized = true;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'Railway' });
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.client || !this.initialized) {
      return { healthy: false, message: 'Railway connector not initialized' };
    }

    try {
      await this.client.post('', {
        query: `
          query {
            me {
              id
            }
          }
        `,
      });
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
      throw new Error('Railway connector not initialized. Call initialize() first.');
    }
    return this.client;
  }
}

interface ConnectorConfig {
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitPointsPerSecond: number;
}

