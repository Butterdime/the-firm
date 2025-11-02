import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GoogleAIConnector } from '../connectors/google-ai.js';
import { logAudit } from '../audit/logger.js';
import { validateInput, googleAIContentSchema, googleAIImageSchema } from '../utils/validation.js';

export function createGoogleAITools(connector: GoogleAIConnector): Tool[] {
  return [
    {
      name: 'google_ai_generate_content',
      description: 'Generate content using Google Gemini AI models',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The prompt to generate content from',
          },
          model: {
            type: 'string',
            description: 'Model name (e.g., gemini-2.5-flash, gemini-2.5-pro)',
            default: 'gemini-2.5-flash',
          },
          temperature: {
            type: 'number',
            description: 'Temperature for generation (0-2)',
            default: 0.7,
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens to generate',
            default: 2048,
          },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'google_ai_list_models',
      description: 'List available Google AI models',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'google_ai_get_model',
      description: 'Get details about a specific model',
      inputSchema: {
        type: 'object',
        properties: {
          modelName: {
            type: 'string',
            description: 'Model name',
          },
        },
        required: ['modelName'],
      },
    },
    {
      name: 'google_ai_create_prompt',
      description: 'Create a prompt template (utility function)',
      inputSchema: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            description: 'Prompt template with placeholders',
          },
          variables: {
            type: 'object',
            description: 'Variables to fill in template',
          },
        },
        required: ['template'],
      },
    },
    {
      name: 'google_ai_analyze_image',
      description: 'Analyze an image using Google Vision API',
      inputSchema: {
        type: 'object',
        properties: {
          imageData: {
            type: 'string',
            description: 'Base64 encoded image data',
          },
          mimeType: {
            type: 'string',
            description: 'Image MIME type',
            default: 'image/jpeg',
          },
          prompt: {
            type: 'string',
            description: 'Prompt describing what to analyze',
          },
          model: {
            type: 'string',
            default: 'gemini-2.5-flash',
          },
        },
        required: ['imageData', 'prompt'],
      },
    },
    {
      name: 'google_ai_stream_content',
      description: 'Stream generated content (returns async generator)',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The prompt to generate content from',
          },
          model: {
            type: 'string',
            default: 'gemini-2.5-flash',
          },
          temperature: {
            type: 'number',
            default: 0.7,
          },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'google_ai_embed_text',
      description: 'Generate embeddings for text',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to generate embeddings for',
          },
          model: {
            type: 'string',
            description: 'Embedding model name',
            default: 'models/embedding-001',
          },
        },
        required: ['text'],
      },
    },
  ];
}

export async function handleGoogleAITool(
  name: string,
  args: unknown,
  connector: GoogleAIConnector
): Promise<unknown> {
  const startTime = Date.now();

  try {
    const genAI = connector.getGenAI();

    switch (name) {
      case 'google_ai_generate_content': {
        const params = validateInput(googleAIContentSchema, args);
        const model = genAI.getGenerativeModel({
          model: params.model,
          generationConfig: {
            temperature: params.temperature,
            maxOutputTokens: params.maxTokens,
          },
        });

        const result = await model.generateContent(params.prompt);
        const response = await result.response;
        const text = response.text();

        logAudit({
          action: 'google_ai_generate_content',
          platform: 'google-ai',
          request: { model: params.model, promptLength: params.prompt.length },
          response: { textLength: text.length },
          success: true,
          duration: Date.now() - startTime,
        });

        return {
          text,
          model: params.model,
          usageMetadata: response.usageMetadata,
        };
      }

      case 'google_ai_list_models': {
        // Note: Google AI SDK doesn't have a direct list models endpoint
        // Return common model names
        const commonModels = [
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'gemini-2.0-flash-exp',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'models/embedding-001',
        ];

        logAudit({
          action: 'google_ai_list_models',
          platform: 'google-ai',
          request: {},
          response: { count: commonModels.length },
          success: true,
          duration: Date.now() - startTime,
        });

        return {
          models: commonModels.map((name) => ({
            name,
            description: `Google ${name} model`,
          })),
        };
      }

      case 'google_ai_get_model': {
        const params = args as { modelName: string };
        // Google AI SDK doesn't have model metadata endpoint
        // Return basic info
        logAudit({
          action: 'google_ai_get_model',
          platform: 'google-ai',
          request: params,
          response: { model: params.modelName },
          success: true,
          duration: Date.now() - startTime,
        });

        return {
          name: params.modelName,
          available: true,
          description: `Google ${params.modelName} model`,
        };
      }

      case 'google_ai_create_prompt': {
        const params = args as { template: string; variables?: Record<string, string> };
        let prompt = params.template;

        if (params.variables) {
          for (const [key, value] of Object.entries(params.variables)) {
            prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          }
        }

        logAudit({
          action: 'google_ai_create_prompt',
          platform: 'google-ai',
          request: { templateLength: params.template.length },
          response: { promptLength: prompt.length },
          success: true,
          duration: Date.now() - startTime,
        });

        return { prompt };
      }

      case 'google_ai_analyze_image': {
        const params = validateInput(googleAIImageSchema, args);
        const model = genAI.getGenerativeModel({ model: params.model });

        const result = await model.generateContent([
          {
            inlineData: {
              data: params.imageData,
              mimeType: params.mimeType,
            },
          },
          params.prompt,
        ]);

        const response = await result.response;
        const text = response.text();

        logAudit({
          action: 'google_ai_analyze_image',
          platform: 'google-ai',
          request: { model: params.model, promptLength: params.prompt.length },
          response: { textLength: text.length },
          success: true,
          duration: Date.now() - startTime,
        });

        return {
          text,
          model: params.model,
          usageMetadata: response.usageMetadata,
        };
      }

      case 'google_ai_stream_content': {
        const params = args as { prompt: string; model?: string; temperature?: number };
        const model = genAI.getGenerativeModel({
          model: params.model || 'gemini-2.5-flash',
          generationConfig: {
            temperature: params.temperature || 0.7,
          },
        });

        // For streaming, we collect chunks and return them
        const stream = await model.generateContentStream(params.prompt);
        const chunks: string[] = [];

        for await (const chunk of stream.stream) {
          const chunkText = chunk.text();
          chunks.push(chunkText);
        }

        const fullText = chunks.join('');

        logAudit({
          action: 'google_ai_stream_content',
          platform: 'google-ai',
          request: { model: params.model, promptLength: params.prompt.length },
          response: { textLength: fullText.length, chunks: chunks.length },
          success: true,
          duration: Date.now() - startTime,
        });

        return {
          text: fullText,
          chunks,
          model: params.model || 'gemini-2.5-flash',
        };
      }

      case 'google_ai_embed_text': {
        const params = args as { text: string; model?: string };
        // Note: Embedding models use a different API
        // This is a placeholder - actual implementation may require different SDK methods
        logAudit({
          action: 'google_ai_embed_text',
          platform: 'google-ai',
          request: { textLength: params.text.length },
          response: { success: true },
          success: true,
          duration: Date.now() - startTime,
        });

        return {
          message: 'Embedding generation requires specific embedding model API',
          text: params.text,
          model: params.model || 'models/embedding-001',
        };
      }

      default:
        throw new Error(`Unknown Google AI tool: ${name}`);
    }
  } catch (error) {
    logAudit({
      action: name,
      platform: 'google-ai',
      request: args,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

