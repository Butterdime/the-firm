import { z } from 'zod';
import { sanitizeInput } from '../config/security.js';

/**
 * Common validation schemas for MCP tool inputs
 */

export const repositorySchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

export const pullRequestSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  body: z.string().max(50000).optional(),
  head: z.string().min(1).max(200),
  base: z.string().min(1).max(200).default('main'),
});

export const issueSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  body: z.string().max(50000).optional(),
  labels: z.array(z.string()).optional(),
});

export const deploymentSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  branch: z.string().optional(),
  commit: z.string().optional(),
});

export const googleAIContentSchema = z.object({
  prompt: z.string().min(1).max(100000),
  model: z.string().default('gemini-2.5-flash'),
  temperature: z.number().min(0).max(2).default(0.7).optional(),
  maxTokens: z.number().min(1).max(32000).optional(),
});

export const googleAIImageSchema = z.object({
  imageData: z.string(), // base64 encoded
  mimeType: z.string().default('image/jpeg'),
  prompt: z.string().min(1).max(10000),
  model: z.string().default('gemini-2.5-flash'),
});

/**
 * Validate and sanitize input using schema
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(
      `Validation error: ${result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }

  return result.data;
}

/**
 * Validate repository owner/repo and sanitize
 */
export function validateRepository(input: { owner: string; repo: string }): { owner: string; repo: string } {
  const validated = validateInput(repositorySchema, input);
  return {
    owner: sanitizeInput(validated.owner, 100),
    repo: sanitizeInput(validated.repo, 100),
  };
}

/**
 * Validate pull request input
 */
export function validatePullRequest(input: unknown): z.infer<typeof pullRequestSchema> {
  const validated = validateInput(pullRequestSchema, input);
  return {
    ...validated,
    title: sanitizeInput(validated.title, 200),
    body: validated.body ? sanitizeInput(validated.body, 50000) : undefined,
    head: sanitizeInput(validated.head, 200),
    base: sanitizeInput(validated.base, 200),
  };
}

