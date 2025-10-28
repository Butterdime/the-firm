declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(options: { apiKey: string });
    models: any;
  }

  // Fix: Add GenerateContentResponse to fix import error in src/index.tsx
  export interface GenerateContentResponse {
    text: string;
    candidates?: Array<{
      content: {
        parts: Array<{
          inlineData?: {
            data: string;
          };
        }>;
      };
    }>;
  }

  // Fix: Corrected enums to be string-based and added BOOLEAN type to support the response schema.
  export enum Type {
    STRING = 'STRING',
    OBJECT = 'OBJECT',
    BOOLEAN = 'BOOLEAN',
  }
  export enum Modality {
    IMAGE = 'IMAGE',
  }
}
