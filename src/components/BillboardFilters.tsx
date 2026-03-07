import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import MultiSelect from '@/components/ui/multi-select';
import { 
  Filter, Search, LayoutGrid, MapPin, Maximize2, Building2, Megaphone, Users, FileText, X, 
  ChevronDown, ChevronUp, Sparkles, SlidersHorizontal, Check, RotateCcw,
  CircleCheck, Clock, Ban, Wrench, EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BillboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (statuses: string[]) => void;
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
  selectedSizes: string[];
  setSelectedSizes: (sizes: string[]) => void;
  selectedMunicipalities: string[];
  setSelectedMunicipalities: (municipalities: string[]) => void;
  selectedDistricts: string[];
  setSelectedDistricts: (districts: string[]) => void;
  selectedAdTypes: string[];
  setSelectedAdTypes: (adTypes: string[]) => void;
  selectedCustomers: string[];
  setSelectedCustomers: (customers: string[]) => void;
  selectedContractNumbers: string[];
  setSelectedContractNumbers: (contractNumbers: string[]) => void;
  cities: string[];
  billboardSizes: string[];
  billboardMunicipalities: string[];
  billboardDistricts?: string[];
  uniqueAdTypes: string[];
  uniqueCustomers: string[];
  uniqueContractNumbers: string[];
}

// ✅ مكون فلتر مخصص مع تصميم محسن
interface FilterChipProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  count?: number;
  onClick: () => void;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const FilterChip: React.FC<FilterChipProps> = ({ label, icon, isActive, count, onClick, color = 'default' }) => {
  const colorClasses = {
    default: isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground',
    success: isActive ? 'bg-green-500 text-white shadow-lg shadow-green-500/25' : 'bg-green-500/10 hover:bg-green-500/20 text-green-600',
    warning: isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600',
    danger: isActive ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' : 'bg-red-500/10 hover:bg-red-500/20 text-red-600',
    info: isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
        "border border-transparent hover:scale-[1.02] active:scale-[0.98]",
        colorClasses[color]
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className={cn(
          "h-5 min-w-5 px-1.5 text-xs rounded-full",
          isActive ? "bg-white/20 text-inherit" : "bg-foreground/10"
        )}>
          {count}
        </Badge>
      )}
    </button>
  );
};

// ✅ مكون حالة سريعة
interface QuickStatusProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

const QuickStatus: React.FC<QuickStatusProps> = ({ label, icon, isActive, onClick, variant }) => {
  const variants = {
    success: 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10 text-green-700 dark:text-green-400',
    warning: 'border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 text-orange-700 dark:text-orange-400',
    danger: 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400',
    info: 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400',
    muted: 'border-muted-foreground/20 bg-muted/30 hover:bg-muted/50 text-muted-foreground',
  };

  const activeVariants = {
    success: 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/30',
    warning: 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/30',
    danger: 'border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/30',
    info: 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30',
    muted: 'border-foreground bg-foreground text-background shadow-lg',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-300",
        "hover:scale-[1.03] active:scale-[0.97]",
        isActive ? activeVariants[variant] : variants[variant]
      )}
    >
      {icon}
      <span>{label}</span>
      {isActive && <Check className="h-4 w-4" />}
    </button>
  );
};

