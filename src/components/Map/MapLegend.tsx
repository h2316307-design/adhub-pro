import { memo, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { getSizeColor } from '@/hooks/useMapMarkers';
import type { Billboard } from '@/types';

interface MapLegendProps {
  billboards: Billboard[];
  className?: string;
  collapsed?: boolean;
}

// الحالات الثابتة
const STATUS_ITEMS = [
  { label: 'متاح', color: '#22c55e' },
  { label: 'قريباً', color: '#eab308' },
  { label: 'محجوز', color: '#ef4444' },
];

const MapLegend = memo(function MapLegend({ billboards, className = '', collapsed: initialCollapsed = false }: MapLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  // حافظ على تزامن حالة الطي مع الـ props (مهم لأن isMobile يتغير بعد أول render)
  useEffect(() => {
    setIsCollapsed(initialCollapsed);
  }, [initialCollapsed]);
  
  // استخراج المقاسات الفريدة من اللوحات
  const sizes = useMemo(() => {
    const sizeSet = new Set<string>();
    billboards.forEach(b => {
      const size = (b as any).Size || (b as any).size;
      if (size) sizeSet.add(size);
    });
    return Array.from(sizeSet).sort((a, b) => {
      const getArea = (s: string) => {
        const nums = s.match(/\d+/g);
        if (nums && nums.length >= 2) return parseInt(nums[0]) * parseInt(nums[1]);
        if (nums && nums.length === 1) return parseInt(nums[0]);
        return 0;
      };
      return getArea(b) - getArea(a);
    });
  }, [billboards]);

  // النسخة المطوية - مضغوطة جداً للهاتف
  if (isCollapsed) {
    return (
      <button 
        onClick={() => setIsCollapsed(false)}
        className={`bg-card/90 backdrop-blur-sm border border-border/50 rounded-md shadow-sm p-1 flex items-center gap-0.5 hover:bg-accent transition-all active:scale-95 ${className}`}
      >
        <div className="flex gap-0.5">
          {STATUS_ITEMS.map((item) => (
            <div 
              key={item.label}
              className="w-2 h-2 rounded-full" 
              style={{ background: item.color }}
            />
          ))}
        </div>
        <ChevronUp className="w-3 h-3 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className={`bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg shadow-md p-2 min-w-[100px] max-w-[120px] ${className}`}>
      {/* Header with collapse button */}
      <div className="flex items-center justify-between mb-1.5">
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-0.5 hover:bg-accent rounded transition-all"
        >
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        <h4 className="text-primary text-[9px] font-bold">الدليل</h4>
      </div>
      
      {/* حالة اللوحة */}
      <div className="mb-2">
        <div className="space-y-1">
          {STATUS_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center justify-end gap-1.5">
              <span className="text-[8px] text-foreground/90">{item.label}</span>
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ background: item.color }} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* ألوان المقاسات */}
      <div className="border-t border-border/50 pt-1.5">
        <h4 className="text-primary text-[8px] font-bold mb-1 text-right">المقاسات</h4>
        <div className="space-y-0.5 max-h-[60px] overflow-y-auto custom-scrollbar">
          {sizes.slice(0, 4).map((size) => {
            const colors = getSizeColor(size);
            return (
              <div key={size} className="flex items-center justify-end gap-1">
                <span className="text-[7px] text-foreground/90 truncate max-w-[60px]">{size}</span>
                <div 
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ 
                    background: colors.bg,
                    border: `1px solid ${colors.border}`
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* مقر الشركة */}
      <div className="border-t border-border/50 pt-1.5 mt-1.5">
        <div className="flex items-center justify-end gap-1">
          <span className="text-[8px] text-foreground/90">المقر</span>
          <div className="w-3 h-3 rounded bg-primary/20 flex items-center justify-center">
            <Building2 className="w-2 h-2 text-primary" />
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.3); border-radius: 2px; }
      `}</style>
    </div>
  );
});

export default MapLegend;