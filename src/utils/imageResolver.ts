import { useState, useEffect } from 'react';
import { supabase, isOfflineMode } from '@/integrations/supabase/client';

// In-memory cache to avoid repeated DB queries (shared with offlineImageInterceptor)
export const memoryCache = new Map<string, string>();

/**
 * Resolves an image URL - returns original URL in online mode,
 * or base64 from memory cache / image_cache table in offline mode
 */
export async function resolveImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  
  // In online mode, return the URL as-is
  if (!isOfflineMode) return url;
  
  // Check memory cache first
  if (memoryCache.has(url)) {
    return memoryCache.get(url)!;
  }
  
  try {
    const { data, error } = await (supabase as any)
      .from('image_cache')
      .select('base64_data')
      .eq('original_url', url)
      .single();
    
    if (data && !error) {
      memoryCache.set(url, data.base64_data);
      return data.base64_data;
    }
  } catch (e) {
    console.warn('Failed to resolve image from cache:', url);
  }
  
  // Fallback to original URL
  return url;
}

/**
 * Resolve multiple image URLs at once (for print HTML generation)
 */
export async function resolveImageUrls(urls: (string | null | undefined)[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!isOfflineMode) {
    urls.forEach(u => { if (u) result.set(u, u); });
    return result;
  }
  
  const promises = urls.filter(Boolean).map(async (url) => {
    const resolved = await resolveImageUrl(url!);
    if (resolved) result.set(url!, resolved);
  });
  await Promise.all(promises);
  return result;
}

/**
 * React hook that resolves an image URL for offline mode
 */
export function useResolvedImage(url: string | null | undefined): { src: string | null; isLoading: boolean } {
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }

    // Online mode: use URL directly
    if (!isOfflineMode) {
      setSrc(url);
      return;
    }

    // Check memory cache
    if (memoryCache.has(url)) {
      setSrc(memoryCache.get(url)!);
      return;
    }

    setIsLoading(true);
    resolveImageUrl(url).then(resolved => {
      setSrc(resolved);
      setIsLoading(false);
    });
  }, [url]);

  return { src, isLoading };
}

/**
 * Compress and convert an image to base64
 */
export async function imageToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string; size: number } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve({
          base64,
          mimeType,
          size: blob.size
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Clear the in-memory cache
 */
export function clearImageCache() {
  memoryCache.clear();
}