export const BillboardFilters: React.FC<BillboardFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  selectedStatuses,
  setSelectedStatuses,
  selectedCities,
  setSelectedCities,
  selectedSizes,
  setSelectedSizes,
  selectedMunicipalities,
  setSelectedMunicipalities,
  selectedDistricts,
  setSelectedDistricts,
  selectedAdTypes,
  setSelectedAdTypes,
  selectedCustomers,
  setSelectedCustomers,
  selectedContractNumbers,
  setSelectedContractNumbers,
  cities,
  billboardSizes,
  billboardMunicipalities,
  billboardDistricts = [],
  uniqueAdTypes,
  uniqueCustomers,
  uniqueContractNumbers
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);

  // ✅ ترتيب أرقام العقود من الأعلى للأقل
  const sortedContractNumbers = [...uniqueContractNumbers]
    .filter(n => n && String(n).trim())
    .sort((a, b) => {
      const numA = parseInt(String(a)) || 0;
      const numB = parseInt(String(b)) || 0;
      return numB - numA;
    });

  // حساب عدد الفلاتر النشطة
  const activeFiltersCount = [
    selectedStatuses.length > 0,
    selectedCities.length > 0,
    selectedSizes.length > 0,
    selectedMunicipalities.length > 0,
    selectedDistricts.length > 0,
    selectedAdTypes.length > 0,
    selectedCustomers.length > 0,
    selectedContractNumbers.length > 0
  ].filter(Boolean).length;

  // دالة إعادة تعيين جميع الفلاتر
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatuses([]);
    setSelectedCities([]);
    setSelectedSizes([]);
    setSelectedMunicipalities([]);
    setSelectedDistricts([]);
    setSelectedAdTypes([]);
    setSelectedCustomers([]);
    setSelectedContractNumbers([]);
  };

  // ✅ التحقق من حالة فلتر سريع
  const isQuickStatusActive = (status: string) => selectedStatuses.includes(status);
  
  const toggleQuickStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses.filter(s => s !== 'all'), status]);
    }
  };

  // ✅ الحالات السريعة
  const quickStatuses = [
    { label: 'متاحة', value: 'متاحة', icon: <CircleCheck className="h-4 w-4" />, variant: 'success' as const },
    { label: 'قريبة الانتهاء', value: 'قريبة الانتهاء', icon: <Clock className="h-4 w-4" />, variant: 'warning' as const },
    { label: 'محجوز', value: 'محجوز', icon: <Ban className="h-4 w-4" />, variant: 'danger' as const },
    { label: 'قيد الصيانة', value: 'قيد الصيانة', icon: <Wrench className="h-4 w-4" />, variant: 'info' as const },
    { label: 'مخفية', value: 'مخفية من المتاح', icon: <EyeOff className="h-4 w-4" />, variant: 'muted' as const },
  ];

  return (
    <div className="space-y-4">
      {/* ✅ شريط البحث الرئيسي - تصميم عصري */}
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-primary/5 via-card to-accent/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        
        <CardContent className="relative p-4">
          <div className="flex items-center gap-4">
            {/* أيقونة البحث المتحركة */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30">
                <Search className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            
            {/* حقل البحث */}
            <div className="flex-1 relative">
              <Input
                placeholder="🔍 ابحث باسم اللوحة، الموقع، العميل، رقم العقد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "h-14 pr-5 pl-14 text-base bg-background/80 backdrop-blur-sm",
                  "border-2 border-border/30 focus:border-primary",
                  "rounded-2xl shadow-inner text-right font-medium",
                  "placeholder:text-muted-foreground/50 transition-all duration-300",
                  "focus:shadow-lg focus:shadow-primary/10"
                )}
                dir="rtl"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive"
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* زر الفلاتر المتقدمة */}
            <Button
              variant={isAdvancedOpen ? "default" : "outline"}
              size="lg"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className={cn(
                "h-14 px-5 rounded-2xl gap-2 font-semibold transition-all duration-300",
                isAdvancedOpen && "shadow-lg shadow-primary/25"
              )}
            >
              <SlidersHorizontal className="h-5 w-5" />
              <span className="hidden sm:inline">فلاتر</span>
              {activeFiltersCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground border-0 animate-pulse">
                  {activeFiltersCount}
                </Badge>
              )}
              {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ✅ الفلاتر السريعة للحالة */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2 ml-2">
          <Sparkles className="h-4 w-4 text-primary" />
          تصفية سريعة:
        </span>
        {quickStatuses.map((status) => (
          <QuickStatus
            key={status.value}
            label={status.label}
            value={status.value}
            icon={status.icon}
            variant={status.variant}
            isActive={isQuickStatusActive(status.value)}
            onClick={() => toggleQuickStatus(status.value)}
          />
        ))}
        
        {/* زر مسح الكل */}
        {(searchQuery || activeFiltersCount > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive mr-auto"
          >
            <RotateCcw className="h-4 w-4" />
            مسح الكل
          </Button>
        )}
      </div>

      {/* ✅ الفلاتر المتقدمة - قابلة للطي */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleContent className="transition-all duration-300">
          <Card className="border border-border/50 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardContent className="p-5">
              {/* رأس الفلاتر */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                    <Filter className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">فلاتر متقدمة</h3>
                    <p className="text-xs text-muted-foreground">تصفية دقيقة حسب المدينة، الحجم، البلدية...</p>
                  </div>
                </div>
              </div>

              {/* شبكة الفلاتر - تصميم محسن */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* فلتر الحالة */}
                <FilterField
                  label="الحالة"
                  icon={<LayoutGrid className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={[
                      { label: 'جميع الحالات', value: 'all' },
                      { label: 'متاحة', value: 'متاحة' },
                      { label: 'قريبة الانتهاء', value: 'قريبة الانتهاء' },
                      { label: 'محجوز', value: 'محجوز' },
                      { label: 'منتهي', value: 'منتهي' },
                      { label: 'إزالة', value: 'إزالة' },
                      { label: 'لم يتم التركيب', value: 'لم يتم التركيب' },
                      { label: 'تحتاج ازالة لغرض التطوير', value: 'تحتاج ازالة لغرض التطوير' },
                      { label: 'قيد الصيانة', value: 'قيد الصيانة' },
                      { label: 'متضررة اللوحة', value: 'متضررة اللوحة' },
                      { label: 'مخفية من المتاح', value: 'مخفية من المتاح' },
                    ]}
                    value={selectedStatuses}
                    onChange={(values) => {
                      if (values.includes('all') && !selectedStatuses.includes('all')) {
                        setSelectedStatuses(['all']);
                      } else if (values.includes('all') && values.length > 1) {
                        setSelectedStatuses(values.filter(v => v !== 'all'));
                      } else {
                        setSelectedStatuses(values);
                      }
                    }}
                    placeholder="جميع الحالات"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر المدن */}
                <FilterField
                  label="المدينة"
                  icon={<MapPin className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={cities.map(c => ({ label: c, value: c }))}
                    value={selectedCities}
                    onChange={setSelectedCities}
                    placeholder="جميع المدن"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر الحجم */}
                <FilterField
                  label="الحجم"
                  icon={<Maximize2 className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={billboardSizes.filter(s => s && String(s).trim()).map(s => ({ label: String(s), value: String(s) }))}
                    value={selectedSizes}
                    onChange={setSelectedSizes}
                    placeholder="جميع الأحجام"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر البلدية */}
                <FilterField
                  label="البلدية"
                  icon={<Building2 className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={billboardMunicipalities.filter(m => m && String(m).trim()).map(m => ({ label: String(m), value: String(m) }))}
                    value={selectedMunicipalities}
                    onChange={setSelectedMunicipalities}
                    placeholder="جميع البلديات"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر المنطقة */}
                {billboardDistricts.length > 0 && (
                  <FilterField
                    label="المنطقة"
                    icon={<MapPin className="h-4 w-4" />}
                  >
                    <MultiSelect
                      options={billboardDistricts.filter(d => d && String(d).trim()).map(d => ({ label: String(d), value: String(d) }))}
                      value={selectedDistricts}
                      onChange={setSelectedDistricts}
                      placeholder="جميع المناطق"
                      className="rounded-xl"
                    />
                  </FilterField>
                )}

                {/* فلتر نوع الإعلان */}
                <FilterField
                  label="نوع الإعلان"
                  icon={<Megaphone className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={uniqueAdTypes.filter(a => a && String(a).trim()).map(a => ({ label: String(a), value: String(a) }))}
                    value={selectedAdTypes}
                    onChange={setSelectedAdTypes}
                    placeholder="جميع الأنواع"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر العملاء */}
                <FilterField
                  label="العميل"
                  icon={<Users className="h-4 w-4" />}
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full h-10 justify-between rounded-xl border-2 font-normal",
                          "bg-background/60 hover:bg-background/80 transition-all",
                          selectedCustomers.length > 0 && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <span className={selectedCustomers.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {selectedCustomers.length === 0 
                            ? 'جميع العملاء' 
                            : `${selectedCustomers.length} عميل`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 rounded-xl shadow-2xl" align="start">
                      <Command className="rounded-xl">
                        <CommandInput placeholder="ابحث عن عميل..." className="text-right h-12" dir="rtl" />
                        <CommandList className="max-h-64">
                          <CommandEmpty className="py-6 text-center text-muted-foreground">لا توجد نتائج</CommandEmpty>
                          <CommandGroup>
                            <CommandItem 
                              onSelect={() => setSelectedCustomers([])} 
                              className="justify-end rounded-lg mx-1 my-0.5"
                            >
                              جميع العملاء
                            </CommandItem>
                            {uniqueCustomers.filter(c => c && String(c).trim()).map((customer) => (
                              <CommandItem
                                key={String(customer)}
                                value={String(customer)}
                                onSelect={() => {
                                  const val = String(customer);
                                  if (selectedCustomers.includes(val)) {
                                    setSelectedCustomers(selectedCustomers.filter(c => c !== val));
                                  } else {
                                    setSelectedCustomers([...selectedCustomers, val]);
                                  }
                                }}
                                className="justify-between rounded-lg mx-1 my-0.5"
                              >
                                <span className={selectedCustomers.includes(String(customer)) ? 'font-bold text-primary' : ''}>
                                  {String(customer)}
                                </span>
                                {selectedCustomers.includes(String(customer)) && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FilterField>

                {/* فلتر أرقام العقود */}
                <FilterField
                  label="رقم العقد"
                  icon={<FileText className="h-4 w-4" />}
                  className="sm:col-span-2 lg:col-span-1"
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full h-10 justify-between rounded-xl border-2 font-normal",
                          "bg-background/60 hover:bg-background/80 transition-all",
                          selectedContractNumbers.length > 0 && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <span className={selectedContractNumbers.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {selectedContractNumbers.length === 0 
                            ? 'جميع العقود' 
                            : `${selectedContractNumbers.length} عقد`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0 rounded-xl shadow-2xl" align="start">
                      <Command className="rounded-xl">
                        <CommandInput placeholder="ابحث عن رقم العقد..." className="text-right h-12" dir="rtl" />
                        <CommandList className="max-h-64">
                          <CommandEmpty className="py-6 text-center text-muted-foreground">لا توجد نتائج</CommandEmpty>
                          <CommandGroup>
                            <CommandItem 
                              onSelect={() => setSelectedContractNumbers([])} 
                              className="justify-end rounded-lg mx-1 my-0.5"
                            >
                              جميع العقود
                            </CommandItem>
                            {sortedContractNumbers.map((contractNum) => (
                              <CommandItem
                                key={String(contractNum)}
                                value={String(contractNum)}
                                onSelect={() => {
                                  const val = String(contractNum);
                                  if (selectedContractNumbers.includes(val)) {
                                    setSelectedContractNumbers(selectedContractNumbers.filter(c => c !== val));
                                  } else {
                                    setSelectedContractNumbers([...selectedContractNumbers, val]);
                                  }
                                }}
                                className="justify-between rounded-lg mx-1 my-0.5"
                              >
                                <span className={selectedContractNumbers.includes(String(contractNum)) ? 'font-bold text-primary' : ''}>
                                  عقد #{String(contractNum)}
                                </span>
                                {selectedContractNumbers.includes(String(contractNum)) && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FilterField>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* ✅ شريط الفلاتر النشطة - تصميم محسن */}
      {(searchQuery || activeFiltersCount > 0) && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-muted/30 border border-border/30">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            نشط:
          </span>
          
          {searchQuery && (
            <ActiveFilterBadge
              label={`البحث: ${searchQuery}`}
              onRemove={() => setSearchQuery('')}
              variant="primary"
            />
          )}
          
          {selectedStatuses.filter(s => s !== 'all').map(status => (
            <ActiveFilterBadge
              key={status}
              label={status}
              onRemove={() => setSelectedStatuses(selectedStatuses.filter(s => s !== status))}
              variant="info"
            />
          ))}
          
          {selectedCities.map(city => (
            <ActiveFilterBadge
              key={city}
              label={city}
              onRemove={() => setSelectedCities(selectedCities.filter(c => c !== city))}
              variant="success"
            />
          ))}
          
          {selectedSizes.map(size => (
            <ActiveFilterBadge
              key={size}
              label={size}
              onRemove={() => setSelectedSizes(selectedSizes.filter(s => s !== size))}
              variant="warning"
            />
          ))}
          
          {selectedMunicipalities.map(municipality => (
            <ActiveFilterBadge
              key={municipality}
              label={municipality}
              onRemove={() => setSelectedMunicipalities(selectedMunicipalities.filter(m => m !== municipality))}
              variant="default"
            />
          ))}
          
          {selectedDistricts.map(district => (
            <ActiveFilterBadge
              key={district}
              label={district}
              onRemove={() => setSelectedDistricts(selectedDistricts.filter(d => d !== district))}
              variant="default"
            />
          ))}
          
          {selectedAdTypes.map(adType => (
            <ActiveFilterBadge
              key={adType}
              label={adType}
              onRemove={() => setSelectedAdTypes(selectedAdTypes.filter(a => a !== adType))}
              variant="default"
            />
          ))}
          
          {selectedCustomers.map(customer => (
            <ActiveFilterBadge
              key={customer}
              label={customer}
              onRemove={() => setSelectedCustomers(selectedCustomers.filter(c => c !== customer))}
              variant="default"
            />
          ))}
          
          {selectedContractNumbers.map(contractNum => (
            <ActiveFilterBadge
              key={contractNum}
              label={`عقد #${contractNum}`}
              onRemove={() => setSelectedContractNumbers(selectedContractNumbers.filter(c => c !== contractNum))}
              variant="default"
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ✅ مكون حقل الفلتر
interface FilterFieldProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const FilterField: React.FC<FilterFieldProps> = ({ label, icon, children, className }) => (
  <div className={cn("space-y-2", className)}>
    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2 pr-1">
      <span className="text-primary">{icon}</span>
      {label}
    </label>
    {children}
  </div>
);

// ✅ مكون شارة الفلتر النشط
interface ActiveFilterBadgeProps {
  label: string;
  onRemove: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
}

const ActiveFilterBadge: React.FC<ActiveFilterBadgeProps> = ({ label, onRemove, variant = 'default' }) => {
  const variants = {
    default: 'bg-muted text-muted-foreground hover:bg-muted/80',
    primary: 'bg-primary/15 text-primary border-primary/30',
    success: 'bg-green-500/15 text-green-600 border-green-500/30',
    warning: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    info: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1.5 pl-1.5 pr-2.5 py-1 text-xs font-medium rounded-full transition-all hover:scale-105",
        variants[variant]
      )}
    >
      {label}
      <button 
        onClick={onRemove} 
        className="hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
};

export default BillboardFilters;
