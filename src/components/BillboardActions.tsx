import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, Plus, FileSpreadsheet, Cloud, Camera, Share2, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ExportWithContractsDialog } from './billboards/ExportWithContractsDialog';

interface BillboardActionsProps {
  exportToExcel: () => void;
  exportAvailableToExcel: () => void;
  exportAllWithEndDate: () => void;
  exportAvailableAndUpcoming: () => void;
  exportFollowUpToExcel: () => void;
  exportRePhotographyToExcel: () => void;
  exportAvailableWithContracts?: (contractIds: number[], hideEndDateContractIds?: number[]) => void;
  exportAvailableAndUpcomingWithContracts?: (contractIds: number[], hideEndDateContractIds?: number[]) => void;
  syncToGoogleSheets: () => Promise<void>;
  setPrintFiltersOpen: (open: boolean) => void;
  setAdvancedPrintOpen?: (open: boolean) => void;
  availableBillboardsCount: number;
  initializeAddForm: () => void;
  setAddOpen: (open: boolean) => void;
}

export const BillboardActions: React.FC<BillboardActionsProps> = ({
  exportToExcel,
  exportAvailableToExcel,
  exportAllWithEndDate,
  exportAvailableAndUpcoming,
  exportFollowUpToExcel,
  exportRePhotographyToExcel,
  exportAvailableWithContracts,
  exportAvailableAndUpcomingWithContracts,
  syncToGoogleSheets,
  setPrintFiltersOpen,
  setAdvancedPrintOpen,
  availableBillboardsCount,
  initializeAddForm,
  setAddOpen
}) => {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [upcomingContractsDialogOpen, setUpcomingContractsDialogOpen] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncToGoogleSheets();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Main Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline"
            className="gap-2 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 hover:shadow-md transition-all"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">تصدير</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">تصدير البيانات</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-blue-500" />
            تصدير جميع اللوحات
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAvailableToExcel} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-emerald-500" />
            تصدير المتاح فقط
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAvailableAndUpcoming} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-emerald-500" />
            تصدير المتاح والقادمة (3 أشهر)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAllWithEndDate} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-orange-500" />
            الكل مع تاريخ الانتهاء
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {exportAvailableWithContracts && (
            <DropdownMenuItem onClick={() => setContractsDialogOpen(true)} className="cursor-pointer gap-2">
              <Download className="h-4 w-4 text-purple-500" />
              المتاح + عقود محددة
            </DropdownMenuItem>
          )}
          {exportAvailableAndUpcomingWithContracts && (
            <DropdownMenuItem onClick={() => setUpcomingContractsDialogOpen(true)} className="cursor-pointer gap-2">
              <Download className="h-4 w-4 text-purple-500" />
              المتاح والقادمة + عقود محددة
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportFollowUpToExcel} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-cyan-500" />
            تصدير المتابعة
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Sync Button */}
      <Button 
        onClick={handleSync}
        disabled={isSyncing}
        variant="outline"
        className="gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 hover:shadow-md transition-all border-blue-200 dark:border-blue-800"
      >
        <Cloud className={`h-4 w-4 text-blue-600 ${isSyncing ? 'animate-pulse' : ''}`} />
        <span className="hidden sm:inline">{isSyncing ? 'جاري...' : 'مزامنة'}</span>
      </Button>

      {/* Rephotography Button */}
      <Button 
        onClick={exportRePhotographyToExcel}
        variant="outline"
        className="gap-2 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 hover:shadow-md transition-all border-orange-200 dark:border-orange-800"
        title="تنزيل قائمة اللوحات التي تحتاج إعادة تصوير"
      >
        <Camera className="h-4 w-4 text-orange-600" />
        <span className="hidden lg:inline">إعادة تصوير</span>
      </Button>

      {/* Print Button */}
      <Button 
        onClick={() => setPrintFiltersOpen(true)}
        variant="outline"
        className="gap-2 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 hover:shadow-md transition-all border-violet-200 dark:border-violet-800"
      >
        <Printer className="h-4 w-4 text-violet-600" />
        <span className="hidden sm:inline">طباعة</span>
        <span className="bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-xs px-2 py-0.5 rounded-full font-medium">
          {availableBillboardsCount}
        </span>
      </Button>

      {/* Advanced Print Button */}
      {setAdvancedPrintOpen && (
        <Button 
          onClick={() => setAdvancedPrintOpen(true)}
          variant="outline"
          className="gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 hover:shadow-md transition-all border-indigo-200 dark:border-indigo-800"
          title="طباعة متقدمة مع اختيار اللوحات والخلفية"
        >
          <Settings2 className="h-4 w-4 text-indigo-600" />
          <span className="hidden lg:inline">طباعة متقدمة</span>
        </Button>
      )}

      {/* Shared Billboards Button */}
      <Button 
        variant="outline" 
        onClick={() => navigate('/admin/shared-billboards')}
        className="gap-2 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950 dark:to-rose-950 hover:shadow-md transition-all border-pink-200 dark:border-pink-800"
      >
        <Share2 className="h-4 w-4 text-pink-600" />
        <span className="hidden lg:inline">المشتركة</span>
      </Button>

      {/* Add Billboard Button - Primary Action */}
      <Button 
        onClick={() => {
          initializeAddForm();
          setAddOpen(true);
        }} 
        className="gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">إضافة لوحة</span>
      </Button>

      {/* Dialog for selecting contracts - المتاح + عقود */}
      {exportAvailableWithContracts && (
        <ExportWithContractsDialog
          open={contractsDialogOpen}
          onOpenChange={setContractsDialogOpen}
          onExport={exportAvailableWithContracts}
          title="تصدير المتاح مع عقود محددة"
          description="اختر العقود التي تريد إضافة لوحاتها إلى ملف اللوحات المتاحة (بدون تاريخ انتهاء)"
        />
      )}

      {/* Dialog for selecting contracts - المتاح والقادمة + عقود */}
      {exportAvailableAndUpcomingWithContracts && (
        <ExportWithContractsDialog
          open={upcomingContractsDialogOpen}
          onOpenChange={setUpcomingContractsDialogOpen}
          onExport={exportAvailableAndUpcomingWithContracts}
          title="تصدير المتاح والقادمة مع عقود محددة"
          description="اختر العقود التي تريد إضافة لوحاتها إلى ملف اللوحات المتاحة والقادمة (بدون تاريخ انتهاء)"
        />
      )}
    </div>
  );
};