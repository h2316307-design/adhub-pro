import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import MultiSelect from '@/components/ui/multi-select';
import { Filter, Search, LayoutGrid, MapPin, Maximize2, Building2, Megaphone, Users, FileText, X } from 'lucide-react';

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
  // ✅ FIXED: Sort contract numbers from highest to lowest
  const sortedContractNumbers = [...uniqueContractNumbers]
    .filter(n => n && String(n).trim())
    .sort((a, b) => {
      const numA = parseInt(String(a)) || 0;
      const numB = parseInt(String(b)) || 0;
      return numB - numA; // Descending order (highest to lowest)
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


  return (
    <Card className="relative overflow-hidden border-border/50 shadow-xl bg-gradient-to-br from-card via-card to-accent/10">
      {/* خلفية زخرفية */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
      
      <CardContent className="relative p-6">
        {/* شريط البحث الرئيسي - بارز ومميز */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-xl pointer-events-none" />
          <div className="relative bg-gradient-to-r from-primary/5 to-accent/5 p-4 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-4">
              {/* أيقونة البحث */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30">
                <Search className="h-6 w-6 text-primary-foreground" />
              </div>
              
              {/* حقل البحث */}
              <div className="flex-1 relative">
                <Input
                  placeholder="ابحث باسم اللوحة، أقرب نقطة دالة، البلديات، المدن، رقم العقد، العميل..."
                  value={searchQuery}
                  onChange={(e) => {
                    console.log('🔍 تغيير البحث:', e.target.value);
                    setSearchQuery(e.target.value);
                  }}
                  className="h-14 pr-4 pl-12 text-lg bg-background/90 border-2 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl shadow-inner text-right font-medium placeholder:text-muted-foreground/60"
                  dir="rtl"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* رأس قسم الفلاتر */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/50">
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">فلاتر متقدمة</h3>
              <p className="text-xs text-muted-foreground">تصفية حسب الحالة، المدينة، الحجم...</p>
            </div>
          </div>
          
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
              مسح الفلاتر
              <Badge className="bg-destructive text-destructive-foreground border-0 text-xs px-1.5">
                {activeFiltersCount}
              </Badge>
            </Button>
          )}
        </div>

        {/* شبكة الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* فلتر الحالة */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5" />
              الحالة
            </label>
            <MultiSelect
              options={[
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
              onChange={setSelectedStatuses}
              placeholder="اختر الحالة"
            />
          </div>

          {/* فلتر المدن */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              المدينة
            </label>
            <MultiSelect
              options={cities.map(c => ({ label: c, value: c }))}
              value={selectedCities}
              onChange={setSelectedCities}
              placeholder="جميع المدن"
            />
          </div>

          {/* فلتر الحجم */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Maximize2 className="h-3.5 w-3.5" />
              الحجم
            </label>
            <MultiSelect
              options={billboardSizes.filter(s => s && String(s).trim()).map(s => ({ label: String(s), value: String(s) }))}
              value={selectedSizes}
              onChange={setSelectedSizes}
              placeholder="جميع الأحجام"
            />
          </div>

          {/* فلتر البلدية */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              البلدية
            </label>
            <MultiSelect
              options={billboardMunicipalities.filter(m => m && String(m).trim()).map(m => ({ label: String(m), value: String(m) }))}
              value={selectedMunicipalities}
              onChange={setSelectedMunicipalities}
              placeholder="جميع البلديات"
            />
          </div>

          {/* فلتر المنطقة */}
          {billboardDistricts.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                المنطقة
              </label>
              <MultiSelect
                options={billboardDistricts.filter(d => d && String(d).trim()).map(d => ({ label: String(d), value: String(d) }))}
                value={selectedDistricts}
                onChange={setSelectedDistricts}
                placeholder="جميع المناطق"
              />
            </div>
          )}

          {/* فلتر نوع الإعلان */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5" />
              نوع الإعلان
            </label>
            <MultiSelect
              options={uniqueAdTypes.filter(a => a && String(a).trim()).map(a => ({ label: String(a), value: String(a) }))}
              value={selectedAdTypes}
              onChange={setSelectedAdTypes}
              placeholder="جميع الأنواع"
            />
          </div>

          {/* فلتر العملاء */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              العميل
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-10 justify-start bg-background/80 border-border/50 font-normal">
                  {selectedCustomers.length === 0 
                    ? 'جميع العملاء' 
                    : `${selectedCustomers.length} عميل محدد`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث عن عميل..." className="text-right" dir="rtl" />
                  <CommandList>
                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setSelectedCustomers([])} className="justify-end">
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
                          className="justify-end"
                        >
                          <span className={selectedCustomers.includes(String(customer)) ? 'font-bold text-primary' : ''}>
                            {String(customer)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* فلتر أرقام العقود */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              رقم العقد
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-10 justify-start bg-background/80 border-border/50 font-normal">
                  {selectedContractNumbers.length === 0 
                    ? 'جميع العقود' 
                    : `${selectedContractNumbers.length} عقد محدد`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث عن رقم العقد..." className="text-right" dir="rtl" />
                  <CommandList>
                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setSelectedContractNumbers([])} className="justify-end">
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
                          className="justify-end"
                        >
                          <span className={selectedContractNumbers.includes(String(contractNum)) ? 'font-bold text-primary' : ''}>
                            عقد #{String(contractNum)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* شريط الفلاتر النشطة */}
        {(searchQuery || activeFiltersCount > 0) && (
          <div className="mt-5 pt-5 border-t border-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">الفلاتر النشطة:</span>
              
              {searchQuery && (
                <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                  البحث: {searchQuery}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSearchQuery('')} />
                </Badge>
              )}
              
              {selectedStatuses.map(status => (
                <Badge key={status} variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                  {status}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedStatuses(selectedStatuses.filter(s => s !== status))} />
                </Badge>
              ))}
              
              {selectedCities.map(city => (
                <Badge key={city} variant="secondary" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                  {city}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedCities(selectedCities.filter(c => c !== city))} />
                </Badge>
              ))}
              
              {selectedSizes.map(size => (
                <Badge key={size} variant="secondary" className="gap-1 bg-purple-500/10 text-purple-600 border-purple-500/20">
                  الحجم: {size}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedSizes(selectedSizes.filter(s => s !== size))} />
                </Badge>
              ))}
              
              {selectedMunicipalities.map(municipality => (
                <Badge key={municipality} variant="secondary" className="gap-1 bg-orange-500/10 text-orange-600 border-orange-500/20">
                  البلدية: {municipality}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedMunicipalities(selectedMunicipalities.filter(m => m !== municipality))} />
                </Badge>
              ))}
              
              {selectedDistricts.map(district => (
                <Badge key={district} variant="secondary" className="gap-1 bg-teal-500/10 text-teal-600 border-teal-500/20">
                  المنطقة: {district}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedDistricts(selectedDistricts.filter(d => d !== district))} />
                </Badge>
              ))}
              
              {selectedAdTypes.map(adType => (
                <Badge key={adType} variant="secondary" className="gap-1 bg-pink-500/10 text-pink-600 border-pink-500/20">
                  نوع الإعلان: {adType}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedAdTypes(selectedAdTypes.filter(a => a !== adType))} />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
