import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, PrinterIcon, ShoppingCart, Wrench, Search, CheckCircle, X } from 'lucide-react';
import { ItemCard } from './ItemCard';
import type { DistributableItem } from './types';

interface ItemsTabsSectionProps {
  items: DistributableItem[];
  setItems: (items: DistributableItem[]) => void;
  onSelect: (id: string | number, selected: boolean) => void;
  onAmountChange: (id: string | number, value: string) => void;
  remainingToAllocate: number;
}

// Normalize Arabic/Eastern digits helper
const normalizeDigits = (str: string) => str.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export function ItemsTabsSection({ items, setItems, onSelect, onAmountChange, remainingToAllocate }: ItemsTabsSectionProps) {
  const [contractSearch, setContractSearch] = useState('');
  const [contractAdTypeFilter, setContractAdTypeFilter] = useState('all');

  const contracts = items.filter(i => i.type === 'contract');
  const printedInvoices = items.filter(i => i.type === 'printed_invoice');
  const salesInvoices = items.filter(i => i.type === 'sales_invoice');
  const compositeTasks = items.filter(i => i.type === 'composite_task');

  const uniqueContractAdTypes = useMemo(() => {
    const types = new Set(contracts.map(c => c.adType).filter(Boolean));
    return Array.from(types) as string[];
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (contractAdTypeFilter !== 'all' && c.adType !== contractAdTypeFilter) return false;
      if (!contractSearch.trim()) return true;
      const term = normalizeDigits(contractSearch.trim().toLowerCase());
      const contractId = normalizeDigits(String(c.id));
      const adType = normalizeDigits((c.adType || '').toLowerCase());
      const displayName = normalizeDigits(c.displayName || '');
      return contractId.includes(term) || adType.includes(term) || displayName.includes(term);
    });
  }, [contracts, contractSearch, contractAdTypeFilter]);

  const selectAll = () => setItems(items.map(item => ({ ...item, selected: true })));
  const deselectAll = () => setItems(items.map(item => ({ ...item, selected: false, allocatedAmount: 0 })));

  const renderEmptyState = (icon: React.ReactNode, text: string) => (
    <div className="text-center text-muted-foreground py-8">
      <div className="mx-auto mb-2 opacity-20">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );

  const renderItems = (list: DistributableItem[]) => (
    <div className="space-y-1.5">
      {list.map((item, idx) => (
        <ItemCard key={item.id} item={item} index={idx} onSelect={onSelect} onAmountChange={onAmountChange} remainingToAllocate={remainingToAllocate} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Quick actions bar */}
      <div className="flex gap-1.5 mb-2 shrink-0">
        <Button onClick={selectAll} variant="outline" size="sm" className="gap-1 text-xs h-7 flex-1">
          <CheckCircle className="h-3 w-3" /> تحديد الكل
        </Button>
        <Button onClick={deselectAll} variant="outline" size="sm" className="gap-1 text-xs h-7 flex-1">
          <X className="h-3 w-3" /> إلغاء التحديد
        </Button>
      </div>

      <Tabs defaultValue="contracts" className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-4 bg-muted h-8 shrink-0">
          <TabsTrigger value="contracts" className="gap-1 text-[10px] px-1">
            <FileText className="h-3 w-3" />
            <span className="hidden sm:inline">العقود</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{contracts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="printed" className="gap-1 text-[10px] px-1">
            <PrinterIcon className="h-3 w-3" />
            <span className="hidden sm:inline">الطباعة</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{printedInvoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1 text-[10px] px-1">
            <ShoppingCart className="h-3 w-3" />
            <span className="hidden sm:inline">المبيعات</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{salesInvoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="composite" className="gap-1 text-[10px] px-1">
            <Wrench className="h-3 w-3" />
            <span className="hidden sm:inline">المجمعة</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{compositeTasks.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="flex-1 overflow-y-auto mt-2 space-y-1.5">
          {/* Search */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm pb-1.5 space-y-1.5">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="ابحث برقم العقد..." value={contractSearch} onChange={(e) => setContractSearch(e.target.value)} className="pr-8 h-8 text-xs" />
            </div>
            {uniqueContractAdTypes.length > 1 && (
              <Select value={contractAdTypeFilter} onValueChange={setContractAdTypeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="نوع الإعلان" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {uniqueContractAdTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {filteredContracts.length === 0 
            ? renderEmptyState(<FileText className="h-10 w-10 mx-auto" />, contractSearch ? 'لا توجد نتائج' : 'لا توجد عقود مستحقة')
            : renderItems(filteredContracts)
          }
        </TabsContent>

        <TabsContent value="printed" className="flex-1 overflow-y-auto mt-2">
          {printedInvoices.length === 0 
            ? renderEmptyState(<PrinterIcon className="h-10 w-10 mx-auto" />, 'لا توجد فواتير طباعة مستحقة')
            : renderItems(printedInvoices)
          }
        </TabsContent>

        <TabsContent value="sales" className="flex-1 overflow-y-auto mt-2">
          {salesInvoices.length === 0
            ? renderEmptyState(<ShoppingCart className="h-10 w-10 mx-auto" />, 'لا توجد فواتير مبيعات مستحقة')
            : renderItems(salesInvoices)
          }
        </TabsContent>

        <TabsContent value="composite" className="flex-1 overflow-y-auto mt-2">
          {compositeTasks.length === 0
            ? renderEmptyState(<Wrench className="h-10 w-10 mx-auto" />, 'لا توجد مهام مجمعة مستحقة')
            : renderItems(compositeTasks)
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}
