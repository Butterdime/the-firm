import { Modality, Type as GenAiType } from '@google/genai';
import { aiClient } from './apiClient';
import { ProgressCallback, ProcessingResult, OcrWord, BoundingBox } from './documentProcessor';
import { callApiWithRetry } from './utils';

// Re-using the OCR schema from imageProcessor.ts logic.
const ocrSchema = {
    type: GenAiType.OBJECT,
    properties: {
        text: { type: GenAiType.STRING, description: 'The full transcribed text of the document.' },
        words: {
            type: GenAiType.ARRAY,
            description: 'An array of all transcribed words with their bounding boxes and confidence scores.',
            items: {
                type: GenAiType.OBJECT,
                properties: {
                    text: { type: GenAiType.STRING, description: 'The transcribed word.' },
                    confidence: { type: GenAiType.NUMBER, description: 'The confidence score for the word transcription (0.0 to 1.0).' },
                    box: {
                        type: GenAiType.OBJECT,
                        description: 'The bounding box coordinates of the word.',
                        properties: {
                            x: { type: GenAiType.NUMBER },
                            y: { type: GenAiType.NUMBER },
                            width: { type: GenAiType.NUMBER },
                            height: { type: GenAiType.NUMBER },
                        }
                    }
                }
            }
        },
        overallConfidence: { 
            type: GenAiType.NUMBER, 
            description: 'A score from 0.0 to 1.0 representing the confidence in the overall transcription quality.' 
        }
    }
};

interface OcrResponse {
    text: string;
    words: OcrWord[];
    overallConfidence: number;
}

const performAdvancedGeminiOcr = async (base64Image: string, pageIndex: number): Promise<OcrResponse> => {
    const response = await callApiWithRetry(
        () => aiClient.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: "Act as a specialized OCR engine. Transcribe all text, including handwritten text, from this document image. Provide the full text, an array of all words with their bounding boxes and confidence scores, and an overall confidence score for the transcription." },
                ]
            },
            config: { 
                responseMimeType: 'application/json',
                responseSchema: ocrSchema,
            }
        }),
        { errorMessage: 'Gemini OCR failed for PDF page' }
    );
    
    const parsed = JSON.parse(response.text.trim()) as OcrResponse;
    // Inject pageIndex into all words and boxes
    parsed.words.forEach(word => {
        word.pageIndex = pageIndex;
        if (word.box) {
            word.box.pageIndex = pageIndex;
        }
    });

    return parsed;
};

const enhanceImage = async (base64Image: string): Promise<string> => {
    const response = await callApiWithRetry(
        () => aiClient.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ 
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: "Enhance this document image. Improve contrast, sharpen text, and ensure it's clear and readable, as if it were a high-quality scan." } 
            ] },
            config: { responseModalities: [Modality.IMAGE] },
        }),
        { errorMessage: 'Image enhancement failed for PDF page' }
    );

    for (const part of response.candidates?.[0]?.content.parts ?? []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    return base64Image;
};

export const processPdf = async (
    fileAsBase64: string,
    docId: string,
    onProgress: ProgressCallback
): Promise<ProcessingResult> => {
    onProgress('Reading PDF...');
    const pdf = await window.pdfjsLib.getDocument({ data: atob(fileAsBase64) }).promise;
    const numPages = pdf.numPages;

    const pageProcessingPromises = Array.from({ length: numPages }, (_, i) => i).map(async pageIndex => {
        const pageNum = pageIndex + 1;
        onProgress(`Processing page ${pageNum}/${numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        
        const originalViewport = page.getViewport({ scale: 1 });
        const MAX_DIMENSION = 2000;
        const scale = Math.min(MAX_DIMENSION / originalViewport.width, MAX_DIMENSION / originalViewport.height, 2);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error(`Could not get canvas context for page ${pageNum}`);
        }

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const imageBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
        onProgress(`Enhancing page ${pageNum}/${numPages}...`);
        const enhancedBase64 = await enhanceImage(imageBase64);
        onProgress(`Analyzing page ${pageNum}/${numPages}...`);
        const ocrResult = await performAdvancedGeminiOcr(enhancedBase64, pageIndex);
        
        return {
            enhancedBase64,
            ocrResult,
            pageIndex
        };
    });

    onProgress('Waiting for all pages to finish processing...');
    const processedPagesResults = await Promise.all(pageProcessingPromises);
    
    // Sort pages back into correct order, just in case.
    processedPagesResults.sort((a, b) => a.pageIndex - b.pageIndex);

    let combinedOcrText = '';
    const combinedOcrWords: OcrWord[] = [];
    const pageImages: string[] = [];
    let totalConfidence = 0;

    for (const result of processedPagesResults) {
        const pageNum = result.pageIndex + 1;
        combinedOcrText += `--- Page ${pageNum} ---\n${result.ocrResult.text}\n\n`;
        combinedOcrWords.push(...result.ocrResult.words);
        pageImages.push(result.enhancedBase64);
        totalConfidence += result.ocrResult.overallConfidence;
    }
    
    const averageConfidence = numPages > 0 ? totalConfidence / numPages : 0;

    return {
        ocrText: combinedOcrText.trim(),
        ocrWords: combinedOcrWords,
        confidence: averageConfidence,
        pages: pageImages,
    };
};
