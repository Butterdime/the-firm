/**
 * Document Storage System
 * 
 * Persists uploaded customer proof documents to disk for later retrieval
 * during CIS PDF generation with attachments.
 * 
 * Directory Structure:
 * uploads/
 *   verifications/
 *     {verification_id}/
 *       identity/
 *         {filename}.pdf
 *       address/
 *         {filename}.pdf
 *       bank/
 *         {filename}.pdf
 *       abn/
 *         {filename}.pdf
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_BASE_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
const VERIFICATIONS_DIR = path.join(UPLOADS_BASE_DIR, 'verifications');

export type DocumentType = 'identity' | 'address' | 'bank' | 'abn';

export interface StoredDocument {
  verification_id: string;
  document_type: DocumentType;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

/**
 * Ensure upload directories exist
 */
function ensureDirectoriesExist(): void {
  if (!fs.existsSync(UPLOADS_BASE_DIR)) {
    fs.mkdirSync(UPLOADS_BASE_DIR, { recursive: true });
  }
  if (!fs.existsSync(VERIFICATIONS_DIR)) {
    fs.mkdirSync(VERIFICATIONS_DIR, { recursive: true });
  }
}

/**
 * Get directory path for a specific verification
 */
function getVerificationDir(verificationId: string): string {
  return path.join(VERIFICATIONS_DIR, verificationId);
}

/**
 * Get directory path for a specific document type within a verification
 */
function getDocumentTypeDir(verificationId: string, documentType: DocumentType): string {
  return path.join(getVerificationDir(verificationId), documentType);
}

/**
 * Save uploaded document buffer to disk
 */
export async function saveUploadedFile(
  buffer: Buffer,
  verificationId: string,
  documentType: DocumentType,
  originalFilename: string,
  mimeType: string = 'application/pdf'
): Promise<StoredDocument> {
  try {
    ensureDirectoriesExist();
    
    const verificationDir = getVerificationDir(verificationId);
    if (!fs.existsSync(verificationDir)) {
      fs.mkdirSync(verificationDir, { recursive: true });
    }
    
    const typeDir = getDocumentTypeDir(verificationId, documentType);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    
    // Generate safe filename
    const sanitizedFilename = sanitizeFilename(originalFilename);
    const filePath = path.join(typeDir, sanitizedFilename);
    
    // Write buffer to disk
    await fs.promises.writeFile(filePath, buffer);
    
    console.log(`✅ Saved ${documentType} document: ${filePath} (${buffer.length} bytes)`);
    
    return {
      verification_id: verificationId,
      document_type: documentType,
      filename: sanitizedFilename,
      file_path: filePath,
      file_size: buffer.length,
      mime_type: mimeType,
    };
  } catch (error: any) {
    console.error(`❌ Error saving ${documentType} document:`, error);
    throw new Error(`Failed to save ${documentType} document: ${error?.message || String(error)}`);
  }
}

/**
 * Retrieve uploaded document buffer from disk
 */
export async function getUploadedFile(
  verificationId: string,
  documentType: DocumentType
): Promise<Buffer | null> {
  try {
    const typeDir = getDocumentTypeDir(verificationId, documentType);
    
    if (!fs.existsSync(typeDir)) {
      console.warn(`⚠️ Document type directory not found: ${typeDir}`);
      return null;
    }
    
    // Find first file in the directory (should only be one per type)
    const files = await fs.promises.readdir(typeDir);
    
    if (files.length === 0) {
      console.warn(`⚠️ No ${documentType} document found for verification ${verificationId}`);
      return null;
    }
    
    // Get the first file (most recent if multiple)
    const filename = files[0];
    const filePath = path.join(typeDir, filename);
    
    const buffer = await fs.promises.readFile(filePath);
    console.log(`✅ Retrieved ${documentType} document: ${filename} (${buffer.length} bytes)`);
    
    return buffer;
  } catch (error) {
    console.error(`❌ Error retrieving ${documentType} document:`, error);
    return null;
  }
}

/**
 * Get file path for a specific document
 */
export async function getUploadedFilePath(
  verificationId: string,
  documentType: DocumentType
): Promise<string | null> {
  try {
    const typeDir = getDocumentTypeDir(verificationId, documentType);
    
    if (!fs.existsSync(typeDir)) {
      return null;
    }
    
    const files = await fs.promises.readdir(typeDir);
    
    if (files.length === 0) {
      return null;
    }
    
    const filename = files[0];
    return path.join(typeDir, filename);
  } catch (error) {
    console.error(`❌ Error getting file path for ${documentType}:`, error);
    return null;
  }
}

/**
 * List all documents for a verification
 */
export async function listVerificationFiles(
  verificationId: string
): Promise<StoredDocument[]> {
  try {
    const verificationDir = getVerificationDir(verificationId);
    
    if (!fs.existsSync(verificationDir)) {
      return [];
    }
    
    const documents: StoredDocument[] = [];
    const documentTypes: DocumentType[] = ['identity', 'address', 'bank', 'abn'];
    
    for (const docType of documentTypes) {
      const typeDir = getDocumentTypeDir(verificationId, docType);
      
      if (fs.existsSync(typeDir)) {
        const files = await fs.promises.readdir(typeDir);
        
        for (const filename of files) {
          const filePath = path.join(typeDir, filename);
          const stats = await fs.promises.stat(filePath);
          
          documents.push({
            verification_id: verificationId,
            document_type: docType,
            filename,
            file_path: filePath,
            file_size: stats.size,
            mime_type: getMimeTypeFromFilenameInternal(filename),
          });
        }
      }
    }
    
    return documents;
  } catch (error) {
    console.error(`❌ Error listing files for verification ${verificationId}:`, error);
    return [];
  }
}

/**
 * Check if a document exists for a verification
 */
export async function documentExists(
  verificationId: string,
  documentType: DocumentType
): Promise<boolean> {
  const filePath = await getUploadedFilePath(verificationId, documentType);
  return filePath !== null && fs.existsSync(filePath);
}

/**
 * Delete all documents for a verification (cleanup)
 */
export async function deleteVerificationDocuments(verificationId: string): Promise<void> {
  try {
    const verificationDir = getVerificationDir(verificationId);
    
    if (fs.existsSync(verificationDir)) {
      await fs.promises.rm(verificationDir, { recursive: true, force: true });
      console.log(`✅ Deleted all documents for verification ${verificationId}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting documents for verification ${verificationId}:`, error);
    throw error;
  }
}

/**
 * Sanitize filename to prevent path traversal and special characters
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  let sanitized = filename
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
  
  // Ensure it has an extension
  if (!path.extname(sanitized)) {
    sanitized += '.pdf';
  }
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const base = sanitized.slice(0, 255 - ext.length);
    sanitized = base + ext;
  }
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  const ext = path.extname(sanitized);
  const base = path.basename(sanitized, ext);
  return `${base}_${timestamp}${ext}`;
}

/**
 * Get MIME type from filename (internal helper)
 */
function getMimeTypeFromFilenameInternal(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'application/pdf';
}

/**
 * Get MIME type from filename (exported)
 */
export function getMimeTypeFromFilename(filename: string): string {
  return getMimeTypeFromFilenameInternal(filename);
}

