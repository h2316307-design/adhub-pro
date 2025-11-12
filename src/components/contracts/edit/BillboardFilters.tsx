import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Trash2 } from 'lucide-react';

interface BillboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cityFilter: string;
  setCityFilter: (city: string) => void;
  sizeFilter: string;
  setSizeFilter: (size: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  pricingCategory: string;
  setPricingCategory: (category: string) => void;
  cities: string[];
  sizes: string[];
  pricingCategories: string[];
  municipalities?: string[];
  municipalityFilter?: string;
  setMunicipalityFilter?: (municipality: string) => void;
  onCleanup?: () => void;
}

export function BillboardFilters({
  searchQuery,
  setSearchQuery,
  cityFilter,
  setCityFilter,
  sizeFilter,
  setSizeFilter,
  statusFilter,
  setStatusFilter,
  pricingCategory,
  setPricingCategory,
  cities,
  sizes,
  pricingCategories,
  municipalities = [],
  municipalityFilter = 'all',
  setMunicipalityFilter,
  onCleanup
}: BillboardFiltersProps) {
  return (
    <Card className="relative z-50 bg-card border-2 border-primary/30 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Filter className="h-5 w-5 text-primary" />
            البحث في اللوحات المتاحة
          </CardTitle>
          {onCleanup && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCleanup}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              تنظيف اللوحات المحذوفة
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input 
              placeholder="البحث باسم اللوحة، أقرب نقطة دالة، البلدية، المدينة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 text-right bg-input border-border"
              dir="rtl"
            />
          </div>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="المدينة" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[10000]">
              <SelectItem value="all">جميع المدن</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {municipalities.length > 0 && setMunicipalityFilter && (
            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="البلدية" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-[10000]">
                <SelectItem value="all">جميع البلديات</SelectItem>
                {municipalities.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="المقاس" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[10000]">
              <SelectItem value="all">جميع المقاسات</SelectItem>
              {sizes.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[10000]">
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="available">متاح</SelectItem>
              <SelectItem value="nearExpiry">قريبة الانتهاء</SelectItem>
              <SelectItem value="rented">مؤجرة</SelectItem>
            </SelectContent>
          </Select>

          <Select value={pricingCategory} onValueChange={setPricingCategory}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="فئة السعر" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[10000]">
              {(pricingCategories || []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
