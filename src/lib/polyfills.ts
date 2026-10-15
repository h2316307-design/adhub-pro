/**
 * crypto.randomUUID متاح فقط في السياق الآمن (https أو localhost).
 * عند فتح النظام عبر عنوان الشبكة (http://192.168...) يكون غير موجود فتفشل عمليات الإنشاء.
 */
if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID !== 'function') {
  (crypto as any).randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16));
}
export {};
