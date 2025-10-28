import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ExtractedData {
  abn: string | null;
  acn: string | null;
  business_name: string | null;
  address: string | null;
  extraction_successful: boolean;
  extraction_errors: string[];
}

/**
 * Extract business entity data from document using Gemini 2.5 Flash
 * CRITICAL: This is the first step in trilogy verification
 */
export async function extractFromDocument(filePath: string): Promise<ExtractedData> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    // Determine MIME type from file extension
    const mimeType = getMimeType(filePath);
    
    const prompt = `Extract Australian business entity information from this document.

Return ONLY a JSON object with these exact fields (use null if not found):
{
  "abn": "11-digit ABN with or without spaces/hyphens",
  "acn": "9-digit ACN with or without spaces",
  "business_name": "Full registered business name exactly as shown",
  "address": "Business address if present"
}

CRITICAL INSTRUCTIONS:
1. Extract business name EXACTLY as written - preserve capitalization, punctuation, spaces
2. Include suffixes like "PTY LTD", "PTY. LTD.", "Pty Ltd" exactly as shown
3. Include trading names if present (e.g., "ACME Pty Ltd T/A Acme Solutions")
4. Do NOT normalize, clean, or standardize the name
5. If ABN/ACN not found, return null for those fields
6. Return ONLY the JSON object, no other text`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
    ]);

    const response = result.response.text();
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        abn: null,
        acn: null,
        business_name: null,
        address: null,
        extraction_successful: false,
        extraction_errors: ['Gemini did not return valid JSON'],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Clean ABN/ACN (remove spaces/hyphens, keep digits only)
    const cleanABN = parsed.abn ? parsed.abn.replace(/[\s\-]/g, '') : null;
    const cleanACN = parsed.acn ? parsed.acn.replace(/[\s\-]/g, '') : null;
    
    // Trim whitespace from business name but preserve exact text
    const cleanName = parsed.business_name ? parsed.business_name.trim() : null;

    return {
      abn: cleanABN,
      acn: cleanACN,
      business_name: cleanName,
      address: parsed.address ? parsed.address.trim() : null,
      extraction_successful: !!(cleanABN || cleanACN || cleanName),
      extraction_errors: [],
    };
  } catch (error) {
    console.error('Gemini extraction error:', error);
    return {
      abn: null,
      acn: null,
      business_name: null,
      address: null,
      extraction_successful: false,
      extraction_errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
