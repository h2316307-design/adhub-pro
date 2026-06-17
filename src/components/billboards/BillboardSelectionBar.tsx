import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Printer, CheckSquare, Square, Trash2, Eye, EyeOff, ClipboardList } from 'lucide-react';
import { BillboardReportDialog } from './BillboardReportDialog';
import { BillboardPrintWithSelection } from './BillboardPrintWithSelection';
import { isBillboardAvailable } from '@/utils/contractUtils';

interface BillboardSelectionBarProps {
  selectedBillboards: any[];
  filteredBillboards: any[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  onDeleteSelected?: () => void;
  onToggleVisibility?: (billboardIds: number[], visible: boolean) => void;
  excludeFriendlyAndHidden?: boolean;
  onSetExcludeFriendlyAndHidden?: (val: boolean) => void;
  selectAvailableOnly?: boolean;
  onSetSelectAvailableOnly?: (val: boolean) => void;
}

export const BillboardSelectionBar: React.FC<BillboardSelectionBarProps> = ({
  selectedBillboards,
  filteredBillboards,
  onClearSelection,
  onSelectAll,
  isAllSelected,
  onDeleteSelected,
  onToggleVisibility,
  excludeFriendlyAndHidden = true,
  onSetExcludeFriendlyAndHidden = () => {},
  selectAvailableOnly = false,
  onSetSelectAvailableOnly = () => {}
}) => {
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const selectableCount = useMemo(() => {
    return filteredBillboards.filter((b: any) => {
      const isFriendly = !!b.friend_company_id;
      const isHidden = b.is_visible_in_available === false || b.is_visible === false;
      const isAvailable = isBillboardAvailable(b);

      if (excludeFriendlyAndHidden && (isFriendly || isHidden)) return false;
      if (selectAvailableOnly && !isAvailable) return false;
      return true;
    }).length;
  }, [filteredBillboards, excludeFriendlyAndHidden, selectAvailableOnly]);

  if (selectedBillboards.length === 0) {
    return null;
  }

  return (
    <>
      {/* الشريط العائم */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-primary/95 to-primary-foreground/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-primary/20">
          {/* عدد اللوحات المختارة */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1.5 text-base font-bold bg-white/90 text-primary">
              {selectedBillboards.length}
            </Badge>
            <span className="text-white font-medium">لوحة مختارة</span>
          </div>

          <div className="w-px h-8 bg-white/30" />

          {/* اختيار الكل */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={isAllSelected ? onClearSelection : onSelectAll}
              className="text-white hover:bg-white/20 gap-2"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="h-4 w-4" />
                  إلغاء الكل ({selectableCount})
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" />
                  اختيار الكل ({selectableCount})
                </>
              )}
            </Button>

            {/* فلتر استثناء اللوحات الصديقة والمخفية */}
            <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2 py-1 rounded-lg border border-white/10 transition-colors">
              <input 
                type="checkbox"
                id="exclude-friendly-hidden"
                checked={excludeFriendlyAndHidden}
                onChange={(e) => onSetExcludeFriendlyAndHidden(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/30 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer"
              />
              <label htmlFor="exclude-friendly-hidden" className="text-[10px] text-white/90 font-medium cursor-pointer select-none">
                استثناء الصديقة والمخفية
              </label>
            </div>

            {/* فلتر تحديد المتاح فقط */}
            <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2 py-1 rounded-lg border border-white/10 transition-colors">
              <input 
                type="checkbox"
                id="select-available-only"
                checked={selectAvailableOnly}
                onChange={(e) => onSetSelectAvailableOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/30 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer"
              />
              <label htmlFor="select-available-only" className="text-[10px] text-white/90 font-medium cursor-pointer select-none">
                المتاح فقط
              </label>
            </div>
          </div>

          <div className="w-px h-8 bg-white/30" />

          {/* زر الطباعة */}
          <Button
            onClick={() => setPrintDialogOpen(true)}
            className="bg-white text-primary hover:bg-white/90 gap-2 font-bold shadow-lg"
          >
            <Printer className="h-4 w-4" />
            طباعة اللوحات
          </Button>

          {/* زر تقرير الحالة */}
          <Button
            onClick={() => setReportDialogOpen(true)}
            variant="ghost"
            className="text-white hover:bg-white/20 gap-2 font-bold"
          >
            <ClipboardList className="h-4 w-4" />
            تقرير الحالة
          </Button>

          {/* أزرار إخفاء/إظهار من المتاح */}
          {onToggleVisibility && (
            <>
              <Button
                onClick={() => onToggleVisibility(selectedBillboards.map(b => Number(b.ID || b.id)), false)}
                variant="ghost"
                className="text-white hover:bg-white/20 gap-2"
                size="sm"
              >
                <EyeOff className="h-4 w-4" />
                إخفاء من المتاح
              </Button>
              <Button
                onClick={() => onToggleVisibility(selectedBillboards.map(b => Number(b.ID || b.id)), true)}
                variant="ghost"
                className="text-white hover:bg-white/20 gap-2"
                size="sm"
              >
                <Eye className="h-4 w-4" />
                إظهار في المتاح
              </Button>
            </>
          )}

          {/* زر الحذف المتعدد */}
          {onDeleteSelected && (
            <Button
              onClick={onDeleteSelected}
              variant="destructive"
              className="gap-2 font-bold shadow-lg"
            >
              <Trash2 className="h-4 w-4" />
              حذف ({selectedBillboards.length})
            </Button>
          )}

          {/* زر إلغاء الاختيار */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* نافذة إعدادات الطباعة المتقدمة المحدثة */}
      <BillboardPrintWithSelection
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        billboards={selectedBillboards}
        partnerName={selectedBillboards[0]?.Partner_Name || selectedBillboards[0]?.partner_name || undefined}
      />

      <BillboardReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        selectedBillboards={selectedBillboards}
      />
    </>
  );
};

export default BillboardSelectionBar;
