import { GoogleGenAI, Type as GenAiType } from '@google/genai';
import { aiClient } from './apiClient';
// Fix: OcrResponse is now correctly defined and exported from documentProcessor.
import { BoundingBox, DetectedPii, OcrResponse, OcrWord, ProcessingResult, Transaction } from './documentProcessor';
// Fix: Removed unused import 'cropToAccountDetails'. Implemented 'detectPii' in imageProcessor.
import { detectAndRotateImage, detectDocumentType, detectPii, enhanceImage, getOcrPrompt, performAdvancedGeminiOcr, rotateBase64Image, iterativeImageEnhancement, extractTransactions } from './imageProcessor';
import { callApiWithRetry } from './utils';

// Make pdfjsLib available from the global scope where it's loaded via script tag
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// --- Main PDF Processing Orchestrator ---

export const processPdf = async (docId: string, fileAsBase64: string, onProgress: (message: string) => void): Promise<ProcessingResult> => {
  try {
    // Convert base64 to Uint8Array for robust PDF parsing
    const pdfData = atob(fileAsBase64);
    const uint8Array = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
      uint8Array[i] = pdfData.charCodeAt(i);
    }

    const pdf = await window.pdfjsLib.getDocument(uint8Array).promise;
    const numPages = pdf.numPages;

    const allOcrWords: OcrWord[] = [];
    let overallConfidenceSum = 0;
    const allDetectedPii: DetectedPii[] = [];
    const allPageImages: string[] = [];
    const allOcrText: string[] = [];
    
    const maxPagesToProcess = docId === 'sourceOfFunds' ? 3 : Math.min(numPages, 3); // Process up to 3 pages for bank statements

    let detectedDocumentType: string | null = null;
    let documentTypeConfidence = 0;

    for (let i = 1; i <= maxPagesToProcess; i++) {
      const pageNum = i;
      const pageIndex = pageNum - 1; // 0-based page index for consistency
      
      onProgress(`(Page ${pageNum}/${maxPagesToProcess}) Rendering...`);
      const page = await pdf.getPage(pageNum);

      // Render page to image
      const originalViewport = page.getViewport({ scale: 1 });
      const MAX_DIMENSION = 2000;
      const scale = Math.min(
        MAX_DIMENSION / originalViewport.width,
        MAX_DIMENSION / originalViewport.height,
        2,
      );
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const context = canvas.getContext('2d')!;
      await page.render({ canvasContext: context, viewport: viewport }).promise;

      let processedBase64 = canvas.toDataURL('image/jpeg').split(',')[1];

      // 1. (Optional) Detect & Rotate - only for the first page for document-wide orientation
      if (pageNum === 1) {
        onProgress(`(Page ${pageNum}/${maxPagesToProcess}) Detecting rotation...`);
        const rotationAngle = await detectAndRotateImage(processedBase64);
        if (rotationAngle !== 0) {
          processedBase64 = await rotateBase64Image(processedBase64, rotationAngle);
          onProgress(`(Page ${pageNum}/${maxPagesToProcess}) Rotated by ${rotationAngle} degrees.`);
        }

        // 2. Detect Document Type for the first page
        onProgress(`(Page ${pageNum}/${maxPagesToProcess}) Detecting document type...`);
        const typeResult = await detectDocumentType(processedBase64);
        detectedDocumentType = typeResult.documentType;
        documentTypeConfidence = typeResult.confidence;
      }

      // 3. Enhance Image (per page)
      onProgress(`(Page ${pageNum}/${maxPagesToProcess}) Enhancing image...`);
      const { processedImage: enhancedImage, ocrResult: enhancedOcrResult } = await iterativeImageEnhancement(
        processedBase64,
        docId,
        pageIndex,
        { fullText: '', words: [], overallConfidence: 0 }, // Initial blank OCR for first pass
        (msg) => onProgress(`(Page ${pageNum}/${maxPagesToProcess}) ${msg}`) // Nested progress
      );
      processedBase64 = enhancedImage;
      
      allPageImages.push(processedBase64);

      // 4. Perform Advanced Structured OCR (per page)
      onProgress(`(Page ${pageNum}/${maxPagesToProcess}) Performing advanced OCR...`);
      const ocrResponse = await performAdvancedGeminiOcr(processedBase64, docId, pageIndex); // 0-based pageIndex
      allOcrWords.push(...ocrResponse.words);
      allOcrText.push(ocrResponse.fullText);
      overallConfidenceSum += ocrResponse.overallConfidence;

      // 5. Detect PII (per page)
      onProgress(`(Page ${pageNum}/${maxPagesToProcess}) Detecting PII...`);
      const detectedPiiPerPage = await detectPii(
        processedBase64,
        ocrResponse.fullText,
        docId,
        pageIndex,
      );
      allDetectedPii.push(...detectedPiiPerPage);
    }

    const averageOverallConfidence = maxPagesToProcess > 0 ? overallConfidenceSum / maxPagesToProcess : 0;
    
    // Fix: Correctly iterate through pages to extract transactions from each one.
    let extractedTransactions: Transaction[] | undefined = undefined;
    if (docId === 'sourceOfFunds' && allPageImages.length > 0) {
        onProgress(`Extracting transactions from all pages...`);
        const allTransactions: Transaction[] = [];
        for(let i = 0; i < allPageImages.length; i++) {
            // Only process if there's substantial text on the page to avoid wasted API calls
            if (allOcrText[i] && allOcrText[i].length > 100) {
                const pageTransactions = await extractTransactions(allOcrText[i], allPageImages[i]);
                allTransactions.push(...pageTransactions);
            }
        }
        extractedTransactions = allTransactions;
    }

    onProgress(`PDF processing complete.`);

    return {
      ocrWords: allOcrWords,
      overallConfidence: averageOverallConfidence,
      detectedDocumentType: detectedDocumentType,
      documentTypeConfidence: documentTypeConfidence,
      detectedPii: allDetectedPii,
      extractedTransactions: extractedTransactions,
      pages: allPageImages,
      warning: undefined, // Will be set by documentProcessor.ts
    };
  } catch (error) {
    console.error(`Error processing PDF ${docId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    let userFriendlyMessage = `Error processing PDF: ${errorMessage}.`;
    if (errorMessage.includes('Password') || errorMessage.includes('encrypted')) {
        userFriendlyMessage = 'PDF appears to be password-protected and cannot be processed.';
    } else if (errorMessage.includes('Invalid PDF structure') || errorMessage.includes('corrupt')) {
        userFriendlyMessage = 'PDF appears to be corrupted or invalid. Please try a different file.';
    }
    return {
      ocrWords: [],
      overallConfidence: 0,
      detectedDocumentType: null,
      documentTypeConfidence: 0,
      detectedPii: [],
      pages: [],
      extractedTransactions: undefined,
      warning: userFriendlyMessage,
    };
  }
};
