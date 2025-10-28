import { Modality, Type as GenAiType } from '@google/genai';
import { aiClient } from './apiClient';
import { ProgressCallback, ProcessingResult, OcrWord } from './documentProcessor';
import { callApiWithRetry } from './utils';

// This schema will be used to get structured OCR data from Gemini.
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

const performAdvancedGeminiOcr = async (base64Image: string, pageIndex?: number): Promise<OcrResponse> => {
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
        { errorMessage: 'Gemini OCR failed' }
    );

    const parsed = JSON.parse(response.text.trim()) as OcrResponse;
    if (pageIndex !== undefined) {
        parsed.words.forEach(word => {
            word.pageIndex = pageIndex;
            word.box.pageIndex = pageIndex;
        });
    }
    return parsed;
};

const enhanceImage = async (base64Image: string, prompt: string): Promise<string> => {
    const response = await callApiWithRetry(
        () => aiClient.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt } ] },
            config: { responseModalities: [Modality.IMAGE] },
        }),
        { errorMessage: 'Image enhancement failed' }
    );

    for (const part of response.candidates?.[0]?.content.parts ?? []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    return base64Image;
};

const applySuperResolution = async (base64Image: string): Promise<string> => {
    const prompt = "Act as a photo restoration expert specializing in super-resolution. Upscale this document image, intelligently reconstructing details to make blurry or pixelated text sharp and clear. The goal is to produce a high-resolution version of the original without altering any content.";
    return enhanceImage(base64Image, prompt);
};

const smartCropImage = async (base64Image: string): Promise<string> => {
    const response = await callApiWithRetry(
        () => aiClient.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: "Analyze this image and provide the bounding box coordinates of the document. The coordinates should be in the format { \"x\": number, \"y\": number, \"width\": number, \"height\": number }. Only provide the JSON object." },
            ] },
            config: { responseMimeType: 'application/json' }
        }),
        { errorMessage: 'Smart crop analysis failed' }
    );

    try {
        const coords = JSON.parse(response.text.trim());
        const { x, y, width, height } = coords;
        
        if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number') {
            const img = new Image();
            img.src = `data:image/jpeg;base64,${base64Image}`;
            await new Promise(resolve => img.onload = resolve);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
                return canvas.toDataURL('image/jpeg').split(',')[1];
            }
        }
        return base64Image;
    } catch (e) {
        console.error("Failed to parse coordinates or crop image:", e);
        return base64Image;
    }
};


const iterativeImageEnhancement = async (
    base64Image: string,
    onProgress: ProgressCallback,
): Promise<string> => {
    let bestImage = base64Image;
    let highestOcrCharCount = 0;

    const enhancementStrategies = [
        "Enhance this document image. Improve contrast, sharpen text, and ensure it's clear and readable, as if it were a high-quality scan. Do not add, remove, or alter any of the original content.",
        "You are a professional document restoration specialist. This image suffers from severe lighting problems. Your primary task is to aggressively neutralize all glare and deep shadows. The final output must be a flat, evenly lit document with high contrast and sharp text, as if it were a perfect studio scan. All text must be equally legible. Do not alter, add, or remove any of the original text content."
    ];

    for (let i = 0; i < enhancementStrategies.length; i++) {
        onProgress(`Enhancing Image (Attempt ${i + 1}/${enhancementStrategies.length})...`);
        try {
            const enhancedImage = await enhanceImage(base64Image, enhancementStrategies[i]);
            const ocrResult = await performAdvancedGeminiOcr(enhancedImage);
            
            if (ocrResult.text.length > highestOcrCharCount) {
                highestOcrCharCount = ocrResult.text.length;
                bestImage = enhancedImage;
            }

            // If we get a decent OCR result, we can stop early.
            if (ocrResult.text.length > 50) {
                return enhancedImage;
            }

        } catch (error) {
            console.error(`Enhancement attempt ${i + 1} failed:`, error);
        }
    }
    
    return bestImage;
};

export const processImage = async (
    fileAsBase64: string,
    docId: string,
    onProgress: ProgressCallback
): Promise<ProcessingResult> => {
    let processedBase64 = fileAsBase64;
    
    onProgress('Assessing image quality...');
    const initialOcr = await performAdvancedGeminiOcr(processedBase64);
    
    // Low character count suggests poor quality, try super-resolution
    if (initialOcr.text.length < 100 && (initialOcr.overallConfidence < 0.7)) {
        onProgress('Low quality detected. Applying super-resolution...');
        processedBase64 = await applySuperResolution(processedBase64);
    }

    onProgress('Iteratively enhancing image...');
    processedBase64 = await iterativeImageEnhancement(processedBase64, onProgress);
    
    onProgress('Applying smart crop...');
    processedBase64 = await smartCropImage(processedBase64);
    
    onProgress('Performing final analysis...');
    const finalOcr = await performAdvancedGeminiOcr(processedBase64);
    
    return {
        ocrText: finalOcr.text,
        ocrWords: finalOcr.words,
        confidence: finalOcr.overallConfidence,
        finalImage: processedBase64,
    };
};
