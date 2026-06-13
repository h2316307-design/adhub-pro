import React from 'react';
import { Printer, DollarSign, BarChart3 } from 'lucide-react';

interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  writtenName: string;
}

interface ContractDetails {
  finalTotal: string;
  rentalCost: string;
  installationCost: string;
  duration: string;
  startDate: string;
  endDate: string;
  currencyInfo: CurrencyInfo;
}

interface CustomerData {
  name: string;
  company: string | null;
  phone: string | null;
}

interface DiscountInfo {
  type: string;
  value: number;
  display: string;
  text: string;
}

interface PaymentInstallment {
  number: number;
  amount: string;
  description: string;
  paymentType: string;
  dueDate: string;
  currencySymbol: string;
  currencyWrittenName: string;
}

interface ContractPDFSummaryProps {
  isGenerating: boolean;
  customerData: CustomerData | null;
  contractDetails: ContractDetails;
  currencyInfo: CurrencyInfo;
  discountInfo: DiscountInfo | null;
  paymentInstallments: PaymentInstallment[];
  contract: any;
  printMode: 'auto' | 'manual';
  setPrintMode: (mode: 'auto' | 'manual') => void;
  useInstallationImages: boolean;
  setUseInstallationImages: (value: boolean) => void;
  formatArabicNumber: (num: number) => string;
}

export function ContractPDFSummary({
  isGenerating,
  customerData,
  contractDetails,
  currencyInfo,
  discountInfo,
  paymentInstallments,
  contract,
  printMode,
  setPrintMode,
  useInstallationImages,
  setUseInstallationImages,
  formatArabicNumber,
}: ContractPDFSummaryProps) {
  if (isGenerating) {
    return (
      <div className="text-center py-16">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
            <Printer className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
        </div>
        <p className="text-xl font-bold mt-6 text-foreground">جاري تحضير العقد للطباعة...</p>
        <p className="text-muted-foreground mt-2">يتم تحميل بيانات العميل وتحضير التخطيط مع الدفعات</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Total Card - Hero Style */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-glow p-6 text-primary-foreground shadow-xl">
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-primary-foreground/80 text-sm">المجموع الإجمالي</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-bold" style={{ direction: 'ltr', display: 'inline-block' }}>{contractDetails.finalTotal}</span>
              <span className="text-xl">{currencyInfo.symbol}</span>
            </div>
          </div>
          <div className="text-left">
            <p className="text-primary-foreground/80 text-sm">مدة العقد</p>
            <p className="text-2xl font-bold">{contractDetails.duration} يوم</p>
          </div>
        </div>
      </div>

      {/* Contract Details Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Customer Info */}
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-lg">👤</span>
            </div>
            <h3 className="font-semibold text-foreground">بيانات العميل</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">الاسم:</span>
              <span className="font-medium">{customerData?.name || 'غير محدد'}</span>
            </p>
            {customerData?.company && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">الشركة:</span>
                <span className="font-medium">{customerData.company}</span>
              </p>
            )}
            {customerData?.phone && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">الهاتف:</span>
                <span className="font-medium font-mono" dir="ltr">{customerData.phone}</span>
              </p>
            )}
          </div>
        </div>

        {/* Contract Info */}
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-lg">📄</span>
            </div>
            <h3 className="font-semibold text-foreground">بيانات العقد</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">رقم العقد:</span>
              <span className="font-medium font-mono">{contract?.id || contract?.Contract_Number || 'غير محدد'}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">البداية:</span>
              <span className="font-medium">{contractDetails.startDate}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">النهاية:</span>
              <span className="font-medium">{contractDetails.endDate}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Financial Details */}
      <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">التفاصيل المالية</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">سعر الإيجار</p>
            <p className="text-lg font-bold text-foreground">{contractDetails.rentalCost}</p>
            <p className="text-xs text-muted-foreground">{currencyInfo.symbol}</p>
          </div>
          {discountInfo && (
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-xs text-green-600 mb-1">الخصم</p>
              <p className="text-lg font-bold text-green-600">{discountInfo.text}</p>
            </div>
          )}
          {(contract?.installation_enabled === true || contract?.installation_enabled === 1 || contract?.installation_enabled === "true" || contract?.installation_enabled === "1") && contract?.installation_cost && (
            <div className="text-center p-3 rounded-lg bg-blue-500/10">
              <p className="text-xs text-blue-600 mb-1">التركيب</p>
              <p className="text-lg font-bold text-blue-600">{formatArabicNumber(Number(contract.installation_cost))}</p>
              <p className="text-xs text-blue-600">{currencyInfo.symbol}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payments */}
      {paymentInstallments.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">جدول الدفعات ({paymentInstallments.length})</h3>
          </div>
          <div className="space-y-2">
            {paymentInstallments.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {payment.number}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{payment.description}</p>
                    {payment.dueDate && <p className="text-xs text-muted-foreground">{payment.dueDate}</p>}
                  </div>
                </div>
                <div className="text-left font-bold text-primary">
                  {payment.amount} {payment.currencySymbol}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Options */}
      <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-lg">⚙️</span>
          </div>
          <h3 className="font-semibold text-foreground">خيارات الطباعة</h3>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
            <input 
              type="radio" 
              name="printMode" 
              value="auto" 
              checked={printMode === 'auto'} 
              onChange={(e) => setPrintMode(e.target.value as 'auto')}
              className="w-4 h-4 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-medium">طباعة تلقائية</span>
              <p className="text-xs text-muted-foreground">يفتح نافذة الطباعة مباشرة</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
            <input 
              type="radio" 
              name="printMode" 
              value="manual" 
              checked={printMode === 'manual'} 
              onChange={(e) => setPrintMode(e.target.value as 'manual')}
              className="w-4 h-4 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-medium">طباعة يدوية</span>
              <p className="text-xs text-muted-foreground">معاينة أولاً ثم طباعة</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer border-t border-border/50 mt-3 pt-3">
            <input 
              type="checkbox" 
              checked={useInstallationImages} 
              onChange={(e) => setUseInstallationImages(e.target.checked)}
              className="w-4 h-4 text-primary focus:ring-primary rounded"
            />
            <div>
              <span className="text-sm font-medium">استخدام صور التركيب الفعلية</span>
              <p className="text-xs text-muted-foreground">عرض صور التركيب المكتملة بدلاً من الصور الافتراضية</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
