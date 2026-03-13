import { memo, useState, useCallback } from 'react';
import { Search, Crosshair } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MapSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onRequestLocation?: () => void;
  placeholder?: string;
  className?: string;
}

const MapSearchBar = memo(function MapSearchBar({
  value,
  onChange,
  onRequestLocation,
  placeholder = 'ابحث عن...',
  className = ''
}: MapSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Location Button */}
      {onRequestLocation && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onRequestLocation}
          className="w-10 h-10 rounded-xl bg-[#1a1a2e]/90 hover:bg-[#1a1a2e] border border-primary/30 text-white/80 hover:text-primary transition-all shadow-lg backdrop-blur-sm"
        >
          <Crosshair className="w-5 h-5" />
        </Button>
      )}

      {/* Search Input */}
      <div 
        className={`relative flex-1 transition-all duration-300 ${
          isFocused ? 'scale-[1.02]' : ''
        }`}
      >
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1a2e]/90 backdrop-blur-sm border transition-all shadow-lg ${
          isFocused ? 'border-primary/50 shadow-primary/20' : 'border-primary/30'
        }`}>
          <Search className="w-5 h-5 text-primary" />
          <Input
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="border-0 bg-transparent p-0 h-auto text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0 text-right"
            dir="rtl"
          />
        </div>
      </div>
    </div>
  );
});

export default MapSearchBar;
