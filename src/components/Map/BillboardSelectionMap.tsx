/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map, Satellite, Filter, X, CheckCircle, Circle } from 'lucide-react';
import type { Billboard } from '@/types';

interface BillboardSelectionMapProps {
  billboards: Billboard[];
  selectedIds: string[];
  onToggleSelect: (billboard: Billboard) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

function parseCoords(b: Billboard): { lat: number; lng: number } | null {
  const coords = (b as any).GPS_Coordinates || (b as any).coordinates;
  if (!coords) return null;
  
  if (typeof coords === 'string') {
    const parts = coords.split(',').map((c: string) => parseFloat(c.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
  } else if (typeof coords === 'object') {
    const lat = (coords as any).lat || (coords as any).latitude;
    const lng = (coords as any).lng || (coords as any).longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { lat, lng };
    }
  }
  return null;
}

export function BillboardSelectionMap({
  billboards,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearAll
}: BillboardSelectionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, google.maps.Marker>>(new globalThis.Map());
  
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const cities = useMemo(() => {
    const citySet = new Set<string>();
    billboards.forEach(b => {
      if (b.City) citySet.add(b.City);
    });
    return Array.from(citySet).sort();
  }, [billboards]);

  const filteredBillboards = useMemo(() => {
    return billboards.filter(b => {
      const matchesSearch = !searchQuery || 
        (b.Billboard_Name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.City || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCity = filterCity === 'all' || b.City === filterCity;
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'selected' ? selectedIds.includes(String(b.ID)) : !selectedIds.includes(String(b.ID)));

      return matchesSearch && matchesCity && matchesStatus && parseCoords(b) !== null;
    });
  }, [billboards, searchQuery, filterCity, filterStatus, selectedIds]);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.google) return;

      if (!mapInstanceRef.current) {
        const center = { lat: 32.8872, lng: 13.1913 };
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 11,
          mapTypeId: mapType,
        });
        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setMapTypeId(mapType);
      }

      const map = mapInstanceRef.current;

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current.clear();

      // Add markers
      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;

      filteredBillboards.forEach((b) => {
        const coords = parseCoords(b);
        if (!coords) return;

        const billboardId = String(b.ID);
        const isSelected = selectedIds.includes(billboardId);
        const isAvailable = b.Status === 'متاح';

        const marker = new google.maps.Marker({
          position: coords,
          map,
          title: b.Billboard_Name || 'لوحة إعلانية',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isSelected ? 14 : 10,
            fillColor: isSelected ? '#3b82f6' : (isAvailable ? '#22c55e' : '#ef4444'),
            fillOpacity: 0.9,
            strokeColor: isSelected ? '#1e40af' : '#ffffff',
            strokeWeight: isSelected ? 3 : 2,
          },
        });

        const price = (b.Price || 0).toLocaleString('ar-LY');
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family: 'Doran', sans-serif; text-align: right; direction: rtl; padding: 8px; min-width: 200px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <h3 style="margin: 0; font-weight: bold;">${b.Billboard_Name || 'لوحة إعلانية'}</h3>
                <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${isSelected ? '#3b82f6' : '#e5e7eb'}; color: ${isSelected ? '#ffffff' : '#374151'};">
                  ${isSelected ? 'محددة' : 'غير محددة'}
                </span>
              </div>
              <p style="margin: 4px 0; color: #666;">${b.City || ''} ${b.District ? '- ' + b.District : ''}</p>
              <p style="margin: 4px 0;"><strong>الحجم:</strong> ${b.Size || ''}</p>
              <p style="margin: 4px 0; font-weight: bold; color: #2563eb;">${price} د.ل/شهر</p>
              <button 
                onclick="window.toggleBillboard_${billboardId}()"
                style="margin-top: 8px; width: 100%; padding: 8px; background: ${isSelected ? '#ef4444' : '#22c55e'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;"
              >
                ${isSelected ? 'إلغاء التحديد' : 'تحديد'}
              </button>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        // Store toggle function globally for button
        (window as any)[`toggleBillboard_${billboardId}`] = () => {
          onToggleSelect(b);
          infoWindow.close();
        };

        markersRef.current.set(billboardId, marker);
        bounds.extend(coords);
        hasMarkers = true;
      });

      if (hasMarkers) {
        map.fitBounds(bounds);
      }
    };

    if (window.google && window.google.maps) {
      initMap();
    } else {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          initMap();
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }
  }, [filteredBillboards, mapType, selectedIds, onToggleSelect]);

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          variant={mapType === 'roadmap' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMapType('roadmap')}
          className="bg-background/95 backdrop-blur"
        >
          <Map className="h-4 w-4 ml-2" />
          خريطة
        </Button>
        <Button
          variant={mapType === 'hybrid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMapType('hybrid')}
          className="bg-background/95 backdrop-blur"
        >
          <Satellite className="h-4 w-4 ml-2" />
          قمر صناعي
        </Button>
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="bg-background/95 backdrop-blur"
        >
          {showFilters ? <X className="h-4 w-4 ml-2" /> : <Filter className="h-4 w-4 ml-2" />}
          {showFilters ? 'إخفاء' : 'فلترة'}
        </Button>
      </div>

      {showFilters && (
        <div className="absolute top-16 right-4 z-10 bg-background/95 backdrop-blur rounded-lg border p-4 space-y-3 w-64">
          <Input
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="المدينة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المدن</SelectItem>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="حالة التحديد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="selected">المحددة</SelectItem>
              <SelectItem value="unselected">غير المحددة</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 pt-2">
            {onSelectAll && (
              <Button size="sm" variant="outline" onClick={onSelectAll} className="flex-1">
                <CheckCircle className="h-4 w-4 ml-1" />
                تحديد الكل
              </Button>
            )}
            {onClearAll && (
              <Button size="sm" variant="outline" onClick={onClearAll} className="flex-1">
                <Circle className="h-4 w-4 ml-1" />
                إلغاء الكل
              </Button>
            )}
          </div>
        </div>
      )}

      <div ref={mapRef} className="w-full h-[600px]" />

      <div className="absolute bottom-4 left-4 right-4 z-10 bg-background/95 backdrop-blur rounded-lg border p-3">
        <div className="flex justify-around text-sm">
          <div className="text-center">
            <div className="font-bold text-blue-600">{selectedIds.length}</div>
            <div className="text-muted-foreground">محددة</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{filteredBillboards.length}</div>
            <div className="text-muted-foreground">إجمالي</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default BillboardSelectionMap;
