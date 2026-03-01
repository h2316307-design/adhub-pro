import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, User, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import TeamBillboardCard from './TeamBillboardCard';

interface Account {
  id: string;
  billboard_id: number;
  contract_id: number;
  installation_date: string;
  amount: number;
  status: string;
  notes?: string;
}

interface BillboardDetails {
  billboard_name: string;
  customer_name: string;
  size: string;
  image_url?: string;
  installation_image_url?: string;
  design_face_a?: string;
  design_face_b?: string;
}

interface SizePricing {
  name: string;
  installation_price: number;
}

interface ContractBillboardsGroupProps {
  contractId: number;
  customerName: string;
  accounts: Account[];
  billboardDetails: Record<string, BillboardDetails>;
  sizePricing: SizePricing[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onUpdateAmount?: (id: string, newAmount: number, reason: string) => void;
  onPrintContractStatement?: (contractId: number) => void;
  getBillboardContractKey: (billboardId: number, contractId: number) => string;
}

export default function ContractBillboardsGroup({
  contractId,
  customerName,
  accounts,
  billboardDetails,
  sizePricing,
  selectedIds,
  onSelectionChange,
  onUpdateAmount,
  onPrintContractStatement,
  getBillboardContractKey
}: ContractBillboardsGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  
  // Get installation price from sizes table
  const getInstallationPrice = (size: string): number | undefined => {
    const sizeInfo = sizePricing.find(s => s.name === size);
    return sizeInfo?.installation_price;
  };

  const pendingAccounts = accounts.filter(a => a.status === 'pending');
  const paidAccounts = accounts.filter(a => a.status === 'paid');
  
  // Calculate amounts using base prices from sizes table ALWAYS
  const totalAmount = accounts.reduce((sum, a) => {
    const key = getBillboardContractKey(a.billboard_id, a.contract_id);
    const details = billboardDetails[key];
    const baseFromTable = details?.size ? getInstallationPrice(details.size) : 0;
    return sum + Number(baseFromTable || 0);
  }, 0);
  
  const pendingAmount = pendingAccounts.reduce((sum, a) => {
    const key = getBillboardContractKey(a.billboard_id, a.contract_id);
    const details = billboardDetails[key];
    const baseFromTable = details?.size ? getInstallationPrice(details.size) : 0;
    return sum + Number(baseFromTable || 0);
  }, 0);
  
  const paidAmount = paidAccounts.reduce((sum, a) => {
    const key = getBillboardContractKey(a.billboard_id, a.contract_id);
    const details = billboardDetails[key];
    const baseFromTable = details?.size ? getInstallationPrice(details.size) : 0;
    return sum + Number(baseFromTable || 0);
  }, 0);

  const allPendingSelected = pendingAccounts.length > 0 && 
    pendingAccounts.every(a => selectedIds.has(a.id));

  const handleSelectAll = (checked: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    pendingAccounts.forEach(a => {
      if (checked) {
        newSelectedIds.add(a.id);
      } else {
        newSelectedIds.delete(a.id);
      }
    });
    onSelectionChange(newSelectedIds);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    if (checked) {
      newSelectedIds.add(id);
    } else {
      newSelectedIds.delete(id);
    }
    onSelectionChange(newSelectedIds);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <CollapsibleTrigger asChild>
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 py-3 px-4 cursor-pointer hover:bg-primary/10 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {pendingAccounts.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={allPendingSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">عقد رقم {contractId}</CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{customerName || 'غير محدد'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {onPrintContractStatement && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onPrintContractStatement(contractId)}>
                      <Printer className="h-3 w-3" />
                      كشف
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="bg-background font-semibold">
                    {accounts.length} لوحات
                  </Badge>
                  <div className="flex flex-col items-end text-xs">
                    {paidAmount > 0 && (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        مدفوع: {paidAmount.toLocaleString('ar-LY')} د.ل
                      </span>
                    )}
                    {pendingAmount > 0 && (
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        معلق: {pendingAmount.toLocaleString('ar-LY')} د.ل
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-1 rounded-full hover:bg-muted transition-colors">
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-4 bg-muted/20">
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {accounts.map(account => {
                const key = getBillboardContractKey(account.billboard_id, account.contract_id);
                const details = billboardDetails[key];
                const baseFromTable = details?.size ? getInstallationPrice(details.size) : undefined;
                
                return (
                  <TeamBillboardCard
                    key={account.id}
                    account={account}
                    billboardDetails={details}
                    sizePriceFromTable={baseFromTable}
                    isSelected={selectedIds.has(account.id)}
                    onSelectChange={(checked) => handleSelectOne(account.id, checked)}
                    onUpdateAmount={onUpdateAmount}
                    disabled={account.status !== 'pending'}
                  />
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
