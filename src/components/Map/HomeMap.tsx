import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map as MapIcon, Satellite, Search, Filter, Layers } from 'lucide-react';
import type { Billboard } from '@/types';

// Fix default marker icon path issue with Leaflet + Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface HomeMapProps {
  billboards: Billboard[];
  onBillboardClick?: (billboard: Billboard) => void;
}

export function HomeMap({ billboards, onBillboardClick }: HomeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('satellite');
  const [mapReady, setMapReady] = useState(false);
  const hasInitializedBounds = useRef(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('متاح');
  const [showFilters, setShowFilters] = useState(false);
  
  // Get unique cities
  const cities = Array.from(new Set(billboards.map(b => b.City).filter(Boolean)));
  
  // Filter billboards
  const filteredBillboards = useMemo(() => {
    return billboards.filter(b => {
      const matchesSearch = searchQuery === '' || 
        b.Billboard_Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.Nearest_Landmark?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCity = cityFilter === 'all' || b.City === cityFilter;
      
      // Status filtering
      const statusVal = String((b as any).Status || '').trim();
      const isAvailable = statusVal === 'متاح' || (!b.Contract_Number && statusVal !== 'صيانة');
      const isRented = statusVal === 'مؤجر' || !!b.Contract_Number;
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'متاح' && isAvailable) ||
        (statusFilter === 'مؤجر' && isRented);
      
      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [billboards, searchQuery, cityFilter, statusFilter]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapRef.current, {
        center: [32.8872, 13.1913],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        dragging: true,
        preferCanvas: false,
        maxBoundsViscosity: 0.8,
      });

      const tileLayer = L.tileLayer(
        mapType === 'streets'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            mapType === 'streets'
              ? '&copy; OpenStreetMap, &copy; CARTO'
              : '&copy; Esri World Imagery',
          maxZoom: 19,
        }
      );

      tileLayer.addTo(map);
      
      L.control.zoom({
        position: 'topright',
        zoomInTitle: 'تكبير',
        zoomOutTitle: 'تصغير'
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Update tile layer when map type changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current!.removeLayer(layer);
      }
    });

    const tileLayer = L.tileLayer(
      mapType === 'streets'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          mapType === 'streets'
            ? '&copy; OpenStreetMap, &copy; CARTO'
            : '&copy; Esri World Imagery',
        maxZoom: 19,
      }
    );

    tileLayer.addTo(mapInstanceRef.current);
  }, [mapType, mapReady]);

  // Parse coordinates
  const parseCoordinates = (coords: string): [number, number] | null => {
    if (!coords) return null;

    try {
      const parts = coords.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          if (lat >= 19 && lat <= 34 && lng >= 9 && lng <= 26) {
            return [lat, lng];
          }
        }
      }

      if (typeof coords === 'object') {
        const coordObj = coords as any;
        const lat = parseFloat(coordObj.lat || coordObj.latitude);
        const lng = parseFloat(coordObj.lng || coordObj.longitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          if (lat >= 19 && lat <= 34 && lng >= 9 && lng <= 26) {
            return [lat, lng];
          }
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  };

  // Add/update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker: any) => {
      if (marker && map) {
        map.removeLayer(marker);
      }
    });
    markersRef.current = {};

    const bounds: [number, number][] = [];

    // Add markers for filtered billboards
    filteredBillboards.forEach((billboard) => {
      const billboardId = String(billboard.ID);
      const coords = billboard.GPS_Coordinates || (billboard as any).coordinates || '';
      
      const position = parseCoordinates(coords);
      
      if (!position) return;

      const statusVal = String((billboard as any).Status || '').trim();
      const isAvailable = statusVal === 'متاح' || (!billboard.Contract_Number && statusVal !== 'صيانة');
      const adType = (billboard as any).Ad_Type || (billboard as any)['Ad Type'] || 'غير محدد';
      
      // Create custom marker with ad type label
      const iconHtml = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: auto !important;
        ">
          <div style="
            background: ${isAvailable ? 'hsl(120 60% 50%)' : 'hsl(0 80% 60%)'};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            margin-bottom: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            ${adType}
          </div>
          <div style="
            width: 40px;
            height: 40px;
            background: ${isAvailable ? 'hsl(120 60% 50%)' : 'hsl(0 80% 60%)'};
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transform: rotate(-45deg);
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <div style="transform: rotate(45deg);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'home-billboard-marker',
        iconSize: [40, 60],
        iconAnchor: [20, 60],
        popupAnchor: [0, -50],
      });

      const marker = L.marker(position, {
        icon,
        interactive: true,
        bubblingMouseEvents: false,
        riseOnHover: true,
        riseOffset: 250
      });

      // Create popup content
      const imageUrl = billboard.Image_URL || `/image/${billboard.Billboard_Name}.jpg`;
      
      const popupContent = `
        <div style="min-width: 280px; font-family: 'Cairo', sans-serif; direction: rtl;">
          ${billboard.Image_URL || billboard.Billboard_Name ? `
            <div style="margin-bottom: 12px; width: 100%; height: 160px; overflow: hidden; border-radius: 8px;">
              <img 
                src="${imageUrl}" 
                alt="${billboard.Billboard_Name || 'صورة اللوحة'}"
                style="width: 100%; height: 100%; object-fit: cover;"
                onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2214%22%3E لا توجد صورة%3C/text%3E%3C/svg%3E';"
              />
            </div>
          ` : ''}
          <div style="background: ${isAvailable ? 'hsl(120 60% 50%)' : 'hsl(0 80% 60%)'}; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: bold; color: white;">
              📍 ${billboard.Billboard_Name || 'لوحة'}
            </h3>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 12px;">
            <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="color: #6b7280; margin-bottom: 2px;">المقاس</div>
              <div style="font-weight: bold;">${billboard.Size || '-'}</div>
            </div>
            <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="color: #6b7280; margin-bottom: 2px;">المستوى</div>
              <div style="font-weight: bold;">${billboard.Level || '-'}</div>
            </div>
            <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="color: #6b7280; margin-bottom: 2px;">المدينة</div>
              <div style="font-weight: bold; font-size: 11px;">${billboard.City || '-'}</div>
            </div>
            <div style="background: #fef3c7; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="color: #92400e; margin-bottom: 2px;">نوع الإعلان</div>
              <div style="font-weight: bold; color: #92400e; font-size: 11px;">${adType}</div>
            </div>
          </div>
          <div style="background: #dbeafe; border-right: 3px solid #3b82f6; padding: 8px; border-radius: 6px; font-size: 11px; color: #1e40af; line-height: 1.4;">
            <strong>📌 الموقع:</strong><br/>${billboard.Nearest_Landmark || '-'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        minWidth: 260,
        className: 'home-billboard-popup',
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        marker.openPopup();
        if (onBillboardClick) {
          onBillboardClick(billboard);
        }
      });

      marker.addTo(map);
      markersRef.current[billboardId] = marker;
      bounds.push(position);
    });

    // Fit map to show all markers on initial load
    if (bounds.length > 0 && !hasInitializedBounds.current) {
      try {
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13
        });
        hasInitializedBounds.current = true;
      } catch (error) {
        console.error('Failed to fit bounds:', error);
      }
    }

    requestAnimationFrame(() => {
      if (map) {
        map.invalidateSize({ animate: false });
      }
    });

    return () => {
      // Cleanup
    };
  }, [filteredBillboards, mapReady, onBillboardClick]);

  return (
    <Card className="relative overflow-hidden">
      <style>{`
        .home-billboard-marker {
          z-index: 1000 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .home-billboard-marker:hover div:last-child {
          transform: rotate(-45deg) scale(1.1);
        }
        .home-billboard-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .home-billboard-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .leaflet-container {
          cursor: grab !important;
        }
        .leaflet-container:active {
          cursor: grabbing !important;
        }
      `}</style>
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2 pointer-events-auto">
        <Button
          size="sm"
          variant={mapType === 'streets' ? 'default' : 'outline'}
          onClick={() => setMapType('streets')}
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
        <div className="absolute top-16 right-4 z-[1000] bg-card border rounded-lg shadow-xl p-4 w-80 pointer-events-auto">
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
                <SelectTrigger>
                  <SelectValue placeholder="جميع المدن" />
                </SelectTrigger>
                <SelectContent>
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
                <SelectTrigger>
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="متاح">متاح</SelectItem>
                  <SelectItem value="مؤجر">مؤجر</SelectItem>
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
                  setStatusFilter('متاح');
                }}
              >
                إعادة تعيين
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapRef} style={{ height: '600px', width: '100%' }} />

      {/* Bottom Stats */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 pointer-events-auto">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>متاح</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>مؤجر</span>
          </div>
          <div className="border-r pr-4 mr-2">
            <Layers className="h-4 w-4 inline mr-1" />
            <strong>{filteredBillboards.length}</strong> لوحة
          </div>
        </div>
      </div>
    </Card>
  );
}
