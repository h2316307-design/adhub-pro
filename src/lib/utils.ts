import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGregorianDate(input: string | Date, locale: string = 'ar-LY'): string {
  try {
    const date = input instanceof Date ? input : new Date(input);
    const options: Intl.DateTimeFormatOptions & { calendar?: string } = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      calendar: 'gregory'
    };
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return '';
  }
}

// Normalize Arabic text for robust searching: lowercase, remove diacritics, normalize alef/yaa/taa marbuta, remove tatweel
export function normalizeArabic(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  let s = String(input).toLowerCase();
  // Remove diacritics and superscript alef
  s = s.replace(/[\u064B-\u0652\u0670]/g, '');
  // Tatweel
  s = s.replace(/[\u0640]/g, '');
  // Normalize Alef variants to ا
  s = s.replace(/[\u0622\u0623\u0625]/g, '\u0627');
  // Normalize Yaa forms and Alef Maqsura to ي
  s = s.replace(/[\u0649\u0626]/g, '\u064A');
  // Normalize Taa Marbuta to ه for broader matching
  s = s.replace(/[\u0629]/g, '\u0647');
  // Convert Arabic-Indic digits to Latin digits for consistency
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  for (let i = 0; i < arabicDigits.length; i++) {
    const ar = arabicDigits[i];
    s = s.replace(new RegExp(ar, 'g'), String(i));
  }
  // Collapse spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function queryTokens(query: string): string[] {
  return normalizeArabic(query).split(/\s+/).filter(Boolean);
}

/**
 * Normalize billboard size to a consistent format (smaller dimension first)
 * Handles numeric (e.g., "10x4" → "4x10"), with suffixes (e.g., "3X8-T" → "3x8-T"),
 * decimal (e.g., "2.5X4" → "2.5x4"), and textual names (e.g., "سوسيت" → "سوسيت")
 */
export function normalizeSize(size: string | null | undefined): string {
  if (!size) return '';
  const trimmed = size.trim();
  // Match dimensions with optional suffixes: "3X8-T", "2.5X4", "10x4"
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return trimmed;
  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);
  const suffix = match[3] ? match[3].trim() : '';
  const [small, large] = a <= b ? [a, b] : [b, a];
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toString();
  const base = `${fmt(small)}x${fmt(large)}`;
  return suffix ? `${base}-${suffix}` : base;
}

/**
 * Format size for display: larger dimension first (e.g., "10x4")
 * Preserves suffixes and decimal points
 */
export function displaySize(size: string | null | undefined): string {
  if (!size) return '—';
  const trimmed = size.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return trimmed;
  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);
  const suffix = match[3] ? match[3].trim() : '';
  const [large, small] = a >= b ? [a, b] : [b, a];
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toString();
  const base = `${fmt(large)}x${fmt(small)}`;
  return suffix ? `${base}-${suffix}` : base;
}
