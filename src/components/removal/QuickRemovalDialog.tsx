import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  CheckCheck, 
  Loader2, 
  Search, 
  ImageIcon, 
  Palette, 
  MapPin, 
  Users, 
  Maximize2, 
  Calendar, 
  X, 
  CheckSquare,
  Navigation,
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { completeRemovalItems } from '@/services/completeRemovalItems';
import { matchesRemovalDesignBillboard, isRemovalDesignEnabled } from '@/services/removalPrintImages';
import { toast } from 'sonner';

interface QuickRemovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: any[];
  tasks: any[];
  billboards: Record<string, any>;
  contracts: Record<string, any>;
  teams: Record<string, any>;
}

export function QuickRemovalDialog({
  open,
  onOpenChange,
  items,
  tasks,
  billboards,
  contracts,
  teams,
}: QuickRemovalDialogProps) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('all');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // 1. جلب ترتيب المقاسات المعتمد من جدول sizes
  const { data: sizeOrderMap = {} } = useQuery({
    queryKey: ['sizes-sort-order'],
    queryFn: async () => {
      const { data } = await supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true });
      const map: Record<string, number> = {};
      data?.forEach((s: any) => {
        if (s.name) {
          const key = s.name.trim().toLowerCase().replace(/[*×]/g, 'x');
          map[key] = s.sort_order ?? 999;
          map[s.name.trim()] = s.sort_order ?? 999;
        }
      });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  // 2. جلب ترتيب المستويات المعتمد من جدول billboard_levels
  const { data: levelOrderMap = {} } = useQuery({
    queryKey: ['levels-sort-order'],
    queryFn: async () => {
      const { data } = await supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true });
      const map: Record<string, number> = {};
      data?.forEach((l: any) => {
        if (l.level_code) {
          map[l.level_code.trim().toUpperCase()] = l.sort_order ?? 999;
        }
      });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  // 3. جلب ترتيب البلديات المعتمد من جدول municipalities
  const { data: municipalityOrderMap = {} } = useQuery({
    queryKey: ['municipalities-sort-order'],
    queryFn: async () => {
      const { data } = await supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true });
      const map: Record<string, number> = {};
      data?.forEach((m: any) => {
        if (m.name) {
          map[m.name.trim()] = m.sort_order ?? 999;
        }
      });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch('');
      setTeam('all');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setPreviewImage(null);
    }
  }, [open]);

  // دوال احتساب الرتبة للترتيب حسب: المقاس -> المستوى -> البلدية -> رقم اللوحة
  const normalizeSize = (sz: string) => sz.trim().toLowerCase().replace(/[*×\s]/g, 'x');

  const getSizeRank = (sz?: string | null) => {
    if (!sz) return 999;
    const clean = normalizeSize(sz);
    if (sizeOrderMap[clean] !== undefined) return sizeOrderMap[clean];
    if (sizeOrderMap[sz.trim()] !== undefined) return sizeOrderMap[sz.trim()];
    if (clean.includes('13x5')) return 1;
    if (clean.includes('12x4')) return 2;
    if (clean.includes('10x4')) return 3;
    if (clean.includes('8x3-t') || clean.includes('8x3t')) return 4;
    if (clean.includes('8x3')) return 5;
    if (clean.includes('6x3')) return 6;
    if (clean.includes('4x3')) return 7;
    if (clean.includes('5x3')) return 9;
    if (clean.includes('سوسيت')) return 10;
    if (clean.includes('4x2.5')) return 13;
    return 999;
  };

  const getLevelRank = (lvl?: string | null) => {
    if (!lvl) return 999;
    const clean = lvl.trim().toUpperCase();
    if (levelOrderMap[clean] !== undefined) return levelOrderMap[clean];
    if (clean === 'S') return 1;
    if (clean === 'A') return 2;
    if (clean === 'B') return 4;
    if (clean === 'C') return 5;
    return 999;
  };

  const getMunicipalityRank = (muni?: string | null) => {
    if (!muni) return 999;
    const clean = muni.trim();
    if (municipalityOrderMap[clean] !== undefined) return municipalityOrderMap[clean];
    const fallbackMuni: Record<string, number> = {
      'طرابلس المركز': 1, 'بوسليم': 2, 'سوق الجمعة': 3, 'عين زارة': 4,
      'حي الأندلس': 5, 'جنزور': 6, 'تاجوراء': 7, 'الزاوية': 8, 'مصراتة': 9,
      'زليتن': 10, 'الخمس': 11, 'صبراته': 12, 'صرمان': 13, 'السواني': 14,
      'قصر بن غشير': 15, 'ترهونة': 16, 'امسلاتة': 17, 'القره بوللي': 18,
      'قصر الاخيار': 19, 'سبها': 20, 'زلطن': 21
    };
    return fallbackMuni[clean] ?? 999;
  };

  const rows = useMemo(() => {
    const active = new Map(
      tasks
        .filter((task) => ['pending', 'in_progress'].includes(task.status))
        .map((task) => [task.id, task])
    );

    return items
      .filter((item) => item.status === 'pending' && active.has(item.task_id))
      .map((item) => {
        const task = active.get(item.task_id)!;
        const billboard = billboards[item.billboard_id] || {};
        const contract = contracts[task.contract_id] || {};
        const teamName = teams[task.team_id]?.team_name || 'بدون فرقة';

        // استخراج صورة التصميم المخصص للإزالة (فقط لو مفعل ولها تصميم يخص هذه اللوحة بالتحديد)
        let designUrl: string | null = null;
        if (contract?.installation_enabled !== false) {
          if (item.design_face_a && typeof item.design_face_a === 'string' && item.design_face_a.trim().length > 5) {
            designUrl = item.design_face_a.trim();
          } else if (item.design_face_b && typeof item.design_face_b === 'string' && item.design_face_b.trim().length > 5) {
            designUrl = item.design_face_b.trim();
          } else if (contract.design_data) {
            try {
              let dd = typeof contract.design_data === 'string' ? JSON.parse(contract.design_data) : contract.design_data;
              if (typeof dd === 'string') {
                try { dd = JSON.parse(dd); } catch {}
              }
              if (Array.isArray(dd)) {
                const match = dd.find((d: any) => isRemovalDesignEnabled(d) && matchesRemovalDesignBillboard(d, billboard));
                if (match) {
                  const face = match.designFaceA || match.design_face_a || match.faceA || match.designFaceAUrl || match.design_face_a_url;
                  if (face && typeof face === 'string' && face.trim().length > 5) {
                    designUrl = face.trim();
                  }
                }
              }
            } catch {}
          }
        }

        // عزل صورة الهيكل عن صورة التصميم لضمان عدم التكرار
        const billboardImg = billboard.Image_URL ? normalizeGoogleImageUrl(billboard.Image_URL) : null;
        const normalizedDesign = designUrl ? normalizeGoogleImageUrl(designUrl) : null;
        const safeDesignUrl = (normalizedDesign && normalizedDesign !== billboardImg) ? normalizedDesign : null;

        return {
          ...item,
          task,
          billboard,
          contract,
          teamName,
          billboardImage: billboardImg,
          designImage: safeDesignUrl,
        };
      })
      .sort((a, b) => {
        // 1. ترتيب المقاس (Size Order)
        const sizeA = a.billboard?.Size || a.billboard?.size;
        const sizeB = b.billboard?.Size || b.billboard?.size;
        const sRankA = getSizeRank(sizeA);
        const sRankB = getSizeRank(sizeB);
        if (sRankA !== sRankB) return sRankA - sRankB;

        // 2. ترتيب المستوى (Level Order)
        const levelA = a.billboard?.Level || a.billboard?.Category_Level || a.billboard?.level;
        const levelB = b.billboard?.Level || b.billboard?.Category_Level || b.billboard?.level;
        const lRankA = getLevelRank(levelA);
        const lRankB = getLevelRank(levelB);
        if (lRankA !== lRankB) return lRankA - lRankB;

        // 3. ترتيب البلدية (Municipality Order)
        const muniA = a.billboard?.Municipality || a.billboard?.municipality || a.billboard?.City || a.billboard?.city;
        const muniB = b.billboard?.Municipality || b.billboard?.municipality || b.billboard?.City || b.billboard?.city;
        const mRankA = getMunicipalityRank(muniA);
        const mRankB = getMunicipalityRank(muniB);
        if (mRankA !== mRankB) return mRankA - mRankB;

        // 4. تسلسل رقم اللوحة (ID)
        const idA = Number(a.billboard?.ID || a.billboard_id || 0);
        const idB = Number(b.billboard?.ID || b.billboard_id || 0);
        return idA - idB;
      });
  }, [items, tasks, billboards, contracts, teams, sizeOrderMap, levelOrderMap, municipalityOrderMap]);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      const matchesTeam = team === 'all' || row.task.team_id === team;
      const term = search.trim().toLowerCase();
      if (!term) return matchesTeam;

      const searchableText = [
        row.billboard.Billboard_Name,
        row.billboard_id,
        row.billboard.Size,
        row.billboard.City,
        row.billboard.District,
        row.billboard.Municipality,
        row.billboard.Nearest_Landmark,
        row.billboard.nearest_landmark,
        row.billboard.location_text,
        row.task.contract_id,
        row.contract['Customer Name'],
        row.contract['Ad Type'],
        row.teamName,
      ].filter(Boolean).join(' ').toLowerCase();

      return matchesTeam && searchableText.includes(term);
    });
  }, [rows, team, search]);

  const chosen = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const allVisible = visible.length > 0 && visible.every((row) => selected.has(row.id));

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisible) {
        visible.forEach((r) => next.delete(r.id));
      } else {
        visible.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const save = async () => {
    if (!chosen.length || !date) return;
    setSaving(true);
    try {
      const count = await completeRemovalItems(chosen, date);
      toast.success(`تم توثيق إزالة ${count} لوحة بنجاح`);
      setSelected(new Set());
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'تعذر حفظ الإزالة');
    } finally {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['removal-tasks'] }),
        client.invalidateQueries({ queryKey: ['all-removal-task-items'] }),
      ]);
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving) onOpenChange(value);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-w-7xl w-[95vw] h-[92dvh] max-h-[92dvh] flex flex-col gap-3.5 overflow-hidden p-4 sm:p-6"
        >
          {/* رأس النافذة */}
          <DialogHeader className="pb-1 text-right">
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-foreground">
              <CheckCheck className="h-5 w-5 text-primary" />
              <span>الإزالة السريعة</span>
              <Badge variant="outline" className="mr-2 text-xs font-mono font-bold bg-primary/10 text-primary border-primary/20">
                {rows.length} لوحة معلّقة
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تحديد وتوثيق إزالة اللوحات دفعة واحدة مع عرض واضح لصورة الهيكل وتصميم الإعلان المطلوب إزالته.
            </DialogDescription>
          </DialogHeader>

          {/* شريط البحث والفلترة */}
          <div className="flex flex-wrap items-center gap-2.5 bg-muted/30 p-2.5 rounded-xl border border-border/50">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                aria-label="بحث الإزالة السريعة"
                placeholder="بحث برقم اللوحة، العقد، العميل، الإعلان أو المدينة..."
                className="pr-9 h-9 text-xs bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 h-9 shrink-0">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                aria-label="فرقة الإزالة"
                className="bg-transparent text-xs text-foreground cursor-pointer focus:outline-none"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              >
                <option value="all">جميع الفرق</option>
                {Object.entries(teams).map(([id, value]) => (
                  <option key={id} value={id}>
                    {value.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 h-9 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">تاريخ الإزالة:</span>
              <input
                aria-label="تاريخ الإزالة السريعة"
                type="date"
                value={date}
                disabled={saving}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs text-foreground cursor-pointer focus:outline-none"
              />
            </div>
          </div>

          {/* شريط الإجراءات والتحكم بالتحديد */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || !visible.length}
                onClick={handleSelectAllVisible}
                className="h-8 gap-1.5 text-xs font-bold cursor-pointer hover:border-primary"
              >
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                {allVisible ? 'إلغاء تحديد المعروض' : `تحديد الكل المعروض (${visible.length})`}
              </Button>

              {selected.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setSelected(new Set())}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  مسح التحديد
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1 bg-muted/60">
                {chosen.length} محددة من إجمالي {rows.length}
              </Badge>
            </div>
          </div>

          {/* شبكة الكروت */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {!visible.length ? (
              <div className="py-20 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                <Search className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">لا توجد لوحات معلّقة تطابق خيارات البحث.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-2">
                {visible.map((row) => {
                  const isSelected = selected.has(row.id);

                  return (
                    <div
                      key={row.id}
                      onClick={() => toggle(row.id, !isSelected)}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/[0.08] shadow-lg shadow-primary/10 ring-2 ring-primary/60'
                          : 'border-border/60 bg-card hover:border-primary/50 hover:shadow-md'
                      }`}
                    >
                      {/* حاوية الصور في الجزء العلوي */}
                      <div className="relative bg-muted/30 border-b border-border/40 p-2">
                        {/* مربع التحديد الطافي */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(row.id, !isSelected);
                          }}
                          className={`absolute top-3.5 right-3.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg border-2 shadow-md backdrop-blur-md transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-primary/30 scale-105'
                              : 'border-white/80 bg-black/40 text-transparent hover:border-primary hover:bg-black/60'
                          }`}
                        >
                          <CheckCheck className={`h-4 w-4 ${isSelected ? 'stroke-[3]' : 'opacity-0'}`} />
                        </div>

                        {/* كود اللوحة الطافي */}
                        <div
                          className="absolute top-3.5 left-3.5 z-20 flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-mono font-bold text-white shadow-sm backdrop-blur-md border border-white/10"
                          dir="ltr"
                        >
                          #{row.billboard.ID || row.billboard_id}
                        </div>

                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted group/img">
                          {row.billboardImage ? <button type="button" className="h-full w-full cursor-pointer focus-visible:ring-2 focus-visible:ring-primary" aria-label={`تكبير صورة ${row.billboard.Billboard_Name || row.billboard_id}`} onClick={event => { event.stopPropagation(); setPreviewImage({ url: row.billboardImage, title: `صورة اللوحة: ${row.billboard.Billboard_Name || row.billboard_id}` }); }}>
                            <img src={row.billboardImage} alt={`صورة اللوحة ${row.billboard.Billboard_Name || row.billboard_id}`} loading="lazy" className="h-full w-full object-contain" />
                            <Maximize2 className="absolute bottom-2 left-2 h-7 w-7 rounded bg-background/90 p-1 text-foreground" />
                          </button> : <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground"><ImageIcon className="h-8 w-8 opacity-40" /><span className="text-xs">صورة اللوحة غير متوفرة</span></div>}
                        </div>
                        {row.designImage && <button type="button" className="mt-2 flex w-full items-center gap-3 rounded-lg border bg-background p-2 cursor-pointer transition-all duration-200 hover:border-primary" onClick={event => { event.stopPropagation(); setPreviewImage({ url: row.designImage, title: `تصميم عقد ${row.task.contract_id}` }); }}>
                          <img src={row.designImage} alt="تصميم الإعلان" loading="lazy" className="h-14 w-24 object-contain" /><span className="text-xs text-muted-foreground">تصميم الإعلان</span>
                        </button>}
                      </div>

                      {/* بيانات اللوحة والعقد أسفل الصورة */}
                      <div className="flex flex-col flex-1 p-3.5 gap-2 text-right bg-card">
                        {/* كود واسم اللوحة والمقاس والموقع */}
                        <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-sm text-foreground truncate" dir="ltr">
                              {row.billboard.Billboard_Name || `لوحة #${row.billboard_id}`}
                            </h4>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                              <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
                              <span className="truncate">
                                {[row.billboard.City, row.billboard.District].filter(Boolean).join(' - ') ||
                                  row.billboard.Municipality ||
                                  'الموقع غير محدد'}
                              </span>
                            </div>
                            {/* أقرب نقطة دالة */}
                            {(row.billboard.Nearest_Landmark || row.billboard.nearest_landmark || row.billboard.location_text) && (
                              <div
                                className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 truncate"
                                title={`أقرب نقطة دالة: ${row.billboard.Nearest_Landmark || row.billboard.nearest_landmark || row.billboard.location_text}`}
                              >
                                <Navigation className="h-3 w-3 shrink-0 text-amber-500" />
                                <span className="truncate">
                                  نقطة دالة: <span className="font-bold text-foreground/90">{row.billboard.Nearest_Landmark || row.billboard.nearest_landmark || row.billboard.location_text}</span>
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {(row.billboard.Level || row.billboard.Category_Level || row.billboard.level) && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              >
                                {row.billboard.Level || row.billboard.Category_Level || row.billboard.level}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5"
                            >
                              {row.billboard.Size || '—'}
                            </Badge>
                          </div>
                        </div>

                        {/* بيانات العقد والعميل ونوع الإعلان */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span
                              className="font-medium text-foreground truncate max-w-[155px]"
                              title={row.contract['Customer Name'] || row.billboard.Customer_Name || 'غير محدد'}
                            >
                              {row.contract['Customer Name'] || row.billboard.Customer_Name || 'عميل غير محدد'}
                            </span>
                            <span className="font-mono text-[11px] text-primary font-bold">
                              عقد #{row.task.contract_id}
                            </span>
                          </div>

                          {(row.contract['Ad Type'] || row.billboard.Ad_Type) && (
                            <div className="text-[11px] text-muted-foreground truncate" title={row.contract['Ad Type'] || row.billboard.Ad_Type}>
                              الإعلان: <span className="text-foreground font-medium">{row.contract['Ad Type'] || row.billboard.Ad_Type}</span>
                            </div>
                          )}
                        </div>

                        {/* فرقة الإزالة وحالة التحديد */}
                        <div className="mt-auto pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5 truncate">
                            <Users className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                            <span className="truncate font-medium">{row.teamName}</span>
                          </div>
                          {isSelected ? (
                            <span className="text-[10px] font-bold text-primary flex items-center gap-1 shrink-0">
                              <CheckCheck className="h-3 w-3" />
                              محددة للإزالة
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 shrink-0">
                              اضغط للتحديد
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* تذييل النافذة مع أزرار التأكيد والإلغاء */}
          <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="cursor-pointer text-xs h-9 px-4"
            >
              إلغاء
            </Button>
            <Button
              onClick={save}
              disabled={saving || !chosen.length || !date}
              className="cursor-pointer gap-2 text-xs font-bold h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جارٍ الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCheck className="h-4 w-4" />
                  <span>تأكيد إزالة {chosen.length} لوحة</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة معاينة الصورة مكبرة */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={(openVal) => { if (!openVal) setPreviewImage(null); }}>
          <DialogContent
            dir="rtl"
            className="max-w-4xl p-3 bg-zinc-950/95 border-zinc-800 text-white flex flex-col items-center"
          >
            <DialogHeader className="w-full px-2 pt-1 pb-2 text-right">
              <DialogTitle className="text-sm font-bold text-white flex items-center justify-between">
                <span>{previewImage.title}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="relative max-h-[75vh] w-full flex items-center justify-center p-1 overflow-hidden">
              <img
                src={previewImage.url}
                alt=""
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
