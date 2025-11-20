import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map as MapIcon, Satellite, Search, Filter, MapPin, Layers, CircleCheck as CheckCircle2, Circle } from 'lucide-react';
import type { Billboard } from '@/types';

// Fix default marker icon path issue with Leaflet + Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface BillboardSelectionMapProps {
  billboards: Billboard[];
  selectedIds: string[];
  onToggleSelect: (billboard: Billboard) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

export function BillboardSelectionMap({
  billboards,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearAll
}: BillboardSelectionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('satellite');
  const [mapReady, setMapReady] = useState(false);
  const hasInitializedBounds = useRef(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Get unique cities
  const cities = Array.from(new Set(billboards.map(b => b.City).filter(Boolean)));
  
  // Filter billboards
  const filteredBillboards = billboards.filter(b => {
    const matchesSearch = searchQuery === '' || 
      b.Billboard_Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.Nearest_Landmark?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCity = cityFilter === 'all' || b.City === cityFilter;
    
    const isSelected = selectedIds.includes(String(b.ID));
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'selected' && isSelected) ||
      (statusFilter === 'unselected' && !isSelected);
    
    return matchesSearch && matchesCity && matchesStatus;
  });


  // Initialize map with performance optimizations
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      // Create map centered on Libya (Tripoli) with performance settings
      const map = L.map(mapRef.current, {
        center: [32.8872, 13.1913],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: false, // Disable to allow dblclick on markers without zooming
        touchZoom: true,
        dragging: true,
        boxZoom: true,
        keyboard: true,
        tapTolerance: 15,
        preferCanvas: false, // SVG for better click detection
        trackResize: true,
        wheelPxPerZoomLevel: 60,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        inertia: true,
        inertiaDeceleration: 2000,
        inertiaMaxSpeed: 1000,
        worldCopyJump: false,
        maxBoundsViscosity: 0.8,
      });

      // Add tile layer based on map type (brand-aligned)
      const tileLayer = L.tileLayer(
        mapType === 'streets'
          ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' // Neutral brand-aligned
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
      
      // Add zoom controls
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

  // Ensure map resizes correctly when shown or container size changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapRef.current) return;
    const map = mapInstanceRef.current;

    // initial invalidate after mount/visibility change
    setTimeout(() => {
      try { map.invalidateSize(); } catch {}
    }, 150);

    const ro = new ResizeObserver(() => {
      try { map.invalidateSize(); } catch {}
    });
    ro.observe(mapRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
    };
  }, [mapReady]);

  // Update tile layer when map type changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    // Remove all existing tile layers
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current!.removeLayer(layer);
      }
    });

    // Add new tile layer (brand-aligned)
    const tileLayer = L.tileLayer(
      mapType === 'streets'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
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

  // Parse coordinates from string
  const parseCoordinates = (coords: string): [number, number] | null => {
    if (!coords) return null;

    try {
      // Try different coordinate formats
      // Format 1: "lat,lng" or "lat, lng"
      const parts = coords.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          // Validate Libya coordinates (roughly)
          if (lat >= 19 && lat <= 34 && lng >= 9 && lng <= 26) {
            return [lat, lng];
          }
        }
      }

      // Format 2: object with lat/lng
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
      console.warn('Failed to parse coordinates:', coords, error);
    }

    return null;
  };

  // Add/update markers - only recreate when filtered billboards change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    const map = mapInstanceRef.current;

    console.log('🗺️ بدء تحديث الدبابيس - عدد اللوحات المفلترة:', filteredBillboards.length);
    console.log('🗺️ عدد الدبابيس الحالية:', Object.keys(markersRef.current).length);

    // Get current marker IDs
    const currentMarkerIds = new Set(Object.keys(markersRef.current));
    const newBillboardIds = new Set(filteredBillboards.filter(b => {
      const coords = b.GPS_Coordinates || (b as any).coordinates || '';
      const hasValidCoords = parseCoordinates(coords) !== null;
      if (!hasValidCoords) {
        console.log('⚠️ لوحة بدون إحداثيات:', b.Billboard_Name, 'GPS:', coords);
      }
      return hasValidCoords;
    }).map(b => String(b.ID)));

    console.log('🗺️ عدد اللوحات بإحداثيات صحيحة:', newBillboardIds.size);

    // Remove markers that are no longer in filtered list
    let removedCount = 0;
    currentMarkerIds.forEach(id => {
      if (!newBillboardIds.has(id)) {
        const marker = markersRef.current[id];
        if (marker && map) {
          map.removeLayer(marker);
          delete markersRef.current[id];
          removedCount++;
        }
      }
    });
    
    if (removedCount > 0) {
      console.log('🗑️ تم حذف', removedCount, 'دبوس');
    }

    const bounds: [number, number][] = [];
    let addedCount = 0;
    let skippedCount = 0;

    // Add new markers or update existing ones
    filteredBillboards.forEach((billboard) => {
      const billboardId = String(billboard.ID);
      const coords = billboard.GPS_Coordinates || (billboard as any).coordinates || '';
      
      const position = parseCoordinates(coords);
      
      if (!position) {
        return;
      }

      bounds.push(position);

      // If marker already exists, just update its icon (don't recreate)
      if (markersRef.current[billboardId]) {
        skippedCount++;
        return; // Skip recreation
      }

      const isSelected = selectedIds.includes(billboardId);
      console.log('➕ إنشاء دبوس جديد للوحة:', billboard.Billboard_Name, 'في الموقع:', position);
      
      // Create custom icon
      const createIcon = (selected: boolean) => {
        const iconHtml = `
          <div class="billboard-pin-wrapper" style="
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            pointer-events: auto !important;
            z-index: 1000 !important;
          ">
            <div class="billboard-pin" style="
              width: 45px;
              height: 45px;
              background: ${selected ? 'hsl(120 60% 50%)' : 'hsl(45 93% 58%)'};
              border: 4px solid white;
              border-radius: 50% 50% 50% 0;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 6px 16px ${selected ? 'hsl(120 60% 50% / 0.5)' : 'hsl(45 93% 58% / 0.5)'}, 0 0 0 8px ${selected ? 'hsl(120 60% 50% / 0.1)' : 'hsl(45 93% 58% / 0.1)'};
              transform: rotate(-45deg);
              cursor: pointer;
              transition: all 0.2s ease;
              pointer-events: auto !important;
            ">
              <div style="transform: rotate(45deg); pointer-events: none;">
                ${selected
                  ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                  : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
                }
              </div>
            </div>
          </div>
        `;

        return L.divIcon({
          html: iconHtml,
          className: 'billboard-marker',
          iconSize: [50, 50],
          iconAnchor: [25, 50],
          popupAnchor: [0, -40],
        });
      };

      const marker = L.marker(position, {
        icon: createIcon(isSelected),
        interactive: true,
        bubblingMouseEvents: false,
        riseOnHover: true,
        riseOffset: 250
      });

      // Store createIcon function with marker for later updates
      (marker as any)._billboardData = { billboard, createIcon };

      // Create popup content - compact version
      const createPopupContent = (selected: boolean) => {
        const imageUrl = billboard.Image_URL || `/image/${billboard.Billboard_Name}.jpg`;
        const nearestLandmark = billboard.Nearest_Landmark || '-';
        
        return `
          <div style="min-width: 240px; max-width: 260px; font-family: 'Cairo', sans-serif; direction: rtl;">
            ${billboard.Image_URL || billboard.Billboard_Name ? `
              <div style="margin-bottom: 8px; width: 100%; height: 120px; overflow: hidden; border-radius: 8px; background: var(--gradient-dark); position: relative;">
                <img 
                  src="${imageUrl}" 
                  alt="${billboard.Billboard_Name || 'صورة اللوحة'}"
                  style="width: 100%; height: 100%; object-fit: cover;"
                  onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2212%22%3E لا توجد صورة%3C/text%3E%3C/svg%3E';"
                />
                <div style="position: absolute; top: 6px; right: 6px; background: ${selected ? 'hsl(120 60% 50%)' : 'hsl(var(--muted))'}; color: ${selected ? 'hsl(var(--background))' : 'hsl(var(--foreground))'}; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; backdrop-filter: blur(8px);">
                  ${selected ? '✓' : '○'}
                </div>
              </div>
            ` : ''}
            <div style="background: ${selected ? 'hsl(120 60% 50%)' : 'hsl(45 93% 58%)'}; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: hsl(var(--background)); text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                📍 ${billboard.Billboard_Name || 'لوحة'}
              </h3>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
              <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">المقاس</div>
                <div style="font-size: 12px; font-weight: bold; color: hsl(var(--foreground));">${billboard.Size || '-'}</div>
              </div>
              <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">المستوى</div>
                <div style="font-size: 12px; font-weight: bold; color: hsl(var(--foreground));">${billboard.Level || '-'}</div>
              </div>
              <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">الأوجه</div>
                <div style="font-size: 12px; font-weight: bold; color: hsl(var(--foreground));">${billboard.Faces_Count || 2}</div>
              </div>
              <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">المدينة</div>
                <div style="font-size: 11px; font-weight: bold; color: hsl(var(--foreground));">${billboard.City || '-'}</div>
              </div>
            </div>
            <div style="background: #fef3c7; border-right: 2px solid #f59e0b; padding: 6px 8px; border-radius: 6px; margin-bottom: 8px;">
              <div style="font-size: 10px; color: #92400e; line-height: 1.3;">
                <strong>📌 الموقع:</strong> ${nearestLandmark.length > 40 ? nearestLandmark.substring(0, 40) + '...' : nearestLandmark}
              </div>
            </div>
            <button 
              onclick="window.toggleBillboard('${billboardId}')"
              style="
                width: 100%;
                padding: 10px;
                background: ${selected ? 'hsl(0 80% 60%)' : 'hsl(120 60% 50%)'};
                color: hsl(var(--background));
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 700;
                font-size: 13px;
                transition: all 0.2s;
                box-shadow: 0 2px 8px ${selected ? 'hsl(0 80% 60% / 0.4)' : 'hsl(120 60% 50% / 0.4)'};
              "
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px ${selected ? 'hsl(0 80% 60% / 0.5)' : 'hsl(120 60% 50% / 0.5)'}';"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${selected ? 'hsl(0 80% 60% / 0.4)' : 'hsl(120 60% 50% / 0.4)'}';"
            >
              ${selected ? '✕ إلغاء' : '✓ اختيار'}
            </button>
          </div>
        `;
      };

      marker.bindPopup(createPopupContent(isSelected), {
        maxWidth: 260,
        minWidth: 240,
        className: 'billboard-popup',
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        keepInView: true,
        autoPan: true,
        autoPanPadding: [50, 50]
      });

      // Improved interaction
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        marker.openPopup();
      });

      marker.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        onToggleSelect(billboard);
      });

      marker.on('touchstart', (e) => {
        L.DomEvent.stopPropagation(e);
        marker.openPopup();
      });

      marker.on('mouseover', () => {
        marker.setZIndexOffset(1000);
      });

      marker.on('mouseout', () => {
        marker.setZIndexOffset(0);
      });

      marker.addTo(map);
      markersRef.current[billboardId] = marker;
      addedCount++;
    });

    console.log('✅ تم إضافة', addedCount, 'دبوس جديد');
    console.log('⏭️ تم تخطي', skippedCount, 'دبوس موجود بالفعل');
    console.log('📍 إجمالي الدبابيس الآن:', Object.keys(markersRef.current).length);
    console.log('🎯 إجمالي المواقع:', bounds.length);

    // Fit map to show all markers only on initial load
    if (bounds.length > 0 && !hasInitializedBounds.current) {
      try {
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13
        });
        hasInitializedBounds.current = true;
      } catch (error) {
        console.error('فشل في تعديل حدود الخريطة:', error);
      }
    }

    // Setup global toggle function for popup buttons
    (window as any).toggleBillboard = (billboardId: string) => {
      const billboard = billboards.find(b => String(b.ID) === billboardId);
      if (billboard) {
        onToggleSelect(billboard);
      }
    };

    return () => {
      delete (window as any).toggleBillboard;
    };
  }, [filteredBillboards, mapReady]);

  // Update marker icons and popups when selection changes (without recreating markers)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    Object.entries(markersRef.current).forEach(([billboardId, marker]) => {
      const isSelected = selectedIds.includes(billboardId);
      const billboardData = (marker as any)._billboardData;
      
      if (billboardData && billboardData.createIcon) {
        // Update icon
        marker.setIcon(billboardData.createIcon(isSelected));
        
        // Update popup content if popup exists
        const popup = marker.getPopup();
        if (popup) {
          const billboard = billboardData.billboard;
          const imageUrl = billboard.Image_URL || `/image/${billboard.Billboard_Name}.jpg`;
          const nearestLandmark = billboard.Nearest_Landmark || '-';
          
          const newContent = `
            <div style="min-width: 240px; max-width: 260px; font-family: 'Cairo', sans-serif; direction: rtl;">
              ${billboard.Image_URL || billboard.Billboard_Name ? `
                <div style="margin-bottom: 8px; width: 100%; height: 120px; overflow: hidden; border-radius: 8px; background: var(--gradient-dark); position: relative;">
                  <img 
                    src="${imageUrl}" 
                    alt="${billboard.Billboard_Name || 'صورة اللوحة'}"
                    style="width: 100%; height: 100%; object-fit: cover;"
                    onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2212%22%3E لا توجد صورة%3C/text%3E%3C/svg%3E';"
                  />
                  <div style="position: absolute; top: 6px; right: 6px; background: ${isSelected ? 'hsl(120 60% 50%)' : 'hsl(var(--muted))'}; color: ${isSelected ? 'hsl(var(--background))' : 'hsl(var(--foreground))'}; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; backdrop-filter: blur(8px);">
                    ${isSelected ? '✓' : '○'}
                  </div>
                </div>
              ` : ''}
              <div style="background: ${isSelected ? 'hsl(120 60% 50%)' : 'hsl(45 93% 58%)'}; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: hsl(var(--background)); text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                  📍 ${billboard.Billboard_Name || 'لوحة'}
                </h3>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">المقاس</div>
                  <div style="font-size: 12px; font-weight: bold; color: hsl(var(--foreground));">${billboard.Size || '-'}</div>
                </div>
                <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">المستوى</div>
                  <div style="font-size: 12px; font-weight: bold; color: hsl(var(--foreground));">${billboard.Level || '-'}</div>
                </div>
                <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">الأوجه</div>
                  <div style="font-size: 12px; font-weight: bold; color: hsl(var(--foreground));">${billboard.Faces_Count || 2}</div>
                </div>
                <div style="background: hsl(var(--muted)); padding: 6px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 9px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">المدينة</div>
                  <div style="font-size: 11px; font-weight: bold; color: hsl(var(--foreground));">${billboard.City || '-'}</div>
                </div>
              </div>
              <div style="background: #fef3c7; border-right: 2px solid #f59e0b; padding: 6px 8px; border-radius: 6px; margin-bottom: 8px;">
                <div style="font-size: 10px; color: #92400e; line-height: 1.3;">
                  <strong>📌 الموقع:</strong> ${nearestLandmark.length > 40 ? nearestLandmark.substring(0, 40) + '...' : nearestLandmark}
                </div>
              </div>
              <button 
                onclick="window.toggleBillboard('${billboardId}')"
                style="
                  width: 100%;
                  padding: 10px;
                  background: ${isSelected ? 'hsl(0 80% 60%)' : 'hsl(120 60% 50%)'};
                  color: hsl(var(--background));
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 700;
                  font-size: 13px;
                  transition: all 0.2s;
                  box-shadow: 0 2px 8px ${isSelected ? 'hsl(0 80% 60% / 0.4)' : 'hsl(120 60% 50% / 0.4)'};
                "
                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px ${isSelected ? 'hsl(0 80% 60% / 0.5)' : 'hsl(120 60% 50% / 0.5)'}';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${isSelected ? 'hsl(0 80% 60% / 0.4)' : 'hsl(120 60% 50% / 0.4)'}';"
              >
                ${isSelected ? '✕ إلغاء' : '✓ اختيار'}
              </button>
            </div>
          `;
          
          popup.setContent(newContent);
        }
      }
    });
  }, [selectedIds, mapReady]);

  return (
    <Card className="relative overflow-hidden" style={{ zIndex: 1 }}>
      <style>{`
        .billboard-marker {
          z-index: 1000 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .billboard-pin-wrapper {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .billboard-pin {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .billboard-pin:hover {
          transform: rotate(-45deg) scale(1.1);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
        }
        .billboard-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        .billboard-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .leaflet-container {
          cursor: grab !important;
        }
        .leaflet-container:active {
          cursor: grabbing !important;
        }
        .leaflet-marker-icon {
          pointer-events: auto !important;
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
          <MapIcon className="h-4 w-4 ml-1" />
          خرائط
        </Button>
        <Button
          size="sm"
          variant={mapType === 'satellite' ? 'default' : 'outline'}
          onClick={() => setMapType('satellite')}
          className="shadow-lg"
        >
          <Satellite className="h-4 w-4 ml-1" />
          أقمار صناعية
        </Button>
        <Button
          size="sm"
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className="shadow-lg"
        >
          <Filter className="h-4 w-4 ml-1" />
          فلترة
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-16 right-4 z-[1000] bg-card/95 border border-border rounded-xl shadow-2xl p-4 space-y-3 pointer-events-auto w-80">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              تصفية اللوحات
            </h3>
            <Badge variant="secondary" className="text-xs">
              {filteredBillboards.length} من {billboards.length}
            </Badge>
          </div>
          
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ابحث عن لوحة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 text-right"
            />
          </div>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="text-right">
              <SelectValue placeholder="اختر المدينة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المدن</SelectItem>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-right">
              <SelectValue placeholder="حالة التحديد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="selected">المحددة فقط</SelectItem>
              <SelectItem value="unselected">غير المحددة فقط</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2 pt-2">
            {onSelectAll && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSelectAll}
                className="flex-1"
              >
                <CheckCircle2 className="h-3 w-3 ml-1" />
                تحديد الكل
              </Button>
            )}
            {onClearAll && (
              <Button
                size="sm"
                variant="outline"
                onClick={onClearAll}
                className="flex-1"
              >
                <Circle className="h-3 w-3 ml-1" />
                إلغاء الكل
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="absolute top-4 left-4 z-[1000] flex gap-2 pointer-events-auto">
        <Badge variant="secondary" className="shadow-lg px-3 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]">
          <Layers className="h-3 w-3 ml-1" />
          {filteredBillboards.length} لوحة
        </Badge>
        <Badge variant="default" className="shadow-lg px-3 py-2 bg-[hsl(var(--green))] text-[hsl(var(--background))]">
          <CheckCircle2 className="h-3 w-3 ml-1" />
          {selectedIds.length} محددة
        </Badge>
      </div>
      
      {/* Helper Text - Improved visibility */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-3 rounded-xl shadow-2xl pointer-events-auto border-2 border-[hsl(var(--ring))]/30">
        <p className="text-sm font-bold flex items-center gap-2">
          <MapPin className="h-4 w-4 animate-pulse" />
          انقر على الدبوس لعرض التفاصيل
        </p>
        <p className="text-xs mt-1 opacity-90">
          استخدم الأزرار في النافذة المنبثقة لاختيار اللوحة
        </p>
      </div>
      
      <div
        ref={mapRef}
        className="w-full h-[600px] relative"
        style={{
          background: 'hsl(var(--muted))',
          touchAction: 'manipulation',
          position: 'relative',
          zIndex: 1,
          cursor: 'grab',
          WebkitTapHighlightColor: 'transparent'
        }}
      />
      
      {/* Custom Styles for Billboard Markers */}
      <style>{`
        .billboard-marker {
          z-index: 600 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
        }

        .billboard-marker:hover {
          z-index: 1500 !important;
        }

        .billboard-pin-wrapper {
          pointer-events: auto !important;
          cursor: pointer !important;
        }

        .billboard-pin-wrapper:hover .billboard-pin {
          transform: rotate(-45deg) scale(1.15);
          box-shadow: 0 8px 24px hsl(45 93% 58% / 0.7), 0 0 0 12px hsl(45 93% 58% / 0.15) !important;
        }

        .billboard-pin {
          will-change: transform, box-shadow;
        }
        
        .leaflet-popup-content-wrapper {
          background: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
        }
        
        .leaflet-popup-tip {
          background: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border)) !important;
        }
        
        .leaflet-container {
          cursor: grab;
        }
        
        .leaflet-container:active {
          cursor: grabbing;
        }
      `}</style>

      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
          </div>
        </div>
      )}
      
      {/* Enhanced CSS Styles */}
      <style>{`
        .billboard-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          padding: 0;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          z-index: 500 !important;
          overflow: hidden;
        }
        .billboard-popup .leaflet-popup-content {
          margin: 0;
          padding: 0;
          width: 300px !important;
        }
        .billboard-popup .leaflet-popup-tip {
          background: white;
          box-shadow: 0 3px 14px rgba(0,0,0,0.15);
        }
        .leaflet-container {
          cursor: grab !important;
          position: relative !important;
          font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          will-change: transform;
        }
        .leaflet-container:active {
          cursor: grabbing !important;
        }
        .leaflet-container * {
          -webkit-tap-highlight-color: transparent;
        }
        .leaflet-control-zoom {
          z-index: 900 !important;
          border: none !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
        .leaflet-control-zoom a {
          width: 42px !important;
          height: 42px !important;
          line-height: 42px !important;
          font-size: 22px !important;
          border-radius: 10px !important;
          background: white !important;
          color: #333 !important;
          transition: all 0.2s ease !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f0f0f0 !important;
          transform: scale(1.05) !important;
        }
        .leaflet-control-zoom a:active {
          transform: scale(0.95) !important;
        }
        .leaflet-pane {
          z-index: auto !important;
        }
        .leaflet-tile-pane {
          z-index: 200 !important;
        }
        .leaflet-marker-pane {
          z-index: 600 !important;
          pointer-events: auto !important;
        }
        .leaflet-popup-pane {
          z-index: 1200 !important;
        }
        .leaflet-shadow-pane {
          z-index: 500 !important;
        }
        .billboard-marker {
          pointer-events: auto !important;
          cursor: pointer !important;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          touch-action: manipulation;
        }
        .billboard-marker:hover {
          z-index: 1500 !important;
        }
        .billboard-marker:hover .billboard-pin {
          transform: translateY(-6px) rotate(-45deg) scale(1.2) !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
        }
        .billboard-marker:active .billboard-pin {
          transform: translateY(-2px) rotate(-45deg) scale(1.05) !important;
        }
        @media (hover: none) {
          .billboard-marker {
            -webkit-tap-highlight-color: transparent;
          }
        }
      `}</style>
    </Card>
  );
}
