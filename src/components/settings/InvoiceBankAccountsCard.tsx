import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, Trash2, Landmark } from 'lucide-react';
import { fetchInvoiceExtras, saveInvoiceExtras, type BankAccount } from '@/utils/invoiceExtras';

const emptyAccount = (): BankAccount => ({ bankName: '', accountNumber: '', lypayNumber: '', iconUrl: '' });

export default function InvoiceBankAccountsCard() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInvoiceExtras()
      .then(extras => setAccounts(extras.bankAccounts))
      .finally(() => setLoading(false));
  }, []);

  const updateAccount = (index: number, patch: Partial<BankAccount>) => {
    setAccounts(prev => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const removeAccount = (index: number) => {
    setAccounts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const invalid = accounts.find(a => !a.bankName.trim() || !a.accountNumber.trim());
    if (invalid) {
      toast({ title: 'بيانات ناقصة', description: 'أدخل اسم المصرف ورقم الحساب لكل سطر', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const cleaned: BankAccount[] = accounts.map(a => ({
        bankName: a.bankName.trim(),
        accountNumber: a.accountNumber.trim(),
        lypayNumber: a.lypayNumber?.trim() || undefined,
        iconUrl: a.iconUrl?.trim() || undefined,
      }));
      await saveInvoiceExtras({ bankAccounts: cleaned });
      toast({ title: 'تم الحفظ', description: 'تم تحديث أرقام الحسابات في الفواتير' });
    } catch {
      toast({ title: 'تعذر الحفظ', description: 'حدث خطأ أثناء حفظ أرقام الحسابات', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          أرقام الحسابات البنكية في الفواتير
        </CardTitle>
        <CardDescription>تُطبع في نهاية الفواتير وفواتير الطباعة والتركيب: رقم الحساب لكل مصرف، ورقم LYPay إن وُجد</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
          </div>
        ) : (
          <>
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد حسابات مضافة</p>
            )}

            {accounts.map((account, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border rounded-md p-3">
                <div className="md:col-span-3 space-y-1">
                  <Label>اسم المصرف</Label>
                  <Input value={account.bankName} onChange={e => updateAccount(index, { bankName: e.target.value })} />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <Label>رقم الحساب</Label>
                  <Input dir="ltr" value={account.accountNumber} onChange={e => updateAccount(index, { accountNumber: e.target.value })} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>رقم LYPay (اختياري)</Label>
                  <Input dir="ltr" value={account.lypayNumber ?? ''} onChange={e => updateAccount(index, { lypayNumber: e.target.value })} />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <Label>رابط أيقونة المصرف (اختياري)</Label>
                  <Input dir="ltr" placeholder="https://..." value={account.iconUrl ?? ''} onChange={e => updateAccount(index, { iconUrl: e.target.value })} />
                </div>
                <div className="md:col-span-1 flex items-center gap-2 justify-between">
                  {account.iconUrl ? (
                    <img src={account.iconUrl} alt="" className="h-8 w-8 object-contain" />
                  ) : <span />}
                  <Button variant="ghost" size="icon" onClick={() => removeAccount(index)} aria-label="حذف الحساب">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setAccounts(prev => [...prev, emptyAccount()])}>
                <Plus className="h-4 w-4 ml-2" /> إضافة حساب
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
