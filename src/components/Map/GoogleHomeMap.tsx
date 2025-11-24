/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map as MapIcon, Satellite, Search, Filter, Layers } from 'lucide-react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { Billboard } from '@/types';

interface GoogleHomeMapProps {
  billboards: Billboard[];
  onBillboardClick?: (billboard: Billboard) => void;
}

// Status color mapping - matches reference file
const getStatusColor = (billboard: Billboard): { color: string; label: string } => {
  const status = String((billboard as any).Status || '').trim();
  const maintenanceStatus = String((billboard as any).maintenance_status || '').trim();
  const maintenanceType = String((billboard as any).maintenance_type || '').trim();
  
  // إزالة / removed
  if (status === 'إزالة' || status === 'ازالة' || status === 'removed' || 
      maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' ||
      maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
      maintenanceType === 'تمت الإزالة' || maintenanceType === 'تحتاج إزالة' || maintenanceType === 'لم يتم التركيب') {
    return { color: 'hsl(0 0% 50%)', label: 'إزالة' };
  }
  
  // صيانة
  if (status === 'صيانة' || maintenanceStatus === 'maintenance' || maintenanceStatus === 'قيد الصيانة') {
    return { color: 'hsl(25 95% 53%)', label: 'صيانة' };
  }
  
  // تحتاج صيانة
  if (maintenanceStatus === 'repair_needed' || maintenanceStatus === 'تحتاج إصلاح' || 
      maintenanceStatus === 'متضررة اللوحة') {
    return { color: 'hsl(45 93% 47%)', label: 'تحتاج صيانة' };
  }
  
  // خارج الخدمة
  if (maintenanceStatus === 'out_of_service' || maintenanceStatus === 'خارج الخدمة') {
    return { color: 'hsl(0 0% 30%)', label: 'خارج الخدمة' };
  }
  
  // Check if contract is expired before marking as rented
  const hasContract = !!billboard.Contract_Number;
  if (hasContract) {
    const rentEndDate = (billboard as any).Rent_End_Date || (billboard as any).rent_end_date;
    if (rentEndDate) {
      const isExpired = new Date(rentEndDate) < new Date();
      if (isExpired) {
        return { color: 'hsl(120 60% 50%)', label: 'متاح' }; // Expired = Available
      }
    }
  }
  
  // مؤجر (only if has active contract)
  if (status === 'مؤجر' || hasContract) {
    return { color: 'hsl(0 80% 60%)', label: 'مؤجر' };
  }
  
  // متاح
  return { color: 'hsl(120 60% 50%)', label: 'متاح' };
};

function parseCoords(b: Billboard): { lat: number; lng: number } | null {
  const coords = (b as any).GPS_Coordinates || (b as any).coordinates;
  if (!coords) return null;
  
  if (typeof coords === 'string') {
    const parts = coords.split(',').map((c: string) => parseFloat(c.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      // Validate Libya coordinates
      if (parts[0] >= 19 && parts[0] <= 34 && parts[1] >= 9 && parts[1] <= 26) {
        return { lat: parts[0], lng: parts[1] };
      }
    }
  } else if (typeof coords === 'object') {
    const lat = (coords as any).lat || (coords as any).latitude;
    const lng = (coords as any).lng || (coords as any).longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      if (lat >= 19 && lat <= 34 && lng >= 9 && lng <= 26) {
        return { lat, lng };
      }
    }
  }
  return null;
}

