/**
 * Base connector interface for platform integrations
 * All platform connectors should extend this class
 */

export interface ConnectorConfig {
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitPointsPerSecond: number;
}

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected initialized: boolean = false;

  constructor(config: ConnectorConfig) {
    this.config = config;
  }

  /**
   * Initialize the connector (authenticate, validate credentials, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Check if connector is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if connector is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Validate connector configuration
   */
  abstract validateConfig(): boolean;

  /**
   * Get connector name for logging
   */
  abstract getName(): string;

  /**
   * Health check for the connector
   */
  abstract healthCheck(): Promise<{ healthy: boolean; message?: string }>;

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }
}

