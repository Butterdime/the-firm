import { processImage } from './imageProcessor';
import { processPdf } from './pdfProcessor';
import { docTypeToAppIdMap } from './imageProcessor';

// --- Type Definitions ---
export type ReportType = 'individual' | 'entity';
export type FormData = { [key: string]: string };

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    pageIndex: number;
}

export interface OcrWord {
    text: string;
    box: BoundingBox;
    confidence: number;
}

export interface OcrResponse {
    fullText: string;
    words: OcrWord[];
    overallConfidence: number;
}

export enum PiiType {
    FULL_NAME = "FULL_NAME",
    DATE_OF_BIRTH = "DATE_OF_BIRTH",
    DRIVERS_LICENCE_NUMBER = "DRIVERS_LICENCE_NUMBER",
    RESIDENTIAL_ADDRESS = "RESIDENTIAL_ADDRESS",
    ABN = "ABN",
    ENTITY_NAME = "ENTITY_NAME",
    TRUSTEE_NAME = "TRUSTEE_NAME",
    BUSINESS_NAME = "BUSINESS_NAME",
    BANK_ACCOUNT_NUMBER = "BANK_ACCOUNT_NUMBER",
    BSB = "BSB",
    PASSPORT_NUMBER = "PASSPORT_NUMBER",
    NATIONAL_ID_NUMBER = "NATIONAL_ID_NUMBER",
    MEDICARE_NUMBER = "MEDICARE_NUMBER",
}

export interface DetectedPii {
    text: string;
    type: PiiType;
    box: BoundingBox;
}

export interface Transaction {
    date: string;
    description: string;
    debit: string | null;
    credit: string | null;
}

export interface HumanOverride {
    field: string;
    aiValue: string;
    humanValue: string;
    timestamp: string;
}

export interface ProcessingResult {
    ocrWords: OcrWord[];
    overallConfidence: number;
    detectedDocumentType: string | null;
    documentTypeConfidence: number;
    detectedPii: DetectedPii[];
    pages: string[]; // base64 encoded images of pages
    extractedTransactions?: Transaction[];
    warning?: string;
    auditTrail?: {
        ocrConfidence: number;
        docTypeConfidence: number;
        qualityGateStatus: 'PASS' | 'FAIL' | 'OVERRIDE';
        processingDuration: number; // milliseconds
        retryAttempts: number;
        humanOverrides: HumanOverride[];
    };
    enhancementStrategy?: string; // from iterativeImageEnhancement
    enhancementAttempts?: number; // from iterativeImageEnhancement
    photoDescription?: string; // from analyzeGeneralPhoto
}

export interface DocumentFile {
    id: string;
    name: string;
    required: boolean;
    file: File | null;
    preview: string | null;
    processingState: string | null;
    processingResult: ProcessingResult | null;
    overriddenType?: string; // For UI to track manual override
}

// Centralized, document-specific confidence thresholds.
export const QUALITY_GATE_THRESHOLDS: { [key: string]: number } = {
  proofOfId: 0.95,
  proofOfResidence: 0.85,
  abnStatement: 0.85,
  sourceOfFunds: 0.80,
  default: 0.85,
};


const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
};

// --- Main Processing Function ---
export const processDocument = async (
  doc: { id: string; file: File },
  onProgress: (message: string) => void
): Promise<ProcessingResult> => {
  const startTime = Date.now();
  onProgress('Starting...');
  
  const { id: docId, file } = doc;

  const fileAsBase64 = await fileToBase64(file);
  
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';

  let result: ProcessingResult;

  if (isImage) {
    result = await processImage(docId, fileAsBase64, onProgress);
  } else if (isPdf) {
    result = await processPdf(docId, fileAsBase64, onProgress);
  } else {
    throw new Error('Unsupported file type. Please upload an image or PDF.');
  }

  // --- Post-processing and Quality Checks ---
  
  onProgress('Validating results...');
  
  // 1. Validate PII bounding boxes
  if (result.detectedPii) {
    result.detectedPii = result.detectedPii.filter(pii => {
      const box = pii.box;
      const isValid = 
        typeof box.x === 'number' && 
        typeof box.y === 'number' && 
        typeof box.width === 'number' && 
        typeof box.height === 'number' &&
        box.width > 0 && 
        box.height > 0 &&
        typeof box.pageIndex === 'number' &&
        box.pageIndex >= 0;
      
      if (!isValid) {
        console.warn(`Invalid PII box detected for ${pii.type}:`, pii);
      }
      return isValid;
    });
  }

  // 2. Document Type Mismatch Logic
  if (result.detectedDocumentType) {
    // Using the imported map, which should now exist
    const detectedAppId = docTypeToAppIdMap[result.detectedDocumentType] || 'unknown';
    if (detectedAppId !== 'unknown' && detectedAppId !== docId) {
      result.warning = `AI detected this as a '${result.detectedDocumentType}'. Please verify this is the correct document type.`;
    }
  }

  // 3. Quality Gate Logic using document-specific thresholds
  const threshold = QUALITY_GATE_THRESHOLDS[docId] || QUALITY_GATE_THRESHOLDS.default;
  const WARNING_THRESHOLD = 0.70; // General threshold for very low quality
  const qualityGateStatus: 'PASS' | 'FAIL' = result.overallConfidence >= threshold ? 'PASS' : 'FAIL';

  if (result.overallConfidence < WARNING_THRESHOLD) {
     const warningMessage = `Low OCR confidence (${(result.overallConfidence * 100).toFixed(0)}%). Extracted data may be inaccurate.`;
     result.warning = result.warning ? `${result.warning}\n${warningMessage}` : warningMessage;
  } else if (qualityGateStatus === 'FAIL') {
     const warningMessage = `Quality Gate: OCR confidence (${(result.overallConfidence * 100).toFixed(0)}%) is below the required ${(threshold * 100)}% threshold. Manual verification is required.`;
     result.warning = result.warning ? `${result.warning}\n${warningMessage}` : warningMessage;
  }
  
  // Add audit trail info
  const endTime = Date.now();
  result.auditTrail = {
      ocrConfidence: result.overallConfidence,
      docTypeConfidence: result.documentTypeConfidence,
      qualityGateStatus: qualityGateStatus,
      processingDuration: endTime - startTime,
      retryAttempts: 0, // This should be tracked from callApiWithRetry, but for now it's 0
      humanOverrides: [],
  };

  onProgress('Processing complete.');
  return result;
};