import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "../backend/trpc/app-router"
import superjson from "superjson";
import { debugService } from "./debug";
import { config } from "@/config";

export const trpc = createTRPCReact<AppRouter>();

const baseUrl = config.API_URL;
const trpcUrl = `${baseUrl}/api/trpc`;
console.log('[tRPC] Initializing client with URL:', trpcUrl);

// Wrap superjson to add error logging
const wrappedSuperjson = {
  ...superjson,
      deserialize: (data: any) => {
        try {
          return superjson.deserialize(data);
        } catch (error) {
          const errorDetails = {
            error: error instanceof Error ? error.message : String(error),
            rawData: JSON.stringify(data).substring(0, 1000),
            dataType: typeof data,
            fullData: data,
          };
          console.error('[tRPC] ❌ Transformation error (deserialize):', error);
          console.error('[tRPC] Raw server response data:', errorDetails.rawData);
          console.error('[tRPC] Full response data type:', errorDetails.dataType);
          console.error('[tRPC] Full response data:', data);
          debugService.error('tRPC', 'Transformation error (deserialize)', errorDetails);
          throw new Error(`Unable to transform response from server.\n\nError: ${errorDetails.error}\n\nRaw data preview: ${errorDetails.rawData.substring(0, 500)}`);
        }
      },
  serialize: (data: any) => {
    try {
      return superjson.serialize(data);
    } catch (error) {
      console.error('[tRPC] ❌ Transformation error (serialize):', error);
      console.error('[tRPC] Data being serialized:', data);
      throw error;
    }
  },
};

export const trpcClient = trpc.createClient({
  transformer: wrappedSuperjson,
  links: [
    httpLink({
      url: trpcUrl,
      fetch: async (url, options) => {
        try {
          console.log('[tRPC] Making request to:', url);
          if (options?.body) {
            try {
              const bodyPreview = typeof options.body === 'string'
                ? options.body.substring(0, 200)
                : '[non-string body]';
              console.log('[tRPC] Request body preview:', bodyPreview);
            } catch (bodyLogError) {
              console.warn('[tRPC] Failed to log request body:', bodyLogError);
            }
          } else {
            console.log('[tRPC] Request body is empty');
          }
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options?.headers,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
          
          // Check if response is OK
          if (!response.ok) {
            console.error('[tRPC] Request failed:', response.status, response.statusText);
            const errorClone = response.clone();
            const contentType = response.headers.get('content-type');
            
            // Check if response is JSON
            if (contentType && contentType.includes('application/json')) {
              try {
                const errorData = await errorClone.json();
                console.error('[tRPC] Error response (JSON):', errorData);
              } catch (e) {
                const errorText = await errorClone.text().catch(() => 'Unknown error');
                console.error('[tRPC] Error response (text):', errorText);
              }
            } else {
              // Response is not JSON - might be HTML error page
              const errorText = await errorClone.text().catch(() => 'Unknown error');
              console.error('[tRPC] Error response (non-JSON):', errorText.substring(0, 200));
              throw new Error(`Server returned non-JSON response (${response.status}). This usually means:\n1. Backend server is not running\n2. Wrong API URL configured\n3. Server error page returned instead of JSON\n\nResponse preview: ${errorText.substring(0, 100)}...`);
            }
          }
          
          // Verify response is JSON before returning
          const contentType = response.headers.get('content-type');
          if (contentType && !contentType.includes('application/json')) {
            const responseClone = response.clone();
            const text = await responseClone.text();
            console.error('[tRPC] Non-JSON response received:', text.substring(0, 200));
            throw new Error(`Server returned non-JSON response. Expected JSON but got: ${contentType}`);
          }
          
          // Clone response to log the raw body before returning
          const responseClone = response.clone();
          try {
            const rawText = await responseClone.text();
            const logMsg = `Raw server response: ${rawText.substring(0, 500)}`;
            console.log('[tRPC] ✅', logMsg);
            debugService.info('tRPC', logMsg, { length: rawText.length, contentType });
            
            // Try to parse as JSON to validate
            try {
              const parsed = JSON.parse(rawText);
              const jsonMsg = `Response is valid JSON: ${JSON.stringify(parsed).substring(0, 300)}`;
              console.log('[tRPC] ✅', jsonMsg);
              debugService.debug('tRPC', jsonMsg);
            } catch (parseError) {
              const errorMsg = `Response is NOT valid JSON: ${parseError}`;
              console.error('[tRPC] ❌', errorMsg);
              console.error('[tRPC] Full response body:', rawText);
              debugService.error('tRPC', errorMsg, { fullResponse: rawText });
              throw new Error(`Server returned invalid JSON. Response: ${rawText.substring(0, 200)}`);
            }
          } catch (logError) {
            console.error('[tRPC] Error logging response:', logError);
            debugService.error('tRPC', 'Error logging response', logError);
            // Don't throw - just log and continue
          }
          
          return response;
        } catch (error) {
          console.error('[tRPC] ❌ Fetch error:', error);
          console.error('[tRPC] Error details:', {
            message: error instanceof Error ? error.message : String(error),
            url,
            baseUrl,
            stack: error instanceof Error ? error.stack : undefined,
          });
          
          // Provide more helpful error message
          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Network request failed. Please check:\n1. Backend is running at ${baseUrl}\n2. Internet connection is active\n3. API URL is correct in your environment variables`);
          }
          
          // Re-throw if it's already a helpful error
          if (error instanceof Error && error.message.includes('non-JSON')) {
            throw error;
          }
          
          throw error;
        }
      },
    }),
  ],
});