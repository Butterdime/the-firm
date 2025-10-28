import { GoogleGenAI, Type as GenAiType, Modality, GenerateContentResponse } from '@google/genai';
import { aiClient } from './apiClient';
import { callApiWithRetry } from './utils';
import { BoundingBox, DetectedPii, OcrResponse, OcrWord, PiiType, ProcessingResult, Transaction, QUALITY_GATE_THRESHOLDS } from './documentProcessor';

// --- Mappings ---
// Fix: Define and export document type maps for use in the UI.
export const docTypeToAppIdMap: { [key: string]: string } = {
  "Driver's License": 'proofOfId',
  "Passport": 'proofOfId',
  "National ID Card": 'proofOfId',
  "Medicare Card": 'proofOfId',
  "Utility Bill": 'proofOfResidence',
  "Rates Notice": 'proofOfResidence',
  "Tenancy Agreement": 'proofOfResidence',
  "Bank Statement": 'sourceOfFunds',
  "Payslip": 'sourceOfFunds',
  "Tax Document": 'sourceOfFunds',
  "Pension Statement": 'sourceOfFunds',
  "ABN Statement": 'abnStatement',
  "Business Registration": 'abnStatement',
  "ASIC Company Statement": 'abnStatement',
  "Unknown": 'unknown',
  "Other Official Document": 'unknown'
};

export const appIdToDocTypeDisplayNameMap: { [key: string]: string } = {
  proofOfId: "Proof of ID",
  proofOfResidence: "Proof of Residence",
  abnStatement: "ABN Statement",
  sourceOfFunds: "Source of Funds",
  photoAnalysis: "Photo for Analysis",
  unknown: "Unknown"
};


// --- Helper Functions ---

const sanitizeText = (text: string): string => {
    if (!text) return '';
    return text.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}]/gu, '');
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const base64ToDataURL = (base64: string, mimeType: string) => `data:${mimeType};base64,${base64}`;

export const rotateBase64Image = async (base64Image: string, angle: number): Promise<string> => {
  if (angle === 0) return base64Image;

  const img = new Image();
  img.src = base64ToDataURL(base64Image, 'image/jpeg');
  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  if (angle === 90 || angle === 270) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  return canvas.toDataURL('image/jpeg').split(',')[1];
};

// --- Gemini-powered Image Processing Steps ---

export const enhanceImage = async (base64Image: string, prompt: string): Promise<string> => {
  const response = await callApiWithRetry(
    () =>
      aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      }),
    { errorMessage: 'Image enhancement failed' },
  );

  for (const part of response.candidates?.[0]?.content.parts ?? []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  return base64Image; // Fallback
};

export const getOcrPrompt = (docId: string) => {
  const validDocIds = ['proofOfId', 'proofOfResidence', 'abnStatement', 'sourceOfFunds', 'photoAnalysis'];
  if (!validDocIds.includes(docId)) {
    throw new Error(`Invalid docId for OCR: ${docId}`);
  }

  const baseOcrInstructions = `...`; // Existing instructions
  // ... existing switch statement ...
  return `...`; // Existing prompt
};

const ocrSchema = { /* ... existing schema ... */ };

export const performAdvancedGeminiOcr = async (base64Image: string, docId: string, pageIndex: number = 0): Promise<OcrResponse> => {
  // ... existing implementation ...
  return {} as OcrResponse;
};

// **DEPRECATED** - Logic moved to preprocessAndAnalyze
export const detectAndRotateImage = async (base64Image: string): Promise<number> => { return 0; };
export const smartCropImage = async (base64Image: string): Promise<string> => { return base64Image; };
export const detectDocumentType = async (base64Image: string): Promise<{ documentType: string | null; confidence: number }> => { return { documentType: null, confidence: 0 }; };

export const perspectiveCorrectImage = async (base64Image: string): Promise<string> => {
  console.warn('True perspective correction requires a transform library. Skipping this step.');
  return base64Image;
};

