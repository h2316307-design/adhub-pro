import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, DollarSign, CreditCard, ArrowRight, Users, TrendingUp, Wallet, PiggyBank } from 'lucide-react';
import ContractBillboardsGroup from '@/components/teams/ContractBillboardsGroup';
import TeamPaymentReceiptDialog from '@/components/teams/TeamPaymentReceiptDialog';

interface TeamAccount {
  id: string;
  team_id: string;
  task_item_id: string;
  billboard_id: number;
  contract_id: number;
  installation_date: string;
  amount: number;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface TeamSummary {
  team_id: string;
  team_name: string;
  total_installations: number;
  pending_count: number;
  paid_count: number;
  pending_amount: number;
  paid_amount: number;
  total_amount: number;
}

interface BillboardDetails {
  billboard_name: string;
  customer_name: string;
  size: string;
  image_url?: string;
  installation_image_url?: string;
}

// Helper function to create a unique key for billboard + contract combination
const getBillboardContractKey = (billboardId: number, contractId: number): string => {
  return `${billboardId}_${contractId}`;
};

interface SizePricing {
  name: string;
  installation_price: number;
}

export default function InstallationTeamAccounts() {
  const [summaries, setSummaries] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TeamAccount[]>([]);
  const [billboardDetails, setBillboardDetails] = useState<Record<string, BillboardDetails>>({});
  const [sizePricing, setSizePricing] = useState<SizePricing[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Receipt dialog
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Overall stats
  const overallStats = useMemo(() => {
    return summaries.reduce((acc, s) => ({
      totalTeams: acc.totalTeams + 1,
      totalInstallations: acc.totalInstallations + s.total_installations,
      totalPending: acc.totalPending + s.pending_amount,
      totalPaid: acc.totalPaid + s.paid_amount,
    }), { totalTeams: 0, totalInstallations: 0, totalPending: 0, totalPaid: 0 });
  }, [summaries]);

  const loadSizePricing = async () => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, installation_price')
        .not('installation_price', 'is', null);

      if (error) throw error;
      setSizePricing(data || []);
    } catch (error: any) {
      console.error('Error loading size pricing:', error);
    }
  };

  const loadSummaries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_accounts_summary')
        .select('*')
        .order('team_name');

