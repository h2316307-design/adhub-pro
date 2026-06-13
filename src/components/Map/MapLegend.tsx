import { memo, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { getSizeColor } from '@/hooks/useMapMarkers';
import type { Billboard } from '@/types';

interface MapLegendProps {
  billboards: Billboard[];
  className?: string;
  collapsed?: boolean;
}

// الحالات الثابتة المحسنة مع تأثيرات التوهج
const STATUS_ITEMS = [
  { label: 'متاح', color: '#10b981', glow: 'rgba(16,185,129,0.4)' }, // Emerald
  { label: 'قريباً', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' }, // Amber
  { label: 'محجوز', color: '#ef4444', glow: 'rgba(239,68,68,0.4)' }, // Red
  { label: 'صيانة', color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' }, // Violet
  { label: 'مخفي', color: '#6b7280', glow: 'rgba(107,114,128,0.4)' }, // Gray
];

const MapLegend = memo(function MapLegend({ billboards, className = '', collapsed: initialCollapsed = false }: MapLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    setIsCollapsed(initialCollapsed);
  }, [initialCollapsed]);
  
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

  // النسخة المطوية - أنيقة للغاية وبشكل دائري زجاجي للهواتف
  if (isCollapsed) {
    return (
      <button 
        onClick={() => setIsCollapsed(false)}
        className={`bg-slate-950/80 backdrop-blur-md border border-amber-500/30 rounded-2xl shadow-xl p-2.5 flex items-center gap-1.5 hover:bg-slate-900/90 transition-all hover:border-amber-500 active:scale-95 ${className}`}
        title="عرض دليل الخريطة"
      >
        <div className="flex gap-1">
          {STATUS_ITEMS.slice(0, 3).map((item) => (
            <div 
              key={item.label}
              className="w-2 h-2 rounded-full animate-pulse" 
              style={{ 
                background: item.color,
                boxShadow: `0 0 6px ${item.glow}`
              }}
            />
          ))}
        </div>
        <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
      </button>
    );
  }

  return (
    <div className={`bg-slate-950/85 backdrop-blur-xl border border-amber-500/20 rounded-[1.25rem] shadow-2xl p-3 min-w-[125px] max-w-[145px] animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}>
      {/* Header with collapse button */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/5">
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-white/10 rounded-lg transition-all text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <h4 className="text-amber-500 text-[10px] font-extrabold tracking-wide font-manrope">دليل الخريطة</h4>
      </div>
      
      {/* حالة اللوحة */}
      <div className="mb-2.5">
        <div className="space-y-1.5">
          {STATUS_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center justify-end gap-2">
              <span className="text-[9px] text-slate-300 font-bold">{item.label}</span>
              <div 
                className="w-2 h-2 rounded-full relative" 
                style={{ 
                  background: item.color,
                  boxShadow: `0 0 8px ${item.glow}`
                }} 
              >
                <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: item.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ألوان المقاسات */}
      {sizes.length > 0 && (
        <div className="border-t border-white/5 pt-2">
          <h4 className="text-amber-500/80 text-[9px] font-extrabold mb-1 text-right">ألوان المقاسات</h4>
          <div className="space-y-1 max-h-[85px] overflow-y-auto custom-scrollbar pr-0.5">
            {sizes.slice(0, 6).map((size) => {
              const colors = getSizeColor(size);
              return (
                <div key={size} className="flex items-center justify-end gap-1.5 py-0.5">
                  <span className="text-[8px] text-slate-300 font-semibold truncate max-w-[80px]" dir="ltr">{size}</span>
                  <div 
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
                    style={{ 
                      background: colors.bg,
                      borderColor: colors.border || 'transparent',
                      boxShadow: `0 1px 3px rgba(0,0,0,0.3)`
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* رموز المعالم الهامة */}
      <div className="border-t border-white/5 pt-2 mt-2">
        <div className="space-y-1">
          <div className="flex items-center justify-end gap-2">
            <span className="text-[8px] text-slate-300 font-semibold">مقر الشركة</span>
            <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center p-0.5">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.25); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(245,158,11,0.5); }
      `}</style>
    </div>
  );
});

export default MapLegend;