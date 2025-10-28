import { GenerateContentResponse } from '@google/genai';

export const callApiWithRetry = async (
    apiCall: () => Promise<GenerateContentResponse>,
    options: { retries?: number; delay?: number; errorMessage: string }
): Promise<GenerateContentResponse> => {
    const { retries = 3, delay = 1000, errorMessage } = options;
    let lastError: any = null;

    // Total attempts = 1 initial + number of retries
    for (let i = 0; i <= retries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            console.error(`API call failed on attempt ${i + 1}/${retries + 1}:`, error);
            if (i < retries) { // Don't wait after the last attempt
                const backoffDelay = delay * Math.pow(2, i); // True exponential backoff
                console.log(`Retrying in ${backoffDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    // If all retries failed, throw a user-friendly error
    throw new Error(`${errorMessage}. Please check your network connection and try again.`);
};