      if (error) throw error;
      setSummaries(data || []);
    } catch (error: any) {
      console.error('Error loading team summaries:', error);
      toast.error('فشل في تحميل ملخص حسابات الفرق');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamAccounts = async (teamId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('installation_team_accounts')
        .select('*')
        .eq('team_id', teamId)
        .order('contract_id', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);

      // Load billboard details with size and image
      if (data && data.length > 0) {
        const billboardIds = [...new Set(data.map(a => a.billboard_id))];
        const contractIds = [...new Set(data.map(a => a.contract_id))];
        const taskItemIds = [...new Set(data.map(a => a.task_item_id).filter(Boolean))];

        const emptyRes = { data: [], error: null } as any;

        const [
          billboardsRes,
          contractsRes,
          taskItemsRes,
          historyRes,
        ] = await Promise.all([
          billboardIds.length
            ? supabase.from('billboards').select('ID, Billboard_Name, Size, Image_URL').in('ID', billboardIds)
            : Promise.resolve(emptyRes),
          contractIds.length
            ? supabase.from('Contract').select('Contract_Number, "Customer Name"').in('Contract_Number', contractIds)
            : Promise.resolve(emptyRes),
          taskItemIds.length
            ? supabase
                .from('installation_task_items')
                .select('id, installed_image_face_a_url, installed_image_face_b_url, installed_image_url')
                .in('id', taskItemIds)
            : Promise.resolve(emptyRes),
          billboardIds.length && contractIds.length
            ? supabase
                .from('billboard_history')
                .select('billboard_id, contract_number, installed_image_face_a_url, installed_image_face_b_url')
                .in('billboard_id', billboardIds)
                .in('contract_number', contractIds)
            : Promise.resolve(emptyRes),
        ]);

        const { data: billboards, error: billboardError } = billboardsRes;
        const { data: contracts } = contractsRes;
        const { data: taskItems } = taskItemsRes;
        const { data: historyData } = historyRes;

        if (billboardError) throw billboardError;

        const pickImageUrl = (...urls: Array<string | null | undefined>): string | undefined =>
          urls.find((u) => typeof u === 'string' && u.trim().length > 0) as string | undefined;

        const taskItemById = new Map((taskItems || []).map((ti: any) => [ti.id, ti]));

        if (billboards) {
          const detailsMap: Record<string, BillboardDetails> = {};

          data.forEach(account => {
            const billboard = billboards.find(b => b.ID === account.billboard_id);
            const contract = contracts?.find(c => c.Contract_Number === account.contract_id);
            const taskItem = taskItemById.get(account.task_item_id) as any;
            const history = historyData?.find((h: any) =>
              h.billboard_id === account.billboard_id &&
              h.contract_number === account.contract_id
            );

            if (billboard) {
              const key = getBillboardContractKey(account.billboard_id, account.contract_id);
              detailsMap[key] = {
                billboard_name: billboard.Billboard_Name || `لوحة ${account.billboard_id}`,
                customer_name: contract?.['Customer Name'] || '',
                size: billboard.Size || '',
                image_url: billboard.Image_URL || undefined,
                // Prefer installation task item images (face A/front), then fallback to any available source
                installation_image_url: pickImageUrl(
                  taskItem?.installed_image_face_a_url,
                  taskItem?.installed_image_url,
                  taskItem?.installed_image_face_b_url,
                  history?.installed_image_face_a_url,
                  history?.installed_image_face_b_url
                )
              };
            }
          });

          setBillboardDetails(detailsMap);
        }
      }
    } catch (error: any) {
      console.error('Error loading team accounts:', error);
      toast.error('فشل في تحميل حسابات الفريق');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummaries();
    loadSizePricing();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamAccounts(selectedTeamId);
      setSelectedIds(new Set());
    }
  }, [selectedTeamId]);

  // Get the correct installation price from sizes table
  const getInstallationPrice = (size: string): number => {
    const sizeInfo = sizePricing.find(s => s.name === size);
    return sizeInfo?.installation_price || 0;
  };

  const getEffectiveAccountAmount = (a: TeamAccount): number => {
    const stored = Number(a.amount || 0);
    if (stored > 0) return stored;

    const key = getBillboardContractKey(a.billboard_id, a.contract_id);
    const details = billboardDetails[key];
    const base = details?.size ? getInstallationPrice(details.size) : 0;
    return Number(base || 0);
  };

  // Group accounts by contract
  const groupedAccounts = accounts.reduce((groups, account) => {
    const contractId = account.contract_id;
    if (!groups[contractId]) {
      groups[contractId] = [];
    }
    groups[contractId].push(account);
    return groups;
  }, {} as Record<number, TeamAccount[]>);

  // Calculate selected amounts
  const selectedAccounts = accounts.filter(a => selectedIds.has(a.id));
  const selectedAmount = selectedAccounts.reduce((sum, a) => sum + getEffectiveAccountAmount(a), 0);

  // Handle bulk payment
  const handleBulkPayment = async () => {
    if (selectedIds.size === 0) {
      toast.error('الرجاء تحديد لوحات للسداد');
      return;
    }
    setPaymentDialogOpen(true);
  };

  const processPayment = async () => {
    try {
      setProcessingPayment(true);

      const billboardsForReceipt = selectedAccounts.map(a => {
        const key = getBillboardContractKey(a.billboard_id, a.contract_id);
        const details = billboardDetails[key];
        return {
          billboard_name: details?.billboard_name || `لوحة ${a.billboard_id}`,
          size: details?.size || '-',
          amount: getEffectiveAccountAmount(a),
          contract_id: a.contract_id
        };
      });

      const totalAmount = billboardsForReceipt.reduce((sum, b) => sum + b.amount, 0);

      for (const account of selectedAccounts) {
        const { error } = await supabase
          .from('installation_team_accounts')
          .update({
            status: 'paid',
            amount: getEffectiveAccountAmount(account),
            notes: paymentNotes || null
          })
          .eq('id', account.id);

        if (error) throw error;
      }

      toast.success(`تم سداد ${selectedIds.size} لوحة بمبلغ ${totalAmount.toLocaleString('ar-LY')} د.ل`);

      setReceiptData({
        amount: totalAmount,
        paid_at: new Date().toISOString(),
        method: paymentMethod === 'cash' ? 'نقدي' : paymentMethod === 'bank' ? 'تحويل بنكي' : paymentMethod,
        notes: paymentNotes,
        billboards: billboardsForReceipt
      });

      setPaymentDialogOpen(false);
      setReceiptDialogOpen(true);

      if (selectedTeamId) {
        await loadTeamAccounts(selectedTeamId);
      }
      await loadSummaries();
      setSelectedIds(new Set());
      setPaymentNotes('');
      setPaymentMethod('cash');

    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error('فشل في معالجة السداد');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle updating individual account amount
  const handleUpdateAmount = async (id: string, newAmount: number, reason: string) => {
    try {
      const existingAccount = accounts.find(a => a.id === id);
      const newNotes = reason 
        ? `${existingAccount?.notes ? existingAccount.notes + ' | ' : ''}تعديل السعر: ${reason}`
        : existingAccount?.notes;

      const { error } = await supabase
        .from('installation_team_accounts')
        .update({ 
          amount: newAmount,
          notes: newNotes
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('تم تحديث السعر بنجاح');
      
      // Reload accounts
      if (selectedTeamId) {
        await loadTeamAccounts(selectedTeamId);
      }
      await loadSummaries();
    } catch (error: any) {
      console.error('Error updating amount:', error);
      toast.error('فشل في تحديث السعر');
    }
  };

  const selectedTeam = summaries.find(s => s.team_id === selectedTeamId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">حسابات فرق التركيب</h2>
          <p className="text-muted-foreground text-sm mt-1">إدارة ومتابعة مستحقات فرق التركيب</p>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد الفرق</p>
                <p className="text-2xl font-bold">{overallStats.totalTeams}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-500/20">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي التركيبات</p>
                <p className="text-2xl font-bold">{overallStats.totalInstallations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-orange-500/20">
                <Wallet className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المعلق</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {overallStats.totalPending.toLocaleString('ar-LY')} <span className="text-sm">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/20">
                <PiggyBank className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المدفوع</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {overallStats.totalPaid.toLocaleString('ar-LY')} <span className="text-sm">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Summaries Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map((summary) => (
          <Card 
            key={summary.team_id}
            className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
              selectedTeamId === summary.team_id 
                ? 'ring-2 ring-primary shadow-lg bg-primary/5' 
                : 'hover:bg-muted/30'
            }`}
            onClick={() => setSelectedTeamId(summary.team_id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{summary.team_name}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {summary.total_installations} تركيب
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">معلق</span>
                </div>
                <div className="text-left">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400">
                    {summary.pending_count}
                  </Badge>
                  <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 mr-2">
                    {summary.pending_amount.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">مدفوع</span>
                </div>
                <div className="text-left">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                    {summary.paid_count}
                  </Badge>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400 mr-2">
                    {summary.paid_amount.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              </div>
              
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">الإجمالي</span>
                  <span className="font-bold text-primary text-lg">
                    {summary.total_amount.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Details with Collapsible Contract Groups */}
      {selectedTeamId && (
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedTeamId(null)}
                className="hover:bg-muted"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>تفاصيل حساب فريق: {selectedTeam?.team_name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Object.keys(groupedAccounts).length} عقود - {accounts.length} لوحات
                  </p>
                </div>
              </div>
            </div>
            
            {/* Payment Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-4 bg-primary/5 px-4 py-2 rounded-lg">
                <div className="text-sm">
                  <span className="text-muted-foreground">المحدد: </span>
                  <span className="font-bold">{selectedIds.size} لوحة</span>
                  <span className="text-muted-foreground mx-2">|</span>
                  <span className="text-muted-foreground">المبلغ: </span>
                  <span className="font-bold text-primary">
                    {selectedAmount.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
                <Button onClick={handleBulkPayment} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  تسديد المحدد
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-4">جاري التحميل...</p>
              </div>
            ) : Object.keys(groupedAccounts).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد حسابات لهذا الفريق</p>
              </div>
            ) : (
              Object.entries(groupedAccounts).map(([contractId, contractAccounts]) => {
                const firstAccount = contractAccounts[0];
                const firstKey = firstAccount ? getBillboardContractKey(firstAccount.billboard_id, firstAccount.contract_id) : '';
                const customerName = billboardDetails[firstKey]?.customer_name || '';
                return (
                  <ContractBillboardsGroup
                    key={contractId}
                    contractId={Number(contractId)}
                    customerName={customerName}
                    accounts={contractAccounts}
                    billboardDetails={billboardDetails}
                    sizePricing={sizePricing}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onUpdateAmount={handleUpdateAmount}
                    getBillboardContractKey={getBillboardContractKey}
                  />
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              تسديد مستحقات الفريق
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span>عدد اللوحات</span>
                <span className="font-bold">{selectedIds.size}</span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span>المبلغ الإجمالي</span>
                <span className="font-bold text-primary">
                  {selectedAmount.toLocaleString('ar-LY')} د.ل
                </span>
              </div>
            </div>

            <div>
              <Label>طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="bank">تحويل بنكي</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={3}
                placeholder="إضافة ملاحظات..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={processPayment} disabled={processingPayment}>
                {processingPayment ? 'جاري المعالجة...' : 'تأكيد السداد'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <TeamPaymentReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        payment={receiptData}
        teamName={selectedTeam?.team_name || ''}
      />
    </div>
  );
}
