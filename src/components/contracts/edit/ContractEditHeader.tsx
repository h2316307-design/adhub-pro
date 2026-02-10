import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

interface ContractEditHeaderProps {
  contractNumber: string;
  onBack: () => void;
  onPrint: () => void;
  onSave: () => void;
  saving: boolean;
}

export function ContractEditHeader({
  contractNumber,
  onBack,
  onPrint,
  onSave,
  saving
}: ContractEditHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-primary mb-2">
          تعديل عقد {contractNumber && `#${contractNumber}`}
        </h1>
        <p className="text-muted-foreground">
          تعديل عقد إيجار موجود مع نظام دفعات ديناميكي
        </p>
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="border-border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4 ml-2" />
          عودة
        </Button>
        <Button 
          variant="outline" 
          onClick={onPrint}
          className="border-border hover:bg-accent"
        >
          <Printer className="h-4 w-4 ml-2" />
          طباعة العقد
        </Button>
        <Button 
          onClick={onSave} 
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </Button>
      </div>
    </div>
  );
}