import React, { useEffect, useState, useMemo } from 'react';
import { calculateAllBillboardPrices } from '@/utils/contractBillboardPricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, X, Wrench, Building2, Users, TrendingUp, Pencil, Search, Filter, Printer, Square, CheckSquare, ArrowLeftRight, MoveRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Billboard } from '@/types';
import { BillboardImage } from '@/components/BillboardImage';

// Component to show friend company name
function FriendCompanyBadge({ billboardId, billboard }: { billboardId: string; billboard: any }) {
  const friendCompanyId = billboard.friend_company_id;
  
  const { data: friendCompany } = useQuery({
    queryKey: ['friend-company', friendCompanyId],
    queryFn: async () => {
      if (!friendCompanyId) return null;
      const { data } = await supabase
        .from('friend_companies')
        .select('name')
        .eq('id', friendCompanyId)
        .single();
      return data;
    },
    enabled: !!friendCompanyId
  });

  return (
    <Badge className="bg-amber-500/90 text-white text-[10px] px-2 py-0.5 shadow-sm max-w-[150px] truncate">
      <Building2 className="h-2.5 w-2.5 ml-1" />
      {friendCompany?.name || 'شركة صديقة'}
    </Badge>
  );
}

interface FriendBillboardCost {
  billboardId: string;
  friendCompanyId: string;
  friendCompanyName: string;
  friendRentalCost: number;
}

interface PartnershipInfo {
  billboardId: string;
  isPartnership: boolean;
  partnerCompanies: string[];
  capital: number;
  capitalRemaining: number;
  phase: 'recovery' | 'profit_sharing';
  partnerShares: Array<{
    partnerId: string;
    partnerName: string;
    preSharePct: number;
    postSharePct: number;
    estimatedShare: number;
  }>;
  companySharePct: number;
  capitalDeductionPct: number;
}

interface SelectedBillboardsCardProps {
  selected: string[];
  billboards: Billboard[];
  onRemoveSelected: (id: string) => void;
  onSwapBillboard?: (billboardId: string, billboardName: string) => void;
  onMoveBillboard?: (billboardId: string, billboardName: string) => void;
  calculateBillboardPrice: (billboard: Billboard) => number;
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>;
  pricingMode: 'months' | 'days';
  durationMonths: number;
  durationDays: number;
  currencySymbol?: string;
  sizeNames?: Map<number, string>;
  totalDiscount?: number;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  friendBillboardCosts?: FriendBillboardCost[];
  onUpdateFriendCost?: (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number) => void;
  startDate?: string;
  endDate?: string;
  partnershipOperatingFeeRate?: number;
  onPartnershipOperatingDataChange?: (data: any[]) => void;
  customerCategory?: string;
  // ✅ NEW: Level discounts
  levelDiscounts?: Record<string, number>;
  // ✅ NEW: Print cost props
  printCostDetails?: Array<{
    billboardId: string;
    printCost: number;
  }>;
  includePrintInPrice?: boolean;
  includeInstallationInPrice?: boolean;
  printCostEnabled?: boolean;
  installationEnabled?: boolean;
  // ✅ NEW: Single face billboards
  singleFaceBillboards?: Set<string>;
  onToggleSingleFace?: (billboardId: string) => void;
}

