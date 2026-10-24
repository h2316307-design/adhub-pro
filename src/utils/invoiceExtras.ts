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

  // لكل مصرف جدول: عمود الأيقونات على اليمين (الأيقونة مع الاسم، وشعار LYPay مع رقمه)، والأرقام تحتها
  const bankGroups = new Map<string, { bank: BankAccount; normal: string[]; lypay: string[] }>();
  for (const b of accounts) {
    let group = bankGroups.get(b.bankName);
    if (!group) {
      group = { bank: b, normal: [], lypay: [] };
      bankGroups.set(b.bankName, group);
    }
    if (b.accountNumber?.trim()) group.normal.push(b.accountNumber.trim());
    if (b.lypayNumber?.trim()) group.lypay.push(b.lypayNumber.trim());
  }
  const iconCell = (src: string | undefined, alt: string) =>
    `<td style="width:90px;text-align:right;vertical-align:middle;padding:0 0 4px 0;">${src ? `<img src="${src}" alt="${alt}" style="display:inline-block;height:22px;max-width:90px;width:auto;object-fit:contain;vertical-align:middle;" />` : ''}</td>`;
  const numberCell = (value: string) =>
    `<td dir="ltr" style="text-align:right;font-family:Manrope,monospace;letter-spacing:0.5px;font-size:11px;line-height:1.7;padding:0 0 4px 0;">${value}</td>`;
  const lypayLogo = LYPAY_LOGO_URL;

  const blocks = [...bankGroups.values()].map(({ bank, normal, lypay }) => {
    const rows = [
      `<tr>${iconCell(bank.iconUrl, bank.bankName)}<td style="text-align:right;font-weight:600;font-size:11px;line-height:1.7;padding:0 0 4px 0;">${bank.bankName}</td></tr>`,
      ...normal.map(n => `<tr>${iconCell(undefined, '')}${numberCell(n)}</tr>`),
      ...lypay.map(n => `<tr>${iconCell(lypayLogo, 'LYPay')}${numberCell(n)}</tr>`),
    ].join('');
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:10px;"><tbody>${rows}</tbody></table>`;
  }).join('');

  return blocks;
}

export function generateBankAndStampHTML(extras: InvoiceExtras, primaryColor: string = '#D4AF37'): string {
  const hasBanks = extras.bankAccounts.length > 0;
  const hasStamp = !!extras.stampImageUrl;
  if (!hasBanks && !hasStamp) return '';

  const bankHtml = hasBanks ? `
    <div style="flex:1;">
      <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:${primaryColor};">
        معلومات التحويلات البنكية
      </div>
      ${renderBankAccountsHTML(extras.bankAccounts, primaryColor)}
    </div>
  ` : '<div style="flex:1;"></div>';

  const stampHtml = hasStamp ? `
    <div style="text-align:center;flex-shrink:0;">
      <img src="${extras.stampImageUrl}" alt="ختم الشركة" style="max-width:140px;max-height:140px;object-fit:contain;" />
    </div>
  ` : '';

  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:30px;margin-top:20px;padding-top:15px;border-top:1px dashed #ccc;">
      ${bankHtml}
      ${stampHtml}
    </div>
  `;
}
