import { supabase } from '@/integrations/supabase/client';

export type ImageUploadProvider = 'supabase_storage' | 'imgbb' | 'freeimage' | 'postimg' | 'cloudinary';

let cachedProvider: ImageUploadProvider | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // re-check every 30s

/**
 * Get current image upload provider from system_settings
 * Defaults to supabase_storage if not set
 */
export const getImageUploadProvider = async (): Promise<ImageUploadProvider> => {
  if (cachedProvider && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) return cachedProvider;

  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'image_upload_provider')
    .single();

  const val = data?.setting_value;
  if (val === 'freeimage') cachedProvider = 'freeimage';
  else if (val === 'postimg') cachedProvider = 'postimg';
  else if (val === 'imgbb') cachedProvider = 'imgbb';
  else if (val === 'cloudinary') cachedProvider = 'cloudinary';
  else cachedProvider = 'supabase_storage'; // default
  cacheTimestamp = Date.now();
  return cachedProvider;
};

/** Clear all cached keys/provider (call after updating settings) */
export const clearImageUploadCache = () => {
  cachedProvider = null;
  cacheTimestamp = 0;
};

// Re-export for backward compatibility
export const clearImgbbKeyCache = clearImageUploadCache;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getProviderName = (provider: ImageUploadProvider): string => {
  if (provider === 'supabase_storage') return 'Supabase Storage';
  if (provider === 'freeimage') return 'Freeimage.host';
  if (provider === 'postimg') return 'PostImages';
  if (provider === 'cloudinary') return 'Cloudinary';
  return 'imgbb';
};

/**
 * Get API key for a provider from system_settings
 */
const getApiKey = async (provider: ImageUploadProvider): Promise<string> => {
  const settingKey = provider === 'freeimage' ? 'freeimage_api_key' : provider === 'postimg' ? 'postimg_api_key' : 'imgbb_api_key';
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', settingKey)
    .single();
  if (!data?.setting_value) throw new Error(`مفتاح ${getProviderName(provider)} API غير مُعد`);
  return data.setting_value;
};

/**
 * Upload a file to Supabase Storage and return the public URL
 */
const uploadToSupabaseStorage = async (file: File, name?: string): Promise<string> => {
  const ext = file.name?.split('.').pop() || 'png';
  const fileName = `${name || crypto.randomUUID()}-${Date.now()}.${ext}`;
  const filePath = `images/${fileName}`;

  console.log('Uploading to Supabase Storage...', filePath);
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(filePath, file, {
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw new Error('فشل رفع الصورة إلى Supabase Storage: ' + error.message);
  }

  const { data: publicData } = supabase.storage
    .from('uploads')
    .getPublicUrl(data.path);

  console.log('Supabase Storage upload success:', publicData.publicUrl);
  return publicData.publicUrl;
};

/**
 * Upload base64 data to Supabase Storage
 */
const uploadBase64ToSupabaseStorage = async (base64: string, name?: string): Promise<string> => {
  // Convert base64 to Blob
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  const file = new File([blob], `${name || 'image'}.png`, { type: 'image/png' });

  return uploadToSupabaseStorage(file, name);
};

/**
 * Upload directly to PostImages from the browser (bypasses Edge Function)
 */
const uploadToPostImagesDirect = async (base64: string, name?: string): Promise<string> => {
  const apiKey = await getApiKey('postimg');
  
  const formBody: Record<string, string> = {
    key: apiKey,
    o: '2b819584285c102318568238c7d4a4c7',
    m: '59c2ad4b46b0c1e12d5703302bff0120',
    version: '1.0.1',
    portable: '1',
    image: base64,
  };
  if (name) {
    formBody.name = name;
    formBody.type = 'png';
  }

  const encodedBody = Object.keys(formBody)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(formBody[k])}`)
    .join('&');

  console.log('Uploading directly to PostImages from browser...');
  const response = await fetch('https://api.postimage.org/1/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: encodedBody,
  });

  const responseText = await response.text();
  console.log('PostImages response status:', response.status, 'preview:', responseText.substring(0, 300));

  if (!response.ok) {
    throw new Error('فشل رفع الصورة إلى PostImages');
  }

  const hotlinkMatch = responseText.match(/<hotlink>(https?:\/\/[^<]+)<\/hotlink>/);
  const directMatch = responseText.match(/<direct_link>(https?:\/\/[^<]+)<\/direct_link>/);
  const pageMatch = responseText.match(/<page>(https?:\/\/[^<]+)<\/page>/);
  
  const imageUrl = hotlinkMatch?.[1] || directMatch?.[1] || pageMatch?.[1];
  
  if (!imageUrl) {
    console.error('PostImages: could not extract URL:', responseText.substring(0, 500));
    throw new Error('فشل استخراج رابط الصورة من PostImages');
  }

  console.log('PostImages direct upload success:', imageUrl);
  return imageUrl;
};

/**
 * Upload via edge function proxy (handles CORS for imgbb and freeimage)
 */
const uploadViaProxy = async (base64: string, provider: ImageUploadProvider, name?: string, folder?: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('upload-image', {
    body: { base64, name, provider, folder },
  });

  if (error) {
    console.error(`${getProviderName(provider)} upload error:`, error);
    throw new Error(`فشل رفع الصورة إلى ${getProviderName(provider)}`);
  }

  if (!data?.url) {
    console.error('Upload response missing URL:', data);
    throw new Error(data?.error || `فشل رفع الصورة إلى ${getProviderName(provider)}`);
  }

  return data.url;
};

/**
 * Upload an image file using the configured provider
 * @param folder - Optional folder path for Cloudinary organization
 */
export const uploadImage = async (file: File, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  
  // Supabase Storage: upload file directly
  if (provider === 'supabase_storage') {
    return uploadToSupabaseStorage(file, name);
  }

  const base64 = await fileToBase64(file);
  
  // All external providers go through the Edge Function proxy (handles CORS)
  return uploadViaProxy(base64, provider, name, folder);
};

/**
 * Upload a base64 image string using the configured provider
 */
export const uploadBase64Image = async (base64Data: string, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  
  // Supabase Storage
  if (provider === 'supabase_storage') {
    return uploadBase64ToSupabaseStorage(cleanBase64, name);
  }
  
  // All external providers go through the Edge Function proxy (handles CORS)
  return uploadViaProxy(cleanBase64, provider, name, folder);
};

// Backward compatibility aliases
export const uploadToImgbb = uploadImage;
export const uploadBase64ToImgbb = uploadBase64Image;
export const getImgbbApiKey = async (): Promise<string> => {
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'imgbb_api_key')
    .single();
  if (!data?.setting_value) throw new Error('مفتاح imgbb API غير مُعد');
  return data.setting_value;
};