const preprocessingSchema = {
    type: GenAiType.OBJECT,
    properties: {
      rotationAngle: { type: GenAiType.NUMBER, description: 'The clockwise rotation angle required to make the text upright (0, 90, 180, or 270 degrees).' },
      cropCoordinates: {
        type: GenAiType.OBJECT,
        properties: {
          x: { type: GenAiType.NUMBER },
          y: { type: GenAiType.NUMBER },
          width: { type: GenAiType.NUMBER },
          height: { type: GenAiType.NUMBER },
        },
        required: ['x', 'y', 'width', 'height']
      },
      documentType: { type: GenAiType.STRING, description: 'The most accurate classification of the document type.' },
      confidence: { type: GenAiType.NUMBER, description: 'Confidence score for the classification (0.0 - 1.0).' },
    },
    required: ['rotationAngle', 'cropCoordinates', 'documentType', 'confidence']
};

export const preprocessAndAnalyze = async (
  base64Image: string
): Promise<{
  rotationAngle: number;
  cropCoordinates: { x: number; y: number; width: number; height: number };
  documentType: string;
  confidence: number;
}> => {
  const prompt = `
    Analyze this document image in ONE pass:
    1. Determine rotation angle (0/90/180/270) to make it upright.
    2. Identify the crop box for the main document content, excluding background.
    3. Classify the document type from this list: Driver's License, Passport, National ID Card, Medicare Card, Utility Bill, Rates Notice, Bank Statement, Tenancy Agreement, ABN Statement, Business Registration, ASIC Company Statement, Payslip, Tax Document, Pension Statement, Other Official Document.
    4. Provide a confidence score (0.0-1.0) for the classification.
    
    Return JSON with all fields. If confidence is < 0.7, classify as "Unknown".
  `;
  
  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }] },
    config: { responseMimeType: 'application/json', responseSchema: preprocessingSchema }
  });
  
  return JSON.parse(response.text.trim());
};

export const getPiiDetectionPrompt = (docId: string, ocrText: string) => {
  let piiTypesToDetect: PiiType[] = [];
  let contextualInstructions = '';

  switch (docId) {
    case 'proofOfId':
      piiTypesToDetect = [PiiType.FULL_NAME, PiiType.DATE_OF_BIRTH, PiiType.DRIVERS_LICENCE_NUMBER, PiiType.RESIDENTIAL_ADDRESS, PiiType.PASSPORT_NUMBER, PiiType.NATIONAL_ID_NUMBER, PiiType.MEDICARE_NUMBER];
      contextualInstructions = `Focus on official ID fields: Full name (top of card), DOB (near photo), Licence/Passport/ID/Medicare number, and Residential address. Ignore background patterns, MRZ codes, and disclaimers.`;
      break;
    case 'proofOfResidence':
      piiTypesToDetect = [PiiType.FULL_NAME, PiiType.RESIDENTIAL_ADDRESS];
      contextualInstructions = `Focus on: Account holder name (top section) and the primary physical Service address (NOT PO Box/billing address). Ignore marketing sections and payment slips.`;
      break;
    case 'abnStatement':
      piiTypesToDetect = [PiiType.ABN, PiiType.ENTITY_NAME, PiiType.TRUSTEE_NAME, PiiType.BUSINESS_NAME];
      contextualInstructions = `Focus on: The 11-digit ABN, the Legal entity name, Trustee name (only if explicitly labeled), and any secondary Business/Trading name. Ignore business activity descriptions.`;
      break;
    case 'sourceOfFunds':
      piiTypesToDetect = [PiiType.FULL_NAME, PiiType.BANK_ACCOUNT_NUMBER, PiiType.BSB];
      contextualInstructions = `Focus on: The main account holder's name, BSB, and Account Number, usually found in the header section. For payslips, also identify the employee name. Ignore transaction-specific account numbers.`;
      break;
    default:
        piiTypesToDetect = [PiiType.FULL_NAME, PiiType.DATE_OF_BIRTH, PiiType.RESIDENTIAL_ADDRESS];
  }

  const uniquePiiTypes = [...new Set(piiTypesToDetect)];

  return `
    Act as a PII detection engine. Use the document image for precise bounding box location and the OCR text for context.
    ${contextualInstructions}
    STRICTLY LIMIT IDENTIFICATION to these PII types: ${uniquePiiTypes.join(', ')}.
    Return an array of JSON objects with 'text', 'type', and 'box'.

    OCR Text Context:
    ---
    ${ocrText.substring(0, 2000)}
    ---
  `;
};

