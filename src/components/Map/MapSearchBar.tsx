import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, Crosshair, MapPin, Navigation, Hash, Landmark, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Billboard } from '@/types';
import { parseCoords } from '@/utils/parseCoords';

export interface SearchSuggestion {
  type: 'billboard' | 'landmark' | 'district' | 'coordinates' | 'place';
  label: string;
  sublabel?: string;
  billboard?: Billboard;
  coords?: { lat: number; lng: number };
}

interface MapSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onRequestLocation?: () => void;
  billboards?: Billboard[];
  onSelectBillboard?: (billboard: Billboard) => void;
  onNavigateToCoords?: (lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

// Nominatim geocoding search with debounce
const searchNominatim = async (query: string): Promise<SearchSuggestion[]> => {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=ar&countrycodes=ly,sa,eg,ae,tn,dz,ma`,
      { headers: { 'User-Agent': 'BillboardApp/1.0' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: any) => ({
      type: 'place' as const,
      label: item.display_name?.split(',').slice(0, 2).join(',') || item.display_name,
      sublabel: item.display_name?.split(',').slice(2, 4).join(',') || '',
      coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
    }));
  } catch {
    return [];
  }
};

const MapSearchBar = memo(function MapSearchBar({
  value,
  onChange,
  onRequestLocation,
  billboards = [],
  onSelectBillboard,
  onNavigateToCoords,
  placeholder = 'ابحث عن لوحة، منطقة، مكان...',
  className = ''
}: MapSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<SearchSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setShowDropdown(true);

    // Debounced Nominatim search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const places = await searchNominatim(val);
      setPlaceSuggestions(places);
    }, 400);
  }, [onChange]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const localSuggestions = useMemo((): SearchSuggestion[] => {
    const q = value.trim();
    if (!q || q.length < 1) return [];
    const results: SearchSuggestion[] = [];
    const seen = new Set<string>();
    const lowerQ = q.toLowerCase();

    // 1. Check if it's coordinates
    const coordObj = parseCoords({ GPS_Coordinates: q });
    if (coordObj) {
      results.push({
        type: 'coordinates',
        label: `التوجه للإحداثي`,
        sublabel: `${coordObj.lat.toFixed(5)}, ${coordObj.lng.toFixed(5)}`,
        coords: coordObj,
      });
    }

    // 2. Search billboards by name, ID
    billboards.forEach(b => {
      if (results.length >= 8) return;
      const name = (b as any).Billboard_Name || b.name || '';
      const id = String((b as any).ID || b.id || '');
      const nameMatch = name.toLowerCase().includes(lowerQ) || name.includes(q);
      const idMatch = id.includes(q);
      if (nameMatch || idMatch) {
        const key = `bb-${id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type: 'billboard',
            label: name || `لوحة ${id}`,
            sublabel: `${(b as any).City || ''} • ${(b as any).Size || ''} • #${id}`,
            billboard: b,
          });
        }
      }
    });

    // 3. Search by Nearest_Landmark
    const landmarkSet = new Set<string>();
    billboards.forEach(b => {
      if (results.length >= 10) return;
      const landmark = (b as any).Nearest_Landmark || '';
      if (!landmark) return;
      if (landmark.toLowerCase().includes(lowerQ) || landmark.includes(q)) {
        if (!landmarkSet.has(landmark)) {
          landmarkSet.add(landmark);
          const coords = parseCoords(b);
          results.push({
            type: 'landmark',
            label: landmark,
            sublabel: (b as any).City || '',
            coords: coords || undefined,
            billboard: b,
          });
        }
      }
    });

    // 4. Search by District/Municipality
    const districtSet = new Set<string>();
    billboards.forEach(b => {
      if (results.length >= 12) return;
      const district = (b as any).District || '';
      const municipality = (b as any).Municipality || '';
      [district, municipality].forEach(area => {
        if (!area || districtSet.has(area)) return;
        if (area.toLowerCase().includes(lowerQ) || area.includes(q)) {
          districtSet.add(area);
          const count = billboards.filter(bb => 
            ((bb as any).District === area || (bb as any).Municipality === area)
          ).length;
          results.push({
            type: 'district',
            label: area,
            sublabel: `${count} لوحة`,
          });
        }
      });
    });

    return results.slice(0, 10);
  }, [value, billboards]);

  // Merge local and place suggestions
  const suggestions = useMemo(() => {
    const all = [...localSuggestions];
    // Add place suggestions that don't duplicate local results
    placeSuggestions.forEach(p => {
      if (all.length < 12) {
        all.push(p);
      }
    });
    return all;
  }, [localSuggestions, placeSuggestions]);

  const handleSelect = useCallback((suggestion: SearchSuggestion) => {
    setShowDropdown(false);
    if ((suggestion.type === 'coordinates' || suggestion.type === 'place') && suggestion.coords && onNavigateToCoords) {
      onNavigateToCoords(suggestion.coords.lat, suggestion.coords.lng);
    } else if (suggestion.type === 'billboard' && suggestion.billboard && onSelectBillboard) {
      onSelectBillboard(suggestion.billboard);
    } else if (suggestion.type === 'landmark' && suggestion.billboard && onSelectBillboard) {
      onSelectBillboard(suggestion.billboard);
    } else if (suggestion.type === 'district') {
      onChange(suggestion.label);
    }
  }, [onNavigateToCoords, onSelectBillboard, onChange]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'billboard': return <MapPin className="w-4 h-4 text-primary" />;
      case 'landmark': return <Landmark className="w-4 h-4 text-amber-500" />;
      case 'district': return <Hash className="w-4 h-4 text-emerald-500" />;
      case 'coordinates': return <Navigation className="w-4 h-4 text-blue-500" />;
      case 'place': return <Globe className="w-4 h-4 text-violet-500" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'billboard': return 'لوحة';
      case 'landmark': return 'معلم';
      case 'district': return 'منطقة';
      case 'coordinates': return 'إحداثي';
      case 'place': return 'مكان';
      default: return '';
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {onRequestLocation && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onRequestLocation}
            className="w-10 h-10 rounded-xl bg-card/90 hover:bg-card border border-border/50 text-muted-foreground hover:text-primary transition-all shadow-lg backdrop-blur-sm"
          >
            <Crosshair className="w-5 h-5" />
          </Button>
        )}

        <div className={`relative flex-1 transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/90 backdrop-blur-sm border transition-all shadow-lg ${
            isFocused ? 'border-primary/50 shadow-primary/20' : 'border-border/50'
          }`}>
            <Search className="w-5 h-5 text-primary" />
            <Input
              type="text"
              value={value}
              onChange={handleChange}
              onFocus={() => { setIsFocused(true); setShowDropdown(true); }}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className="border-0 bg-transparent p-0 h-auto text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 text-right"
              dir="rtl"
            />
          </div>
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl z-[2000] max-h-80 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.type}-${i}`}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-right"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                {getIcon(s.type)}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                {s.sublabel && (
                  <p className="text-xs text-muted-foreground truncate">{s.sublabel}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                {getTypeLabel(s.type)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default MapSearchBar;