// Convert HSL to hex for Google Maps
const hslToHex = (hsl: string): string => {
  const match = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (!match) return '#22c55e';
  
  const h = parseInt(match[1]);
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export default function GoogleHomeMap({ billboards, onBillboardClick }: GoogleHomeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markerClustererRef = useRef<MarkerClusterer | null>(null);
  const currentInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('satellite');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [enableClustering, setEnableClustering] = useState(true);

  // Get unique cities
  const cities = useMemo(() => 
    Array.from(new Set(billboards.map(b => b.City).filter(Boolean))).sort(),
    [billboards]
  );

  // Filter billboards
  const filteredBillboards = useMemo(() => {
    return billboards.filter(b => {
      const matchesSearch = searchQuery === '' || 
        b.Billboard_Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.Nearest_Landmark?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.City?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCity = cityFilter === 'all' || b.City === cityFilter;
      
      // Status filtering
      const statusColor = getStatusColor(b);
      const matchesStatus = statusFilter === 'all' || statusColor.label === statusFilter;
      
      return matchesSearch && matchesCity && matchesStatus && parseCoords(b) !== null;
    });
  }, [billboards, searchQuery, cityFilter, statusFilter]);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.google) return;

      if (!mapInstanceRef.current) {
        const center = { lat: 32.8872, lng: 13.1913 };
        
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 12,
          mapTypeId: mapType,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
        });
        mapInstanceRef.current = map;
        
        // Close info window when clicking on the map
        map.addListener('click', () => {
          if (currentInfoWindowRef.current) {
            currentInfoWindowRef.current.close();
          }
        });
      } else {
        mapInstanceRef.current.setMapTypeId(mapType);
      }

      const map = mapInstanceRef.current;

      // Clear old markers and clusterer
      if (markerClustererRef.current) {
        markerClustererRef.current.clearMarkers();
        markerClustererRef.current.setMap(null);
        markerClustererRef.current = null;
      }
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Add markers
      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;

      filteredBillboards.forEach((b) => {
        const coords = parseCoords(b);
        if (!coords) return;

        const { color, label } = getStatusColor(b);
        const hexColor = hslToHex(color);
        
        // Create custom SVG marker
        const svgMarker = {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: hexColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.8,
          anchor: new google.maps.Point(12, 22),
        };

        const marker = new google.maps.Marker({
          position: coords,
          map: enableClustering ? null : map,
          title: b.Billboard_Name || 'لوحة إعلانية',
          icon: svgMarker,
        });

        const imageUrl = b.Image_URL || `/image/${b.Billboard_Name}.jpg`;
        
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="min-width: 280px; font-family: 'Cairo', sans-serif; direction: rtl; padding: 0;">
              ${b.Image_URL || b.Billboard_Name ? `
                <div style="margin-bottom: 12px; width: 100%; height: 160px; overflow: hidden; border-radius: 8px;">
                  <img 
                    src="${imageUrl}" 
                    alt="${b.Billboard_Name || 'صورة اللوحة'}"
                    style="width: 100%; height: 100%; object-fit: cover;"
                    onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2214%22%3E لا توجد صورة%3C/text%3E%3C/svg%3E';"
                  />
                </div>
              ` : ''}
              <div style="background: ${color}; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: bold; color: white;">
                  📍 ${b.Billboard_Name || 'لوحة'}
                </h3>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 12px;">
                <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="color: #6b7280; margin-bottom: 2px;">المقاس</div>
                  <div style="font-weight: bold;">${b.Size || '-'}</div>
                </div>
                <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="color: #6b7280; margin-bottom: 2px;">المستوى</div>
                  <div style="font-weight: bold;">${b.Level || '-'}</div>
                </div>
                <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="color: #6b7280; margin-bottom: 2px;">المدينة</div>
                  <div style="font-weight: bold; font-size: 11px;">${b.City || '-'}</div>
                </div>
                <div style="background: ${color}20; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid ${color};">
                  <div style="color: ${color}; margin-bottom: 2px; font-weight: bold;">الحالة</div>
                  <div style="font-weight: bold; color: ${color}; font-size: 11px;">${label}</div>
                </div>
              </div>
              <div style="background: #dbeafe; border-right: 3px solid #3b82f6; padding: 8px; border-radius: 6px; font-size: 11px; color: #1e40af; line-height: 1.4;">
                <strong>📌 الموقع:</strong><br/>${b.Nearest_Landmark || '-'}
              </div>
            </div>
          `,
        });

        marker.addListener('click', () => {
          // Close previous info window
          if (currentInfoWindowRef.current) {
            currentInfoWindowRef.current.close();
          }
          infoWindow.open(map, marker);
          currentInfoWindowRef.current = infoWindow;
          if (onBillboardClick) {
            onBillboardClick(b);
          }
        });

        markersRef.current.push(marker);
        bounds.extend(coords);
        hasMarkers = true;
      });

      // Create marker clusterer if enabled
      if (enableClustering && markersRef.current.length > 0) {
        markerClustererRef.current = new MarkerClusterer({
          map,
          markers: markersRef.current,
          renderer: {
            render: ({ count, position }) => {
              const scale = Math.min(Math.sqrt(count) * 8 + 20, 50);
              let color = 'hsl(var(--primary))';
              
              if (count > 50) {
                color = 'hsl(0 84% 60%)';
              } else if (count > 20) {
                color = 'hsl(25 95% 53%)';
              }
              
              return new google.maps.Marker({
                position,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: scale,
                  fillColor: hslToHex(color),
                  fillOpacity: 0.95,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                },
                label: {
                  text: String(count),
                  color: '#ffffff',
                  fontSize: count > 99 ? '11px' : '14px',
                  fontWeight: 'bold',
                },
                zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
              });
            },
          },
        });
      } else if (!enableClustering) {
        // Add markers directly to map if clustering is disabled
        markersRef.current.forEach(marker => marker.setMap(map));
      }

      // Fit bounds if we have markers
      if (hasMarkers) {
        map.fitBounds(bounds);
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 13) {
          map.setZoom(13);
        }
      }
    };

    // Wait for Google Maps to be loaded by Keyless API
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
  }, [filteredBillboards, mapType, onBillboardClick, enableClustering]);

  return (
    <Card className="relative overflow-hidden">
      <style>{`
        .gm-style-iw {
          padding: 0 !important;
          border-radius: 16px !important;
          overflow: hidden;
        }
        .gm-style-iw-d {
          overflow: auto !important;
          padding: 12px !important;
        }
        .gm-style-iw-c {
          border-radius: 16px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
        }
      `}</style>
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2 pointer-events-auto">
        <Button
          size="sm"
          variant={mapType === 'roadmap' ? 'default' : 'outline'}
          onClick={() => setMapType('roadmap')}
          className="shadow-lg"
        >
          <MapIcon className="h-4 w-4 mr-2" />
          خريطة
        </Button>
        <Button
          size="sm"
          variant={mapType === 'satellite' ? 'default' : 'outline'}
          onClick={() => setMapType('satellite')}
          className="shadow-lg"
        >
          <Satellite className="h-4 w-4 mr-2" />
          قمر صناعي
        </Button>
        <Button
          size="sm"
          variant={enableClustering ? 'default' : 'outline'}
          onClick={() => setEnableClustering(!enableClustering)}
          className="shadow-lg"
          title={enableClustering ? 'إلغاء التجميع' : 'تجميع الدبابيس'}
        >
          <Layers className="h-4 w-4 mr-2" />
          {enableClustering ? 'مجمّعة' : 'منفصلة'}
        </Button>
        <Button
          size="sm"
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className="shadow-lg"
        >
          <Filter className="h-4 w-4 mr-2" />
          فلاتر
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-16 right-4 z-[2000] bg-card/95 backdrop-blur-md border rounded-lg shadow-xl p-4 w-80 pointer-events-auto animate-fade-in">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">بحث</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن لوحة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">المدينة</label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="جميع المدن" />
                </SelectTrigger>
                <SelectContent className="z-[3000] bg-background">
                  <SelectItem value="all">جميع المدن</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">الحالة</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent className="z-[3000] bg-background">
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="متاح">متاح</SelectItem>
                  <SelectItem value="مؤجر">مؤجر</SelectItem>
                  <SelectItem value="صيانة">صيانة</SelectItem>
                  <SelectItem value="تحتاج صيانة">تحتاج صيانة</SelectItem>
                  <SelectItem value="إزالة">إزالة</SelectItem>
                  <SelectItem value="خارج الخدمة">خارج الخدمة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {filteredBillboards.length} لوحة
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setCityFilter('all');
                  setStatusFilter('all');
                }}
              >
                إعادة تعيين
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-card/95 backdrop-blur-md border rounded-lg shadow-xl p-3 pointer-events-auto">
        <div className="text-xs font-semibold mb-2 text-foreground">دليل الألوان</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="w-3 h-3 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, hsl(120 60% 50%), hsl(120 60% 40%))' }}></div>
            <span className="text-foreground">متاح</span>
          </div>
          <div className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="w-3 h-3 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, hsl(0 80% 60%), hsl(0 80% 50%))' }}></div>
            <span className="text-foreground">مؤجر</span>
          </div>
          <div className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="w-3 h-3 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, hsl(25 95% 53%), hsl(25 95% 43%))' }}></div>
            <span className="text-foreground">صيانة</span>
          </div>
          <div className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="w-3 h-3 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, hsl(45 93% 47%), hsl(45 93% 37%))' }}></div>
            <span className="text-foreground">تحتاج صيانة</span>
          </div>
          <div className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="w-3 h-3 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, hsl(0 0% 50%), hsl(0 0% 40%))' }}></div>
            <span className="text-foreground">إزالة</span>
          </div>
          <div className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="w-3 h-3 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, hsl(0 0% 30%), hsl(0 0% 20%))' }}></div>
            <span className="text-foreground">خارج الخدمة</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapRef} style={{ height: '600px', width: '100%' }} />

      {/* Bottom Stats */}
      <div className="absolute top-4 left-4 z-[1000] bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg px-4 py-2 pointer-events-none">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-primary" />
            <span className="font-semibold">{filteredBillboards.length}</span>
            <span className="text-muted-foreground">لوحة</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
