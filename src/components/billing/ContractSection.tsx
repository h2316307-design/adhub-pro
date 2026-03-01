import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ContractRow, PaymentRow } from './BillingTypes';
import { FileText, CreditCard, Calendar, Clock, CheckCircle2, AlertCircle, ImageIcon, ZoomIn, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface ContractSectionProps {
  contracts: ContractRow[];
  payments: PaymentRow[];
  onBulkPayment?: (selectedContracts: number[]) => void;
  onAddPayment?: (contractNumber: number) => void;
  selectedContracts?: Set<number>;
  onSelectedContractsChange?: (selected: Set<number>) => void;
  onDistributePayment?: () => void;
  onScrollToPayment?: (paymentId: string) => void;
}

// تحويل RGB إلى HSL
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// استخراج اللون السائد من الصورة باستخدام proxy
const extractColorFromImage = async (imageUrl: string): Promise<{ rgb: string; hsl: string } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&w=50&h=50`;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          const hsl = rgbToHsl(r, g, b);
          // تعديل السطوع ليكون داكن (25% كحد أقصى) مثل كروت العقود
          const adjustedL = Math.min(hsl.l, 25);
          resolve({
            rgb: `${r}, ${g}, ${b}`,
            hsl: `${hsl.h} ${Math.min(hsl.s, 60)}% ${adjustedL}%`
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    img.src = proxyUrl;
  });
};

export function ContractSection({ 
  contracts, 
  payments, 
  onBulkPayment, 
  onAddPayment,
  selectedContracts: externalSelectedContracts,
  onSelectedContractsChange,
  onDistributePayment,
  onScrollToPayment
}: ContractSectionProps) {
  const [internalSelectedContracts, setInternalSelectedContracts] = useState<Set<number>>(new Set());
  const [contractDesigns, setContractDesigns] = useState<Record<number, string>>({});
  const [contractColors, setContractColors] = useState<Record<number, { rgb: string; hsl: string }>>({});
  
  const selectedContracts = externalSelectedContracts ?? internalSelectedContracts;
  const setSelectedContracts = onSelectedContractsChange ?? setInternalSelectedContracts;

  // جلب تصاميم العقود
  useEffect(() => {
    const fetchDesigns = async () => {
      const designs: Record<number, string> = {};
      
      for (const contract of contracts) {
        const contractNumber = Number(contract.Contract_Number);
        if (!Number.isFinite(contractNumber)) continue;
        
        let foundImage: string | null = null;
        
        // البحث في مهام التركيب
        const { data: tasks } = await supabase
          .from('installation_tasks')
          .select('id')
          .eq('contract_id', contractNumber);
        
        if (tasks && tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const { data: items } = await supabase
            .from('installation_task_items')
            .select('design_face_a, design_face_b')
            .in('task_id', taskIds)
            .or('design_face_a.not.is.null,design_face_b.not.is.null')
            .limit(1);
          
          if (items && items.length > 0) {
            foundImage = items[0].design_face_a || items[0].design_face_b;
          }
        }
        
        // البحث في design_data إذا لم نجد
        if (!foundImage) {
          const { data: contractData } = await supabase
            .from('Contract')
            .select('design_data')
            .eq('Contract_Number', contractNumber)
            .single();
          
          if (contractData?.design_data) {
            try {
              const designData = typeof contractData.design_data === 'string'
                ? JSON.parse(contractData.design_data)
                : contractData.design_data;
              
              if (Array.isArray(designData)) {
                for (const d of designData) {
                  const img = d?.designFaceA || d?.designFaceB || d?.faceA || d?.faceB || d?.design_face_a || d?.design_face_b;
                  if (typeof img === 'string' && img.trim()) {
                    foundImage = img;
                    break;
                  }
                }
              }
            } catch {}
          }
        }
        
        if (foundImage) {
          designs[contractNumber] = foundImage;
        }
      }
      
      setContractDesigns(designs);
    };
    
    if (contracts.length > 0) {
      fetchDesigns();
    }
  }, [contracts]);

  const toggleContract = (contractNumber: number) => {
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(contractNumber)) {
      newSelected.delete(contractNumber);
    } else {
      newSelected.add(contractNumber);
    }
    setSelectedContracts(newSelected);
  };

  const toggleAll = () => {
    if (selectedContracts.size === contracts.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(contracts.map(c => Number(c.Contract_Number))));
    }
  };

  const handleBulkPayment = () => {
    if (onBulkPayment && selectedContracts.size > 0) {
      onBulkPayment(Array.from(selectedContracts));
    }
  };

  // حساب الإحصائيات
  const totalContractValue = contracts.reduce((sum, c) => sum + (Number((c as any)['Total'] ?? c['Total Rent'] ?? 0) || 0), 0);
  const totalPaidValue = contracts.reduce((sum, contract) => {
    const contractPayments = payments
      .filter(p => {
        const paymentContractNum = String(p.contract_number || '');
        const contractNum = String(contract.Contract_Number || '');
        const isMatch = paymentContractNum === contractNum;
        const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
        return isMatch && isValidPaymentType;
      })
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return sum + contractPayments;
  }, 0);
  const totalRemaining = totalContractValue - totalPaidValue;
  const hasSurplus = totalRemaining < 0;
  const activeContracts = contracts.filter(c => {
    const endDate = c['End Date'] ? new Date(c['End Date']) : null;
    return endDate && new Date() <= endDate;
  }).length;

  return (
    <div className="container mx-auto px-6 mb-6">
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">العقود</CardTitle>
                <p className="text-white/70 text-sm mt-0.5">{contracts.length} عقد • {activeContracts} نشط</p>
              </div>
            </div>
            
            {/* إحصائيات سريعة */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-white/60 text-xs">الإجمالي</p>
                <p className="text-lg font-bold text-white">{totalContractValue.toLocaleString('ar-LY')}</p>
              </div>
              <div className="text-center">
                <p className="text-white/60 text-xs">المدفوع</p>
                <p className="text-lg font-bold text-emerald-400">{totalPaidValue.toLocaleString('ar-LY')}</p>
              </div>
              <div className="text-center">
                <p className="text-white/60 text-xs">{hasSurplus ? 'فائض' : 'المتبقي'}</p>
                <p className={`text-lg font-bold ${hasSurplus ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hasSurplus ? Math.abs(totalRemaining).toLocaleString('ar-LY') : totalRemaining.toLocaleString('ar-LY')}
                </p>
              </div>
            </div>
            {selectedContracts.size > 0 && (
              <div className="flex gap-2">
                {onDistributePayment && (
                  <Button 
                    onClick={onDistributePayment}
                    className="bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                    size="sm"
                  >
                    <CreditCard className="h-4 w-4 ml-2" />
                    دفعة موزعة ({selectedContracts.size} عقد)
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {contracts.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-right font-bold w-12">
                      <Checkbox 
                        checked={selectedContracts.size === contracts.length && contracts.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-right font-bold w-44">التصميم</TableHead>
                    <TableHead className="text-right font-bold">رقم العقد</TableHead>
                    <TableHead className="text-right font-bold">نوع الإعلان</TableHead>
                    <TableHead className="text-right font-bold text-center">اللوحات</TableHead>
                    <TableHead className="text-right font-bold">الفترة</TableHead>
                    <TableHead className="text-right font-bold">الحالة</TableHead>
                    <TableHead className="text-right font-bold">القيمة</TableHead>
                    <TableHead className="text-right font-bold">المدفوع</TableHead>
                    <TableHead className="text-right font-bold">الدفعات</TableHead>
                    <TableHead className="text-right font-bold">المتبقي</TableHead>
                    <TableHead className="text-right font-bold">نسبة السداد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(contract => {
                    // جلب الدفعات المرتبطة بهذا العقد
                    const contractPaymentsList = payments.filter(p => {
                      const paymentContractNum = String(p.contract_number || '');
                      const contractNum = String(contract.Contract_Number || '');
                      const isMatch = paymentContractNum === contractNum;
                      const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
                      return isMatch && isValidPaymentType;
                    });
                    
                    const contractPaymentsTotal = contractPaymentsList.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    
                    const contractTotal = Number((contract as any)['Total'] ?? contract['Total Rent'] ?? 0) || 0;
                    const contractRemaining = contractTotal - contractPaymentsTotal;
                    const hasSurplusContract = contractRemaining < 0;
                    const isPaid = contractRemaining <= 0 && contractTotal > 0;
                    const paymentPercentage = contractTotal > 0 ? Math.round((contractPaymentsTotal / contractTotal) * 100) : 0;
                    
                    const today = new Date();
                    const endDate = contract['End Date'] ? new Date(contract['End Date']) : null;
                    const startDate = contract['Contract Date'] ? new Date(contract['Contract Date']) : null;
                    const isActive = endDate && today <= endDate;
                    
                    const contractNumber = Number(contract.Contract_Number);
                    const designImage = contractDesigns[contractNumber];
                    const colorData = contractColors[contractNumber];
                    const hasColor = !!colorData;
                    
                    // ستايل الصف مثل كروت العقود - خلفية داكنة قوية
                    const rowStyle = hasColor ? {
                      backgroundColor: `hsl(${colorData.hsl})`,
                    } : {};
                    
                    return (
                      <TableRow 
                        key={String(contract.Contract_Number)} 
                        className={`group transition-all duration-300 ${
                          hasColor ? 'text-white' : ''
                        } ${
                          selectedContracts.has(contractNumber) && !hasColor
                            ? 'bg-primary/5' 
                            : !hasColor ? 'hover:bg-accent/50' : 'hover:opacity-90'
                        }`}
                        style={rowStyle}
                      >
                        <TableCell className="py-4">
                          <Checkbox 
                            checked={selectedContracts.has(contractNumber)}
                            onCheckedChange={() => toggleContract(contractNumber)}
                          />
                        </TableCell>
                        <TableCell className="py-3 pr-3">
                          {designImage ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <div 
                                  className="relative cursor-pointer group/img"
                                  style={hasColor ? { 
                                    boxShadow: `0 4px 20px rgba(${colorData.rgb}, 0.5)`,
                                  } : {}}
                                >
                                  <img 
                                    src={designImage} 
                                    alt="التصميم" 
                                    className="w-40 h-28 object-cover rounded-xl border-2 shadow-xl transition-all duration-300 group-hover/img:scale-105 group-hover/img:shadow-2xl"
                                    style={hasColor ? { borderColor: `rgba(${colorData.rgb}, 0.8)` } : { borderColor: 'hsl(var(--border))' }}
                                    onLoad={() => {
                                      if (!contractColors[contractNumber] && designImage) {
                                        extractColorFromImage(designImage).then(color => {
                                          if (color) {
                                            setContractColors(prev => ({ ...prev, [contractNumber]: color }));
                                          }
                                        });
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 rounded-xl transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                    <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                                  </div>
                                </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl p-2">
                                <img 
                                  src={designImage} 
                                  alt="التصميم" 
                                  className="w-full h-auto rounded-lg"
                                />
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <div className="w-40 h-28 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`font-bold py-4 ${hasColor ? 'text-white' : 'text-primary'}`}>
                          #{String(contract.Contract_Number || '')}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant="outline" className={`font-medium ${hasColor ? 'bg-white/20 text-white border-white/30' : ''}`}>
                            {contract['Ad Type'] || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${hasColor ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                            {contract.billboards_count || 0}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-0.5 text-sm">
                            <div className={`flex items-center gap-1.5 ${hasColor ? 'text-white/80' : 'text-muted-foreground'}`}>
                              <Calendar className="h-3 w-3" />
                              <span>{startDate ? startDate.toLocaleDateString('ar-LY') : '—'}</span>
                            </div>
                            <div className={`flex items-center gap-1.5 ${hasColor ? 'text-white/80' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" />
                              <span>{endDate ? endDate.toLocaleDateString('ar-LY') : '—'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge className={`text-xs ${
                            hasColor 
                              ? isActive 
                                ? 'bg-white/20 text-white border-white/30' 
                                : 'bg-white/10 text-white/70 border-white/20'
                              : isActive 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          }`} variant="outline">
                            {isActive ? (
                              <><CheckCircle2 className="h-3 w-3 ml-1" />ساري</>
                            ) : (
                              <><AlertCircle className="h-3 w-3 ml-1" />منتهي</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`font-bold ${hasColor ? 'text-white' : 'text-foreground'}`}>{contractTotal.toLocaleString('ar-LY')}</span>
                          <span className={`text-xs mr-1 ${hasColor ? 'text-white/70' : 'text-muted-foreground'}`}>د.ل</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`font-semibold ${hasColor ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}>{contractPaymentsTotal.toLocaleString('ar-LY')}</span>
                          <span className={`text-xs mr-1 ${hasColor ? 'text-white/70' : 'text-muted-foreground'}`}>د.ل</span>
                        </TableCell>
                        <TableCell className="py-4">
                          {contractPaymentsList.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {contractPaymentsList.map((payment, idx) => {
                                // حساب رقم الإيصال بناءً على ترتيبه في قائمة الدفعات الكاملة
                                const paymentIndex = payments.findIndex(p => p.id === payment.id);
                                const receiptNumber = paymentIndex + 1;
                                const isDistributed = !!payment.distributed_payment_id;
                                
                                return (
                                  <button
                                    key={payment.id}
                                    onClick={() => onScrollToPayment?.(payment.id)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:scale-105 cursor-pointer ${
                                      hasColor
                                        ? 'bg-white/20 text-white hover:bg-white/30'
                                        : isDistributed
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                    }`}
                                    title={`${isDistributed ? 'دفعة موزعة' : 'إيصال'} رقم ${receiptNumber} - ${Number(payment.amount).toLocaleString('ar-LY')} د.ل`}
                                  >
                                    <Receipt className="h-3 w-3" />
                                    <span>#{receiptNumber}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className={`text-xs ${hasColor ? 'text-white/50' : 'text-muted-foreground'}`}>-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className={`font-bold ${
                              hasColor 
                                ? hasSurplusContract ? 'text-emerald-300' : contractRemaining > 0 ? 'text-rose-300' : 'text-emerald-300'
                                : hasSurplusContract ? 'text-emerald-600 dark:text-emerald-400' : contractRemaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {hasSurplusContract ? Math.abs(contractRemaining).toLocaleString('ar-LY') : contractRemaining.toLocaleString('ar-LY')}
                              <span className={`text-xs mr-1 ${hasColor ? 'text-white/70' : 'text-muted-foreground'}`}>د.ل</span>
                            </span>
                            {hasSurplusContract && (
                              <span className={`text-xs ${hasColor ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                فائض
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 min-w-[120px]">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${
                                hasColor 
                                  ? isPaid ? 'text-emerald-300' : paymentPercentage >= 50 ? 'text-amber-300' : 'text-rose-300'
                                  : isPaid ? 'text-emerald-600' : paymentPercentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {paymentPercentage}%
                              </span>
                              {isPaid && <CheckCircle2 className={`h-4 w-4 ${hasColor ? 'text-emerald-300' : 'text-emerald-500'}`} />}
                            </div>
                            <div className={`h-2 w-full rounded-full overflow-hidden ${hasColor ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  hasColor 
                                    ? 'bg-white/80'
                                    : isPaid ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                                      paymentPercentage >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                                      'bg-gradient-to-r from-rose-500 to-rose-400'
                                }`}
                                style={{ width: `${Math.min(100, paymentPercentage)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">لا توجد عقود</p>
              <p className="text-sm">لم يتم العثور على عقود لهذا العميل</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
