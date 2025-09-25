// API configuration for different environments
export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or fallback
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  
  // Server-side: use environment variable or fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

export const API_URL = getApiUrl();
