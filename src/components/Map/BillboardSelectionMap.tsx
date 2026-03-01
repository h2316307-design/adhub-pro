/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map, Satellite, CheckCircle, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  billboards = [],
  selectedIds = [],
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
  const [filterMunicipality, setFilterMunicipality] = useState<string>('all');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [allSizes, setAllSizes] = useState<string[]>([]);

  // جلب جميع المقاسات من قاعدة البيانات
  useEffect(() => {
    const loadSizes = async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order');
      
      if (!error && data) {
        setAllSizes(data.map(s => s.name).filter(Boolean));
      }
    };
    loadSizes();
  }, []);

  // Get cities from all billboards (available + selected)
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    billboards.forEach(b => {
      // نظهر المدن من اللوحات المتاحة أو المختارة
      if (b.Status === 'متاح' || selectedIds.includes(String(b.ID))) {
        if (b.City) citySet.add(b.City);
      }
    });
    return Array.from(citySet).sort();
  }, [billboards, selectedIds]);

  // Get municipalities from all billboards (available + selected)
  const municipalities = useMemo(() => {
    const municipalitySet = new Set<string>();
    billboards.forEach(b => {
      if (b.Status === 'متاح' || selectedIds.includes(String(b.ID))) {
        if (b.Municipality) municipalitySet.add(b.Municipality);
      }
    });
    return Array.from(municipalitySet).sort();
  }, [billboards, selectedIds]);

  // استخدام المقاسات من قاعدة البيانات مع إضافة أي مقاسات موجودة في اللوحات
  const sizes = useMemo(() => {
    const sizeSet = new Set<string>(allSizes);
    billboards.forEach(b => {
      if (b.Size) sizeSet.add(b.Size);
    });
    // ترتيب بحيث تكون مقاسات allSizes أولاً
    return [...allSizes, ...Array.from(sizeSet).filter(s => !allSizes.includes(s))];
  }, [billboards, allSizes]);

  // عرض اللوحات المتاحة + اللوحات المختارة (حتى لو كانت مؤجرة للعقد الحالي)
  const displayableBillboards = useMemo(() => {
    return billboards.filter(b => 
      b.Status === 'متاح' || selectedIds.includes(String(b.ID))
    );
  }, [billboards, selectedIds]);

  const filteredBillboards = useMemo(() => {
    return displayableBillboards.filter(b => {
      const matchesSearch = !searchQuery || 
        (b.Billboard_Name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.City || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.Municipality || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCity = filterCity === 'all' || b.City === filterCity;
      const matchesMunicipality = filterMunicipality === 'all' || b.Municipality === filterMunicipality;
      const matchesSize = filterSize === 'all' || b.Size === filterSize;
      const matchesSelection = filterStatus === 'all' || 
        (filterStatus === 'selected' ? selectedIds.includes(String(b.ID)) : !selectedIds.includes(String(b.ID)));

      return matchesSearch && matchesCity && matchesMunicipality && matchesSize && matchesSelection && parseCoords(b) !== null;
    });
  }, [displayableBillboards, searchQuery, filterCity, filterMunicipality, filterSize, filterStatus, selectedIds]);

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

        // أيقونة مخصصة مميزة للوحات المختارة - دبوس ذهبي أصغر
        const selectedIcon = {
          url: `data:image/svg+xml,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 48 56">
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#FFD700"/>
                  <stop offset="50%" style="stop-color:#FFA500"/>
                  <stop offset="100%" style="stop-color:#B8860B"/>
                </linearGradient>
              </defs>
              <path d="M24 0C13.5 0 5 8.5 5 19c0 14.25 19 35 19 35s19-20.75 19-35C43 8.5 34.5 0 24 0z" 
                    fill="url(#goldGradient)" stroke="#8B4513" stroke-width="2"/>
              <circle cx="24" cy="18" r="7" fill="#fff" stroke="#8B4513" stroke-width="1.5"/>
              <text x="24" y="21" text-anchor="middle" font-size="9" font-weight="bold" fill="#8B4513">✓</text>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(32, 38),
          anchor: new google.maps.Point(16, 38),
        };

        // أيقونة عادية للوحات غير المختارة - دائرة أصغر
        const normalIcon = {
          url: `data:image/svg+xml,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="${isAvailable ? '#22c55e' : '#ef4444'}" stroke="#fff" stroke-width="2.5" opacity="0.95"/>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(18, 18),
          anchor: new google.maps.Point(9, 9),
        };

        const marker = new google.maps.Marker({
          position: coords,
          map,
          title: b.Billboard_Name || 'لوحة إعلانية',
          icon: isSelected ? selectedIcon : normalIcon,
          zIndex: isSelected ? 1000 : 1,
          animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
        });

        // إيقاف الارتداد بعد ثانيتين
        if (isSelected) {
          setTimeout(() => {
            marker.setAnimation(null);
          }, 2000);
        }

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
              <p style="margin: 6px 0; background: #1e3a5f; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 14px; font-weight: bold; text-align: center;">
                <span style="color: #d4af37;">المقاس:</span> ${b.Size || 'غير محدد'}
              </p>
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
      {/* شريط الفلاتر الدائم */}
      <div className="bg-background/95 backdrop-blur border-b border-border p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-40"
          />
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue placeholder="المدينة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المدن</SelectItem>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMunicipality} onValueChange={setFilterMunicipality}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue placeholder="البلدية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع البلديات</SelectItem>
              {municipalities.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSize} onValueChange={setFilterSize}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue placeholder="المقاس" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المقاسات</SelectItem>
              {sizes.map(size => (
                <SelectItem key={size} value={size}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue placeholder="حالة التحديد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="selected">المحددة</SelectItem>
              <SelectItem value="unselected">غير المحددة</SelectItem>
            </SelectContent>
          </Select>
          {onSelectAll && (
            <Button size="sm" variant="outline" onClick={onSelectAll} className="h-9">
              <CheckCircle className="h-4 w-4 ml-1" />
              تحديد الكل
            </Button>
          )}
          {onClearAll && (
            <Button size="sm" variant="outline" onClick={onClearAll} className="h-9">
              <Circle className="h-4 w-4 ml-1" />
              إلغاء الكل
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
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

        <div ref={mapRef} className="w-full h-[600px]" />

        <div className="absolute bottom-4 left-4 right-4 z-10 bg-background/95 backdrop-blur rounded-lg border p-3">
          <div className="flex justify-around text-sm">
            <div className="text-center">
              <div className="font-bold text-blue-600">{selectedIds.length}</div>
              <div className="text-muted-foreground">محددة</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-green-600">{filteredBillboards.length}</div>
              <div className="text-muted-foreground">متاحة</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default BillboardSelectionMap;
