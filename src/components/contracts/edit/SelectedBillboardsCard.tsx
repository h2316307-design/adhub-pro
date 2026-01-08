import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, X, Wrench, Building2, Users, TrendingUp, Pencil, Search, Filter, Printer } from 'lucide-react';
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
}

export function SelectedBillboardsCard({
  selected,
  billboards,
  onRemoveSelected,
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
  installationEnabled = false
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

  const handleQuickEdit = async (billboard: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBillboard(billboard);
    
    const level = String(billboard.Level || billboard.level || '').trim();
    // استخدام الفئة السعرية من العقد مباشرة (الأولوية للعقد)
    const category = String(customerCategory || billboard.Category_Level || billboard.category_level || '').trim();
    const size = billboard.Size || billboard.size;
    
    setEditLevel(level);
    setEditCategory(category);
    setCurrentDurationLabel(getDurationLabel(durationMonths));
    
    // جلب السعر الحالي من جدول pricing بناءً على المدة المختارة في العقد
    if (size && category) {
      const priceColumn = getPriceColumnByDuration(durationMonths);
      
      // البحث بالمقاس والفئة أولاً، ثم بالمستوى إن وجد
      let query = supabase
        .from('pricing')
        .select('id, full_year, one_month, 3_months, 6_months, 2_months, one_day')
        .eq('size', size)
        .eq('customer_category', category);
      
      if (level) {
        query = query.eq('billboard_level', level);
      }
      
      const { data: pricingData } = await query.maybeSingle();
      
      if (pricingData) {
        setCurrentPricingId(pricingData.id);
        // جلب السعر حسب المدة المختارة
        const priceValue = (pricingData as any)[priceColumn] || pricingData.full_year || 0;
        setEditPricingPrice(String(priceValue));
      } else {
        setCurrentPricingId(null);
        setEditPricingPrice('');
      }
    } else {
      setCurrentPricingId(null);
      setEditPricingPrice('');
    }
    
    setQuickEditOpen(true);
  };

  const handleQuickEditSave = async () => {
    if (!editingBillboard) return;
    
    try {
      const size = editingBillboard.Size || editingBillboard.size;
      const priceColumn = getPriceColumnByDuration(durationMonths);
      
      // تحديث اللوحة (Category_Level و Level فقط)
      const { error: billboardError } = await supabase
        .from('billboards')
        .update({
          Category_Level: editCategory || null,
          Level: editLevel || null
        })
        .eq('ID', editingBillboard.ID);

      if (billboardError) throw billboardError;
      
      // تحديث أو إنشاء السعر في جدول pricing
      if (editPricingPrice && size && editLevel && editCategory) {
        const priceValue = Number(editPricingPrice);
        
        // البحث عن السعر الموجود
        const { data: existingPricing } = await supabase
          .from('pricing')
          .select('id')
          .eq('size', size)
          .eq('billboard_level', editLevel)
          .eq('customer_category', editCategory)
          .maybeSingle();
        
        if (existingPricing) {
          // تحديث السعر الموجود حسب المدة المختارة
          const updateData: any = {};
          updateData[priceColumn] = priceValue;
          
          await supabase
            .from('pricing')
            .update(updateData)
            .eq('id', existingPricing.id);
        } else {
          // إنشاء سعر جديد مع وضع القيمة في العمود المناسب
          const insertData: any = {
            size,
            billboard_level: editLevel,
            customer_category: editCategory,
            full_year: 0,
            one_month: 0,
            '2_months': 0,
            '3_months': 0,
            '6_months': 0,
            one_day: 0
          };
          insertData[priceColumn] = priceValue;
          
          await supabase
            .from('pricing')
            .insert(insertData);
        }
      }
      
      setQuickEditOpen(false);
      setEditingBillboard(null);
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
                  <div className="text-2xl font-bold text-primary">{sizeSummary.totalCount}</div>
                  <div className="text-xs text-muted-foreground">إجمالي اللوحات</div>
                </div>
                {/* إجمالي الوجوه */}
                <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                  <div className="text-2xl font-bold text-accent">{sizeSummary.totalFaces}</div>
                  <div className="text-xs text-muted-foreground">إجمالي الوجوه</div>
                </div>
                {/* تفاصيل كل مقاس */}
                {sizeSummary.sizes.map(([size, data]) => (
                  <div key={size} className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                    <div className="text-lg font-bold text-foreground">{data.count}</div>
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
                      <span className="font-bold text-foreground">{costsSummary.totalBaseRental.toLocaleString('ar-LY')} {currencySymbol}</span>
                    </div>
                    
                    {/* تكلفة الطباعة */}
                    {costsSummary.totalPrintCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-600 flex items-center gap-1">
                          <Printer className="h-3.5 w-3.5" />
                          إجمالي تكلفة الطباعة
                        </span>
                        <span className="font-bold text-blue-600">+ {costsSummary.totalPrintCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                      </div>
                    )}
                    
                    {/* تكلفة التركيب */}
                    {costsSummary.totalInstallCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-accent flex items-center gap-1">
                          <Wrench className="h-3.5 w-3.5" />
                          إجمالي تكلفة التركيب
                        </span>
                        <span className="font-bold text-accent">+ {costsSummary.totalInstallCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                      </div>
                    )}
                    
                    {/* الإجمالي الكلي */}
                    <div className="flex justify-between items-center text-base pt-2 border-t border-border mt-2">
                      <span className="font-bold text-primary">الإجمالي الكلي للوحات</span>
                      <span className="font-bold text-xl text-primary">{costsSummary.grandTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
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
                const baseTotalForBoard = calculateBillboardPrice(b);
                const installDetail = installationDetails.find(
                  detail => detail.billboardId === billboardId
                );
                const installPrice = installDetail?.installationPrice || 0;

                // ✅ Get print cost for this billboard
                const printCostDetail = printCostDetails.find(
                  detail => detail.billboardId === billboardId
                );
                const printCostForBillboard = printCostDetail?.printCost || 0;

                // ✅ FIXED: Add print/installation to displayed price ONLY when NOT included in price
                // When "include in price" is OFF, the cost is added separately (customer pays extra)
                let totalForBoard = baseTotalForBoard;
                if (printCostEnabled && !includePrintInPrice && printCostForBillboard > 0) {
                  totalForBoard += printCostForBillboard;
                }
                if (installationEnabled && !includeInstallationInPrice && installPrice > 0) {
                  totalForBoard += installPrice;
                }

                // ✅ حساب صافي الإيجار للوحة (بعد خصم التكاليف المضمنة في السعر)
                // صافي الإيجار = الإيجار الأساسي - تكاليف الطباعة المضمنة - تكاليف التركيب المضمنة
                const includedPrintCost = (printCostEnabled && includePrintInPrice) ? printCostForBillboard : 0;
                const includedInstallCost = (installationEnabled && includeInstallationInPrice) ? installPrice : 0;
                const netRentalForBoard = baseTotalForBoard - includedPrintCost - includedInstallCost;
                const hasIncludedCosts = includedPrintCost > 0 || includedInstallCost > 0;

                // Calculate proportional discount
                const billboardPricePercentage = totalPriceBeforeDiscount > 0
                  ? baseTotalForBoard / totalPriceBeforeDiscount
                  : 0;
                const discountPerBillboard = totalDiscount * billboardPricePercentage;
                const priceAfterDiscount = Math.max(0, totalForBoard - discountPerBillboard);

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
                          <div className="text-sm font-bold text-primary">{getDisplaySize(b)}</div>
                        </div>
                        <div className="text-center bg-muted border border-border rounded-lg py-2.5 px-1">
                          <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">الوجوه</div>
                          <div className="text-sm font-bold text-foreground">{getFacesCount(b)}</div>
                        </div>
                        <div className="text-center bg-muted border border-border rounded-lg py-2.5 px-1">
                          <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">المدينة</div>
                          <div className="text-sm font-bold text-foreground">{(b as any).city || (b as any).City || '-'}</div>
                        </div>
                        <div className="text-center bg-accent/10 border border-accent/20 rounded-lg py-2.5 px-1">
                          <div className="text-[10px] text-accent/70 mb-0.5 font-medium">المستوى</div>
                          <div className="text-sm font-bold text-accent">{(b as any).level || (b as any).Level || '-'}</div>
                        </div>
                      </div>

                      {/* Pricing Section - Using primary/accent colors */}
                      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                        {/* Base Rental */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">الإيجار الأساسي</span>
                          <span className="text-lg font-bold text-primary">{baseTotalForBoard.toLocaleString('ar-LY')} {currencySymbol}</span>
                        </div>

                        {/* Print Cost - Show when enabled and included in price (deducted from rental) */}
                        {printCostEnabled && includePrintInPrice && printCostForBillboard > 0 && (
                          <div className="flex justify-between items-center bg-orange-500/10 rounded-lg px-3 py-2 -mx-1">
                            <span className="text-sm font-medium text-orange-600 flex items-center gap-1.5">
                              <Printer className="h-3.5 w-3.5" />
                              طباعة مضمنة
                            </span>
                            <span className="text-base font-bold text-orange-600">- {printCostForBillboard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Print Cost - Show when enabled and NOT included in price */}
                        {printCostEnabled && !includePrintInPrice && printCostForBillboard > 0 && (
                          <div className="flex justify-between items-center bg-blue-500/10 rounded-lg px-3 py-2 -mx-1">
                            <span className="text-sm font-medium text-blue-600 flex items-center gap-1.5">
                              <Printer className="h-3.5 w-3.5" />
                              تكلفة الطباعة
                            </span>
                            <span className="text-base font-bold text-blue-600">+ {printCostForBillboard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Installation Cost - Show when enabled and included in price (deducted from rental) */}
                        {installationEnabled && includeInstallationInPrice && installPrice > 0 && (
                          <div className="flex justify-between items-center bg-amber-500/10 rounded-lg px-3 py-2 -mx-1">
                            <span className="text-sm font-medium text-amber-600 flex items-center gap-1.5">
                              <Wrench className="h-3.5 w-3.5" />
                              تركيب مضمن
                            </span>
                            <span className="text-base font-bold text-amber-600">- {installPrice.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Installation Cost - Show when enabled and NOT included in price */}
                        {installationEnabled && !includeInstallationInPrice && installPrice > 0 && (
                          <div className="flex justify-between items-center bg-accent/10 rounded-lg px-3 py-2 -mx-1">
                            <span className="text-sm font-medium text-accent flex items-center gap-1.5">
                              <Wrench className="h-3.5 w-3.5" />
                              تكلفة التركيب
                            </span>
                            <span className="text-base font-bold text-accent">+ {installPrice.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* ✅ صافي الإيجار - يظهر عندما تكون هناك تكاليف مضمنة */}
                        {hasIncludedCosts && (
                          <div className="flex justify-between items-center bg-green-500/10 rounded-lg px-3 py-2 -mx-1 border border-green-500/20">
                            <span className="text-sm font-bold text-green-600">صافي الإيجار</span>
                            <span className="text-lg font-bold text-green-600">{netRentalForBoard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Total with additions (if any added) */}
                        {((printCostEnabled && !includePrintInPrice && printCostForBillboard > 0) || 
                          (installationEnabled && !includeInstallationInPrice && installPrice > 0)) && (
                          <div className="flex justify-between items-center bg-primary/10 rounded-lg px-3 py-2 -mx-1 border border-primary/20">
                            <span className="text-sm font-bold text-primary">إجمالي اللوحة</span>
                            <span className="text-lg font-bold text-primary">{totalForBoard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}
                        
                        {discountPerBillboard > 0 && (
                          <>
                            {/* Discount */}
                            <div className="flex justify-between items-center bg-destructive/10 rounded-lg px-3 py-2 -mx-1">
                              <span className="text-sm font-medium text-destructive">الخصم</span>
                              <span className="text-base font-bold text-destructive">- {discountPerBillboard.toLocaleString('ar-LY')} {currencySymbol}</span>
                            </div>
                            {/* Net */}
                            <div className="flex justify-between items-center bg-primary/10 rounded-lg px-3 py-2 -mx-1">
                              <span className="text-sm font-medium text-primary">الصافي بعد الخصم</span>
                              <div className="text-left">
                                <span className="text-lg font-bold text-primary">
                                  {priceAfterDiscount.toLocaleString('ar-LY')} {currencySymbol}
                                </span>
                                <span className="text-xs text-primary/60 font-normal mr-1">
                                  /{pricingMode === 'months' ? `${durationMonths} شهر` : `${durationDays} يوم`}
                                </span>
                              </div>
                            </div>
                          </>
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
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
              <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
              <div className="space-y-1">
                {installationCostSummary.uniqueSizes.map((sizeInfo, index) => (
                  <div key={index} className="text-xs flex justify-between items-center">
                    <span>
                      <strong>مقاس {sizeInfo.size}:</strong> {sizeInfo.pricePerUnit.toLocaleString()} د.ل × {sizeInfo.count} لوحة
                    </span>
                    <span className="font-bold text-accent">
                      {sizeInfo.totalForSize.toLocaleString()} د.ل
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Edit Dialog */}
      <Dialog open={quickEditOpen} onOpenChange={setQuickEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل سريع - {editingBillboard?.name || editingBillboard?.Billboard_Name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الفئة السعرية</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفئة السعرية" />
                </SelectTrigger>
                 <SelectContent>
                   {[
                     ...(editCategory ? [editCategory] : []),
                     ...categories.filter((c) => c !== editCategory)
                   ].map((cat) => (
                     <SelectItem key={cat} value={cat}>
                       {cat}
                     </SelectItem>
                   ))}
                 </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level: any) => (
                    <SelectItem key={level.level_code} value={level.level_code}>
                      {level.level_code} - {level.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>السعر في قائمة الأسعار ({currentDurationLabel || 'سنوي'})</Label>
              <Input
                type="number"
                value={editPricingPrice}
                onChange={(e) => setEditPricingPrice(e.target.value)}
                placeholder={`السعر ${currentDurationLabel || 'السنوي'}`}
              />
              <p className="text-xs text-muted-foreground">
                سيتم تحديث سعر ({currentDurationLabel || 'سنوي'}) في جدول الأسعار للمقاس {editingBillboard?.Size || editingBillboard?.size} والمستوى {editLevel} والفئة {editCategory || 'غير محددة'}
              </p>
            </div>
            <Button onClick={handleQuickEditSave} className="w-full">
              حفظ التغييرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}