import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment variable schema
const envSchema = z.object({
  // GitHub
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),

  // Vercel
  VERCEL_TOKEN: z.string().optional(),

  // Railway
  RAILWAY_TOKEN: z.string().optional(),

  // Google AI
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),

  // Security
  ENCRYPTION_KEY: z.string().min(32).optional(),
  AUDIT_LOG_PATH: z.string().default('./audit-logs'),
  AUDIT_LOG_ENCRYPTED: z.string().transform((val) => val === 'true').default('true'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  RATE_LIMIT_POINTS_PER_SECOND: z.string().transform(Number).default('10'),

  // Network
  MCP_SERVER_HOST: z.string().default('127.0.0.1'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let envConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (envConfig) {
    return envConfig;
  }

  try {
    envConfig = envSchema.parse(process.env);
    return envConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid environment configuration:\n${error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n')}`
      );
    }
    throw error;
  }
}

export function validatePlatformCredentials(): {
  github: boolean;
  vercel: boolean;
  railway: boolean;
  googleAi: boolean;
} {
  const config = getEnvConfig();

  return {
    github: !!(config.GITHUB_TOKEN || (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET)),
    vercel: !!config.VERCEL_TOKEN,
    railway: !!config.RAILWAY_TOKEN,
    googleAi: !!(config.GOOGLE_AI_API_KEY || (config.GOOGLE_OAUTH_CLIENT_ID && config.GOOGLE_OAUTH_CLIENT_SECRET)),
  };
}

