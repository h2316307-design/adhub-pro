export interface ContractRow {
  Contract_Number: number | string;
  'Customer Name'?: string;
  customer_name?: string;
  'Ad Type'?: string;
  ad_type?: string;
  customer_category?: string;
  billboards_data?: any;
  billboards_count?: number;
  Total?: number;
  'Total Rent'?: number; // legacy
  customer_id?: string;
}

export interface BillboardSize {
  size: string;
  level: string;
  quantity: number;
  faces: number; // عدد الأوجه
  print_price: number;
  install_price: number;
  adType?: string; // نوع الإعلان (وجه، تيبول)
}

export interface PrintInvoiceItem {
  contractNumber: string;
  adType: string;
  customerCategory: string;
  selected: boolean;
  sizes: BillboardSize[];
  total: number;
}

export interface InstallationPrintPricing {
  id: number;
  size: string;
  level: string;
  category: string;
  print_price: number;
  installation_price: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  items: InvoiceItem[];
  totalAmount: number;
  totalInWords: string;
  notes: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentRow {
  id: string;
  created_at: string;
  customer_id: string;
  customer_name: string;
  contract_number: number | string | null;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  paid_at: string;
  entry_type: 'receipt' | 'invoice' | 'debt' | 'account_payment' | 'payment' | 'sales_invoice' | 'purchase_invoice' | 'printed_invoice' | 'general_debit' | 'general_credit';
  distributed_payment_id?: string | null;
  printed_invoice_id?: string | null; // ✅ ربط مع فاتورة طباعة
  sales_invoice_id?: string | null; // ✅ ربط مع فاتورة مبيعات
  purchase_invoice_id?: string | null; // ✅ ربط مع فاتورة مشتريات
}

export interface PrintedInvoiceRow {
  id: string; // uuid
  created_at: string;
  updated_at?: string;
  invoice_number: string;
  invoice_date: string;
  customer_id?: string | null;
  customer_name?: string | null;
  contract_number: number; // primary related contract (not nullable in DB)
  contract_numbers?: number[] | null; // optional array when UI groups multiple contracts
  printer_name: string;
  total_amount?: number | null;
  paid_amount?: number | null; // المبلغ المدفوع
  paid?: boolean | null; // هل تم تسديد الفاتورة بالكامل
  invoice_type?: string | null;
  currency_symbol?: string | null;
  notes?: string | null;
  design_face_a_path?: string | null;
  design_face_b_path?: string | null;
  account_payments_deducted?: string | null;
}
