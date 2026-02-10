/**
 * Print Engine Utilities
 * دوال مساعدة للطباعة
 */

/**
 * تحميل الشعار كـ Data URI
 */
export async function loadLogoAsDataUri(logoPath: string): Promise<string> {
  try {
    const response = await fetch(logoPath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading logo:', error);
    return '';
  }
}

/**
 * تنسيق الرقم بالعربية
 */
export function formatArabicNumber(num: number): string {
  return num.toLocaleString('ar-LY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * تنسيق التاريخ
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('ar-LY');
  } catch {
    return dateString;
  }
}

/**
 * تنسيق التاريخ والوقت
 */
export function formatDateTime(dateString: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleString('ar-LY');
  } catch {
    return dateString;
  }
}
