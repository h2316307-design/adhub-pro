import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Wrench, Save, X, Calculator, Percent, Minus, TrendingDown, TrendingUp, Printer, Gift, Settings, Info, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface CostSummaryCardProps {
  estimatedTotal: number;
  rentCost: number;
  setRentCost: (cost: number) => void;
  setUserEditedRentCost: (edited: boolean) => void;
  discountType: 'percent' | 'amount';
  setDiscountType: (type: 'percent' | 'amount') => void;
  discountValue: number;
  setDiscountValue: (value: number) => void;
  baseTotal: number;
  discountAmount: number;
  finalTotal: number;
  installationCost: number;
  rentalCostOnly: number;
  operatingFee: number;
  operatingFeeRate?: number;
  currentContract: any;
  originalTotal: number;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  totalFriendCosts?: number;
  // Print cost props
  printCost?: number;
  printCostEnabled?: boolean;
  // Installation enabled prop
  installationEnabled?: boolean;
  // Include in price toggles
  includeInstallationInPrice?: boolean;
  setIncludeInstallationInPrice?: (include: boolean) => void;
  includePrintInPrice?: boolean;
  setIncludePrintInPrice?: (include: boolean) => void;
  // NEW: Include operating fee in costs toggles
  includeOperatingInPrint?: boolean;
  setIncludeOperatingInPrint?: (include: boolean) => void;
  includeOperatingInInstallation?: boolean;
  setIncludeOperatingInInstallation?: (include: boolean) => void;
  // NEW: Separate operating fee rates for installation and print
  operatingFeeRateInstallation?: number;
  setOperatingFeeRateInstallation?: (rate: number) => void;
  operatingFeeRatePrint?: number;
  setOperatingFeeRatePrint?: (rate: number) => void;
  // Currency
  currencySymbol?: string;
  // NEW: Proportional distribution callback
  onProportionalDistribution?: (newTotal: number) => void;
  // ✅ NEW: Refresh prices from table
  savedBaseRent?: number | null;
  calculatedEstimatedTotal?: number;
  onRefreshPricesFromTable?: () => void;
}

