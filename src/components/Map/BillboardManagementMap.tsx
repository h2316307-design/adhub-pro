import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
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

interface BillboardManagementMapProps {
  billboards: Billboard[];
  onBillboardClick?: (billboard: Billboard) => void;
}

// Status color mapping
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
  
  // ✅ FIX: Check if contract is expired before marking as rented
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

export function BillboardManagementMap({ billboards, onBillboardClick }: BillboardManagementMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const markerClusterGroupRef = useRef<any>(null);
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('satellite');
  const [mapReady, setMapReady] = useState(false);
  const hasInitializedBounds = useRef(false);
  const [enableClustering, setEnableClustering] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
      const statusColor = getStatusColor(b);
      const matchesStatus = statusFilter === 'all' || statusColor.label === statusFilter;
      
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

    // Clear existing marker cluster group
    if (markerClusterGroupRef.current) {
      map.removeLayer(markerClusterGroupRef.current);
      markerClusterGroupRef.current = null;
    }

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker: any) => {
      if (marker && map) {
        map.removeLayer(marker);
      }
    });
    markersRef.current = {};

    // Create marker cluster group if clustering is enabled
    if (enableClustering) {
      markerClusterGroupRef.current = (L as any).markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 60,
        iconCreateFunction: function(cluster: any) {
          const count = cluster.getChildCount();
          let size = 'small';
          let colorClass = 'bg-primary';
          
          if (count > 50) {
            size = 'large';
            colorClass = 'bg-destructive';
          } else if (count > 20) {
            size = 'medium';
            colorClass = 'bg-orange-500';
          }
          
          return L.divIcon({
            html: `<div class="cluster-icon ${size} ${colorClass}"><span>${count}</span></div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40)
          });
        }
      });
    }

    const bounds: [number, number][] = [];

    // Add markers for filtered billboards
    filteredBillboards.forEach((billboard) => {
      const billboardId = String(billboard.ID);
      const coords = billboard.GPS_Coordinates || (billboard as any).coordinates || '';
      
      const position = parseCoordinates(coords);
      
      if (!position) return;

      const { color, label } = getStatusColor(billboard);
      const adType = (billboard as any).Ad_Type || (billboard as any)['Ad Type'] || 'غير محدد';
      
      // Lighter color for better visibility
      const lightColor = color.replace(/\d+%\)/, (match) => {
        const num = parseInt(match);
        return `${Math.min(num + 10, 70)}%)`;
      });
      
      // Create custom marker with vibrant colors
      const iconHtml = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        ">
          <div style="
            background: ${color};
            color: white;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          ">
            ${label}
          </div>
          <div style="
            width: 42px;
            height: 42px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transform: rotate(-45deg);
            position: relative;
          ">
            <div style="
              position: absolute;
              inset: 3px;
              background: ${lightColor};
              border-radius: 50% 50% 50% 0;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="transform: rotate(45deg);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3" fill="white"></circle>
                </svg>
              </div>
            </div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'billboard-management-marker',
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
          <div style="background: ${color}; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
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
            <div style="background: ${color}20; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid ${color};">
              <div style="color: ${color}; margin-bottom: 2px; font-weight: bold;">الحالة</div>
              <div style="font-weight: bold; color: ${color}; font-size: 11px;">${label}</div>
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
        className: 'billboard-management-popup',
        closeButton: true,
        autoClose: true,
        closeOnClick: true,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        marker.openPopup();
        if (onBillboardClick) {
          onBillboardClick(billboard);
        }
      });

      // Add to cluster group or map
      if (enableClustering && markerClusterGroupRef.current) {
        markerClusterGroupRef.current.addLayer(marker);
      } else {
        marker.addTo(map);
      }
      
      markersRef.current[billboardId] = marker;
      bounds.push(position);
    });

    // Add cluster group to map if clustering is enabled
    if (enableClustering && markerClusterGroupRef.current) {
      map.addLayer(markerClusterGroupRef.current);
    }

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
      // Cleanup cluster group
      if (markerClusterGroupRef.current && map) {
        map.removeLayer(markerClusterGroupRef.current);
      }
    };
  }, [filteredBillboards, mapReady, onBillboardClick, enableClustering]);

  return (
    <Card className="relative overflow-hidden">
      <style>{`
        .billboard-management-marker {
          z-index: 1000 !important;
          cursor: pointer !important;
        }
        .billboard-management-marker:hover > div > div:last-child {
          transform: rotate(-45deg) scale(1.12) !important;
          box-shadow: 0 6px 20px rgba(0,0,0,0.5) !important;
        }
        .billboard-management-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
          overflow: hidden;
          background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%);
        }
        .billboard-management-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .billboard-management-popup .leaflet-popup-tip {
          box-shadow: 0 3px 14px rgba(0,0,0,0.2);
        }
        .leaflet-container {
          cursor: grab !important;
          background: linear-gradient(to bottom, #1e293b 0%, #0f172a 100%);
        }
        .leaflet-container:active {
          cursor: grabbing !important;
        }
        
        /* Cluster styles */
        .custom-cluster-icon {
          background: transparent;
          border: none;
        }
        .cluster-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: all 0.2s;
        }
        .cluster-icon:hover {
          transform: scale(1.1);
        }
        .cluster-icon.small {
          background: hsl(var(--primary));
        }
        .cluster-icon.medium {
          background: hsl(25 95% 53%);
          width: 46px;
          height: 46px;
          font-size: 15px;
        }
        .cluster-icon.large {
          background: hsl(0 84% 60%);
          width: 52px;
          height: 52px;
          font-size: 16px;
        }
        .marker-cluster {
          background-clip: padding-box;
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
