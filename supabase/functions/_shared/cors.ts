// List of allowed origins for CORS
// In production, add your actual domain(s) here
const allowedOrigins = [
  'https://id-preview--730b5654-af8c-4ad3-9324-86c94529393a.lovable.app',
  'https://atqjaiebixuzomrfwilu.supabase.co',
  // Add localhost for development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Get CORS headers based on the request origin
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is in the allowed list
  const isAllowed = origin && allowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith('.lovable.app')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Legacy export for backward compatibility - uses first allowed origin
export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
