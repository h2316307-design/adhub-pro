/**
 * Offline Image Interceptor
 * Automatically intercepts all img src assignments and replaces external URLs
 * with cached base64 data when in offline mode.
 * 
 * This avoids having to replace <img> tags in 36+ files.
 */
import { isOfflineMode } from '@/integrations/supabase/client';
import { supabase } from '@/integrations/supabase/client';
import { memoryCache } from '@/utils/imageResolver';

let cacheLoaded = false;

/**
 * Preload all cached images from image_cache table into memory.
 * Call this once on app startup in offline mode.
 */
export async function preloadImageCache(): Promise<void> {
  if (!isOfflineMode || cacheLoaded) return;

  try {
    let allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 500;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await (supabase as any)
        .from('image_cache')
        .select('original_url, base64_data')
        .range(from, from + PAGE_SIZE - 1);

      if (error || !data || data.length === 0) break;
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    for (const row of allData) {
      if (row.original_url && row.base64_data) {
        memoryCache.set(row.original_url, row.base64_data);
      }
    }

    cacheLoaded = true;
    console.log(`[Offline] Preloaded ${memoryCache.size} cached images`);
  } catch (e) {
    console.warn('[Offline] Failed to preload image cache:', e);
  }
}

/**
 * Install a MutationObserver that watches for new <img> elements
 * and replaces their src with cached base64 when in offline mode.
 */
export function installImageInterceptor(): (() => void) | undefined {
  if (!isOfflineMode) return undefined;

  // Also intercept window.open to handle print windows
  const originalWindowOpen = window.open.bind(window);
  window.open = function (...args: any[]) {
    const newWindow = originalWindowOpen(...args);
    if (newWindow) {
      const originalWrite = newWindow.document.write.bind(newWindow.document);
      newWindow.document.write = function (html: string) {
        return originalWrite(replaceImageUrlsInHtml(html));
      };
    }
    return newWindow;
  } as typeof window.open;

  const processImg = (img: HTMLImageElement) => {
    const src = img.getAttribute('src');
    if (!src) return;
    // Skip already resolved, data URLs, local paths, and blobs
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) return;

    const cached = memoryCache.get(src);
    if (cached) {
      img.setAttribute('src', cached);
    }
  };

  // Process all existing images
  document.querySelectorAll('img').forEach(processImg);

  // Watch for new images
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) {
          processImg(node);
        }
        if (node instanceof HTMLElement) {
          node.querySelectorAll('img').forEach(processImg);
        }
      }
      if (mutation.type === 'attributes' && mutation.attributeName === 'src' && mutation.target instanceof HTMLImageElement) {
        processImg(mutation.target);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  return () => observer.disconnect();
}

/**
 * Process HTML string to replace image URLs with cached base64.
 * Use this for print windows and generated HTML.
 */
export function replaceImageUrlsInHtml(html: string): string {
  if (!isOfflineMode || memoryCache.size === 0) return html;

  let result = html;
  for (const [originalUrl, base64Data] of memoryCache) {
    // Replace all occurrences of the URL in the HTML string
    if (result.includes(originalUrl)) {
      result = result.split(originalUrl).join(base64Data);
    }
  }
  return result;
}
