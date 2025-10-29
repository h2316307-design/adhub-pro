import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import MultiSelect from '@/components/ui/multi-select';
import { Filter, Search } from 'lucide-react';

interface BillboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (statuses: string[]) => void;
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
  sizeFilter: string;
  setSizeFilter: (size: string) => void;
  municipalityFilter: string;
  setMunicipalityFilter: (municipality: string) => void;
  adTypeFilter: string;
  setAdTypeFilter: (adType: string) => void;
  selectedCustomers: string[];
  setSelectedCustomers: (customers: string[]) => void;
  selectedContractNumbers: string[];
  setSelectedContractNumbers: (contractNumbers: string[]) => void;
  cities: string[];
  billboardSizes: string[];
  billboardMunicipalities: string[];
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
  sizeFilter,
  setSizeFilter,
  municipalityFilter,
  setMunicipalityFilter,
  adTypeFilter,
  setAdTypeFilter,
  selectedCustomers,
  setSelectedCustomers,
  selectedContractNumbers,
  setSelectedContractNumbers,
  cities,
  billboardSizes,
  billboardMunicipalities,
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

  return (
    <Card className="expenses-preview-card">
      <CardHeader>
        <CardTitle className="expenses-preview-title flex items-center gap-2">
          <Filter className="h-5 w-5" />
          البحث في اللوحات...
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="البحث باسم اللوحة، أقرب نقطة دالة، البلديات، المدن، أرقام العقود..."
              value={searchQuery}
              onChange={(e) => {
                console.log('🔍 تغيير البحث:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              className="pr-10 text-right"
              dir="rtl"
            />
          </div>
          
          {/* ✅ ENHANCED: Added "منتهي" status to the filter options */}
          <MultiSelect
            options={[
              { label: 'متاحة', value: 'متاحة' },
              { label: 'قريبة الانتهاء', value: 'قريبة الانتهاء' },
              { label: 'محجوز', value: 'محجوز' },
              { label: 'منتهي', value: 'منتهي' },
            ]}
            value={selectedStatuses}
            onChange={setSelectedStatuses}
            placeholder="الحالة (متعدد)"
          />

          <MultiSelect
            options={cities.map(c => ({ label: c, value: c }))}
            value={selectedCities}
            onChange={setSelectedCities}
            placeholder="جميع المدن"
          />

          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="حجم اللوحة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأحجام</SelectItem>
              {billboardSizes.filter(s => s && String(s).trim()).map((s) => (
                <SelectItem key={String(s)} value={String(s)}>{String(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="البلدية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع البلديات</SelectItem>
              {billboardMunicipalities.filter(m => m && String(m).trim()).map((m) => (
                <SelectItem key={String(m)} value={String(m)}>{String(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ✅ FIXED: Ad Type filter with search functionality */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 justify-start">
                {adTypeFilter === 'all' ? 'نوع الإعلان (الكل)' : `نوع الإعلان: ${adTypeFilter}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="ابحث عن نوع الإعلان..." />
                <CommandList>
                  <CommandEmpty>لا يوجد نتائج</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => setAdTypeFilter('all')}>الكل</CommandItem>
                    {uniqueAdTypes.filter(t => t && String(t).trim()).map((t) => (
                      <CommandItem key={t} onSelect={() => setAdTypeFilter(t)}>{t}</CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <MultiSelect
            options={uniqueCustomers.filter(c => c && String(c).trim()).map((c) => ({ label: c, value: c }))}
            value={selectedCustomers}
            onChange={setSelectedCustomers}
            placeholder="أسماء الزبائن (متعدد)"
          />

          {/* ✅ FIXED: Contract numbers as single select with sorted order */}
          <Select 
            value={selectedContractNumbers.length > 0 ? selectedContractNumbers[0] : 'all'} 
            onValueChange={(value) => setSelectedContractNumbers(value === 'all' ? [] : [value])}
          >
            <SelectTrigger>
              <SelectValue placeholder="رقم العقد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع العقود</SelectItem>
              {sortedContractNumbers.map((n) => (
                <SelectItem key={String(n)} value={String(n)}>{String(n)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};