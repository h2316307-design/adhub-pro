import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Send, Users } from 'lucide-react';
import { Contract } from '@/services/contractService';
import { useSendTextly } from '@/hooks/useSendTextly';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface SendAlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
}

export function SendAlertsDialog({ open, onOpenChange, contracts }: SendAlertsDialogProps) {
  const [selectedContracts, setSelectedContracts] = useState<Set<number>>(new Set());
  const [selectedManagementPhones, setSelectedManagementPhones] = useState<Set<string>>(new Set());
  const [managementPhones, setManagementPhones] = useState<Array<{ id: string; phone_number: string; label: string }>>([]);
  const [sending, setSending] = useState(false);
  const { sendMessage: sendTextlyMessage } = useSendTextly();

  // تحميل أرقام الإدارة
  useEffect(() => {
    if (open) {
      loadManagementPhones();
    }
  }, [open]);

  const loadManagementPhones = async () => {
    const { data } = await supabase
      .from('management_phones')
      .select('*')
      .eq('is_active', true);
    
    if (data) {
      setManagementPhones(data);
      setSelectedManagementPhones(new Set(data.map(p => p.id)));
    }
  };

  const getDayName = (date: Date) => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  };

  // تصفية العقود القريبة من الانتهاء (20 يوم)
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date) return false;
    const today = new Date();
    const endDate = new Date(c.end_date);
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining <= 20 && daysRemaining > 0;
  });

  // تصفية العقود المنتهية (فات عليها أسبوع فقط)
  const expiredContracts = contracts.filter(c => {
    if (!c.end_date) return false;
    const today = new Date();
    const endDate = new Date(c.end_date);
    const daysExpired = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysExpired > 0 && daysExpired <= 7;
  });

  const allAlertContracts = [...expiringContracts, ...expiredContracts];

  // اختيار الكل عند الفتح
  useEffect(() => {
    if (open && allAlertContracts.length > 0) {
      setSelectedContracts(new Set(allAlertContracts.map(c => c.id)));
    }
  }, [open, allAlertContracts.length]);

  const toggleContract = (contractId: number) => {
    setSelectedContracts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contractId)) {
        newSet.delete(contractId);
      } else {
        newSet.add(contractId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedContracts.size === allAlertContracts.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(allAlertContracts.map(c => c.id)));
    }
  };

  const toggleAllManagement = () => {
    if (selectedManagementPhones.size === managementPhones.length) {
      setSelectedManagementPhones(new Set());
    } else {
      setSelectedManagementPhones(new Set(managementPhones.map(p => p.id)));
    }
  };

  const getContractStatus = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date!);
    if (today > endDate) {
      return { label: 'منتهي', variant: 'destructive' as const, icon: AlertCircle };
    }
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: `${daysRemaining} يوم متبقي`, variant: 'default' as const, icon: Clock };
  };

  const handleSend = async () => {
    const contractsToSend = allAlertContracts.filter(c => selectedContracts.has(c.id));
    
    if (contractsToSend.length === 0 && selectedManagementPhones.size === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل أو تفعيل الإرسال للإدارة');
      return;
    }

    setSending(true);
    let successCount = 0;
    const today = new Date();

    try {
      // إرسال للعملاء
      for (const contract of contractsToSend) {
        const phone = (contract as any).Phone || (contract as any).phone;
        const customerName = contract.customer_name || '';
        const contractNumber = (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? '';
        
        if (!phone) continue;

        const endDate = new Date(contract.end_date!);
        const dayName = getDayName(endDate);
        const formattedDate = format(endDate, 'dd/MM/yyyy');
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let message = '';
        if (daysRemaining > 0) {
          message = `مرحباً ${customerName},\n\nنود تذكيرك بأن العقد رقم ${contractNumber} قارب على الانتهاء.\n\nمتبقي ${daysRemaining} يوم على انتهاء العقد.\nتاريخ الانتهاء: ${dayName} ${formattedDate}\n\nنأمل التواصل معنا لتجديد العقد.\n\nشكراً لك.`;
        } else {
          const daysExpired = Math.abs(daysRemaining);
          message = `مرحباً ${customerName},\n\nنود إعلامك بأن العقد رقم ${contractNumber} قد انتهى.\n\nفات ${daysExpired} يوم على انتهاء العقد.\nتاريخ الانتهاء: ${dayName} ${formattedDate}\n\nنأمل التواصل معنا لتجديد العقد.\n\nشكراً لك.`;
        }

        try {
          await sendTextlyMessage({ phone, message });
          successCount++;
        } catch (error) {
          console.error(`Failed to send alert for contract ${contractNumber}:`, error);
        }
      }

      // إرسال للإدارة المحددة
      if (selectedManagementPhones.size > 0) {
        const selectedPhones = managementPhones.filter(p => selectedManagementPhones.has(p.id));
        
        if (selectedPhones.length > 0) {
          // تقسيم العقود في الملخص
          const expiringSummary = expiringContracts
            .filter(c => selectedContracts.has(c.id))
            .map(c => {
              const endDate = new Date(c.end_date!);
              const dayName = getDayName(endDate);
              const formattedDate = format(endDate, 'dd/MM/yyyy');
              const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const contractNumber = (c as any).Contract_Number ?? (c as any)['Contract Number'] ?? '';
              return `- العقد ${contractNumber} (${c.customer_name}): متبقي ${daysRemaining} يوم - ${dayName} ${formattedDate}`;
            })
            .join('\n');

          const expiredSummary = expiredContracts
            .filter(c => selectedContracts.has(c.id))
            .map(c => {
              const endDate = new Date(c.end_date!);
              const dayName = getDayName(endDate);
              const formattedDate = format(endDate, 'dd/MM/yyyy');
              const daysExpired = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
              const contractNumber = (c as any).Contract_Number ?? (c as any)['Contract Number'] ?? '';
              return `- العقد ${contractNumber} (${c.customer_name}): فات ${daysExpired} يوم - ${dayName} ${formattedDate}`;
            })
            .join('\n');

          let managementMessage = 'تنبيه العقود:\n\n';
          if (expiringSummary) {
            managementMessage += '📌 قاربت على الانتهاء:\n' + expiringSummary + '\n\n';
          }
          if (expiredSummary) {
            managementMessage += '⚠️ منتهية:\n' + expiredSummary + '\n\n';
          }
          managementMessage += `إجمالي العقود: ${contractsToSend.length}`;

          for (const mgmt of selectedPhones) {
            try {
              await sendTextlyMessage({ phone: mgmt.phone_number, message: managementMessage });
            } catch (error) {
              console.error(`Failed to send to management ${mgmt.label}:`, error);
            }
          }
        }
      }

      setSending(false);
      toast.success(`تم إرسال ${successCount} تنبيه بنجاح`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending alerts:', error);
      setSending(false);
      toast.error('حدث خطأ أثناء الإرسال');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            إرسال تنبيهات العقود
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ملخص */}
          <div className="bg-muted/50 p-4 rounded-lg grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm">
                <strong>قاربت على الانتهاء:</strong> {expiringContracts.length}
              </p>
              <p className="text-sm text-muted-foreground">متبقي 20 يوم أو أقل</p>
            </div>
            <div>
              <p className="text-sm">
                <strong>منتهية:</strong> {expiredContracts.length}
              </p>
              <p className="text-sm text-muted-foreground">فات عليها أسبوع</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm">
                <strong>المحدد للإرسال:</strong> {selectedContracts.size}
              </p>
            </div>
          </div>

          {/* زر اختيار الكل للعقود */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            className="w-full"
          >
            {selectedContracts.size === allAlertContracts.length ? 'إلغاء تحديد كل العقود' : 'تحديد كل العقود'}
          </Button>

          {/* قائمة العقود */}
          <ScrollArea className="h-[300px] border rounded-lg p-2">
            <div className="space-y-4">
              {allAlertContracts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد عقود تحتاج تنبيه
                </div>
              ) : (
                <>
                  {/* قاربت على الانتهاء */}
                  {expiringContracts.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        قاربت على الانتهاء ({expiringContracts.length})
                      </h4>
                      <div className="space-y-2">
                        {expiringContracts.map(contract => {
                          const status = getContractStatus(contract);
                          const StatusIcon = status.icon;
                          const contractNumber = (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? '';
                          const phone = (contract as any).Phone || (contract as any).phone;
                          const endDate = new Date(contract.end_date!);
                          const dayName = getDayName(endDate);

                          return (
                            <div
                              key={contract.id}
                              className={`flex items-start gap-3 p-3 border rounded-lg ${
                                selectedContracts.has(contract.id) ? 'bg-primary/5 border-primary' : ''
                              }`}
                            >
                              <Checkbox
                                checked={selectedContracts.has(contract.id)}
                                onCheckedChange={() => toggleContract(contract.id)}
                                disabled={!phone}
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">العقد {contractNumber}</span>
                                  <Badge variant={status.variant} className="gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {contract.customer_name}
                                </p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">الانتهاء:</span>{' '}
                                  {dayName} {format(endDate, 'dd/MM/yyyy')}
                                </p>
                                {phone ? (
                                  <p className="text-sm text-green-600">
                                    الهاتف: {phone}
                                  </p>
                                ) : (
                                  <p className="text-sm text-destructive">
                                    لا يوجد رقم هاتف
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* منتهية */}
                  {expiredContracts.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        منتهية ({expiredContracts.length})
                      </h4>
                      <div className="space-y-2">
                        {expiredContracts.map(contract => {
                          const contractNumber = (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? '';
                          const phone = (contract as any).Phone || (contract as any).phone;
                          const endDate = new Date(contract.end_date!);
                          const dayName = getDayName(endDate);
                          const today = new Date();
                          const daysExpired = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

                          return (
                            <div
                              key={contract.id}
                              className={`flex items-start gap-3 p-3 border rounded-lg ${
                                selectedContracts.has(contract.id) ? 'bg-primary/5 border-primary' : ''
                              }`}
                            >
                              <Checkbox
                                checked={selectedContracts.has(contract.id)}
                                onCheckedChange={() => toggleContract(contract.id)}
                                disabled={!phone}
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">العقد {contractNumber}</span>
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    فات {daysExpired} يوم
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {contract.customer_name}
                                </p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">انتهى:</span>{' '}
                                  {dayName} {format(endDate, 'dd/MM/yyyy')}
                                </p>
                                {phone ? (
                                  <p className="text-sm text-green-600">
                                    الهاتف: {phone}
                                  </p>
                                ) : (
                                  <p className="text-sm text-destructive">
                                    لا يوجد رقم هاتف
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* أرقام الإدارة */}
          {managementPhones.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  إرسال للإدارة
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllManagement}
                >
                  {selectedManagementPhones.size === managementPhones.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </Button>
              </div>
              <div className="border rounded-lg p-3 space-y-2 max-h-[150px] overflow-y-auto">
                {managementPhones.map(phone => (
                  <div key={phone.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedManagementPhones.has(phone.id)}
                      onCheckedChange={() => {
                        setSelectedManagementPhones(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(phone.id)) {
                            newSet.delete(phone.id);
                          } else {
                            newSet.add(phone.id);
                          }
                          return newSet;
                        });
                      }}
                    />
                    <label className="text-sm flex-1 cursor-pointer">
                      {phone.label || phone.phone_number}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || (selectedContracts.size === 0 && selectedManagementPhones.size === 0)}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {sending ? 'جاري الإرسال...' : `إرسال (${selectedContracts.size} عقد، ${selectedManagementPhones.size} إدارة)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
