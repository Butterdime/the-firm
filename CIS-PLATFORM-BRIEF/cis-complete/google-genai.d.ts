
declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(options: { apiKey: string });
    // Fix: Declared specific model methods for better type checking
    models: {
      generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
      generateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;
      generateImages(params: any): Promise<any>; // Simplified, can be detailed if used
      generateVideos(params: any): Promise<any>; // Simplified, can be detailed if used
    };
    live: any; // Simplified for this context
    operations: any; // Simplified for this context
    chats: any; // Simplified for this context
  }

  // Fix: Add GenerateContentResponse to fix import error in src/index.tsx
  export interface GenerateContentResponse {
    text: string;
    candidates?: Array<{
      content: {
        parts: Array<{
          inlineData?: {
            data: string;
            mimeType: string;
          };
          text?: string; // Add text part for cases where model returns text
        }>;
      };
      // For PII, could also include safetyRatings, finishReason, etc.
    }>;
  }

  // Fix: Added `GenerateContentParameters` to correctly type the input for generateContent
  export interface GenerateContentParameters {
    model: string;
    contents: { parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> } | string;
    config?: {
      systemInstruction?: string;
      topK?: number;
      topP?: number;
      temperature?: number;
      responseMimeType?: string;
      responseSchema?: any; // Can be detailed if specific schemas are used more broadly
      responseModalities?: Modality[];
      seed?: number;
      maxOutputTokens?: number;
      thinkingConfig?: { thinkingBudget?: number };
      tools?: any[]; // Simplified for this context
      speechConfig?: any; // Simplified for this context
    };
  }

  // Fix: Corrected enums to be string-based and added BOOLEAN type to support the response schema.
  export enum Type {
    STRING = 'STRING',
    OBJECT = 'OBJECT',
    BOOLEAN = 'BOOLEAN',
    NUMBER = 'NUMBER',
    INTEGER = 'INTEGER', // Added INTEGER as it's a distinct OpenAPI type
    ARRAY = 'ARRAY',
    NULL = 'NULL', // Added NULL as it's a distinct OpenAPI type
    TYPE_UNSPECIFIED = 'TYPE_UNSPECIFIED', // Added TYPE_UNSPECIFIED for completeness
  }
  export enum Modality {
    IMAGE = 'IMAGE',
    AUDIO = 'AUDIO', // Added AUDIO modality for completeness based on guidelines
  }
  export interface Blob {
    data: string;
    mimeType: string;
  }
  export interface FunctionDeclaration {
    name: string;
    parameters: any;
  }
  export enum VideoGenerationReferenceType {
    ASSET = 'ASSET',
  }

  export interface LiveServerMessage {
    serverContent?: {
      modelTurn?: {
        parts: Array<{
          inlineData?: {
            data: string;
            mimeType: string;
          };
        }>;
      };
      interrupted?: boolean;
      outputTranscription?: {
        text: string;
      };
      inputTranscription?: {
        text: string;
      };
      turnComplete?: boolean;
    };
    toolCall?: {
      functionCalls: Array<{
        args: any;
        name: string;
        id: string;
      }>;
    };
  }
}