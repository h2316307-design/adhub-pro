import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, MapPin, Ruler, CheckCircle2, Building2, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="البحث باسم اللوحة، الموقع، البلدية..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 h-11 text-base bg-background border-2 border-border focus:border-primary transition-colors"
          dir="rtl"
        />
      </div>

      {/* Status Quick Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'available', label: 'متاح', color: 'bg-green-500', icon: '🟢' },
          { value: 'nearExpiry', label: 'قريب الانتهاء', color: 'bg-orange-500', icon: '🟠' },
          { value: 'rented', label: 'مؤجر', color: 'bg-red-500', icon: '🔴' },
          { value: 'all', label: 'الكل', color: 'bg-gray-500', icon: '⚪' },
        ].map((status) => (
          <button
            key={status.value}
            onClick={() => setStatusFilter(status.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
              statusFilter === status.value
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            <span className="text-xs">{status.icon}</span>
            {status.label}
          </button>
        ))}
      </div>

      {/* Dropdown Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="h-9 bg-background border-border text-sm">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="المدينة" />
            </div>
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
            <SelectTrigger className="h-9 bg-background border-border text-sm">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="البلدية" />
              </div>
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
          <SelectTrigger className="h-9 bg-background border-border text-sm">
            <div className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="المقاس" />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[10000]">
            <SelectItem value="all">جميع المقاسات</SelectItem>
            {sizes.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={pricingCategory} onValueChange={setPricingCategory}>
          <SelectTrigger className="h-9 bg-background border-border text-sm">
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="الفئة" />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[10000]">
            {(pricingCategories || []).map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cleanup Button */}
      {onCleanup && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCleanup}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            تنظيف
          </Button>
        </div>
      )}
    </div>
  );
}
