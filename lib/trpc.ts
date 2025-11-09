import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "../backend/trpc/app-router"
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_RORK_API_BASE_URL) {
    const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    // Don't use localhost on mobile devices
    if (url && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      return url;
    }
  }

  // Fallback for development - this should be set in production
  console.warn('EXPO_PUBLIC_RORK_API_BASE_URL not set or is localhost, using fallback');
  console.warn('Please set EXPO_PUBLIC_RORK_API_BASE_URL to your Render backend URL');
  // Return null or empty to make the error more obvious
  return 'http://localhost:3000';
};

export const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
});