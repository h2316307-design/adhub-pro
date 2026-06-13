/**
 * BillboardSwapDialog
 * نافذة نقل لوحة من العقد الحالي إلى عقد آخر
 * - بحث تفاعلي فوري
 * - توحيد كتابة المقاسات (4x10 = 10x4)
 * - نقل المهام (تركيب، طباعة، قص) مع تأكيد
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, Search, Loader2, AlertTriangle, MapPin, Ruler, Image as ImageIcon, CheckCircle2, Wrench, Printer, Scissors, MoveRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addBillboardsToContract, removeBillboardFromContract } from '@/services/contractService';
import { removeBillboardFromAllTasks, addBillboardToExistingTasks } from '@/services/smartBillboardService';
import { normalizeSize, displaySize } from '@/lib/utils';

interface BillboardSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboardId: string;
  billboardName: string;
  billboardSize: string;
  billboardImageUrl: string;
  billboardLandmark: string;
  currentContractNumber: string;
  onSwapComplete: () => void;
  startDate?: string;
  endDate?: string;
  mode?: 'swap' | 'move';
}

interface ContractSearchResult {
  Contract_Number: number;
  'Customer Name': string | null;
  'Ad Type': string | null;
  'Contract Date': string | null;
  'End Date': string | null;
  billboards_count: number | null;
  billboard_ids: string | null;
}

interface TargetBillboard {
  ID: number;
  Billboard_Name: string | null;
  Size: string | null;
  Image_URL: string | null;
  Nearest_Landmark: string | null;
}

interface LinkedTasksSummary {
  hasInstallation: boolean;
  hasPrint: boolean;
  hasCutout: boolean;
}

export function BillboardSwapDialog({
  open,
  onOpenChange,
  billboardId,
  billboardName,
  billboardSize,
  billboardImageUrl,
  billboardLandmark,
  currentContractNumber,
  onSwapComplete,
  startDate,
  endDate,
  mode = 'swap',
}: BillboardSwapDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ContractSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractSearchResult | null>(null);
  const [targetBillboards, setTargetBillboards] = useState<TargetBillboard[]>([]);
  const [selectedTargetBillboard, setSelectedTargetBillboard] = useState<TargetBillboard | null>(null);
  const [loadingBillboards, setLoadingBillboards] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTasksSummary>({ hasInstallation: false, hasPrint: false, hasCutout: false });
  const [targetLinkedTasks, setTargetLinkedTasks] = useState<LinkedTasksSummary>({ hasInstallation: false, hasPrint: false, hasCutout: false });
  const [sizeMismatchAcknowledged, setSizeMismatchAcknowledged] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedSourceSize = normalizeSize(billboardSize);
  const displaySourceSize = displaySize(billboardSize);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setResults([]);
      setSelectedContract(null);
      setTargetBillboards([]);
      setSelectedTargetBillboard(null);
      setShowConfirmation(false);
      setSizeMismatchAcknowledged(false);
    }
  }, [open]);

  // Load target contract billboards when selected
  useEffect(() => {
    if (!selectedContract?.billboard_ids) {
      setTargetBillboards([]);
      return;
    }
    const ids = selectedContract.billboard_ids.split(',').map(Number).filter(Boolean);
    if (ids.length === 0) { setTargetBillboards([]); return; }
    
    setLoadingBillboards(true);
    supabase
      .from('billboards')
      .select('ID, Billboard_Name, Size, Image_URL, Nearest_Landmark')
      .in('ID', ids)
      .then(({ data }) => {
        setTargetBillboards((data as TargetBillboard[]) || []);
        setLoadingBillboards(false);
      });
  }, [selectedContract]);

  // Check linked tasks for source billboard
  useEffect(() => {
    if (!open) return;
    const checkTasks = async () => {
      const contractNum = Number(currentContractNumber);
      const bbId = Number(billboardId);
      
      const [installRes, printRes, cutoutRes] = await Promise.all([
        supabase.from('installation_tasks').select('id').eq('contract_id', contractNum).limit(1),
        supabase.from('print_tasks').select('id').eq('contract_id', contractNum).limit(1),
        supabase.from('cutout_tasks').select('id').eq('contract_id', contractNum).limit(1),
      ]);

      const installIds = (installRes.data || []).map(t => t.id);
      const printIds = (printRes.data || []).map(t => t.id);
      const cutoutIds = (cutoutRes.data || []).map(t => t.id);

      const [iItems, pItems, cItems] = await Promise.all([
        installIds.length ? supabase.from('installation_task_items').select('id').in('task_id', installIds).eq('billboard_id', bbId).limit(1) : { data: [] },
        printIds.length ? supabase.from('print_task_items').select('id').in('task_id', printIds).eq('billboard_id', bbId).limit(1) : { data: [] },
        cutoutIds.length ? supabase.from('cutout_task_items').select('id').in('task_id', cutoutIds).eq('billboard_id', bbId).limit(1) : { data: [] },
      ]);

      setLinkedTasks({
        hasInstallation: (iItems.data || []).length > 0,
        hasPrint: (pItems.data || []).length > 0,
        hasCutout: (cItems.data || []).length > 0,
      });
    };
    checkTasks();
  }, [open, currentContractNumber, billboardId]);

  // Check target contract tasks
  useEffect(() => {
    if (!selectedContract) {
      setTargetLinkedTasks({ hasInstallation: false, hasPrint: false, hasCutout: false });
      return;
    }
    const check = async () => {
      const [i, p, c] = await Promise.all([
        supabase.from('installation_tasks').select('id').eq('contract_id', selectedContract.Contract_Number).limit(1),
        supabase.from('print_tasks').select('id').eq('contract_id', selectedContract.Contract_Number).limit(1),
        supabase.from('cutout_tasks').select('id').eq('contract_id', selectedContract.Contract_Number).limit(1),
      ]);
      setTargetLinkedTasks({
        hasInstallation: (i.data || []).length > 0,
        hasPrint: (p.data || []).length > 0,
        hasCutout: (c.data || []).length > 0,
      });
    };
    check();
  }, [selectedContract]);

  // Size mismatch warning - check selected target billboard specifically
  const selectedTargetSizeMismatch = useMemo(() => {
    if (!selectedTargetBillboard || !normalizedSourceSize) return false;
    return normalizeSize(selectedTargetBillboard.Size) !== normalizedSourceSize;
  }, [selectedTargetBillboard, normalizedSourceSize]);

  // General mismatch for entire contract
  const hasSizeMismatch = useMemo(() => {
    if (!selectedContract || !normalizedSourceSize) return false;
    if (targetBillboards.length === 0) return false;
    const targetNormalized = new Set(targetBillboards.map(b => normalizeSize(b.Size)).filter(Boolean));
    return targetNormalized.size > 0 && !targetNormalized.has(normalizedSourceSize);
  }, [selectedContract, targetBillboards, normalizedSourceSize]);

  // Interactive search with debounce
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    setSelectedContract(null);
    try {
      const trimmed = q.trim();
      const num = Number(trimmed);

      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboards_count, billboard_ids')
        .neq('Contract_Number', Number(currentContractNumber))
        .order('Contract_Number', { ascending: false })
        .limit(20);

      if (!isNaN(num) && trimmed.length > 0 && /^\d+$/.test(trimmed)) {
        query = query.eq('Contract_Number', num);
      } else {
        query = query.or(`"Customer Name".ilike.%${trimmed}%,"Ad Type".ilike.%${trimmed}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setResults((data as any[]) || []);
    } catch (err: any) {
      toast.error('خطأ في البحث: ' + err.message);
    } finally {
      setSearching(false);
    }
  }, [currentContractNumber]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(value), 400);
  };

  const hasAnyLinkedTask = linkedTasks.hasInstallation || linkedTasks.hasPrint || linkedTasks.hasCutout;
  const hasAnyTargetLinkedTask = targetLinkedTasks.hasInstallation || targetLinkedTasks.hasPrint || targetLinkedTasks.hasCutout;

  const handleSwapClick = () => {
    if (!selectedContract) return;
    if (mode === 'swap' && !selectedTargetBillboard) return;
    setShowConfirmation(true);
  };

  const executeSwap = async () => {
    if (!selectedContract) return;
    if (mode === 'swap' && !selectedTargetBillboard) return;
    setShowConfirmation(false);
    setSwapping(true);
    try {
      const sourceContractNum = Number(currentContractNumber);
      const targetContractNum = selectedContract.Contract_Number;
      const sourceBbId = Number(billboardId);

      if (mode === 'move') {
        // === One-way move ===
        await removeBillboardFromAllTasks(sourceContractNum, sourceBbId);
        await removeBillboardFromContract(String(sourceContractNum), String(sourceBbId));
        await addBillboardsToContract(String(targetContractNum), [String(sourceBbId)], {
          start_date: startDate || '',
          end_date: endDate || '',
          customer_name: '',
        });
        const { added } = await addBillboardToExistingTasks(targetContractNum, sourceBbId);
        const taskMsg = added.length > 0 ? `\nتم إضافتها لـ: ${added.join('، ')}` : '';
        toast.success(`تم نقل "${billboardName}" إلى العقد #${targetContractNum}${taskMsg}`);
      } else {
        // === Two-way swap ===
        const targetBbId = selectedTargetBillboard!.ID;
        await Promise.all([
          removeBillboardFromAllTasks(sourceContractNum, sourceBbId),
          removeBillboardFromAllTasks(targetContractNum, targetBbId),
        ]);
        await Promise.all([
          removeBillboardFromContract(String(sourceContractNum), String(sourceBbId)),
          removeBillboardFromContract(String(targetContractNum), String(targetBbId)),
        ]);
        await Promise.all([
          addBillboardsToContract(String(targetContractNum), [String(sourceBbId)], {
            start_date: startDate || '',
            end_date: endDate || '',
            customer_name: '',
          }),
          addBillboardsToContract(String(sourceContractNum), [String(targetBbId)], {
            start_date: startDate || '',
            end_date: endDate || '',
            customer_name: '',
          }),
        ]);
        const [sourceAdded, targetAdded] = await Promise.all([
          addBillboardToExistingTasks(targetContractNum, sourceBbId),
          addBillboardToExistingTasks(sourceContractNum, targetBbId),
        ]);
        const allAdded = [...new Set([...sourceAdded.added, ...targetAdded.added])];
        const taskMsg = allAdded.length > 0 ? `\nتم تحديث: ${allAdded.join('، ')}` : '';
        toast.success(`تم التبديل بنجاح!\n"${billboardName}" ↔ "${selectedTargetBillboard!.Billboard_Name || '#' + targetBbId}"${taskMsg}`);
      }

      onSwapComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`فشل في ${mode === 'move' ? 'النقل' : 'التبديل'}: ` + err.message);
    } finally {
      setSwapping(false);
    }
  };

  const taskLabels: { key: keyof LinkedTasksSummary; label: string; icon: React.ReactNode }[] = [
    { key: 'hasInstallation', label: 'تركيب', icon: <Wrench className="h-3 w-3" /> },
    { key: 'hasPrint', label: 'طباعة', icon: <Printer className="h-3 w-3" /> },
    { key: 'hasCutout', label: 'قص مجسم', icon: <Scissors className="h-3 w-3" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'move' ? <MoveRight className="h-5 w-5 text-primary" /> : <ArrowLeftRight className="h-5 w-5 text-primary" />}
            {mode === 'move' ? 'نقل لوحة إلى عقد آخر' : 'تبديل لوحة مع عقد آخر'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source billboard info */}
          <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border">
            {billboardImageUrl ? (
              <img src={billboardImageUrl} alt={billboardName} className="w-20 h-14 rounded-md object-cover border shrink-0" />
            ) : (
              <div className="w-20 h-14 rounded-md bg-muted flex items-center justify-center border shrink-0">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{billboardName}</div>
              {billboardLandmark && (
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {billboardLandmark}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {displaySourceSize && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Ruler className="h-2.5 w-2.5" /> {displaySourceSize}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  من العقد #{currentContractNumber}
                </Badge>
                {/* Show linked tasks badges */}
                {taskLabels.filter(t => linkedTasks[t.key]).map(t => (
                  <Badge key={t.key} variant="outline" className="text-[10px] gap-1 border-blue-400/50 text-blue-600 dark:text-blue-400">
                    {t.icon} {t.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Search - interactive */}
          <div className="space-y-2">
            <Label>ابحث عن العقد المستهدف</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="رقم العقد، اسم العميل، أو نوع الإعلان..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pr-9"
              />
              {searching && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.Contract_Number}
                  onClick={() => setSelectedContract(c)}
                  className={`w-full text-right p-3 rounded-lg border transition-colors ${
                    selectedContract?.Contract_Number === c.Contract_Number
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">عقد #{c.Contract_Number}</span>
                      {c['Ad Type'] && (
                        <Badge variant="outline" className="text-[10px]">{c['Ad Type']}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{c.billboards_count || 0} لوحة</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c['Customer Name'] || 'بدون عميل'}
                    {c['End Date'] && <span className="mr-2">• حتى {c['End Date']}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && searchQuery && !searching && (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد نتائج</p>
          )}

          {/* Target contract billboards - only for swap mode */}
          {selectedContract && mode === 'swap' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 flex-wrap">
                لوحات العقد #{selectedContract.Contract_Number}
                {hasSizeMismatch && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" /> مقاس مختلف
                  </Badge>
                )}
                {taskLabels.filter(t => targetLinkedTasks[t.key]).map(t => (
                  <Badge key={t.key} variant="outline" className="text-[10px] gap-1 border-green-400/50 text-green-600 dark:text-green-400">
                    {t.icon} {t.label}
                  </Badge>
                ))}
              </Label>

              {hasSizeMismatch && !selectedTargetBillboard && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/40 bg-destructive/5 text-xs">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>
                    مقاس اللوحة المنقولة (<strong dir="ltr">{displaySourceSize}</strong>) يختلف عن مقاسات لوحات العقد المستهدف.
                    اختر اللوحة المراد التبديل معها.
                  </span>
                </div>
              )}

              {selectedTargetBillboard && selectedTargetSizeMismatch && (
                <div className="p-3 rounded-lg border-2 border-destructive bg-destructive/10 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    تحذير: اختلاف في المقاس!
                  </div>
                  <p className="text-xs">
                    اللوحة المنقولة <strong dir="ltr">{displaySourceSize}</strong> ← اللوحة المستهدفة <strong dir="ltr">{displaySize(selectedTargetBillboard.Size)}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    المقاسات مختلفة. يمكنك المتابعة لكن تأكد أن هذا هو التبديل الصحيح.
                  </p>
                </div>
              )}

              {loadingBillboards ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : targetBillboards.length > 0 ? (
                <>
                  <p className="text-[11px] text-muted-foreground">اختر اللوحة المراد التبديل معها:</p>
                  <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto">
                    {targetBillboards.map((tb) => {
                      const sizeMatch = normalizeSize(tb.Size) === normalizedSourceSize;
                      const isSelected = selectedTargetBillboard?.ID === tb.ID;
                      return (
                        <button
                          key={tb.ID}
                          type="button"
                          onClick={() => {
                            setSelectedTargetBillboard(isSelected ? null : tb);
                            setSizeMismatchAcknowledged(false);
                          }}
                          className={`flex gap-2 p-2 rounded-lg border text-xs text-right transition-all ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/30 bg-primary/10'
                              : sizeMatch
                                ? 'border-border bg-muted/30 hover:bg-muted/60'
                                : 'border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400'
                          }`}
                        >
                          {tb.Image_URL ? (
                            <img src={tb.Image_URL} alt="" className="w-12 h-10 rounded object-cover border shrink-0" />
                          ) : (
                            <div className="w-12 h-10 rounded bg-muted flex items-center justify-center border shrink-0">
                              <ImageIcon className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{tb.Billboard_Name || `#${tb.ID}`}</div>
                            <div className="text-muted-foreground truncate">{tb.Nearest_Landmark || '—'}</div>
                            <Badge variant={sizeMatch ? 'secondary' : 'outline'} className={`text-[9px] mt-0.5 ${!sizeMatch ? 'border-amber-400 text-amber-600' : ''}`}>
                              <span dir="ltr">{displaySize(tb.Size)}</span>
                            </Badge>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 self-center" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">لا توجد لوحات</p>
              )}
            </div>
          )}

          {/* Confirmation for SWAP mode */}
          {showConfirmation && mode === 'swap' && selectedTargetBillboard && (
            <div className="p-4 rounded-lg border-2 border-primary/50 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                تأكيد التبديل بين اللوحتين
              </div>
              
              {selectedTargetSizeMismatch && (
                <div className="p-3 rounded-lg border-2 border-destructive bg-destructive/10 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-destructive">تحذير: المقاسات مختلفة!</p>
                    <p><strong dir="ltr">{displaySourceSize}</strong> ↔ <strong dir="ltr">{displaySize(selectedTargetBillboard.Size)}</strong></p>
                    <p className="text-muted-foreground">المقاسات مختلفة. سيتم التبديل لكن تأكد أن هذا صحيح.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded border bg-muted/30">
                  <div className="font-semibold mb-1">📤 من العقد #{currentContractNumber}</div>
                  <div>{billboardName}</div>
                  <div className="text-muted-foreground" dir="ltr">{displaySourceSize}</div>
                </div>
                <div className="p-2 rounded border bg-muted/30">
                  <div className="font-semibold mb-1">📥 من العقد #{selectedContract?.Contract_Number}</div>
                  <div>{selectedTargetBillboard.Billboard_Name || `#${selectedTargetBillboard.ID}`}</div>
                  <div className="text-muted-foreground" dir="ltr">{displaySize(selectedTargetBillboard.Size)}</div>
                </div>
              </div>

              {(hasAnyLinkedTask || hasAnyTargetLinkedTask) && (
                <div className="text-xs space-y-1 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded border border-blue-300/30">
                  <p className="font-semibold text-blue-700 dark:text-blue-300">📋 سيتم تبديل المهام تلقائياً:</p>
                  <div className="flex flex-wrap gap-1">
                    {taskLabels.filter(t => linkedTasks[t.key] || targetLinkedTasks[t.key]).map(t => (
                      <Badge key={t.key} className="text-[10px] gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                        {t.icon} {t.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={executeSwap} disabled={swapping} className={`gap-1 ${selectedTargetSizeMismatch ? 'bg-amber-600 hover:bg-amber-700' : ''}`}>
                  {swapping ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowLeftRight className="h-3 w-3" />}
                  {selectedTargetSizeMismatch ? 'تبديل رغم اختلاف المقاس' : 'تأكيد التبديل'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowConfirmation(false)} disabled={swapping}>
                  رجوع
                </Button>
              </div>
            </div>
          )}

          {/* Confirmation for MOVE mode */}
          {showConfirmation && mode === 'move' && selectedContract && (
            <div className="p-4 rounded-lg border-2 border-primary/50 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <MoveRight className="h-5 w-5 text-primary" />
                تأكيد نقل اللوحة
              </div>
              
              <div className="text-xs space-y-1 p-2 rounded border bg-muted/30">
                <p>سيتم نقل <strong>"{billboardName}"</strong> من العقد <strong>#{currentContractNumber}</strong> إلى العقد <strong>#{selectedContract.Contract_Number}</strong></p>
                <p className="text-muted-foreground">({selectedContract['Customer Name'] || 'بدون عميل'})</p>
              </div>

              {hasAnyLinkedTask && (
                <div className="text-xs space-y-1 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded border border-blue-300/30">
                  <p className="font-semibold text-blue-700 dark:text-blue-300">📋 سيتم نقل المهام تلقائياً:</p>
                  <div className="flex flex-wrap gap-1">
                    {taskLabels.filter(t => linkedTasks[t.key]).map(t => (
                      <Badge key={t.key} className="text-[10px] gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                        {t.icon} حذف من {t.label} ← إضافة للعقد #{selectedContract.Contract_Number}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={executeSwap} disabled={swapping} className="gap-1">
                  {swapping ? <Loader2 className="h-3 w-3 animate-spin" /> : <MoveRight className="h-3 w-3" />}
                  تأكيد النقل
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowConfirmation(false)} disabled={swapping}>
                  رجوع
                </Button>
              </div>
            </div>
          )}
        </div>

        {!showConfirmation && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={swapping}>
              إلغاء
            </Button>
            <Button
              onClick={handleSwapClick}
              disabled={!selectedContract || (mode === 'swap' && !selectedTargetBillboard) || swapping}
              className="gap-2"
            >
              {swapping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === 'move' ? (
                <MoveRight className="h-4 w-4" />
              ) : (
                <ArrowLeftRight className="h-4 w-4" />
              )}
              {swapping
                ? mode === 'move' ? 'جاري النقل...' : 'جاري التبديل...'
                : mode === 'move'
                  ? !selectedContract ? 'اختر العقد المستهدف' : `نقل إلى العقد #${selectedContract.Contract_Number}`
                  : !selectedTargetBillboard
                    ? 'اختر لوحة للتبديل'
                    : `تبديل ↔ ${selectedTargetBillboard.Billboard_Name || '#' + selectedTargetBillboard.ID}`
              }
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
