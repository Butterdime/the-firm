import { GenerateContentResponse } from '@google/genai';

export const callApiWithRetry = async (
    apiCall: () => Promise<GenerateContentResponse>,
    options: { retries?: number; delay?: number; errorMessage: string }
): Promise<GenerateContentResponse> => {
    const { retries = 3, delay = 1000, errorMessage } = options;
    let lastError: any = null;

    for (let i = 0; i <= retries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            lastError = error;
            console.error(`API call failed on attempt ${i + 1}/${retries + 1}:`, error);
            
            // Check for specific Google AI errors, which can often be retried
            if (error.message && error.message.includes('[GoogleGenerativeAI Error]')) {
                // Rate limit (429) errors should definitely be retried
                if (error.message.includes('[429]')) {
                     console.warn("Rate limit hit, retrying with exponential backoff.");
                } else if (error.message.includes('[400]')) { // Bad Request, typically not retriable with same input
                    throw new Error(`API Error [400]: Invalid request to the model. ${error.message}`);
                }
            }
            
            // Network errors (e.g., fetch failed)
            if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('NetworkError'))) {
                 // Network errors might recover, so we can retry a few times
                 console.warn("Network error encountered, retrying.");
            }

            if (i < retries) { // Don't wait after the last attempt
                const backoffDelay = delay * Math.pow(2, i); // Exponential backoff
                console.log(`Retrying in ${backoffDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    
    // After all retries, analyze the last error for a better final message
    if (lastError && lastError.message) {
        if (lastError.message.includes('[500]') || lastError.message.includes('[503]')) {
             throw new Error(`API Service Error: The service is currently unavailable. Please try again later. Details: ${lastError.message}`);
        }
        if (lastError.message.includes('[429]')) {
            throw new Error(`Rate Limit Exceeded: Please wait a moment before trying again. Details: ${lastError.message}`);
        }
        if (lastError.message.includes('[401]') || lastError.message.includes('[403]')) {
            throw new Error(`Authentication Error: Invalid API key or insufficient permissions. Details: ${lastError.message}`);
        }
    }

    // Fallback error message if no specific error was caught
    throw new Error(`${errorMessage}. Please check your internet connection and API key configuration, or try a different file.`);
};