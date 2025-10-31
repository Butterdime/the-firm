/**
 * Visual Authentication Helper
 * Detects bank logos, fonts, and watermarks for document authenticity
 * Scoring: Logo (8 points), Font (4 points), Watermark (3 points) = 15 points total
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface VisualAuthResult {
  bank_logo_detected: string | null;
  logo_confidence: number;
  logo_points: number;  // 0-8 points
  
  font_matched: boolean;
  font_confidence: number;
  font_points: number;  // 0-4 points
  
  watermark_detected: boolean;
  watermark_confidence: number;
  watermark_points: number;  // 0-3 points
  
  visual_auth_total: number;  // 0-15 points
}

/**
 * Analyze document for visual authentication markers
 */
export async function analyzeVisualAuth(
  filePathOrBuffer: string | Buffer,
  mimeType?: string
): Promise<VisualAuthResult> {
  // Check if visual auth is enabled
  if (process.env.ENABLE_VISUAL_AUTH === 'false') {
    return {
      bank_logo_detected: null,
      logo_confidence: 0,
      logo_points: 0,
      font_matched: false,
      font_confidence: 0,
      font_points: 0,
      watermark_detected: false,
      watermark_confidence: 0,
      watermark_points: 0,
      visual_auth_total: 0,
    };
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Handle both file path and buffer
  let base64Data: string;
  let actualMimeType: string;

  if (Buffer.isBuffer(filePathOrBuffer)) {
    base64Data = filePathOrBuffer.toString('base64');
    actualMimeType = mimeType || 'application/pdf';
  } else {
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePathOrBuffer);
    base64Data = fileBuffer.toString('base64');
    actualMimeType = mimeType || getMimeType(filePathOrBuffer);
  }

  const prompt = `
Analyze this bank document for visual authentication markers.

DETECT THE FOLLOWING:
1. Bank Logo:
   - Identify which Australian bank logo is present (Commonwealth Bank, Westpac, ANZ, NAB, Bank of Queensland, Suncorp, Bendigo Bank, etc.)
   - Assess logo clarity and authenticity (confidence 0-1)
   - Logo must be clearly visible and match known bank branding

2. Font Matching:
   - Check if fonts match typical bank document fonts (professional, consistent)
   - Assess if fonts appear authentic (not generic or mismatched)
   - Confidence score (0-1)

3. Watermark Detection:
   - Look for security watermarks (often subtle, printed patterns)
   - Assess watermark visibility and authenticity
   - Confidence score (0-1)

CRITICAL INSTRUCTIONS:
- Only detect logos if they are clearly visible and recognizable
- Font matching should check consistency across the document
- Watermarks are often subtle - look carefully
- Return ONLY valid JSON, no markdown formatting

RESPONSE FORMAT (JSON only):
{
  "bank_logo_detected": "Commonwealth Bank" or null,
  "logo_confidence": 0.0-1.0,
  "font_matched": true|false,
  "font_confidence": 0.0-1.0,
  "watermark_detected": true|false,
  "watermark_confidence": 0.0-1.0
}
`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: actualMimeType,
        },
      },
    ]);

    const response = result.response.text();

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Return zero score if parsing fails
      return createZeroScoreResult();
    }

    const data = JSON.parse(jsonMatch[0]);

    // Calculate points based on confidence scores
    const logo_points = data.bank_logo_detected && data.logo_confidence >= 0.7
      ? Math.round(data.logo_confidence * 8)  // 0-8 points
      : 0;

    const font_points = data.font_matched && data.font_confidence >= 0.6
      ? Math.round(data.font_confidence * 4)  // 0-4 points
      : 0;

    const watermark_points = data.watermark_detected && data.watermark_confidence >= 0.5
      ? Math.round(data.watermark_confidence * 3)  // 0-3 points
      : 0;

    return {
      bank_logo_detected: data.bank_logo_detected || null,
      logo_confidence: data.logo_confidence || 0,
      logo_points,
      font_matched: data.font_matched || false,
      font_confidence: data.font_confidence || 0,
      font_points,
      watermark_detected: data.watermark_detected || false,
      watermark_confidence: data.watermark_confidence || 0,
      watermark_points,
      visual_auth_total: logo_points + font_points + watermark_points,
    };
  } catch (error) {
    console.error('Visual auth analysis failed:', error);
    return createZeroScoreResult();
  }
}

function createZeroScoreResult(): VisualAuthResult {
  return {
    bank_logo_detected: null,
    logo_confidence: 0,
    logo_points: 0,
    font_matched: false,
    font_confidence: 0,
    font_points: 0,
    watermark_detected: false,
    watermark_confidence: 0,
    watermark_points: 0,
    visual_auth_total: 0,
  };
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