const piiDetectionSchema = {
    type: GenAiType.ARRAY,
    items: {
      type: GenAiType.OBJECT,
      properties: {
        text: { type: GenAiType.STRING },
        type: { type: GenAiType.STRING, enum: Object.values(PiiType) },
        box: {
          type: GenAiType.OBJECT,
          properties: {
            x: { type: GenAiType.NUMBER },
            y: { type: GenAiType.NUMBER },
            width: { type: GenAiType.NUMBER },
            height: { type: GenAiType.NUMBER },
            pageIndex: { type: GenAiType.NUMBER },
          },
          required: ['x', 'y', 'width', 'height', 'pageIndex'],
        },
      },
      required: ['text', 'type', 'box'],
    },
};

export const detectPii = async (base64Image: string, ocrText: string, docId: string, pageIndex: number): Promise<DetectedPii[]> => {
    const prompt = getPiiDetectionPrompt(docId, ocrText);
    try {
        const response = await callApiWithRetry(
            () =>
                aiClient.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                            { text: prompt }
                        ]
                    },
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: piiDetectionSchema,
                    },
                }),
            { errorMessage: 'PII detection failed' }
        );
        const piiArray = JSON.parse(response.text.trim());
        // Add pageIndex to each bounding box
        piiArray.forEach((pii: DetectedPii) => {
            if (pii.box) {
                pii.box.pageIndex = pageIndex;
            }
        });
        return piiArray;
    } catch (error) {
        console.warn('Failed to detect PII via AI, returning empty.', error);
        return [];
    }
};


const transactionSchema = { /* ... existing schema ... */ };

export const extractTransactions = async (ocrText: string, pageImage: string): Promise<Transaction[]> => {
    const prompt = `
        You are analyzing a bank statement IMAGE. The table structure is visible.
        Extract ONLY transaction rows from the main transaction table.
        CRITICAL: Use the IMAGE to understand column alignment. The OCR text below is for semantic validation only.
        Rules:
        - Identify table boundaries visually.
        - Extract row-by-row using column positions.
        - Debit/Credit are mutually exclusive (only one per row).
        - Ignore opening/closing balances, subtotals, and page footers.
        - Return JSON array of transactions. If a field is missing, use null.
        
        OCR Text (for validation): ${ocrText.substring(0, 1500)}
    `;
    try {
        const response = await callApiWithRetry(
            () =>
                aiClient.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: 'image/jpeg', data: pageImage } },
                            { text: prompt }
                        ]
                    },
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: transactionSchema,
                    },
                }),
            { retries: 2, errorMessage: 'Transaction extraction failed' }
        );
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.warn('Failed to extract transactions via AI, returning empty.', error);
        return [];
    }
};

export async function iterativeImageEnhancement(
  base64Image: string,
  docId: string,
  pageIndex: number,
  initialOcrResult: OcrResponse,
  onProgress: (message: string) => void,
): Promise<{ processedImage: string; ocrResult: OcrResponse; auditInfo: { strategy?: string, attempts: number } }> {
  let bestImage = base64Image;
  let bestOcrResult = initialOcrResult;
  let auditInfo = { strategy: 'none', attempts: 0 };

  const skipThreshold = QUALITY_GATE_THRESHOLDS[docId] || QUALITY_GATE_THRESHOLDS.default;
  if (initialOcrResult.overallConfidence >= skipThreshold && initialOcrResult.fullText.length > 100) {
    onProgress('Initial quality sufficient, skipping enhancement.');
    return { processedImage: bestImage, ocrResult: bestOcrResult, auditInfo };
  }

  const enhancementStrategies = [
    { name: 'contrast', prompt: "Enhance contrast and sharpen text for clarity." },
    { name: 'lighting', prompt: "Balance lighting to neutralize glare and shadows." },
    { name: 'deblur', prompt: "Apply a conservative deblurring filter to improve text clarity." },
  ];

  for (let i = 0; i < enhancementStrategies.length; i++) {
    const strategy = enhancementStrategies[i];
    onProgress(`Applying enhancement strategy ${i + 1}/${enhancementStrategies.length} (${strategy.name})...`);
    try {
      const enhancedImage = await enhanceImage(base64Image, strategy.prompt);
      const currentOcrResult = await performAdvancedGeminiOcr(enhancedImage, docId, pageIndex);
      auditInfo.attempts = i + 1;

      if (currentOcrResult.overallConfidence > bestOcrResult.overallConfidence) {
        bestOcrResult = currentOcrResult;
        bestImage = enhancedImage;
        auditInfo.strategy = strategy.name;
      }

      if (bestOcrResult.overallConfidence >= 0.95) break;

    } catch (error) {
      console.warn(`Enhancement attempt ${i + 1} failed for ${docId}:`, error);
    }
  }

  return { processedImage: bestImage, ocrResult: bestOcrResult, auditInfo };
}

