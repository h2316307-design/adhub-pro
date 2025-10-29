import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BillboardActionsProps {
  exportToExcel: () => void;
  exportAvailableToExcel: () => void;
  exportFollowUpToExcel: () => void;
  exportRePhotographyToExcel: () => void;
  setPrintFiltersOpen: (open: boolean) => void;
  availableBillboardsCount: number;
  initializeAddForm: () => void;
  setAddOpen: (open: boolean) => void;
}

export const BillboardActions: React.FC<BillboardActionsProps> = ({
  exportToExcel,
  exportAvailableToExcel,
  exportFollowUpToExcel,
  exportRePhotographyToExcel,
  setPrintFiltersOpen,
  availableBillboardsCount,
  initializeAddForm,
  setAddOpen
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex gap-2">
      <Button 
        onClick={exportToExcel}
        variant="outline"
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        تصدير Excel
      </Button>
      <Button 
        onClick={exportAvailableToExcel}
        variant="outline"
        className="gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
      >
        <Download className="h-4 w-4" />
        تصدير المتاح Excel
      </Button>
      <Button 
        onClick={exportFollowUpToExcel}
        variant="outline"
        className="gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
      >
        <Download className="h-4 w-4" />
        تصدير المتابعة Excel
      </Button>
      <Button 
        onClick={exportRePhotographyToExcel}
        variant="outline"
        className="gap-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-300"
        title="تنزيل قائمة اللوحات التي تحتاج إعادة تصوير مع الإحداثيات"
      >
        <Download className="h-4 w-4" />
        إعادة تصوير
      </Button>
      <Button 
        onClick={() => setPrintFiltersOpen(true)}
        variant="outline"
        className="gap-2"
      >
        <Printer className="h-4 w-4" />
        طباعة المتاحة ({availableBillboardsCount})
      </Button>
      <Button onClick={() => {
        initializeAddForm();
        setAddOpen(true);
      }} className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300">
        <Plus className="h-4 w-4 ml-2" />
        إضافة لوحة
      </Button>
      <Button variant="outline" onClick={() => navigate('/admin/shared-billboards')}>
        اللوحات المشتركة
      </Button>
    </div>
  );
};