export function SelectedBillboardsCard({
  selected,
  billboards,
  onRemoveSelected,
  onSwapBillboard,
  onMoveBillboard,
  calculateBillboardPrice,
  installationDetails,
  pricingMode,
  durationMonths,
  durationDays,
  currencySymbol = 'د.ل',
  sizeNames = new Map(),
  totalDiscount = 0,
  discountType = 'percent',
  discountValue = 0,
  friendBillboardCosts = [],
  onUpdateFriendCost,
  startDate,
  endDate,
  partnershipOperatingFeeRate = 3,
  onPartnershipOperatingDataChange,
  customerCategory = '',
  // ✅ NEW: Level discounts
  levelDiscounts = {},
  // ✅ NEW: Print cost props
  printCostDetails = [],
  includePrintInPrice = true,
  includeInstallationInPrice = true,
  printCostEnabled = false,
  installationEnabled = false,
  // ✅ NEW: Single face billboards
  singleFaceBillboards = new Set(),
  onToggleSingleFace,
}: SelectedBillboardsCardProps) {
  const [partnershipInfoMap, setPartnershipInfoMap] = useState<Map<string, PartnershipInfo>>(new Map());
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<any>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editLevel, setEditLevel] = useState<string>('');
  
  // حالة البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  // جلب مستويات اللوحات
  const { data: levels = [] } = useQuery({
    queryKey: ['billboard-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_levels')
        .select('level_code, level_name')
        .order('level_code');
      if (error) throw error;
      return data || [];
    }
  });

  // جلب الفئات السعرية من جدول pricing
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['pricing-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing')
        .select('customer_category')
        .not('customer_category', 'is', null);
      if (error) throw error;

      const uniqueCategories = Array.from(
        new Set(
          (data || [])
            .map((d: any) => String(d.customer_category || '').trim())
            .filter(Boolean)
        )
      );

      return uniqueCategories.sort((a, b) => a.localeCompare(b, 'ar'));
    }
  });

  // جلب ترتيب المقاسات
  const { data: sizesOrder = [] } = useQuery({
    queryKey: ['sizes-order'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('id, name, sort_order')
        .order('sort_order');
      if (error) throw error;
      return data || [];
    }
  });

  const [editCategory, setEditCategory] = useState<string>('');
  const [editPricingPrice, setEditPricingPrice] = useState<string>('');
  const [currentPricingId, setCurrentPricingId] = useState<number | null>(null);
  const [currentDurationLabel, setCurrentDurationLabel] = useState<string>('');
  const [allDurationPrices, setAllDurationPrices] = useState<Record<string, number>>({});
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [loadingQuickPricing, setLoadingQuickPricing] = useState(false);

  // تحديد عمود السعر بناءً على المدة
  const getPriceColumnByDuration = (months: number): string => {
    if (months >= 12) return 'full_year';
    if (months >= 6) return '6_months';
    if (months >= 3) return '3_months';
    if (months >= 2) return '2_months';
    if (months >= 1) return 'one_month';
    return 'one_day';
  };

  const getDurationLabel = (months: number): string => {
    if (months >= 12) return 'سنوي';
    if (months >= 6) return '6 أشهر';
    if (months >= 3) return '3 أشهر';
    if (months >= 2) return 'شهرين';
    if (months >= 1) return 'شهر';
    return 'يومي';
  };

  const loadPricingData = async (size: string, level: string, category: string, sizeId?: number | null) => {
    setLoadingQuickPricing(true);
    try {
      let pricingResult: any = null;

      // 1) Try by size_id first (most reliable)
      if (sizeId) {
        let q = supabase
          .from('pricing')
          .select('id, full_year, one_month, 3_months, 6_months, 2_months, one_day')
          .eq('size_id', sizeId)
          .eq('customer_category', category);
        if (level) q = q.eq('billboard_level', level);
        const { data } = await q.maybeSingle();
        if (data) pricingResult = data;
      }

      // 2) Fallback: by size name
      if (!pricingResult) {
        let q = supabase
          .from('pricing')
          .select('id, full_year, one_month, 3_months, 6_months, 2_months, one_day')
          .eq('size', size)
          .eq('customer_category', category);
        if (level) q = q.eq('billboard_level', level);
        const { data } = await q.maybeSingle();
        if (data) pricingResult = data;
      }
      
      if (pricingResult) {
        setCurrentPricingId(pricingResult.id);
        setAllDurationPrices({
          one_day: pricingResult.one_day || 0,
          one_month: pricingResult.one_month || 0,
          '2_months': (pricingResult as any)['2_months'] || 0,
          '3_months': (pricingResult as any)['3_months'] || 0,
          '6_months': (pricingResult as any)['6_months'] || 0,
          full_year: pricingResult.full_year || 0,
        });
      } else {
        setCurrentPricingId(null);
        setAllDurationPrices({ one_day: 0, one_month: 0, '2_months': 0, '3_months': 0, '6_months': 0, full_year: 0 });
      }
    } catch (e) {
      console.error('Error loading pricing:', e);
    } finally {
      setLoadingQuickPricing(false);
    }
  };

  const handleQuickEdit = async (billboard: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBillboard(billboard);
    setIsQuickEditMode(false);
    
    const level = String(billboard.Level || billboard.level || '').trim();
    const category = String(customerCategory || billboard.Category_Level || billboard.category_level || '').trim();
    const size = billboard.Size || billboard.size;
    
    setEditLevel(level);
    setEditCategory(category);
    setCurrentDurationLabel(getDurationLabel(durationMonths));
    
    if (size && category) {
      const sizeId = billboard.size_id || billboard.Size_ID || null;
      await loadPricingData(size, level, category, sizeId ? Number(sizeId) : null);
    } else {
      setCurrentPricingId(null);
      setAllDurationPrices({});
    }
    
    setQuickEditOpen(true);
  };

  const handleQuickEditSave = async () => {
    if (!editingBillboard) return;
    
    try {
      const size = editingBillboard.Size || editingBillboard.size;
      const sizeId = editingBillboard.size_id || editingBillboard.Size_ID || null;
      
      // تحديث اللوحة (Category_Level و Level فقط)
      const { error: billboardError } = await supabase
        .from('billboards')
        .update({
          Category_Level: editCategory || null,
          Level: editLevel || null
        })
        .eq('ID', editingBillboard.ID);

      if (billboardError) throw billboardError;
      
      // تحديث جميع الأسعار إذا كان في وضع التعديل
      if (isQuickEditMode && size && editLevel && editCategory) {
        // Try to find existing pricing by currentPricingId first, then by size_id, then by size name
        let existingId: number | null = currentPricingId;
        
        if (!existingId && sizeId) {
          const { data } = await supabase
            .from('pricing')
            .select('id')
            .eq('size_id', Number(sizeId))
            .eq('billboard_level', editLevel)
            .eq('customer_category', editCategory)
            .maybeSingle();
          if (data) existingId = data.id;
        }
        
        if (!existingId) {
          const { data } = await supabase
            .from('pricing')
            .select('id')
            .eq('size', size)
            .eq('billboard_level', editLevel)
            .eq('customer_category', editCategory)
            .maybeSingle();
          if (data) existingId = data.id;
        }
        
        if (existingId) {
          const { error } = await supabase.from('pricing').update(allDurationPrices).eq('id', existingId);
          if (error) console.error('Error updating pricing:', error);
        } else {
          const insertData: any = {
            size,
            billboard_level: editLevel,
            customer_category: editCategory,
            ...allDurationPrices,
          };
          if (sizeId) insertData.size_id = Number(sizeId);
          const { error } = await supabase.from('pricing').insert(insertData);
          if (error) console.error('Error inserting pricing:', error);
        }
        
        // Reload prices to reflect changes without full page reload
        await loadPricingData(size, editLevel, editCategory, sizeId ? Number(sizeId) : null);
        setIsQuickEditMode(false);
        return; // Stay in dialog to show updated prices
      }
      
      setQuickEditOpen(false);
      setEditingBillboard(null);
      setIsQuickEditMode(false);
      window.location.reload();
    } catch (error) {
      console.error('Error updating billboard:', error);
    }
  };

  // Load partnership info for selected billboards
  useEffect(() => {
    const loadPartnershipInfo = async () => {
      if (selectedBillboards.length === 0) {
        setPartnershipInfoMap(new Map());
        return;
      }
      
      // Fetch partnership data directly from database for all selected billboards
      const billboardIds = selectedBillboards.map(b => (b as any).ID);
      
      const { data: dbBillboards } = await supabase
        .from('billboards')
        .select('"ID", is_partnership, partner_companies, capital, capital_remaining')
        .in('ID', billboardIds);
      
      // Create a map of partnership data from DB
      const dbPartnershipMap = new Map<number, any>();
      if (dbBillboards) {
        dbBillboards.forEach(db => {
          if (db.is_partnership) {
            dbPartnershipMap.set(db.ID, db);
          }
        });
      }
      
      console.log('🔍 Partnership data from DB:', {
        total: selectedBillboards.length,
        partnershipFromDB: dbPartnershipMap.size,
        data: Array.from(dbPartnershipMap.entries())
      });
      
      if (dbPartnershipMap.size === 0) {
        setPartnershipInfoMap(new Map());
        return;
      }
      
      const newMap = new Map<string, PartnershipInfo>();
      
      // Process each partnership billboard from DB data
      for (const [dbId, dbData] of dbPartnershipMap.entries()) {
        const bb = selectedBillboards.find(b => (b as any).ID === dbId);
        if (!bb) continue;
        
        const billboardId = String(dbId);
        const capital = Number(dbData.capital || 0);
        const capitalRemaining = Number(dbData.capital_remaining ?? capital);
        const phase = capitalRemaining <= 0 ? 'profit_sharing' : 'recovery';
        const partnerCompanies = dbData.partner_companies || [];
        
        // Fetch partnership terms from shared_billboards
        const { data: terms } = await supabase
          .from('shared_billboards')
          .select(`
            partner_company_id,
            partner_pre_pct,
            partner_post_pct,
            pre_company_pct,
            pre_capital_pct,
            post_company_pct,
            partners:partner_company_id(id, name)
          `)
          .eq('billboard_id', dbId);
        
        const billboardPrice = calculateBillboardPrice(bb);
        const partnerShares: PartnershipInfo['partnerShares'] = [];
        
        // Default percentages
        let companySharePct = phase === 'recovery' ? 35 : 50;
        let capitalDeductionPct = phase === 'recovery' ? 30 : 0;
        
        if (terms && terms.length > 0) {
          companySharePct = phase === 'recovery' 
            ? Number(terms[0].pre_company_pct || 35) 
            : Number(terms[0].post_company_pct || 50);
          capitalDeductionPct = phase === 'recovery' 
            ? Number(terms[0].pre_capital_pct || 30) 
            : 0;
          
          for (const term of terms) {
            const sharePct = phase === 'recovery' 
              ? Number(term.partner_pre_pct || 35) 
              : Number(term.partner_post_pct || 50);
            const estimatedShare = billboardPrice * (sharePct / 100);
            
            partnerShares.push({
              partnerId: term.partner_company_id,
              partnerName: (term as any).partners?.name || 'شريك',
              preSharePct: Number(term.partner_pre_pct || 35),
              postSharePct: Number(term.partner_post_pct || 50),
              estimatedShare
            });
          }
        } else if (partnerCompanies.length > 0) {
          // Fallback: use partner_companies array from billboard if no shared_billboards data
          const defaultSharePct = phase === 'recovery' ? 35 : 50;
          const sharePerPartner = defaultSharePct / partnerCompanies.length;
          
          partnerCompanies.forEach((partnerName: string) => {
            const estimatedShare = billboardPrice * (sharePerPartner / 100);
            partnerShares.push({
              partnerId: partnerName,
              partnerName: partnerName,
              preSharePct: sharePerPartner,
              postSharePct: sharePerPartner,
              estimatedShare
            });
          });
        }
        
        // Always add to map if it's a partnership billboard
        newMap.set(billboardId, {
          billboardId,
          isPartnership: true,
          partnerCompanies,
          capital,
          capitalRemaining,
          phase,
          partnerShares,
          companySharePct,
          capitalDeductionPct
        });
      }
      
      setPartnershipInfoMap(newMap);
    };
    
    loadPartnershipInfo();
  }, [selected, billboards, calculateBillboardPrice, pricingMode, durationMonths, durationDays]);
  
  // ✅ NEW: Helper to get display size name
  const getDisplaySize = (billboard: any): string => {
    const sizeId = billboard.size_id || billboard.Size_ID;
    if (sizeId && sizeNames.has(sizeId)) {
      return sizeNames.get(sizeId) || billboard.size || billboard.Size || 'غير محدد';
    }
    return billboard.size || billboard.Size || 'غير محدد';
  };
  
  // ترتيب اللوحات حسب sort_order من جدول sizes
  const getSortOrder = (billboard: any): number => {
    const size = billboard.Size || billboard.size;
    const sizeId = billboard.size_id;
    
    // أولاً نحاول البحث بالـ id
    if (sizeId) {
      const found = sizesOrder.find(s => s.id === sizeId);
      if (found) return found.sort_order || 999;
    }
    
    // ثم نحاول البحث بالاسم
    if (size) {
      const found = sizesOrder.find(s => s.name === size);
      if (found) return found.sort_order || 999;
    }
    
    return 999;
  };
  
  const selectedBillboards = billboards
    .filter((b) => selected.includes(String((b as any).ID)))
    .sort((a, b) => getSortOrder(a) - getSortOrder(b));

  const getFacesCount = (b: any): number => {
    const raw = (b as any).Faces_Count ?? (b as any).faces_count ?? 1;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  // الحصول على المقاسات والمدن الفريدة للفلترة
  const uniqueSizesForFilter = useMemo(() => {
    const sizes = new Set<string>();
    selectedBillboards.forEach((b) => {
      const size = getDisplaySize(b);
      if (size && size !== 'غير محدد') sizes.add(size);
    });
    return Array.from(sizes);
  }, [selectedBillboards]);

  const uniqueCitiesForFilter = useMemo(() => {
    const cities = new Set<string>();
    selectedBillboards.forEach((b) => {
      const city = (b as any).city || (b as any).City;
      if (city) cities.add(city);
    });
    return Array.from(cities);
  }, [selectedBillboards]);

  // تطبيق البحث والفلترة على اللوحات
  const filteredSelectedBillboards = useMemo(() => {
    return selectedBillboards.filter((b) => {
      const name = String((b as any).name || (b as any).Billboard_Name || '').toLowerCase();
      const landmark = String((b as any).location || (b as any).Nearest_Landmark || '').toLowerCase();
      const city = (b as any).city || (b as any).City || '';
      const size = getDisplaySize(b);

      const matchesSearch = !searchQuery ||
        name.includes(searchQuery.toLowerCase()) ||
        landmark.includes(searchQuery.toLowerCase());
      const matchesSize = sizeFilter === 'all' || size === sizeFilter;
      const matchesCity = cityFilter === 'all' || city === cityFilter;

      return matchesSearch && matchesSize && matchesCity;
    });
  }, [selectedBillboards, searchQuery, sizeFilter, cityFilter]);

  // ✅ مصدر تسعير موحد للكروت: نفس منطق الحفظ تمامًا
  const pricingByBillboardId = useMemo(() => {
    const pricingResults = calculateAllBillboardPrices(
      selectedBillboards.map((bb) => {
        const id = String((bb as any).ID);
        const installRaw = installationDetails.find((d) => d.billboardId === id)?.installationPrice || 0;
        const printRaw = printCostDetails.find((d) => d.billboardId === id)?.printCost || 0;

        return {
          billboardId: id,
          baseRentalPrice: calculateBillboardPrice(bb),
          installationPrice: installRaw,
          printCost: printRaw,
          isSingleFace: singleFaceBillboards.has(id),
        };
      }),
      {
        totalDiscount,
        printCostEnabled,
        includePrintInPrice,
        installationEnabled,
        includeInstallationInPrice,
      }
    );

    return new Map(pricingResults.map((r) => [r.billboardId, r]));
  }, [
    selectedBillboards,
    installationDetails,
    printCostDetails,
    calculateBillboardPrice,
    singleFaceBillboards,
    totalDiscount,
    printCostEnabled,
    includePrintInPrice,
    installationEnabled,
    includeInstallationInPrice,
  ]);

  // ملخص المقاسات والوجوه
  const sizeSummary = React.useMemo(() => {
    const sizeMap = new Map<string, { count: number; faces: number }>();
    let totalFaces = 0;

    selectedBillboards.forEach((b) => {
      const size = getDisplaySize(b);
      const faces = getFacesCount(b);
      totalFaces += faces;

      if (sizeMap.has(size)) {
        const current = sizeMap.get(size)!;
        sizeMap.set(size, { count: current.count + 1, faces: current.faces + faces });
      } else {
        sizeMap.set(size, { count: 1, faces });
      }
    });
    
    // ترتيب حسب sort_order
    const sortedSizes = Array.from(sizeMap.entries()).sort((a, b) => {
      const orderA = sizesOrder.find(s => s.name === a[0])?.sort_order || 999;
      const orderB = sizesOrder.find(s => s.name === b[0])?.sort_order || 999;
      return orderA - orderB;
    });
    
    return { sizes: sortedSizes, totalFaces, totalCount: selectedBillboards.length };
  }, [selectedBillboards, sizesOrder]);

  // ✅ Calculate total price of all billboards before discount
  const totalPriceBeforeDiscount = React.useMemo(() => {
    return selectedBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
  }, [selectedBillboards, calculateBillboardPrice, pricingMode, durationMonths, durationDays]);

  // ✅ NEW: Calculate installation cost summary with unique sizes display
  const installationCostSummary = React.useMemo(() => {
    if (installationDetails.length === 0) return null;

    const totalInstallationCost = installationDetails.reduce((sum, detail) => sum + detail.installationPrice, 0);
    
    // Group by size and show unique prices without repetition
    const uniqueSizes = Array.from(new Map(installationDetails.map(detail => [detail.size, detail])).values());
    
    return {
      totalInstallationCost,
      uniqueSizes: uniqueSizes.map(detail => {
        const sizeCount = installationDetails.filter(d => d.size === detail.size).length;
        const totalForSize = detail.installationPrice * sizeCount;
        return {
          size: detail.size,
          pricePerUnit: detail.installationPrice,
          count: sizeCount,
          totalForSize
        };
      })
    };
  }, [installationDetails]);

  // ✅ NEW: Calculate total costs summary
  const costsSummary = React.useMemo(() => {
    const totalBaseRental = selectedBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
    
    const totalPrintCost = printCostEnabled && !includePrintInPrice 
      ? printCostDetails.reduce((sum, d) => sum + d.printCost, 0)
      : 0;
    
    const totalInstallCost = installationEnabled && !includeInstallationInPrice
      ? installationDetails.reduce((sum, d) => sum + d.installationPrice, 0)
      : 0;
    
    const grandTotal = totalBaseRental + totalPrintCost + totalInstallCost;
    
    return {
      totalBaseRental,
      totalPrintCost,
      totalInstallCost,
      grandTotal,
      hasCosts: totalPrintCost > 0 || totalInstallCost > 0
    };
  }, [selectedBillboards, calculateBillboardPrice, printCostDetails, installationDetails, printCostEnabled, includePrintInPrice, installationEnabled, includeInstallationInPrice]);

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        {/* Header */}
        <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border">
          <CardTitle className="flex items-center justify-between text-card-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">اللوحات المرتبطة ({selected.length})</span>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* ملخص المقاسات والوجوه */}
          {selected.length > 0 && (
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-bold text-foreground">ملخص اللوحات</h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                {/* إجمالي اللوحات */}
                <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                  <div className="text-2xl font-bold text-primary font-manrope">{sizeSummary.totalCount}</div>
                  <div className="text-xs text-muted-foreground">إجمالي اللوحات</div>
                </div>
                {/* إجمالي الوجوه */}
                <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                  <div className="text-2xl font-bold text-accent font-manrope">{sizeSummary.totalFaces}</div>
                  <div className="text-xs text-muted-foreground">إجمالي الوجوه</div>
                </div>
                {/* تفاصيل كل مقاس */}
                {sizeSummary.sizes.map(([size, data]) => (
                  <div key={size} className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                    <div className="text-lg font-bold text-foreground font-manrope">{data.count}</div>
                    <div className="text-xs text-muted-foreground">{size}</div>
                    <div className="text-[10px] text-primary/70">{data.faces} وجه</div>
                  </div>
                ))}
              </div>

              {/* ✅ ملخص إجمالي التكاليف */}
              {costsSummary.hasCosts && (
                <div className="bg-background/80 backdrop-blur rounded-lg p-4 border border-border mt-4">
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    تفاصيل الحساب الكاملة
                  </h4>
                  <div className="space-y-2">
                    {/* الإيجار الأساسي */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">إجمالي الإيجار الأساسي</span>
                      <span className="font-bold text-foreground font-manrope">{costsSummary.totalBaseRental.toLocaleString('ar-LY')} {currencySymbol}</span>
                    </div>
                    
                    {/* تكلفة الطباعة */}
                    {costsSummary.totalPrintCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-600 flex items-center gap-1">
                          <Printer className="h-3.5 w-3.5" />
                          إجمالي تكلفة الطباعة
                        </span>
                        <span className="font-bold text-blue-600 font-manrope">+ {costsSummary.totalPrintCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                      </div>
                    )}
                    
                    {/* تكلفة التركيب */}
                    {costsSummary.totalInstallCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-accent flex items-center gap-1">
                          <Wrench className="h-3.5 w-3.5" />
                          إجمالي تكلفة التركيب
                        </span>
                        <span className="font-bold text-accent font-manrope">+ {costsSummary.totalInstallCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                      </div>
                    )}
                    
                    {/* الإجمالي الكلي */}
                    <div className="flex justify-between items-center text-base pt-2 border-t border-border mt-2">
                      <span className="font-bold text-primary">الإجمالي الكلي للوحات</span>
                      <span className="font-bold text-xl text-primary font-manrope">{costsSummary.grandTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* شريط البحث والفلترة */}
          {selected.length > 3 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>بحث وفلترة اللوحات</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو الموقع..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 h-9 bg-background"
                  />
                </div>
                {uniqueSizesForFilter.length > 1 && (
                  <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger className="w-[140px] h-9 bg-background">
                      <SelectValue placeholder="المقاس" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المقاسات</SelectItem>
                      {uniqueSizesForFilter.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {uniqueCitiesForFilter.length > 1 && (
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-[140px] h-9 bg-background">
                      <SelectValue placeholder="المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المدن</SelectItem>
                      {uniqueCitiesForFilter.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* عداد النتائج */}
              {(searchQuery || sizeFilter !== 'all' || cityFilter !== 'all') && (
                <div className="text-xs text-muted-foreground">
                  عرض {filteredSelectedBillboards.length} من {selectedBillboards.length} لوحة
                </div>
              )}
            </div>
          )}

          {selected.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">لا توجد لوحات</p>
          ) : filteredSelectedBillboards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">لا توجد نتائج للبحث</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSelectedBillboards.map((b) => {
                const billboardId = String((b as any).ID);
                const isSingleFace = singleFaceBillboards.has(billboardId);
                const pricingData = pricingByBillboardId.get(billboardId);

                // Fallback بسيط في حال عدم وجود بيانات (لا يُفترض أن يحدث)
                const fallbackInstallRaw = installationDetails.find((d) => d.billboardId === billboardId)?.installationPrice || 0;
                const fallbackPrintRaw = printCostDetails.find((d) => d.billboardId === billboardId)?.printCost || 0;
                const fallbackInstall = isSingleFace ? Math.round(fallbackInstallRaw / 2) : fallbackInstallRaw;
                const fallbackPrint = isSingleFace ? Math.round(fallbackPrintRaw / 2) : fallbackPrintRaw;

                const baseTotalForBoard = pricingData?.baseRentalPrice ?? calculateBillboardPrice(b);
                const installPrice = pricingData?.installationPrice ?? fallbackInstall;
                const printCostForBillboard = pricingData?.printCost ?? fallbackPrint;
                const includedPrintCost = pricingData?.includedPrintCost ?? ((printCostEnabled && includePrintInPrice) ? printCostForBillboard : 0);
                const includedInstallCost = pricingData?.includedInstallCost ?? ((installationEnabled && includeInstallationInPrice) ? installPrice : 0);
                const netRentalBeforeDiscount = pricingData?.netRentalBeforeDiscount ?? (baseTotalForBoard - includedPrintCost - includedInstallCost);
                const discountPerBillboard = pricingData?.discountPerBillboard ?? 0;
                const netRentalAfterDiscount = pricingData?.netRentalAfterDiscount ?? Math.max(0, netRentalBeforeDiscount - discountPerBillboard);
                const extraPrintCost = pricingData?.extraPrintCost ?? ((printCostEnabled && !includePrintInPrice) ? printCostForBillboard : 0);
                const extraInstallCost = pricingData?.extraInstallCost ?? ((installationEnabled && !includeInstallationInPrice) ? installPrice : 0);
                const totalForBoard = pricingData?.totalForBoard ?? (netRentalAfterDiscount + includedInstallCost + includedPrintCost + extraInstallCost + extraPrintCost);
                const hasIncludedCosts = includedPrintCost > 0 || includedInstallCost > 0;

                // للتوافق مع الكود القديم
                const priceAfterDiscount = totalForBoard;

                // Friend company check
                const isFriendBillboard = (b as any).friend_company_id;
                const friendCost = friendBillboardCosts.find(f => f.billboardId === billboardId);

                // Partnership check
                const partnershipInfo = partnershipInfoMap.get(billboardId);
                const isPartnership = !!partnershipInfo;


                return (
                  <div 
                    key={(b as any).ID} 
                    className="group relative bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    {/* Action Buttons - Top Left */}
                    <div className="absolute top-2 left-2 z-10 flex gap-1">
                      <button
                        onClick={(e) => handleQuickEdit(b, e)}
                        className="w-7 h-7 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                        title="تعديل السعر والمستوى"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {onToggleSingleFace && (
                        <button
                          onClick={() => onToggleSingleFace(billboardId)}
                          className={`w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors shadow-sm ${
                            isSingleFace 
                              ? 'bg-amber-500 text-white hover:bg-amber-600' 
                              : 'bg-background/90 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100'
                          }`}
                          title={isSingleFace ? 'وجه واحد (انقر للتغيير لوجهين)' : 'وجهان (انقر للتغيير لوجه واحد)'}
                        >
                          <span className="text-[9px] font-bold leading-none">{isSingleFace ? '١' : '٢'}</span>
                        </button>
                      )}
                      {onSwapBillboard && (
                        <button
                          onClick={() => onSwapBillboard(billboardId, (b as any).Billboard_Name || (b as any).name || `لوحة ${billboardId}`)}
                          className="w-7 h-7 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                          title="تبديل مع لوحة أخرى"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onMoveBillboard && (
                        <button
                          onClick={() => onMoveBillboard(billboardId, (b as any).Billboard_Name || (b as any).name || `لوحة ${billboardId}`)}
                          className="w-7 h-7 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                          title="نقل إلى عقد آخر"
                        >
                          <MoveRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveSelected(billboardId)}
                        className="w-7 h-7 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-sm"
                        title="إزالة"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Badges - Top Right */}
                    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                      {isPartnership && (
                        <Badge className="bg-primary/90 text-primary-foreground text-[10px] px-2 py-0.5 shadow-sm">
                          <Users className="h-2.5 w-2.5 ml-1" />
                          مشتركة
                        </Badge>
                      )}
                      {isPartnership && partnershipInfo && partnershipInfo.partnerShares.length > 0 && (
                        <Badge className="bg-purple-500/90 text-white text-[10px] px-2 py-0.5 shadow-sm max-w-[150px] truncate">
                          {partnershipInfo.partnerShares.map(ps => ps.partnerName).join(' • ')}
                        </Badge>
                      )}
                      {isFriendBillboard && (
                        <FriendCompanyBadge billboardId={billboardId} billboard={b} />
                      )}
                      {isSingleFace && (
                        <Badge className="bg-amber-500/90 text-white text-[10px] px-2 py-0.5 shadow-sm">
                          وجه واحد
                        </Badge>
                      )}
                    </div>

                    {/* Image Section */}
                    <div className="relative h-40 bg-muted">
                      <BillboardImage
                        billboard={b}
                        className="w-full h-full object-cover"
                        alt={(b as any).name || (b as any).Billboard_Name || 'لوحة'}
                      />
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      {/* Billboard Code on Image */}
                      <div className="absolute bottom-3 right-3 text-white">
                        <h4 className="text-lg font-bold drop-shadow-lg">
                          {(b as any).name || (b as any).Billboard_Name}
                        </h4>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-4 space-y-4">
                      {/* Location */}
                      <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                        {(b as any).location || (b as any).Nearest_Landmark || 'لا يوجد موقع'}
                      </p>

                      {/* Details Grid - Using site identity colors */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center bg-primary/10 border border-primary/20 rounded-lg py-2.5 px-1">
                          <div className="text-[10px] text-primary/70 mb-0.5 font-medium">الحجم</div>
                          <div className="text-sm font-bold text-primary font-manrope">{getDisplaySize(b)}</div>
                        </div>
                        <div className="text-center bg-muted border border-border rounded-lg py-2.5 px-1">
                          <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">الوجوه</div>
                          <div className="text-sm font-bold text-foreground font-manrope">{getFacesCount(b)}</div>
                        </div>
                        <div className="text-center bg-muted border border-border rounded-lg py-2.5 px-1">
                          <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">المدينة</div>
                          <div className="text-sm font-bold text-foreground">{(b as any).city || (b as any).City || '-'}</div>
                        </div>
                        <div className="text-center bg-primary/10 border border-primary/30 rounded-lg py-2.5 px-1">
                          <div className="text-[10px] text-primary/80 mb-0.5 font-medium">المستوى</div>
                          <div className="text-sm font-bold text-primary">{(b as any).level || (b as any).Level || '-'}</div>
                        </div>
                      </div>

                      {/* Single Face Toggle Button - Always visible */}
                      {onToggleSingleFace && (
                        <button
                          onClick={() => onToggleSingleFace(billboardId)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${
                            isSingleFace
                              ? 'bg-amber-500/15 border-amber-500 text-amber-600'
                              : 'bg-muted/50 border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600 hover:bg-amber-500/5'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                              isSingleFace ? 'bg-amber-500 border-amber-500 text-white' : 'border-border text-muted-foreground'
                            }`}>
                              {isSingleFace ? '١' : '٢'}
                            </span>
                            عدد الوجوه
                          </span>
                          <span className="text-xs">
                            {isSingleFace ? '⚡ وجه واحد (طباعة وتركيب ×٥٠٪)' : 'انقر لتغيير إلى وجه واحد'}
                          </span>
                        </button>
                      )}

                      {/* Pricing Section */}
                      <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
                        {/* Base Rental */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">الإيجار الأساسي</span>
                          <span className="text-lg font-bold text-primary font-manrope">{baseTotalForBoard.toLocaleString('ar-LY')} {currencySymbol}</span>
                        </div>

                        {/* Print Cost - included in price */}
                        {printCostEnabled && includePrintInPrice && printCostForBillboard > 0 && (
                          <div className="flex justify-between items-center bg-orange-500/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-orange-600 flex items-center gap-1.5">
                              <Printer className="h-3 w-3" />
                              طباعة مضمنة
                            </span>
                            <span className="text-sm font-bold text-orange-600 font-manrope">- {printCostForBillboard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Print Cost - NOT included in price */}
                        {printCostEnabled && !includePrintInPrice && printCostForBillboard > 0 && (
                          <div className="flex justify-between items-center bg-blue-500/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                              <Printer className="h-3 w-3" />
                              تكلفة الطباعة
                            </span>
                            <span className="text-sm font-bold text-blue-600 font-manrope">+ {printCostForBillboard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Installation Cost - included in price */}
                        {installationEnabled && includeInstallationInPrice && installPrice > 0 && (
                          <div className="flex justify-between items-center bg-amber-500/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                              <Wrench className="h-3 w-3" />
                              تركيب مضمن
                            </span>
                            <span className="text-sm font-bold text-amber-600 font-manrope">- {installPrice.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Installation Cost - NOT included in price */}
                        {installationEnabled && !includeInstallationInPrice && installPrice > 0 && (
                          <div className="flex justify-between items-center bg-accent/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-accent flex items-center gap-1.5">
                              <Wrench className="h-3 w-3" />
                              تكلفة التركيب
                            </span>
                            <span className="text-sm font-bold text-accent font-manrope">+ {installPrice.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* صافي الإيجار قبل الخصم */}
                        {hasIncludedCosts && (
                          <div className="flex justify-between items-center bg-emerald-500/10 rounded-lg px-3 py-2 -mx-1 border border-emerald-500/20">
                            <span className="text-xs font-bold text-emerald-600">صافي الإيجار</span>
                            <span className="text-base font-bold text-emerald-600 font-manrope">{netRentalBeforeDiscount.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Discount */}
                        {discountPerBillboard > 0 && (
                          <div className="flex justify-between items-center bg-destructive/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-destructive">الخصم</span>
                            <span className="text-sm font-bold text-destructive font-manrope">- {Math.round(discountPerBillboard).toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Net after discount */}
                        {discountPerBillboard > 0 && (
                          <div className="flex justify-between items-center bg-green-500/10 rounded-lg px-3 py-2 -mx-1 border border-green-500/20">
                            <span className="text-xs font-bold text-green-600">بعد الخصم</span>
                            <span className="text-base font-bold text-green-600 font-manrope">{Math.round(netRentalAfterDiscount).toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* الإجمالي النهائي - always show when there are extra costs or discount */}
                        {(discountPerBillboard > 0 || extraInstallCost > 0 || extraPrintCost > 0) && (
                          <div className="flex justify-between items-center bg-primary/10 rounded-lg px-3 py-2.5 -mx-1 border border-primary/30 mt-1">
                            <span className="text-sm font-bold text-primary">الإجمالي النهائي</span>
                            <div className="text-left">
                              <span className="text-lg font-bold text-primary font-manrope">
                                {Math.round(totalForBoard).toLocaleString('ar-LY')} {currencySymbol}
                              </span>
                              <span className="text-[10px] text-primary/60 font-normal mr-1">
                                /{pricingMode === 'months' ? `${durationMonths} شهر` : `${durationDays} يوم`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Friend cost input - Using site identity colors */}
                      {isFriendBillboard && onUpdateFriendCost && (
                        <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-foreground">لوحة صديقة</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">صافي الايجار بعد التركيب:</label>
                            <Input
                              type="number"
                              value={friendCost?.friendRentalCost || 0}
                              onChange={(e) => {
                                const cost = Number(e.target.value) || 0;
                                onUpdateFriendCost(billboardId, (b as any).friend_company_id, (b as any).friend_companies?.name || 'غير محدد', cost);
                              }}
                              className="h-9 text-base bg-background border-border flex-1 font-bold"
                            />
                          </div>
                          {friendCost && friendCost.friendRentalCost > 0 && (
                            <div className="flex justify-between items-center bg-primary/20 rounded-lg px-4 py-3 border border-primary/30">
                              <span className="text-sm font-bold text-primary">الربح المتوقع</span>
                              <span className="text-xl font-bold text-primary">
                                {(priceAfterDiscount - friendCost.friendRentalCost).toLocaleString('ar-LY')} {currencySymbol}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Partnership Info - Using site identity colors */}
                      {isPartnership && partnershipInfo && (
                        <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold text-foreground">لوحة مشتركة</span>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                              partnershipInfo.phase === 'profit_sharing' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-accent/20 text-accent'
                            }`}>
                              {partnershipInfo.phase === 'profit_sharing' ? 'مرحلة الأرباح' : 'مرحلة الاسترداد'}
                            </span>
                          </div>
                          
                          {/* Capital Info */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted border border-border rounded-lg px-3 py-2.5">
                              <div className="text-[10px] text-muted-foreground mb-0.5">رأس المال</div>
                              <div className="text-base font-bold text-foreground">{partnershipInfo.capital.toLocaleString()} {currencySymbol}</div>
                            </div>
                            <div className={`rounded-lg px-3 py-2.5 ${
                              partnershipInfo.capitalRemaining <= 0 
                                ? 'bg-primary/10 border border-primary/20' 
                                : 'bg-accent/10 border border-accent/20'
                            }`}>
                              <div className={`text-[10px] mb-0.5 ${partnershipInfo.capitalRemaining <= 0 ? 'text-primary' : 'text-accent'}`}>المتبقي</div>
                              <div className={`text-base font-bold ${partnershipInfo.capitalRemaining <= 0 ? 'text-primary' : 'text-accent'}`}>
                                {partnershipInfo.capitalRemaining.toLocaleString()} {currencySymbol}
                              </div>
                            </div>
                          </div>
                          
                          {/* Partner Shares */}
                          {partnershipInfo.partnerShares.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">حصص الشركاء:</div>
                              <div className="grid gap-2">
                                {partnershipInfo.partnerShares.map((ps, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-muted rounded-lg px-3 py-2 border border-border">
                                    <span className="text-sm text-foreground">{ps.partnerName}</span>
                                    <span className="text-base font-bold text-primary">{ps.estimatedShare.toLocaleString()} {currencySymbol}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Company Share */}
                          <div className="flex justify-between items-center bg-primary/20 rounded-lg px-4 py-3 border border-primary/30">
                            <span className="text-sm font-bold text-primary">حصة الشركة</span>
                            <span className="text-xl font-bold text-primary">
                              {(priceAfterDiscount * (partnershipInfo.companySharePct / 100)).toLocaleString()} {currencySymbol}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ NEW: Installation Cost Summary with unique sizes display */}
      {installationCostSummary && installationCostSummary.totalInstallationCost > 0 && (
        <Card className="bg-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Wrench className="h-5 w-5 text-accent" />
              ملخص تكلفة التركيب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">إجمالي تكلفة التركيب</label>
                <div className="px-4 py-3 rounded bg-accent/10 text-accent font-bold text-lg">
                  {installationCostSummary.totalInstallationCost.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">عدد اللوحات</label>
                <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold text-lg">
                  {selected.length} لوحة
                </div>
              </div>
            </div>

            {/* ✅ NEW: Display unique installation costs by size without repetition */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded" dir="rtl">
              <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
              <div className="space-y-1.5">
                {installationCostSummary.uniqueSizes.map((sizeInfo, index) => (
                  <div key={index} className="text-xs flex items-center justify-between gap-2">
                    <span>
                      <strong>مقاس {sizeInfo.size}:</strong>{' '}
                      <span dir="ltr" className="inline-block">{sizeInfo.pricePerUnit.toLocaleString('en-US')}</span> د.ل × {sizeInfo.count} لوحة
                    </span>
                    <span className="font-bold text-accent whitespace-nowrap" dir="ltr">
                      {sizeInfo.totalForSize.toLocaleString('en-US')} د.ل
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Edit Dialog - عرض جميع الأسعار */}
      <Dialog open={quickEditOpen} onOpenChange={(open) => { setQuickEditOpen(open); if (!open) setIsQuickEditMode(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>الأسعار والمستوى - {editingBillboard?.name || editingBillboard?.Billboard_Name}</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {editingBillboard?.Size && <Badge variant="secondary" className="text-xs font-bold">{editingBillboard.Size}</Badge>}
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary">الفئة: {editCategory || 'غير محددة'}</Badge>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 font-bold">المستوى: {editLevel}</Badge>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* تغيير المستوى */}
            <div className="space-y-2">
              <Label className="text-sm">المستوى</Label>
              <Select value={editLevel} onValueChange={(v) => {
                setEditLevel(v);
                const size = editingBillboard?.Size || editingBillboard?.size;
                const sizeId = editingBillboard?.size_id || editingBillboard?.Size_ID || null;
                if (size && editCategory) loadPricingData(size, v, editCategory, sizeId ? Number(sizeId) : null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {levels.map((level: any) => (
                    <SelectItem key={level.level_code} value={level.level_code}>
                      {level.level_code} - {level.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* عرض أسعار جميع الفترات */}
            {loadingQuickPricing ? (
              <div className="text-center py-4 text-muted-foreground text-sm">جاري تحميل الأسعار...</div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  أسعار المقاس {editingBillboard?.Size} - المستوى {editLevel} - الفئة: {editCategory}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'one_day', label: 'يوم واحد' },
                    { key: 'one_month', label: 'شهر' },
                    { key: '2_months', label: 'شهرين' },
                    { key: '3_months', label: '3 أشهر' },
                    { key: '6_months', label: '6 أشهر' },
                    { key: 'full_year', label: 'سنة' },
                  ].map(({ key, label }) => (
                    <div key={key} className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                      <span className="text-xs text-muted-foreground block mb-1.5">{label}</span>
                      {isQuickEditMode ? (
                        <Input
                          type="number"
                          min="0"
                          value={allDurationPrices[key] || ''}
                          onChange={(e) => setAllDurationPrices(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                          className="h-10 text-center text-base font-mono font-bold"
                          placeholder="0"
                        />
                      ) : (
                        <span className="font-bold text-foreground text-base font-mono">
                          {allDurationPrices[key] ? Number(allDurationPrices[key]).toLocaleString() : '-'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* أزرار الإجراءات */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setQuickEditOpen(false)} className="flex-1">إغلاق</Button>
              {!isQuickEditMode ? (
                <Button variant="secondary" onClick={() => setIsQuickEditMode(true)} className="flex-1">
                  تعديل الأسعار
                </Button>
              ) : (
                <Button onClick={handleQuickEditSave} className="flex-1">
                  حفظ التغييرات
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}