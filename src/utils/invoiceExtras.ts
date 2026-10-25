/**
 * إعدادات إضافية للفواتير: التحويلات البنكية + صورة الختم
 * تُخزن في system_settings بمفتاحي 'invoice_bank_accounts' و 'invoice_stamp_image'
 */

import { supabase } from '@/integrations/supabase/client';

export interface BankAccount {
  bankName: string;
  /** رقم الحساب العادي */
  accountNumber: string;
  /** رقم حساب LYPay لنفس المصرف (اختياري) */
  lypayNumber?: string;
  /** رابط أيقونة المصرف (اختياري) */
  iconUrl?: string;
}

/** شعار نظام LYPay الذي يظهر عنوان قسم LYPay في الفواتير */
export const LYPAY_LOGO_URL = '/bank-icons/lypay.png';

export interface InvoiceExtras {
  bankAccounts: BankAccount[];
  stampImageUrl: string;
}

let cache: InvoiceExtras | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

export async function fetchInvoiceExtras(): Promise<InvoiceExtras> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const defaults: InvoiceExtras = { bankAccounts: [], stampImageUrl: '' };

  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['invoice_bank_accounts', 'invoice_stamp_image']);

    if (!data) return defaults;

    for (const row of data) {
      if (row.setting_key === 'invoice_bank_accounts' && row.setting_value) {
        try { defaults.bankAccounts = JSON.parse(row.setting_value); } catch {}
      }
      if (row.setting_key === 'invoice_stamp_image' && row.setting_value) {
        defaults.stampImageUrl = row.setting_value;
      }
    }

    cache = defaults;
    cacheTime = Date.now();
    return defaults;
  } catch {
    return defaults;
  }
}

export async function saveInvoiceExtras(extras: Partial<InvoiceExtras>): Promise<void> {
  if (extras.bankAccounts !== undefined) {
    await upsertSetting('invoice_bank_accounts', JSON.stringify(extras.bankAccounts), 'json', 'معلومات التحويلات البنكية');
  }
  if (extras.stampImageUrl !== undefined) {
    await upsertSetting('invoice_stamp_image', extras.stampImageUrl, 'text', 'صورة ختم الشركة');
  }
  cache = null;
  cacheTime = 0;
}

async function upsertSetting(key: string, value: string, type: string, desc: string) {
  const { data } = await supabase
    .from('system_settings')
    .select('id')
    .eq('setting_key', key)
    .maybeSingle();

  if (data) {
    await supabase
      .from('system_settings')
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq('setting_key', key);
  } else {
    await supabase
      .from('system_settings')
      .insert({ setting_key: key, setting_value: value, setting_type: type, description: desc });
  }
}

/**
 * Generate bank + stamp HTML section for invoices
 */
/**
 * أرقام الحسابات مرتبة حسب النظام (LYPay ثم عادي) مع أيقونة المصرف إن وُجدت.
 * يُستخدم في الفواتير وفواتير الطباعة/التركيب.
 */
export function renderBankAccountsHTML(accounts: BankAccount[], primaryColor: string = '#D4AF37'): string {
  if (accounts.length === 0) return '';

  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const groups = new Map<string, { name: string; icon?: string; normal: Set<string>; lypay: Set<string> }>();
  for (const bank of accounts) {
    if (!bank.accountNumber?.trim() && !bank.lypayNumber?.trim()) continue;
    const name = bank.bankName?.trim() || 'حساب مصرفي';
    const group = groups.get(name) || { name, icon: bank.iconUrl, normal: new Set<string>(), lypay: new Set<string>() };
    if (!group.icon && bank.iconUrl) group.icon = bank.iconUrl;
    if (bank.accountNumber?.trim()) group.normal.add(bank.accountNumber.trim());
    if (bank.lypayNumber?.trim()) group.lypay.add(bank.lypayNumber.trim());
    groups.set(name, group);
  }
  if (!groups.size) return '';
  const accountRow = (label: string, value: string, lypay = false) => `<div class="invoice-bank-number" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:2px 0;min-width:0;">
    <span style="display:inline-flex;align-items:center;gap:5px;flex-shrink:0;font-size:10px;color:#666;">${lypay ? `<img src="${LYPAY_LOGO_URL}" alt="LYPay" style="width:38px;height:16px;object-fit:contain;" />` : escape(label)}</span>
    <bdi dir="ltr" style="min-width:0;max-width:100%;text-align:right;overflow-wrap:anywhere;font-family:Manrope,Doran,sans-serif;font-size:11px;font-weight:600;letter-spacing:.2px;">${escape(value)}</bdi>
  </div>`;
  return `<section class="invoice-bank-details" dir="rtl" style="width:100%;font-family:Doran,sans-serif;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11px;font-weight:700;color:#444;">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 10 9-7 9 7M3 10h18M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18"/></svg>بيانات التحويل المصرفي
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;">
      ${[...groups.values()].map(bank => `<div class="invoice-bank-card" style="min-width:0;border:1px solid #dedede;border-radius:6px;padding:10px 12px;break-inside:avoid;background:#fff;">
        <div style="display:flex;align-items:center;gap:8px;padding-bottom:7px;margin-bottom:3px;border-bottom:1px solid #eee;">
          ${bank.icon ? `<img src="${escape(bank.icon)}" alt="" style="width:28px;height:24px;object-fit:contain;flex-shrink:0;" />` : ''}
          <strong style="font-size:11px;color:#333;">${escape(bank.name)}</strong>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 20px;padding-top:3px;">
          ${[...bank.normal].map(value => accountRow('رقم الحساب', value)).join('')}
          ${[...bank.lypay].map(value => accountRow('LYPay', value, true)).join('')}
        </div>
      </div>`).join('')}
    </div>
  </section>`;

}

export function generateBankAndStampHTML(extras: InvoiceExtras, primaryColor: string = '#D4AF37'): string {
  const hasBanks = extras.bankAccounts.length > 0;
  const hasStamp = !!extras.stampImageUrl;
  if (!hasBanks && !hasStamp) return '';

  const bankHtml = hasBanks ? `
    <div style="flex:1;">
      ${renderBankAccountsHTML(extras.bankAccounts, primaryColor)}
    </div>
  ` : '<div style="flex:1;"></div>';

  const stampHtml = hasStamp ? `
    <div style="text-align:center;flex-shrink:0;">
      <img src="${extras.stampImageUrl}" alt="ختم الشركة" style="max-width:140px;max-height:140px;object-fit:contain;" />
    </div>
  ` : '';

  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-top:14px;padding-top:12px;border-top:1px solid #e5e5e5;">
      ${bankHtml}
      ${stampHtml}
    </div>
  `;
}