export const analyzeGeneralPhoto = async (fileAsBase64: string, onProgress: (message: string) => void): Promise<ProcessingResult> => {
    onProgress('Analyzing photo...');
    const prompt = 'Describe this image in detail. What are the key objects, setting, and any notable features?';
    try {
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: fileAsBase64 } }, { text: prompt }] }
        });
        
        onProgress('Finalizing...');
        return {
            ocrWords: [],
            overallConfidence: 1.0,
            detectedDocumentType: 'Photograph',
            documentTypeConfidence: 1.0,
            detectedPii: [],
            pages: [fileAsBase64],
            photoDescription: response.text,
        };
    } catch (error) {
        console.error('Failed to analyze photo:', error);
        return {
            ocrWords: [],
            overallConfidence: 0,
            detectedDocumentType: 'Photograph',
            documentTypeConfidence: 0,
            detectedPii: [],
            pages: [fileAsBase64],
            warning: 'Failed to analyze photo.',
        };
    }
};


export const processImage = async (docId: string, fileAsBase64: string, onProgress: (message: string) => void): Promise<ProcessingResult> => {
  if (docId === 'photoAnalysis') {
    return analyzeGeneralPhoto(fileAsBase64, onProgress);
  }

  let processedBase64 = fileAsBase64;
  
  onProgress(`(1/5) Preprocessing image...`);
  const { rotationAngle, cropCoordinates, documentType, confidence } = await preprocessAndAnalyze(processedBase64);
  
  if (rotationAngle !== 0) {
    processedBase64 = await rotateBase64Image(processedBase64, rotationAngle);
  }

  const { x, y, width, height } = cropCoordinates;
  const img = new Image();
  img.src = base64ToDataURL(processedBase64, 'image/jpeg');
  await new Promise(resolve => img.onload = resolve);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    processedBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
  }

  onProgress(`(2/5) Performing initial OCR...`);
  let currentOcrResult = await performAdvancedGeminiOcr(processedBase64, docId, 0);
  let auditInfo: { strategy?: string, attempts: number } = { strategy: 'none', attempts: 0 };

  onProgress(`(3/5) Assessing quality...`);
  const enhancementResult = await iterativeImageEnhancement(
    processedBase64, docId, 0, currentOcrResult,
    (msg) => onProgress(`(3/5) ${msg}`)
  );
  processedBase64 = enhancementResult.processedImage;
  currentOcrResult = enhancementResult.ocrResult;
  auditInfo = enhancementResult.auditInfo;
  
  onProgress(`(4/5) Detecting PII...`);
  const detectedPii = await detectPii(processedBase64, currentOcrResult.fullText, docId, 0);

  let extractedTransactions: Transaction[] | undefined = undefined;
  if (docId === 'sourceOfFunds') {
      onProgress(`(5/5) Extracting transactions...`);
      extractedTransactions = await extractTransactions(currentOcrResult.fullText, processedBase64);
  }

  onProgress(`(Finalizing) Processing complete.`);

  return {
    ocrWords: currentOcrResult.words,
    overallConfidence: currentOcrResult.overallConfidence,
    detectedDocumentType: documentType,
    documentTypeConfidence: confidence,
    detectedPii: detectedPii,
    pages: [processedBase64],
    warning: undefined,
    extractedTransactions: extractedTransactions,
    enhancementStrategy: auditInfo.strategy,
    enhancementAttempts: auditInfo.attempts,
  };
};