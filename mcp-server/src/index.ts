#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GitHubConnector } from './connectors/github.js';
import { VercelConnector } from './connectors/vercel.js';
import { RailwayConnector } from './connectors/railway.js';
import { GoogleAIConnector } from './connectors/google-ai.js';
import { createGitHubTools, handleGitHubTool } from './tools/github-tools.js';
import { createVercelTools, handleVercelTool } from './tools/vercel-tools.js';
import { createRailwayTools, handleRailwayTool } from './tools/railway-tools.js';
import { createGoogleAITools, handleGoogleAITool } from './tools/google-ai-tools.js';
import { getEnvConfig, validatePlatformCredentials } from './config/env.js';
import { logInfo, logError, logWarning } from './audit/logger.js';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Initialize connectors
const connectors: {
  github?: GitHubConnector;
  vercel?: VercelConnector;
  railway?: RailwayConnector;
  googleAi?: GoogleAIConnector;
} = {};

// Initialize rate limiters
const rateLimiters: Map<string, RateLimiterMemory> = new Map();

async function initializeConnectors() {
  const envConfig = getEnvConfig();
  const credentials = validatePlatformCredentials();

  // Configure rate limiter
  const rateLimiterConfig = {
    points: Math.floor(envConfig.RATE_LIMIT_POINTS_PER_SECOND),
    duration: 1, // per second
  };

  // Initialize GitHub connector
  if (credentials.github) {
    try {
      connectors.github = new GitHubConnector({
        enabled: true,
        rateLimitEnabled: envConfig.RATE_LIMIT_ENABLED,
        rateLimitPointsPerSecond: envConfig.RATE_LIMIT_POINTS_PER_SECOND,
      });
      await connectors.github.initialize();
      rateLimiters.set('github', new RateLimiterMemory(rateLimiterConfig));
      logInfo('GitHub connector initialized');
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'GitHub' });
      logWarning('GitHub connector disabled due to initialization error');
    }
  }

  // Initialize Vercel connector
  if (credentials.vercel) {
    try {
      connectors.vercel = new VercelConnector({
        enabled: true,
        rateLimitEnabled: envConfig.RATE_LIMIT_ENABLED,
        rateLimitPointsPerSecond: envConfig.RATE_LIMIT_POINTS_PER_SECOND,
      });
      await connectors.vercel.initialize();
      rateLimiters.set('vercel', new RateLimiterMemory(rateLimiterConfig));
      logInfo('Vercel connector initialized');
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'Vercel' });
      logWarning('Vercel connector disabled due to initialization error');
    }
  }

  // Initialize Railway connector
  if (credentials.railway) {
    try {
      connectors.railway = new RailwayConnector({
        enabled: true,
        rateLimitEnabled: envConfig.RATE_LIMIT_ENABLED,
        rateLimitPointsPerSecond: envConfig.RATE_LIMIT_POINTS_PER_SECOND,
      });
      await connectors.railway.initialize();
      rateLimiters.set('railway', new RateLimiterMemory(rateLimiterConfig));
      logInfo('Railway connector initialized');
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'Railway' });
      logWarning('Railway connector disabled due to initialization error');
    }
  }

  // Initialize Google AI connector
  if (credentials.googleAi) {
    try {
      connectors.googleAi = new GoogleAIConnector({
        enabled: true,
        rateLimitEnabled: envConfig.RATE_LIMIT_ENABLED,
        rateLimitPointsPerSecond: envConfig.RATE_LIMIT_POINTS_PER_SECOND,
      });
      await connectors.googleAi.initialize();
      rateLimiters.set('google-ai', new RateLimiterMemory(rateLimiterConfig));
      logInfo('Google AI connector initialized');
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { connector: 'Google AI' });
      logWarning('Google AI connector disabled due to initialization error');
    }
  }
}

async function checkRateLimit(platform: string): Promise<void> {
  const limiter = rateLimiters.get(platform);
  if (!limiter) {
    return; // No rate limiting for this platform
  }

  try {
    await limiter.consume(platform, 1);
  } catch (error) {
    throw new Error(`Rate limit exceeded for ${platform}`);
  }
}

async function main() {
  try {
    // Initialize connectors
    await initializeConnectors();

    // Create MCP server
    const server = new Server(
      {
        name: 'mcp-server-integrations',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register all tools
    const allTools = [];

    if (connectors.github) {
      allTools.push(...createGitHubTools(connectors.github));
    }
    if (connectors.vercel) {
      allTools.push(...createVercelTools(connectors.vercel));
    }
    if (connectors.railway) {
      allTools.push(...createRailwayTools(connectors.railway));
    }
    if (connectors.googleAi) {
      allTools.push(...createGoogleAITools(connectors.googleAi));
    }

    // Set tools handler
    server.setRequestHandler('tools/list', async () => {
      return {
        tools: allTools,
      };
    });

    // Set tool execution handler
    server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      // Determine platform from tool name
      let platform: string;
      if (name.startsWith('github_')) {
        platform = 'github';
      } else if (name.startsWith('vercel_')) {
        platform = 'vercel';
      } else if (name.startsWith('railway_')) {
        platform = 'railway';
      } else if (name.startsWith('google_ai_')) {
        platform = 'google-ai';
      } else {
        throw new Error(`Unknown tool platform: ${name}`);
      }

      // Check rate limit
      const envConfig = getEnvConfig();
      if (envConfig.RATE_LIMIT_ENABLED) {
        await checkRateLimit(platform);
      }

      // Route to appropriate handler
      try {
        let result: unknown;

        if (name.startsWith('github_') && connectors.github) {
          result = await handleGitHubTool(name, args, connectors.github);
        } else if (name.startsWith('vercel_') && connectors.vercel) {
          result = await handleVercelTool(name, args, connectors.vercel);
        } else if (name.startsWith('railway_') && connectors.railway) {
          result = await handleRailwayTool(name, args, connectors.railway);
        } else if (name.startsWith('google_ai_') && connectors.googleAi) {
          result = await handleGoogleAITool(name, args, connectors.googleAi);
        } else {
          throw new Error(`Connector for ${platform} not initialized`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          tool: name,
          platform,
        });
        throw error;
      }
    });

    // Create stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logInfo('MCP server started and ready for connections');
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { context: 'server startup' });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logInfo('Shutting down MCP server...');
  for (const connector of Object.values(connectors)) {
    if (connector) {
      await connector.cleanup();
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logInfo('Shutting down MCP server...');
  for (const connector of Object.values(connectors)) {
    if (connector) {
      await connector.cleanup();
    }
  }
  process.exit(0);
});

// Start server
main().catch((error) => {
  logError(error instanceof Error ? error : new Error(String(error)), { context: 'main' });
  process.exit(1);
});

