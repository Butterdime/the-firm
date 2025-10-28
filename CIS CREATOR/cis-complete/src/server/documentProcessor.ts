import { processImage } from './imageProcessor';
import { processPdf } from './pdfProcessor';

export type ProgressCallback = (message: string) => void;

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    // Fix: Add pageIndex to allow storing page number for highlights in multi-page documents.
    pageIndex?: number;
}

export interface OcrWord {
    text: string;
    box: BoundingBox;
    confidence?: number; // Optional: for word-level confidence
    pageIndex?: number;  // Optional: for multi-page documents
}

export interface ProcessingResult {
    ocrText: string;
    ocrWords: OcrWord[];
    confidence: number;
    pages?: string[];      // For PDFs
    finalImage?: string; // For Images
}

export const processDocument = async (
    fileAsBase64: string,
    mimeType: string,
    docId: string,
    onProgress: ProgressCallback
): Promise<ProcessingResult> => {
    
    if (mimeType.startsWith('image/')) {
        return processImage(fileAsBase64, docId, onProgress);
    } else if (mimeType === 'application/pdf') {
        return processPdf(fileAsBase64, docId, onProgress);
    } else {
        throw new Error('Unsupported file type.');
    }
};