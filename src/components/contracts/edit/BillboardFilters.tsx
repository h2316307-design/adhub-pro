import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

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
  pricingCategories
}: BillboardFiltersProps) {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Search className="h-5 w-5 text-primary" />
          البحث والتصفية
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث عن لوحة" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pr-9 bg-input border-border text-foreground"
            />
          </div>
          
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[180px] bg-input border-border">
              <SelectValue placeholder="المدينة" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">كل المدن</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-[160px] bg-input border-border">
              <SelectValue placeholder="المقاس" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">كل المقاسات</SelectItem>
              {sizes.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-input border-border">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="available">المتاحة فقط</SelectItem>
              <SelectItem value="rented">المؤجرة فقط</SelectItem>
            </SelectContent>
          </Select>

          <Select value={pricingCategory} onValueChange={setPricingCategory}>
            <SelectTrigger className="w-[160px] bg-input border-border">
              <SelectValue placeholder="فئة السعر" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {pricingCategories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}