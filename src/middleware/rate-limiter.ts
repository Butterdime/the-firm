/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for document verification endpoint
 * Limit: 10 requests per minute per IP
 */
export const verifyDocumentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many verification requests',
    message: 'You have exceeded the limit of 10 document verifications per minute. Please try again later.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * Rate limiter for general API endpoints
 * Limit: 100 requests per minute per IP
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many API requests',
    message: 'You have exceeded the API rate limit. Please try again later.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the API rate limit. Please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * Rate limiter for health check endpoint
 * More lenient: 100 requests per minute
 */
export const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

