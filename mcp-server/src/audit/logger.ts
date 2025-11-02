import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getEnvConfig } from '../config/env.js';
import { encrypt, maskSensitiveData } from '../config/security.js';

const config = getEnvConfig();
const logDir = config.AUDIT_LOG_PATH;

// Ensure audit log directory exists
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// Create winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File transport for audit trail
    new winston.transports.File({
      filename: join(logDir, 'audit.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true,
    }),
    // Error log file
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  platform: string;
  userId?: string;
  request?: unknown;
  response?: unknown;
  success: boolean;
  error?: string;
  duration?: number;
  ipAddress?: string;
}

/**
 * Log an audit entry
 */
export function logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Mask sensitive data in request/response
  if (fullEntry.request) {
    fullEntry.request = maskSensitiveDataInObject(fullEntry.request);
  }
  if (fullEntry.response) {
    fullEntry.response = maskSensitiveDataInObject(fullEntry.response);
  }

  // Log to file
  logger.info('AUDIT', fullEntry);

  // If encryption is enabled, also write encrypted version
  if (config.AUDIT_LOG_ENCRYPTED) {
    try {
      const encryptedEntry = JSON.stringify(fullEntry);
      // Note: In production, you'd want to encrypt this before writing
      // For now, we rely on filesystem permissions
    } catch (error) {
      logger.error('Failed to encrypt audit entry', error);
    }
  }
}

/**
 * Mask sensitive data in objects recursively
 */
function maskSensitiveDataInObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveDataInObject(item));
  }

  const sensitiveKeys = [
    'token',
    'password',
    'secret',
    'key',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
    'credential',
    'access_token',
    'refresh_token',
  ];

  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      if (typeof value === 'string') {
        masked[key] = maskSensitiveData(value);
      } else {
        masked[key] = '***MASKED***';
      }
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveDataInObject(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Log an error
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error('ERROR', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

/**
 * Log info message
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  logger.info(message, context);
}

/**
 * Log warning message
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  logger.warn(message, context);
}

