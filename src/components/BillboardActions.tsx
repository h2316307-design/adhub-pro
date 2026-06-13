import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Printer, Plus, FileSpreadsheet, Cloud, Camera, Share2, Settings2, Zap, Upload, Shuffle, Copy, MoreHorizontal, Globe, Calendar } from 'lucide-react';
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
  copyAvailableToClipboard: () => void;
  copyAllToClipboard: () => void;
  copyAvailableAndUpcomingToClipboard: (monthsAhead?: number) => void;
  copyAllWithEndDateToClipboard: () => void;
  copyFollowUpToClipboard: () => void;
  exportAllWithEndDate: () => void;
  exportAvailableAndUpcoming: (monthsAhead?: number) => void;
  exportFollowUpToExcel: () => void;
  exportRePhotographyToExcel: () => void;
  exportAvailableWithContracts?: (contractIds: number[], hideEndDateContractIds?: number[]) => void;
  exportAvailableAndUpcomingWithContracts?: (contractIds: number[], hideEndDateContractIds?: number[], monthsAhead?: number) => void;
  uploadAvailableToSite?: () => void;
  uploadAvailableAndUpcomingToSite?: (monthsAhead?: number) => void;
  uploadFollowUpToSite?: () => void;
  uploadAllToSite?: () => void;
  syncToGoogleSheets: () => Promise<void>;
  setPrintFiltersOpen: (open: boolean) => void;
  setAdvancedPrintOpen?: (open: boolean) => void;
  availableBillboardsCount: number;
  initializeAddForm: () => void;
  setAddOpen: (open: boolean) => void;
  setBulkAddOpen?: (open: boolean) => void;
  setExcelImportOpen?: (open: boolean) => void;
  setExcelImageImportOpen?: (open: boolean) => void;
}

