import { Octokit } from '@octokit/rest';
import { BaseConnector } from './base-connector.js';
import { getEnvConfig, validatePlatformCredentials } from '../config/env.js';
import { retrieveApiKey, validateApiKey } from '../auth/api-key.js';
import { retrieveToken, isTokenExpired } from '../auth/token-manager.js';
import { logError, logInfo } from '../audit/logger.js';

export class GitHubConnector extends BaseConnector {
  private octokit: Octokit | null = null;
  private token: string | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  getName(): string {
    return 'GitHub';
  }

  validateConfig(): boolean {
    const credentials = validatePlatformCredentials();
    return credentials.github;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.validateConfig()) {
        throw new Error('GitHub credentials not configured');
      }

      const config = getEnvConfig();

      // Prefer OAuth token, fallback to direct token
      if (config.GITHUB_TOKEN) {
        // Check if token is encrypted
        try {
          this.token = retrieveApiKey({ token: config.GITHUB_TOKEN, platform: 'github' });
        } catch {
          // Not encrypted, use directly
          this.token = config.GITHUB_TOKEN;
        }

        if (!validateApiKey(this.token, 'vercel')) {
          // GitHub tokens don't follow vercel format, so we use a more lenient check
          if (this.token.length < 20) {
            throw new Error('Invalid GitHub token format');
          }
        }
      } else {
        throw new Error('GITHUB_TOKEN not found in environment');
      }

      this.octokit = new Octokit({
        auth: this.token,
        userAgent: 'mcp-server-integrations',
      });

      // Test connection
      const { data: user } = await this.octokit.users.getAuthenticated();
      logInfo('GitHub connector initialized', { username: user.login });

      this.initialized = true;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'GitHub' });
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.octokit || !this.initialized) {
      return { healthy: false, message: 'GitHub connector not initialized' };
    }

    try {
      await this.octokit.users.getAuthenticated();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getOctokit(): Octokit {
    if (!this.octokit || !this.initialized) {
      throw new Error('GitHub connector not initialized. Call initialize() first.');
    }
    return this.octokit;
  }
}

interface ConnectorConfig {
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitPointsPerSecond: number;
}

