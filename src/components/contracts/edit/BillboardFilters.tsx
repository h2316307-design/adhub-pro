import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, MapPin, Ruler, Building2, Tag, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  // Multi-select support
  selectedCount?: number;
  totalCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
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
  onCleanup,
  selectedCount = 0,
  totalCount = 0,
  onSelectAll,
  onClearSelection
}: BillboardFiltersProps) {
  const hasActiveFilters = cityFilter !== 'all' || sizeFilter !== 'all' || statusFilter !== 'all' || municipalityFilter !== 'all' || searchQuery.length > 0;

  const clearAllFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
    setSizeFilter('all');
    setStatusFilter('all');
    if (setMunicipalityFilter) setMunicipalityFilter('all');
  };

  return (
    <div className="space-y-4 bg-gradient-to-br from-card via-card/95 to-muted/30 rounded-xl p-4 border border-border/50 shadow-sm">
      {/* Header with stats and selection actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">فلترة اللوحات</h3>
            <p className="text-xs text-muted-foreground">
              {totalCount > 0 ? `${totalCount} لوحة` : 'جاري التحميل...'}
              {selectedCount > 0 && (
                <span className="text-primary font-semibold mr-1"> • {selectedCount} محددة</span>
              )}
            </p>
          </div>
        </div>

        {/* Selection actions */}
        <div className="flex items-center gap-2">
          {onSelectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              تحديد الكل
            </Button>
          )}
          {onClearSelection && selectedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <X className="h-3 w-3" />
              إلغاء التحديد
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="البحث باسم اللوحة، الموقع، البلدية..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 h-11 text-base bg-background border-2 border-border focus:border-primary transition-all duration-200 rounded-lg"
          dir="rtl"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status Quick Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'available', label: 'متاح', color: 'bg-green-500', icon: '🟢', hoverBg: 'hover:bg-green-500/20' },
          { value: 'nearExpiry', label: 'قريب الانتهاء', color: 'bg-orange-500', icon: '🟠', hoverBg: 'hover:bg-orange-500/20' },
          { value: 'rented', label: 'مؤجر', color: 'bg-red-500', icon: '🔴', hoverBg: 'hover:bg-red-500/20' },
          { value: 'all', label: 'الكل', color: 'bg-gray-500', icon: '⚪', hoverBg: 'hover:bg-muted' },
        ].map((status) => (
          <button
            key={status.value}
            onClick={() => setStatusFilter(status.value)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2",
              "border-2",
              statusFilter === status.value
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-105"
                : `bg-background border-border ${status.hoverBg} text-muted-foreground hover:text-foreground`
            )}
          >
            <span className="text-xs">{status.icon}</span>
            {status.label}
          </button>
        ))}
      </div>

      {/* Dropdown Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="h-10 bg-background border-2 border-border text-sm rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
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
            <SelectTrigger className="h-10 bg-background border-2 border-border text-sm rounded-lg hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
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
          <SelectTrigger className="h-10 bg-background border-2 border-border text-sm rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-primary" />
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
          <SelectTrigger className="h-10 bg-background border-2 border-border text-sm rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
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

      {/* Active Filters & Actions */}
      {(hasActiveFilters || onCleanup) && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
          {/* Active filter badges */}
          <div className="flex flex-wrap gap-1.5">
            {cityFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Building2 className="h-3 w-3" />
                {cityFilter}
                <button onClick={() => setCityFilter('all')} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {municipalityFilter !== 'all' && setMunicipalityFilter && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <MapPin className="h-3 w-3" />
                {municipalityFilter}
                <button onClick={() => setMunicipalityFilter('all')} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {sizeFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Ruler className="h-3 w-3" />
                {sizeFilter}
                <button onClick={() => setSizeFilter('all')} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="h-3 w-3" />
                مسح الفلاتر
              </Button>
            )}
            {onCleanup && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCleanup}
                className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <Trash2 className="h-3 w-3" />
                تنظيف
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
