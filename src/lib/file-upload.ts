/**
 * File Upload Handler
 * Handles multi-file uploads for KYC document verification
 * Supports 1-5 files per upload (for bank documents)
 */

import multer from 'multer';
import path from 'path';
import { Request } from 'express';

// Configuration from environment
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(',');

/**
 * Create multer storage configuration
 * For Vercel serverless, we use memory storage (no disk access)
 */
const storage = multer.memoryStorage();

/**
 * File filter function
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`));
  }
};

/**
 * Single file upload middleware
 */
export const uploadSingle = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

/**
 * Multiple file upload middleware (1-5 files)
 */
export const uploadMultiple = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files
  },
  fileFilter,
});

/**
 * Validate file count
 */
export function validateFileCount(files: Express.Multer.File[] | undefined, min: number = 1, max: number = 5): {
  valid: boolean;
  error?: string;
} {
  if (!files || files.length === 0) {
    return {
      valid: false,
      error: `No files provided. Minimum: ${min} file(s)`,
    };
  }

  if (files.length < min) {
    return {
      valid: false,
      error: `Too few files. Minimum: ${min}, provided: ${files.length}`,
    };
  }

  if (files.length > max) {
    return {
      valid: false,
      error: `Too many files. Maximum: ${max}, provided: ${files.length}`,
    };
  }

  return { valid: true };
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(mimeType: string): string {
  const mimeToExt: { [key: string]: string } = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/pdf': '.pdf',
  };

  return mimeToExt[mimeType] || '.bin';
}

/**
 * Validate file size
 */
export function validateFileSize(file: Express.Multer.File): {
  valid: boolean;
  error?: string;
} {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum: ${MAX_FILE_SIZE} bytes (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`,
    };
  }

  return { valid: true };
}

/**
 * Generate unique filename
 */
export function generateFileName(originalName: string, mimeType: string): string {
  const ext = getFileExtension(mimeType);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const baseName = path.basename(sanitizedName, path.extname(sanitizedName));
  
  return `${baseName}_${timestamp}_${random}${ext}`;
}