export function CostSummaryCard({
  estimatedTotal,
  rentCost,
  setRentCost,
  setUserEditedRentCost,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  baseTotal,
  discountAmount,
  finalTotal,
  installationCost,
  rentalCostOnly,
  operatingFee,
  operatingFeeRate = 3,
  currentContract,
  originalTotal,
  onSave,
  onCancel,
  saving,
  totalFriendCosts = 0,
  printCost = 0,
  printCostEnabled = false,
  installationEnabled = true,
  includeInstallationInPrice = false,
  setIncludeInstallationInPrice,
  includePrintInPrice = false,
  setIncludePrintInPrice,
  includeOperatingInPrint = false,
  setIncludeOperatingInPrint,
  includeOperatingInInstallation = false,
  setIncludeOperatingInInstallation,
  operatingFeeRateInstallation = 3,
  setOperatingFeeRateInstallation,
  operatingFeeRatePrint = 3,
  setOperatingFeeRatePrint,
  currencySymbol = 'د.ل',
  onProportionalDistribution,
  savedBaseRent,
  calculatedEstimatedTotal,
  onRefreshPricesFromTable
}: CostSummaryCardProps) {
  const [showDetails, setShowDetails] = React.useState(true);
  const [proportionalValue, setProportionalValue] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // الإيجار الصافي بعد الخصم (قبل أي إضافات أو خصومات تكاليف)
  const rentalAfterDiscount = React.useMemo(() => {
    return baseTotal - discountAmount;
  }, [baseTotal, discountAmount]);

  // حساب صافي الإيجار الفعلي
  // إذا كانت التكلفة مضمنة = مخصومة من صافي الإيجار (مجانية للعميل)
  // إذا كانت التكلفة غير مضمنة = تضاف للإجمالي (يدفعها العميل)
  const netRental = React.useMemo(() => {
    let net = rentalAfterDiscount;
    
    // خصم التركيب إذا كان مضمناً (مجاني للعميل)
    if (installationEnabled && includeInstallationInPrice && installationCost > 0) {
      net -= installationCost;
    }
    
    // خصم الطباعة إذا كانت مضمنة (مجانية للعميل)
    if (printCostEnabled && includePrintInPrice && printCost > 0) {
      net -= printCost;
    }
    
    // خصم تكاليف الشركات الصديقة
    net -= totalFriendCosts;
    
    return Math.max(0, net);
  }, [rentalAfterDiscount, installationCost, printCost, installationEnabled, printCostEnabled, includeInstallationInPrice, includePrintInPrice, totalFriendCosts]);

  // حساب رسوم التشغيل على صافي الإيجار الفعلي
  const calculatedOperatingFee = React.useMemo(() => {
    return Math.round(netRental * (operatingFeeRate / 100) * 100) / 100;
  }, [netRental, operatingFeeRate]);

  // حساب الإجمالي النهائي للعميل
  const adjustedFinalTotal = React.useMemo(() => {
    let total = rentalAfterDiscount;
    
    // إضافة التركيب إذا لم يكن مضمناً
    if (installationEnabled && !includeInstallationInPrice && installationCost > 0) {
      total += installationCost;
    }
    
    // إضافة الطباعة إذا لم تكن مضمنة
    if (printCostEnabled && !includePrintInPrice && printCost > 0) {
      total += printCost;
    }
    
    return Math.max(0, total);
  }, [rentalAfterDiscount, installationCost, printCost, installationEnabled, printCostEnabled, includeInstallationInPrice, includePrintInPrice]);
  
  const totalPaid = Number(currentContract?.['Total Paid'] || 0);
  const remaining = adjustedFinalTotal - totalPaid;
  const priceDifference = adjustedFinalTotal - originalTotal;
  
  return (
    <Card className="border-border shadow-xl overflow-hidden">
      {/* Header with gradient */}
      <div className="h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
      <CardHeader className="py-4 px-5 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            ملخص التكاليف
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-muted-foreground"
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        {/* ✅ Estimated Total Badge with Refresh Button */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-muted/80 to-muted/50 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">الإيجار الأساسي</span>
              {savedBaseRent !== null && savedBaseRent > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  محفوظ
                </Badge>
              )}
            </div>
            <span className="font-bold text-lg text-primary font-manrope">{(estimatedTotal || 0).toLocaleString('ar-LY')} {currencySymbol}</span>
          </div>
          
          {/* Show comparison with calculated value if different */}
          {savedBaseRent !== null && savedBaseRent > 0 && calculatedEstimatedTotal && calculatedEstimatedTotal !== savedBaseRent && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>السعر من الجدول الحالي:</span>
                <span className="font-medium">{calculatedEstimatedTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
              </div>
            </div>
          )}
          
          {/* Refresh Prices Button */}
          {onRefreshPricesFromTable && savedBaseRent !== null && savedBaseRent > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshPricesFromTable}
              className="w-full mt-3 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20"
            >
              <RefreshCw className="h-3.5 w-3.5 ml-2" />
              تحديث الأسعار من الجدول الحالي
            </Button>
          )}
        </div>

        {/* Manual Cost Override */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            تعديل يدوي للتكلفة
          </label>
          <Input
            type="number"
            value={rentCost}
            onChange={(e) => {
              setRentCost(Number(e.target.value));
              setUserEditedRentCost(true);
            }}
            placeholder="التكلفة قبل الخصم"
            className="h-12 font-bold text-xl bg-background border-2 border-border focus:border-primary rounded-xl"
          />
        </div>

        {/* Proportional Distribution Section */}
        {onProportionalDistribution && estimatedTotal > 0 && (
          <div className="p-4 rounded-xl bg-violet-500/5 border-2 border-violet-500/20 space-y-3">
            <label className="text-sm font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              توزيع نسبي على اللوحات
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>عند إدخال إجمالي جديد، يتم توزيعه على اللوحات بنفس نسبة أسعارها الحالية</p>
                    <p className="mt-1 text-xs text-muted-foreground">مثال: إذا زاد الإجمالي 20%، تزيد أسعار جميع اللوحات 20%</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={proportionalValue || ''}
                  onChange={(e) => setProportionalValue(Number(e.target.value) || 0)}
                  placeholder={`الإجمالي الحالي: ${estimatedTotal.toLocaleString('ar-LY')}`}
                  className="pr-9 h-11 bg-background"
                />
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (proportionalValue > 0) {
                    onProportionalDistribution(proportionalValue);
                    setProportionalValue(0);
                  }
                }}
                disabled={!proportionalValue || proportionalValue <= 0}
                className="h-11 px-4 bg-violet-600 hover:bg-violet-700"
              >
                <Calculator className="h-4 w-4 ml-2" />
                توزيع
              </Button>
            </div>
            {proportionalValue > 0 && estimatedTotal > 0 && (
              <div className="flex items-center justify-between text-xs bg-violet-500/10 rounded-lg px-3 py-2">
                <span className="text-violet-700 dark:text-violet-300">
                  نسبة التغيير: {((proportionalValue / estimatedTotal - 1) * 100).toFixed(1)}%
                </span>
                <span className="font-medium text-violet-700 dark:text-violet-300">
                  {proportionalValue > estimatedTotal ? (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      زيادة {(proportionalValue - estimatedTotal).toLocaleString('ar-LY')} {currencySymbol}
                    </span>
                  ) : proportionalValue < estimatedTotal ? (
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      نقص {(estimatedTotal - proportionalValue).toLocaleString('ar-LY')} {currencySymbol}
                    </span>
                  ) : (
                    'بدون تغيير'
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Discount Section - القيمة والنسبة معاً */}
        <div className="p-4 rounded-xl bg-red-500/5 border-2 border-red-500/20 space-y-3">
          <label className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <Percent className="h-4 w-4" />
            الخصم
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">القيمة ({currencySymbol})</label>
              <Input
                type="number"
                value={discountType === 'amount' ? discountValue : (baseTotal > 0 ? Math.round((baseTotal * discountValue) / 100) : 0)}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setDiscountType('amount');
                  setDiscountValue(val);
                }}
                placeholder="0"
                className="h-11 bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">النسبة (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={discountType === 'percent' ? discountValue : (baseTotal > 0 ? ((discountValue / baseTotal) * 100).toFixed(1) : 0)}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setDiscountType('percent');
                  setDiscountValue(Math.min(100, val));
                }}
                placeholder="0"
                className="h-11 bg-background"
              />
            </div>
          </div>
          {discountAmount > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">
              خصم {baseTotal > 0 ? ((discountAmount / baseTotal) * 100).toFixed(1) : 0}% = {discountAmount.toLocaleString('ar-LY')} {currencySymbol}
            </p>
          )}
        </div>

        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleContent className="space-y-4">
            {/* Installation Inclusion Toggle */}
            {installationEnabled && installationCost > 0 && setIncludeInstallationInPrice && (
              <div className="p-4 rounded-xl bg-orange-500/5 border-2 border-orange-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-install" className="text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2 cursor-pointer">
                    <Wrench className="h-4 w-4" />
                    تضمين التركيب في السعر
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>عند التفعيل: التركيب مجاني للعميل ويخصم من صافي الإيجار</p>
                          <p>عند الإلغاء: التركيب يضاف للإجمالي ويدفعه العميل</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Switch
                    id="include-install"
                    checked={includeInstallationInPrice}
                    onCheckedChange={setIncludeInstallationInPrice}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">تكلفة التركيب:</span>
                  <span className="font-bold text-orange-600 font-manrope">{installationCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                </div>
                {includeInstallationInPrice ? (
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <Gift className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-600">مجانية للعميل (مخصومة من صافي الإيجار)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-medium text-orange-600">تضاف للإجمالي (يدفعها العميل)</span>
                  </div>
                )}
              </div>
            )}

            {/* Print Cost Inclusion Toggle */}
            {printCostEnabled && printCost > 0 && setIncludePrintInPrice && (
              <div className="p-4 rounded-xl bg-blue-500/5 border-2 border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-print" className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2 cursor-pointer">
                    <Printer className="h-4 w-4" />
                    تضمين الطباعة في السعر
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>عند التفعيل: الطباعة مجانية للعميل وتخصم من صافي الإيجار</p>
                          <p>عند الإلغاء: الطباعة تضاف للإجمالي ويدفعها العميل</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Switch
                    id="include-print"
                    checked={includePrintInPrice}
                    onCheckedChange={setIncludePrintInPrice}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">تكلفة الطباعة:</span>
                  <span className="font-bold text-blue-600 font-manrope">{printCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                </div>
                {includePrintInPrice ? (
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <Gift className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-600">مجانية للعميل (مخصومة من صافي الإيجار)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">تضاف للإجمالي (يدفعها العميل)</span>
                  </div>
                )}
              </div>
            )}

            {/* NEW: Operating Fee Inclusion Toggles */}
            {operatingFeeRate > 0 && (
              <div className="p-4 rounded-xl bg-violet-500/5 border-2 border-violet-500/20 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Percent className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                    تضمين نسبة التشغيل ({operatingFeeRate}%)
                  </span>
                </div>

                {/* Include in Print */}
                {printCostEnabled && printCost > 0 && setIncludeOperatingInPrint && (
                  <div className="space-y-2 bg-background/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-operating-print" className="text-sm text-foreground flex items-center gap-2 cursor-pointer">
                        <Printer className="h-4 w-4 text-blue-500" />
                        تضمين في الطباعة
                      </Label>
                      <Switch
                        id="include-operating-print"
                        checked={includeOperatingInPrint}
                        onCheckedChange={setIncludeOperatingInPrint}
                      />
                    </div>
                    {includeOperatingInPrint && setOperatingFeeRatePrint && (
                      <div className="flex items-center gap-2 pt-1">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">نسبة الطباعة:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={operatingFeeRatePrint}
                          onChange={e => setOperatingFeeRatePrint(Number(e.target.value) || 0)}
                          className="h-7 w-20 text-center text-sm font-manrope"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <span className="text-xs text-blue-600 font-semibold mr-auto font-manrope">
                          = {Math.round(printCost * (operatingFeeRatePrint / 100)).toLocaleString('ar-LY')} {currencySymbol}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Include in Installation */}
                {installationEnabled && installationCost > 0 && setIncludeOperatingInInstallation && (
                  <div className="space-y-2 bg-background/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-operating-install" className="text-sm text-foreground flex items-center gap-2 cursor-pointer">
                        <Wrench className="h-4 w-4 text-orange-500" />
                        تضمين في التركيب
                      </Label>
                      <Switch
                        id="include-operating-install"
                        checked={includeOperatingInInstallation}
                        onCheckedChange={setIncludeOperatingInInstallation}
                      />
                    </div>
                    {includeOperatingInInstallation && setOperatingFeeRateInstallation && (
                      <div className="flex items-center gap-2 pt-1">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">نسبة التركيب:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={operatingFeeRateInstallation}
                          onChange={e => setOperatingFeeRateInstallation(Number(e.target.value) || 0)}
                          className="h-7 w-20 text-center text-sm font-manrope"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <span className="text-xs text-orange-600 font-semibold mr-auto font-manrope">
                          = {Math.round(installationCost * (operatingFeeRateInstallation / 100)).toLocaleString('ar-LY')} {currencySymbol}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Cost Breakdown - Enhanced */}
            <div className="space-y-0 rounded-xl border-2 border-border overflow-hidden">
              <div className="p-3 bg-gradient-to-r from-slate-500/10 to-slate-500/5 border-b border-border">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  تفاصيل الحساب الكاملة
                </h4>
              </div>
              
              {/* Step 1: Base Rental */}
              <div className="p-3 border-b border-border bg-background">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">1</Badge>
                  إيجار اللوحات الأساسي
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">إجمالي الإيجار</span>
                  <span className="font-bold text-lg font-manrope">{(baseTotal || 0).toLocaleString('ar-LY')} {currencySymbol}</span>
                </div>
              </div>
              
              {/* Step 2: Discount */}
              {discountAmount > 0 && (
                <div className="p-3 border-b border-border bg-red-500/5">
                  <div className="flex items-center gap-2 text-xs text-red-500 mb-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/50 text-red-500">2</Badge>
                    الخصم المطبق
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-600 flex items-center gap-1">
                      <Minus className="h-3 w-3" />
                      خصم {baseTotal > 0 ? ((discountAmount / baseTotal) * 100).toFixed(1) : 0}%
                    </span>
                    <span className="font-bold text-lg text-red-600 font-manrope">-{discountAmount.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-red-500/20">
                    <span className="text-xs text-muted-foreground">= بعد الخصم</span>
                    <span className="font-semibold text-sm font-manrope">{rentalAfterDiscount.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                </div>
              )}

              {/* Step 3: Installation */}
              {installationEnabled && installationCost > 0 && (
                <div className={cn(
                  "p-3 border-b border-border",
                  includeInstallationInPrice ? "bg-green-500/5" : "bg-orange-500/5"
                )}>
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0",
                      includeInstallationInPrice ? "border-green-500/50 text-green-600" : "border-orange-500/50 text-orange-600"
                    )}>
                      {discountAmount > 0 ? '3' : '2'}
                    </Badge>
                    <span className={includeInstallationInPrice ? "text-green-600" : "text-orange-600"}>
                      تكلفة التركيب
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm flex items-center gap-1",
                      includeInstallationInPrice ? "text-green-600" : "text-orange-600"
                    )}>
                      <Wrench className="h-3 w-3" />
                      {includeInstallationInPrice ? 'مخصوم (مجاني للعميل)' : 'يضاف للعميل'}
                    </span>
                    <span className={cn(
                      "font-bold text-lg font-manrope",
                      includeInstallationInPrice ? "text-green-600" : "text-orange-600"
                    )}>
                      {includeInstallationInPrice ? '-' : '+'}{installationCost.toLocaleString('ar-LY')} {currencySymbol}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 4: Print */}
              {printCostEnabled && printCost > 0 && (
                <div className={cn(
                  "p-3 border-b border-border",
                  includePrintInPrice ? "bg-green-500/5" : "bg-blue-500/5"
                )}>
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0",
                      includePrintInPrice ? "border-green-500/50 text-green-600" : "border-blue-500/50 text-blue-600"
                    )}>
                      {(discountAmount > 0 ? 1 : 0) + (installationEnabled && installationCost > 0 ? 1 : 0) + 2}
                    </Badge>
                    <span className={includePrintInPrice ? "text-green-600" : "text-blue-600"}>
                      تكلفة الطباعة
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm flex items-center gap-1",
                      includePrintInPrice ? "text-green-600" : "text-blue-600"
                    )}>
                      <Printer className="h-3 w-3" />
                      {includePrintInPrice ? 'مخصومة (مجانية للعميل)' : 'تضاف للعميل'}
                    </span>
                    <span className={cn(
                      "font-bold text-lg font-manrope",
                      includePrintInPrice ? "text-green-600" : "text-blue-600"
                    )}>
                      {includePrintInPrice ? '-' : '+'}{printCost.toLocaleString('ar-LY')} {currencySymbol}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 5: Friend Costs */}
              {totalFriendCosts > 0 && (
                <div className="p-3 border-b border-border bg-amber-500/5">
                  <div className="flex items-center gap-2 text-xs text-amber-600 mb-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">خصم</Badge>
                    تكاليف الشركات الصديقة
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-600 flex items-center gap-1">
                      <Minus className="h-3 w-3" />
                      مخصوم من صافي الإيجار
                    </span>
                    <span className="font-bold text-lg text-amber-600 font-manrope">-{totalFriendCosts.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                </div>
              )}

              {/* Summary Row */}
              <div className="p-3 bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">صافي الإيجار (للشركة)</span>
                    <span className="font-bold text-primary font-manrope">{netRental.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-muted-foreground block mb-1">رسوم التشغيل ({operatingFeeRate}%)</span>
                    <span className="font-bold text-purple-600 font-manrope">{calculatedOperatingFee.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Net Rental - الأهم */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/30">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary">صافي الإيجار</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-right">
                    <p className="font-semibold mb-1">صافي الإيجار =</p>
                    <p>الإيجار بعد الخصم</p>
                    {includeInstallationInPrice && installationCost > 0 && <p>- التركيب (مضمن)</p>}
                    {includePrintInPrice && printCost > 0 && <p>- الطباعة (مضمنة)</p>}
                    {totalFriendCosts > 0 && <p>- تكاليف الشركات الصديقة</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-2xl font-bold text-primary font-manrope">{netRental.toLocaleString('ar-LY')} {currencySymbol}</span>
          </div>
          
          {/* Operating Fee from Net Rental */}
          <div className="flex justify-between items-center text-sm pt-2 border-t border-primary/20 mt-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              رسوم التشغيل ({operatingFeeRate}% من الصافي)
            </span>
            <span className="font-semibold text-purple-600 font-manrope">{calculatedOperatingFee.toLocaleString('ar-LY')} {currencySymbol}</span>
          </div>
        </div>

        {/* Final Total */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/15 via-emerald-500/10 to-teal-500/5 border-2 border-green-500/40 shadow-lg">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-lg text-foreground">الإجمالي للعميل</span>
            <span className="text-3xl font-bold text-green-600 font-manrope">{adjustedFinalTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {includeInstallationInPrice && installationCost > 0 && '(التركيب مجاني) '}
            {includePrintInPrice && printCost > 0 && '(الطباعة مجانية)'}
            {!includeInstallationInPrice && installationCost > 0 && `(شامل التركيب ${installationCost.toLocaleString('ar-LY')}) `}
            {!includePrintInPrice && printCost > 0 && `(شامل الطباعة ${printCost.toLocaleString('ar-LY')})`}
          </p>
          
          {/* Previous Total - الإجمالي السابق - More Prominent */}
          {originalTotal > 0 && (
            <div className="mt-3 pt-3 border-t border-green-500/30">
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-foreground">الإجمالي السابق:</span>
                <span className="font-bold text-lg text-foreground font-manrope">{originalTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
              </div>
            </div>
          )}
        </div>

        {/* Price Difference Warning */}
        {originalTotal > 0 && priceDifference !== 0 && (
          <div className={cn(
            "p-4 rounded-xl border-2 space-y-2",
            priceDifference > 0 
              ? "bg-amber-500/10 border-amber-500/40" 
              : "bg-red-500/10 border-red-500/40"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-full",
                priceDifference > 0 ? "bg-amber-500/20" : "bg-red-500/20"
              )}>
                {priceDifference > 0 ? (
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
              <span className={cn(
                "font-semibold text-sm",
                priceDifference > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
              )}>
                تنبيه: يوجد فرق عن الإجمالي السابق!
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">الفرق:</span>
              <span className={cn(
                "font-bold font-manrope",
                priceDifference > 0 ? "text-amber-600" : "text-red-600"
              )}>
                {priceDifference > 0 ? '+' : ''}{priceDifference.toLocaleString('ar-LY')} {currencySymbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {priceDifference > 0 
                ? 'الإجمالي الحالي أعلى من السابق. تأكد من أن هذا التغيير مطلوب.'
                : 'الإجمالي الحالي أقل من السابق. تأكد من أن هذا التغيير مطلوب.'}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button 
            variant="outline"
            onClick={onCancel}
            className="h-12 text-base"
          >
            <X className="h-4 w-4 mr-2" />
            إلغاء
          </Button>
          <Button 
            onClick={() => {
              // Show confirmation dialog if there's a price difference
              if (originalTotal > 0 && priceDifference !== 0) {
                setShowConfirmDialog(true);
              } else {
                onSave();
              }
            }} 
            disabled={saving}
            className="h-12 text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                جاري الحفظ...
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                حفظ التعديلات
              </>
            )}
          </Button>
        </div>

        {/* Price Difference Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                تأكيد تغيير الإجمالي
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-2">
                <p className="text-foreground font-medium">
                  يوجد فرق في إجمالي العقد عن القيمة السابقة:
                </p>
                
                <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">الإجمالي السابق:</span>
                    <span className="font-bold text-lg font-manrope">{originalTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">الإجمالي الجديد:</span>
                    <span className="font-bold text-lg text-green-600 font-manrope">{adjustedFinalTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">الفرق:</span>
                    <span className={cn(
                      "font-bold text-lg font-manrope",
                      priceDifference > 0 ? "text-amber-600" : "text-red-600"
                    )}>
                      {priceDifference > 0 ? '+' : ''}{priceDifference.toLocaleString('ar-LY')} {currencySymbol}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  هل أنت متأكد من حفظ هذه التعديلات؟
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  setShowConfirmDialog(false);
                  onSave();
                }}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                تأكيد الحفظ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