export const BillboardActions: React.FC<BillboardActionsProps> = ({
  exportToExcel,
  exportAvailableToExcel,
  copyAvailableToClipboard,
  copyAllToClipboard,
  copyAvailableAndUpcomingToClipboard,
  copyAllWithEndDateToClipboard,
  copyFollowUpToClipboard,
  exportAllWithEndDate,
  exportAvailableAndUpcoming,
  exportFollowUpToExcel,
  exportRePhotographyToExcel,
  exportAvailableWithContracts,
  exportAvailableAndUpcomingWithContracts,
  uploadAvailableToSite,
  uploadAvailableAndUpcomingToSite,
  uploadFollowUpToSite,
  uploadAllToSite,
  syncToGoogleSheets,
  setPrintFiltersOpen,
  setAdvancedPrintOpen,
  availableBillboardsCount,
  initializeAddForm,
  setAddOpen,
  setBulkAddOpen,
  setExcelImportOpen,
  setExcelImageImportOpen,
}) => {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [upcomingContractsDialogOpen, setUpcomingContractsDialogOpen] = useState(false);
  const [monthsAhead, setMonthsAhead] = useState<number>(4);

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
          <DropdownMenuItem onClick={copyAllToClipboard} className="cursor-pointer gap-2">
            <Copy className="h-4 w-4 text-blue-500" />
            نسخ جميع اللوحات
          </DropdownMenuItem>
          {uploadAllToSite && (
            <DropdownMenuItem onClick={uploadAllToSite} className="cursor-pointer gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              تصدير جميع اللوحات إلى الموقع
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportAvailableToExcel} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-emerald-500" />
            تصدير المتاح فقط
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyAvailableToClipboard} className="cursor-pointer gap-2">
            <Copy className="h-4 w-4 text-emerald-500" />
            نسخ المتاح فقط
          </DropdownMenuItem>
          {uploadAvailableToSite && (
            <DropdownMenuItem onClick={uploadAvailableToSite} className="cursor-pointer gap-2">
              <Globe className="h-4 w-4 text-emerald-600" />
              تصدير المتاح إلى الموقع
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <div
            className="px-2 py-1.5 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
            <Label htmlFor="months-ahead-input" className="text-xs text-muted-foreground shrink-0">
              عدد الأشهر القادمة:
            </Label>
            <Input
              id="months-ahead-input"
              type="number"
              min={1}
              max={36}
              value={monthsAhead}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setMonthsAhead(Number.isFinite(v) && v > 0 ? v : 4);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-16 text-xs text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <DropdownMenuItem onClick={() => exportAvailableAndUpcoming(monthsAhead)} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-emerald-500" />
            تصدير المتاح والقادمة ({monthsAhead} {monthsAhead === 1 ? 'شهر' : monthsAhead === 2 ? 'شهرين' : monthsAhead <= 10 ? 'أشهر' : 'شهراً'})
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyAvailableAndUpcomingToClipboard(monthsAhead)} className="cursor-pointer gap-2">
            <Copy className="h-4 w-4 text-emerald-500" />
            نسخ المتاح والقادمة ({monthsAhead})
          </DropdownMenuItem>
          {uploadAvailableAndUpcomingToSite && (
            <DropdownMenuItem onClick={() => uploadAvailableAndUpcomingToSite(monthsAhead)} className="cursor-pointer gap-2">
              <Globe className="h-4 w-4 text-emerald-600" />
              تصدير المتاح والقادمة إلى الموقع ({monthsAhead})
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportAllWithEndDate} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-orange-500" />
            الكل مع تاريخ الانتهاء
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyAllWithEndDateToClipboard} className="cursor-pointer gap-2">
            <Copy className="h-4 w-4 text-orange-500" />
            نسخ الكل مع تاريخ الانتهاء
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
          <DropdownMenuItem onClick={copyFollowUpToClipboard} className="cursor-pointer gap-2">
            <Copy className="h-4 w-4 text-cyan-500" />
            نسخ المتابعة
          </DropdownMenuItem>
          {uploadFollowUpToSite && (
            <DropdownMenuItem onClick={uploadFollowUpToSite} className="cursor-pointer gap-2">
              <Globe className="h-4 w-4 text-cyan-600" />
              تصدير المتابعة إلى الموقع
            </DropdownMenuItem>
          )}
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

      {/* Tools Dropdown - Secondary Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline"
            className="gap-2 hover:shadow-md transition-all"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">أدوات</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">أدوات إضافية</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportRePhotographyToExcel} className="cursor-pointer gap-2">
            <Camera className="h-4 w-4 text-orange-600" />
            إعادة تصوير
          </DropdownMenuItem>
          {setAdvancedPrintOpen && (
            <DropdownMenuItem onClick={() => setAdvancedPrintOpen(true)} className="cursor-pointer gap-2">
              <Settings2 className="h-4 w-4 text-indigo-600" />
              طباعة متقدمة
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/admin/smart-distribution')} className="cursor-pointer gap-2">
            <Shuffle className="h-4 w-4 text-emerald-600" />
            توزيع ذكي
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/admin/shared-billboards')} className="cursor-pointer gap-2">
            <Share2 className="h-4 w-4 text-pink-600" />
            اللوحات المشتركة
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Billboard Dropdown - Primary Action */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">إضافة لوحة</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">خيارات الإضافة</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => {
              initializeAddForm();
              setAddOpen(true);
            }} 
            className="cursor-pointer gap-2"
          >
            <Plus className="h-4 w-4 text-primary" />
            إضافة لوحة واحدة
          </DropdownMenuItem>
          {setBulkAddOpen && (
            <DropdownMenuItem 
              onClick={() => setBulkAddOpen(true)} 
              className="cursor-pointer gap-2"
            >
              <Zap className="h-4 w-4 text-amber-500" />
              إضافة لوحات متعددة
            </DropdownMenuItem>
          )}
          {setExcelImportOpen && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setExcelImportOpen(true)} 
                className="cursor-pointer gap-2"
              >
                <Upload className="h-4 w-4 text-green-600" />
                استيراد من Excel
              </DropdownMenuItem>
            </>
          )}
          {setExcelImageImportOpen && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setExcelImageImportOpen(true)} 
                className="cursor-pointer gap-2"
              >
                <Upload className="h-4 w-4 text-purple-600" />
                استيراد صور من Excel
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
          onExport={(contractIds, hideEndDateIds) =>
            exportAvailableAndUpcomingWithContracts(contractIds, hideEndDateIds, monthsAhead)
          }
          title={`تصدير المتاح والقادمة مع عقود محددة (${monthsAhead} ${monthsAhead === 1 ? 'شهر' : monthsAhead === 2 ? 'شهرين' : monthsAhead <= 10 ? 'أشهر' : 'شهراً'})`}
          description="اختر العقود التي تريد إضافة لوحاتها إلى ملف اللوحات المتاحة والقادمة (بدون تاريخ انتهاء)"
        />
      )}
    </div>
  );
};