import { memo } from 'react';
import { MapPin } from 'lucide-react';

interface MapHeaderProps {
  billboardCount: number;
  className?: string;
  compact?: boolean;
}

const MapHeader = memo(function MapHeader({ billboardCount, className = '', compact = false }: MapHeaderProps) {
  if (compact) {
    return (
      <div className={`flex items-center justify-end gap-1.5 bg-card/90 backdrop-blur-sm border border-border/50 rounded-md px-2 py-1 shadow-sm ${className}`}>
        <span className="text-[10px] text-foreground/70 font-medium">{billboardCount}</span>
        <MapPin className="w-3 h-3 text-primary" />
      </div>
    );
  }
  
  return (
    <div className={`flex items-center justify-end gap-3 ${className}`}>
      <div className="text-right">
        <h1 className="text-xl md:text-2xl font-bold text-primary" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          خريطة المواقع الإعلانية
        </h1>
        <p className="text-sm text-white/70">
          استكشف {billboardCount} موقع إعلاني
        </p>
      </div>
      <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center">
        <MapPin className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
});

export default MapHeader;