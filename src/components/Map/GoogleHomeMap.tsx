/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Map as MapIcon, Globe, MapPin } from 'lucide-react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Billboard } from '@/types';
import type { MapProvider } from '@/types/map';
import { OSM_TILE_LAYERS } from '@/types/map';
import { createCompactPopupContent, getBillboardStatus, getSizeColor } from '@/hooks/useMapMarkers';
import { useMapNavigation, calculateDistance } from '@/hooks/useMapNavigation';
import MapHeader from './MapHeader';
import MapLegend from './MapLegend';
import MapControlButtons from './MapControlButtons';
import MapSearchBar from './MapSearchBar';
import LiveTrackingMode from './LiveTrackingMode';
import ImageLightbox from './ImageLightbox';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';

interface GoogleHomeMapProps {
  billboards: Billboard[];
  onBillboardClick?: (billboard: Billboard) => void;
  onImageView?: (imageUrl: string) => void;
  className?: string;
  // External filter props for integration with parent page
  externalSearchQuery?: string;
  externalStatusFilter?: string[];
  externalCityFilter?: string[];
  externalSizeFilter?: string[];
  externalMunicipalityFilter?: string[];
  externalShowSociet?: boolean;
  onShowSocietChange?: (val: boolean) => void;
}

function parseCoords(b: Billboard): { lat: number; lng: number } | null {
  const coords = (b as any).GPS_Coordinates || (b as any).coordinates;
  if (!coords) return null;
  
  if (typeof coords === 'string') {
    const parts = coords.split(',').map((c: string) => parseFloat(c.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180) {
        return { lat: parts[0], lng: parts[1] };
      }
    }
  }
  return null;
}

const LIBYA_CENTER = { lat: 32.8872, lng: 13.1913 };

export default function GoogleHomeMap({ 
  billboards, 
  onBillboardClick, 
  onImageView, 
  className,
  externalSearchQuery,
  externalStatusFilter,
  externalCityFilter,
  externalSizeFilter,
  externalMunicipalityFilter,
  externalShowSociet,
  onShowSocietChange
}: GoogleHomeMapProps) {


  // Google Maps refs
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googleClustererRef = useRef<MarkerClusterer | null>(null);
  const googleInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const googleUserMarkerRef = useRef<google.maps.Marker | null>(null);
  const googleLiveMarkerRef = useRef<google.maps.Marker | null>(null);
  const googleRouteRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const googleRecordedRouteRef = useRef<google.maps.Polyline | null>(null);
  const prevFilterKeyRef = useRef<string>('');
  const hasFitBoundsRef = useRef(false);
  
  // Leaflet refs
  const leafletMapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const leafletClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletUserMarkerRef = useRef<L.Marker | null>(null);
  const leafletLiveMarkerRef = useRef<L.Marker | null>(null);
  const leafletRecordedRouteRef = useRef<L.Polyline | null>(null);
  
  // Container ref for fullscreen
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State - Google is the default provider (Keyless loader)
  const [mapProvider, setMapProvider] = useState<MapProvider>('google');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'styled' | 'detailed'>('satellite');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Navigation hook
  const {
    isTracking,
    liveLocation,
    startTracking,
    stopTracking,
    isRecording,
    recordedRoute,
    stopRecording,
    userLocation,
    requestUserLocation,
    autoOpenPopup,
    setAutoOpenPopup,
    addPassedBillboard
  } = useMapNavigation();
  
  // Passed billboard IDs for fading (within 50m becomes visited)
  const [passedBillboardIds, setPassedBillboardIds] = useState<Set<number>>(new Set());
  
  // GTA-style tracking zoom level
  const TRACKING_ZOOM_LEVEL = 17;

  // Calculate nearby billboards for tracking bar
  const nearbyBillboards = useMemo(() => {
    if (!liveLocation) return [];
    
    return billboards
      .map(b => {
        const coords = parseCoords(b);
        if (!coords) return null;
        const distance = calculateDistance(liveLocation.lat, liveLocation.lng, coords.lat, coords.lng);
        return {
          id: (b as any).ID || 0,
          name: (b as any).Billboard_Name || '',
          distance,
          landmark: (b as any).Nearest_Landmark || '',
          imageUrl: (b as any).design_face_a || (b as any).Image_URL || ''
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null && b.distance < 500)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  }, [billboards, liveLocation]);

  // Track billboards within 50m as "visited" (for fading effect)
  useEffect(() => {
    if (!isTracking || !liveLocation) return;
    
    nearbyBillboards.forEach(nb => {
      if (nb.distance <= 50 && !passedBillboardIds.has(nb.id)) {
        setPassedBillboardIds(prev => new Set(prev).add(nb.id));
      }
    });
  }, [liveLocation, nearbyBillboards, isTracking, passedBillboardIds]);

  // Helper to check billboard status for filtering - matches BillboardFilters options
  const getFilterStatus = (billboard: any): string[] => {
    const statuses: string[] = [];
    const status = String(billboard.Status || billboard.status || '').trim();
    const maintenanceStatus = String(billboard.maintenance_status || '').trim();
    const maintenanceType = String(billboard.maintenance_type || '').trim();
    const isVisibleInAvailable = billboard.is_visible_in_available;
    
    // إزالة
    if (status === 'إزالة' || status === 'ازالة' || status.toLowerCase() === 'removed' ||
        maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة') {
      statuses.push('إزالة');
    }
    
    // لم يتم التركيب
    if (maintenanceStatus === 'لم يتم التركيب' || maintenanceType === 'لم يتم التركيب') {
      statuses.push('لم يتم التركيب');
    }
    
    // تحتاج ازالة لغرض التطوير
    if (maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceType === 'تحتاج إزالة') {
      statuses.push('تحتاج ازالة لغرض التطوير');
    }
    
    // قيد الصيانة
    if (status === 'صيانة' || maintenanceStatus === 'maintenance' || maintenanceStatus === 'قيد الصيانة') {
      statuses.push('قيد الصيانة');
    }
    
    // متضررة اللوحة
    if (maintenanceStatus === 'repair_needed' || maintenanceStatus === 'تحتاج إصلاح' || 
        maintenanceStatus === 'متضررة اللوحة') {
      statuses.push('متضررة اللوحة');
    }
    
    // مخفية من المتاح
    if (isVisibleInAvailable === false) {
      statuses.push('مخفية من المتاح');
    }
    
    // Check contract status
    const hasContract = !!billboard.Contract_Number;
    const rentEndDate = billboard.Rent_End_Date || billboard.rent_end_date;
    
    if (hasContract && rentEndDate) {
      const endDate = new Date(rentEndDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        statuses.push('منتهي');
        statuses.push('متاحة');
      } else if (daysUntilExpiry <= 30) {
        statuses.push('قريبة الانتهاء');
        statuses.push('محجوز');
      } else {
        statuses.push('محجوز');
      }
    } else if (!hasContract && statuses.length === 0) {
      statuses.push('متاحة');
    }
    
    return statuses;
  };

  // Filter billboards - combine internal search with external filters
  const filteredBillboards = useMemo(() => {
    const combinedSearchQuery = externalSearchQuery || searchQuery;
    
    return billboards.filter(b => {
      // Must have valid coordinates
      if (!parseCoords(b)) return false;

      // سوسيت filter: إذا كان عرض السوسيت مفعّل → أظهر السوسيت فقط، وإلا أخفِ السوسيت
      const sizeVal = String((b as any).Size || (b as any).size || '').trim();
      if (externalShowSociet) {
        if (sizeVal !== 'سوسيت') return false;
      } else {
        if (sizeVal === 'سوسيت') return false;
      }
      
      // Search filter
      if (combinedSearchQuery) {
        const query = combinedSearchQuery.toLowerCase();
        const matchesSearch = 
          (b as any).Billboard_Name?.toLowerCase().includes(query) ||
          (b as any).Nearest_Landmark?.toLowerCase().includes(query) ||
          (b as any).City?.toLowerCase().includes(query) ||
          (b as any).Customer_Name?.toLowerCase().includes(query) ||
          (b as any).Municipality?.toLowerCase().includes(query) ||
          String((b as any).Contract_Number || '').includes(query) ||
          String((b as any).ID || '').includes(query);
        
        if (!matchesSearch) return false;
      }
      
      // External status filter - check if any of billboard's statuses match any filter option
      // إذا تم اختيار "all" (جميع الحالات) لا يتم تطبيق فلتر الحالة
      if (externalStatusFilter && externalStatusFilter.length > 0 && !externalStatusFilter.includes('all')) {
        const billboardStatuses = getFilterStatus(b);
        const hasMatchingStatus = externalStatusFilter.some(filterStatus => 
          billboardStatuses.includes(filterStatus)
        );
        if (!hasMatchingStatus) return false;
      }
      
      // External city filter
      if (externalCityFilter && externalCityFilter.length > 0) {
        const city = (b as any).City || '';
        if (!externalCityFilter.includes(city)) return false;
      }
      
      // External size filter
      if (externalSizeFilter && externalSizeFilter.length > 0) {
        const size = (b as any).Size || '';
        if (!externalSizeFilter.includes(size)) return false;
      }
      
      // External municipality filter
      if (externalMunicipalityFilter && externalMunicipalityFilter.length > 0) {
        const municipality = (b as any).Municipality || '';
        if (!externalMunicipalityFilter.includes(municipality)) return false;
      }
      
      return true;
    });
  }, [billboards, searchQuery, externalSearchQuery, externalStatusFilter, externalCityFilter, externalSizeFilter, externalMunicipalityFilter, externalShowSociet]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const currentZoom = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(currentZoom + 1);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomIn();
    }
  }, [mapProvider]);

  const handleZoomOut = useCallback(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const currentZoom = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(currentZoom - 1);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomOut();
    }
  }, [mapProvider]);

  // Center on user
  const handleCenterOnUser = useCallback(() => {
    const location = liveLocation || userLocation;
    if (!location) {
      requestUserLocation();
      return;
    }
    
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      googleMapInstanceRef.current.panTo({ lat: location.lat, lng: location.lng });
      googleMapInstanceRef.current.setZoom(15);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setView([location.lat, location.lng], 15);
    }
  }, [mapProvider, liveLocation, userLocation, requestUserLocation]);

  const handleToggleProvider = useCallback(() => {
    setMapProvider(prev => prev === 'google' ? 'openstreetmap' : 'google');
  }, []);

  // Create pin with size on TOP and customer name below
  // ✅ Compact pin with size label INSIDE - same as SelectableGoogleHomeMap
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false, isVisited: boolean = false) => {
    const status = getBillboardStatus(billboard);
    const size = (billboard as any).Size || '';
    const isHidden = (billboard as any).is_visible_in_available === false;
    const isAvailable = status.label === 'متاحة' || status.label === 'متاح';
    const isSoon = status.label === 'محجوزة';
    const statusColor = isHidden ? '#6b7280' : isVisited ? '#00ff6a' : (isAvailable ? '#00ff6a' : isSoon ? '#f59e0b' : '#ef4444');
    
    // ✅ Pin color based on size ONLY - gray if hidden
    const colors = isHidden 
      ? { bg: '#6b7280', border: '#9ca3af', text: '#fff' } 
      : getSizeColor(size);

    const adjustColor = (hex: string, amount: number): string => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };

    const pinSize = isSelected ? 42 : 30;
    const w = pinSize + 20;
    const h = pinSize + 28;
    const cx = w / 2;
    const headR = pinSize / 2.2;
    const uniqueId = `pin-${(billboard as any).ID || Math.random()}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);

    const shortSize = size.length > 6 ? size.substring(0, 5) + '..' : size;
    const fontSize = isSelected ? 11 : 9;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="body${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${adjustColor(colors.bg, 50)}"/>
          <stop offset="50%" stop-color="${colors.bg}"/>
          <stop offset="100%" stop-color="${adjustColor(colors.bg, -40)}"/>
        </linearGradient>
        <filter id="shadow${uniqueId}" x="-50%" y="-30%" width="200%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.45)"/>
        </filter>
        <radialGradient id="glow${uniqueId}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${statusColor}" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="${statusColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      
      <ellipse cx="${cx}" cy="${h - 3}" rx="${pinSize * 0.18}" ry="2.5" fill="rgba(0,0,0,0.2)"/>
      
      ${isAvailable ? `
      <circle cx="${cx}" cy="${headR + 8}" r="${headR + 4}" fill="none" stroke="${statusColor}" stroke-width="1.5" opacity="0.4">
        <animate attributeName="r" values="${headR + 1};${headR + 10}" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      ` : ''}
      
      <g filter="url(#shadow${uniqueId})">
        <path d="M${cx},${h - 5} 
                 C${cx - 3},${h - 12} ${cx - headR - 3},${headR + 14} ${cx - headR - 3},${headR + 8}
                 A${headR + 3},${headR + 3} 0 1,1 ${cx + headR + 3},${headR + 8}
                 C${cx + headR + 3},${headR + 14} ${cx + 3},${h - 12} ${cx},${h - 5}Z"
              fill="url(#body${uniqueId})" 
              stroke="${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.35)'}" 
              stroke-width="${isSelected ? 2.5 : 1}"/>
        
        <!-- Status ring -->
        <circle cx="${cx}" cy="${headR + 8}" r="${headR * 0.8}" fill="rgba(0,0,0,0.25)"/>
        <circle cx="${cx}" cy="${headR + 8}" r="${headR * 0.75}" fill="none" stroke="${statusColor}" stroke-width="2" opacity="0.8"/>
        
        <!-- Size label inside pin -->
        <text x="${cx}" y="${headR + 8 + fontSize * 0.35}" text-anchor="middle" 
              fill="#fff" font-size="${fontSize}px" font-weight="bold" font-family="Arial, sans-serif"
              style="text-shadow: 0 1px 3px rgba(0,0,0,0.9)">${shortSize}</text>
      </g>
      
      ${isSelected ? `
      <circle cx="${cx}" cy="${headR + 8}" r="${headR + 7}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4,2" opacity="0.85">
        <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${headR + 8}" to="360 ${cx} ${headR + 8}" dur="4s" repeatCount="indefinite"/>
      </circle>
      <g>
        <circle cx="${cx + headR + 1}" cy="5" r="8" fill="#fbbf24"/>
        <path d="M${cx + headR - 2} 5 l2.5 2.5 l4.5 -4.5" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>
      ` : ''}
    </svg>`;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      width: w,
      height: h,
      anchorX: cx,
      anchorY: h - 5
    };
  }, [isMobile]);

  // Initialize Leaflet map
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapRef.current || leafletMapInstanceRef.current) return;

    const map = L.map(leafletMapRef.current, {
      center: [LIBYA_CENTER.lat, LIBYA_CENTER.lng],
      zoom: 8,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 18,
      minZoom: 5
    });

    leafletMapInstanceRef.current = map;

    // Double-click to copy coordinates with temporary pin
    let tempLeafletMarker: L.Marker | null = null;
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);
      const coordsText = `${lat}, ${lng}`;
      
      // Remove previous temp marker
      if (tempLeafletMarker) {
        map.removeLayer(tempLeafletMarker);
      }
      
      // Add temporary pin
      const tempIcon = L.divIcon({
        className: 'temp-coord-pin',
        html: `<div style="
          width: 32px; height: 32px;
          background: #f59e0b;
          border: 3px solid #fff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          animation: tempPinDrop 0.3s ease-out;
        "><div style="
          transform: rotate(45deg);
          text-align: center;
          line-height: 26px;
          font-size: 14px;
        ">📍</div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      
      tempLeafletMarker = L.marker(e.latlng, { icon: tempIcon, interactive: false }).addTo(map);
      
      // Copy to clipboard
      navigator.clipboard.writeText(coordsText).then(() => {
        toast.success(`تم نسخ الإحداثيات: ${coordsText}`, { duration: 2500 });
      }).catch(() => {
        toast.info(coordsText, { duration: 3000 });
      });
      
      // Remove pin after 2 seconds
      setTimeout(() => {
        if (tempLeafletMarker) {
          map.removeLayer(tempLeafletMarker);
          tempLeafletMarker = null;
        }
      }, 2000);
    });

    const tileConfig = mapType === 'satellite' ? OSM_TILE_LAYERS.satellite : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 18
    }).addTo(map);

    leafletClusterRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const displayCount = count > 99 ? '99+' : String(count);
        const size = count > 50 ? 56 : count > 20 ? 48 : 44;
        
        return L.divIcon({
          html: `
            <div style="width: ${size}px; height: ${size}px; position: relative; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));">
              <svg width="${size}" height="${size}" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="clusterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#d4af37"/>
                    <stop offset="100%" style="stop-color:#b8860b"/>
                  </linearGradient>
                </defs>
                <circle cx="25" cy="25" r="23" fill="url(#clusterGrad)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
              </svg>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #d4af37; font-weight: 800; font-size: ${count > 50 ? 14 : 13}px; font-family: Tajawal, sans-serif;">${displayCount}</div>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: L.point(size, size),
          iconAnchor: L.point(size / 2, size / 2)
        });
      }
    });
    map.addLayer(leafletClusterRef.current);

    return () => {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
        leafletClusterRef.current = null;
      }
    };
  }, [mapProvider]);

  // Update Leaflet tile layer
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletTileRef.current) return;

    leafletMapInstanceRef.current.removeLayer(leafletTileRef.current);
    
    const tileConfig = mapType === 'satellite' ? OSM_TILE_LAYERS.satellite : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 18
    }).addTo(leafletMapInstanceRef.current);
  }, [mapType, mapProvider]);

  // Update Leaflet markers
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletClusterRef.current) return;

    leafletClusterRef.current.clearLayers();

    const bounds = L.latLngBounds([]);
    let hasMarkers = false;

    filteredBillboards.forEach((b) => {
      const coords = parseCoords(b);
      if (!coords) return;

      const billboardId = (b as any).ID || 0;
      const isVisited = passedBillboardIds.has(billboardId);
      const pinData = createPinWithLabel(b, false, isVisited);
      
      const icon = L.icon({
        iconUrl: pinData.url,
        iconSize: [pinData.width, pinData.height],
        iconAnchor: [pinData.anchorX, pinData.anchorY],
        popupAnchor: [0, -pinData.anchorY]
      });

      const marker = L.marker([coords.lat, coords.lng], { icon });
      
      const popupContent = createCompactPopupContent(b);
      marker.bindPopup(popupContent, { 
        className: 'leaflet-popup-dark',
        maxWidth: isMobile ? Math.max(220, Math.min(320, window.innerWidth - 32)) : 340
      });

      marker.on('click', () => {
        if (onBillboardClick) onBillboardClick(b);
      });

      leafletClusterRef.current?.addLayer(marker);

      bounds.extend([coords.lat, coords.lng]);
      hasMarkers = true;
    });

    // ✅ Only fitBounds on initial load, not every re-render
    if (hasMarkers && bounds.isValid() && !hasFitBoundsRef.current) {
      hasFitBoundsRef.current = true;
      leafletMapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    }
  }, [filteredBillboards, mapProvider, onBillboardClick, createPinWithLabel, passedBillboardIds]);

  // Leaflet: User/Live location markers
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current) return;

    // Clear existing markers
    if (leafletUserMarkerRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletUserMarkerRef.current);
      leafletUserMarkerRef.current = null;
    }
    if (leafletLiveMarkerRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletLiveMarkerRef.current);
      leafletLiveMarkerRef.current = null;
    }

    const location = liveLocation || userLocation;
    if (location) {
      const heading = liveLocation?.heading || 0;
      
      const markerIcon = L.divIcon({
        className: 'live-tracking-marker',
        html: `
          <div style="position: relative; width: 60px; height: 70px; filter: drop-shadow(0 4px 12px rgba(34,197,94,0.6));">
            <div style="position: absolute; top: 5px; left: 5px; width: 50px; height: 50px; border: 3px solid #22c55e; border-radius: 50%; animation: pulse-ring 2s infinite; opacity: 0.4;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; background: linear-gradient(145deg, #1a1a2e, #252542); border: 3px solid #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(34,197,94,0.4);">
              <svg width="26" height="26" viewBox="0 0 24 24" style="transform: rotate(${heading}deg);">
                <defs>
                  <linearGradient id="arrowGradLeaflet" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" style="stop-color:#16a34a"/>
                    <stop offset="100%" style="stop-color:#22c55e"/>
                  </linearGradient>
                </defs>
                <path d="M12 2 L20 18 L12 14 L4 18 Z" fill="url(#arrowGradLeaflet)"/>
              </svg>
            </div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 10px #22c55e;"></div>
            <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 3px 10px rgba(0,0,0,0.4); font-family: Tajawal, sans-serif;">أنت هنا</div>
          </div>
          <style>
            @keyframes pulse-ring { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 0.1; } }
          </style>
        `,
        iconSize: [60, 70],
        iconAnchor: [30, 35]
      });

      leafletLiveMarkerRef.current = L.marker([location.lat, location.lng], {
        icon: markerIcon,
        zIndexOffset: 3000
      }).addTo(leafletMapInstanceRef.current);

      if (isTracking) {
        leafletMapInstanceRef.current.panTo([location.lat, location.lng], {
          animate: true,
          duration: 0.3
        });
      }
    }
  }, [liveLocation, userLocation, mapProvider, isTracking]);

  // Leaflet: Recorded route - GOLDEN PATH (GTA Style)
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current) return;

    if (leafletRecordedRouteRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletRecordedRouteRef.current);
      leafletRecordedRouteRef.current = null;
    }

    if (recordedRoute && recordedRoute.length > 1) {
      const routeCoords: L.LatLngExpression[] = recordedRoute.map(p => [p.lat, p.lng]);
      
      // Golden glow effect - GTA mission path style
      L.polyline(routeCoords, { color: '#d4af37', weight: 16, opacity: 0.2 }).addTo(leafletMapInstanceRef.current);
      L.polyline(routeCoords, { color: '#fbbf24', weight: 10, opacity: 0.4 }).addTo(leafletMapInstanceRef.current);
      
      // Main golden path
      leafletRecordedRouteRef.current = L.polyline(routeCoords, {
        color: '#d4af37', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round'
      }).addTo(leafletMapInstanceRef.current);
    }
  }, [recordedRoute, mapProvider]);

  // Google Maps: Recorded route - GOLDEN PATH (GTA Style)
  useEffect(() => {
    if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;

    // Remove existing polyline
    if (googleRecordedRouteRef.current) {
      googleRecordedRouteRef.current.setMap(null);
      googleRecordedRouteRef.current = null;
    }

    if (recordedRoute && recordedRoute.length > 1) {
      const routePath = recordedRoute.map(p => ({ lat: p.lat, lng: p.lng }));
      
      // Create golden glow polyline (outer)
      new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#d4af37',
        strokeOpacity: 0.3,
        strokeWeight: 16,
        map: googleMapInstanceRef.current
      });
      
      // Create middle glow
      new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#fbbf24',
        strokeOpacity: 0.5,
        strokeWeight: 10,
        map: googleMapInstanceRef.current
      });
      
      // Main golden path
      googleRecordedRouteRef.current = new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#d4af37',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map: googleMapInstanceRef.current,
        zIndex: 500
      });
    }
  }, [recordedRoute, mapProvider]);
  // Custom map styles - Yellow/Black theme
  const styledMapStyles: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#d4af37' }] },
    { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#d4af37' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#fbbf24' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#ca8a04' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d4af37' }, { lightness: -40 }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d4af37' }, { lightness: -60 }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#252525' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2a1a' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] }
  ];

  // "بدون مسميات" style - satellite with all labels hidden
  const detailedMapStyles: google.maps.MapTypeStyle[] = [
    { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ];

  // Initialize Google Maps with Keyless API
  useEffect(() => {
    if (mapProvider !== 'google') return;
    
    const getMapStyles = () => {
      if (mapType === 'styled') return styledMapStyles;
      if (mapType === 'detailed') return detailedMapStyles;
      if (mapType === 'roadmap') {
        return [
          { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#d4af37' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] }
        ];
      }
      return [];
    };
    
    const initGoogleMap = () => {
      if (!googleMapRef.current || !window.google) return;

      const mapStyles = getMapStyles();
      const mapTypeId = mapType === 'styled' ? 'roadmap' : mapType === 'satellite' ? 'hybrid' : mapType === 'detailed' ? 'satellite' : mapType;

      if (!googleMapInstanceRef.current) {
        const map = new google.maps.Map(googleMapRef.current, {
          center: LIBYA_CENTER,
          zoom: 10,
          mapTypeId: mapTypeId,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          styles: mapStyles.length > 0 ? mapStyles : undefined
        });
        googleMapInstanceRef.current = map;
        
        // Single click: close info windows
        map.addListener('click', () => {
          if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
        });
        
        // Double-click: copy coordinates with temporary pin
        let tempGoogleMarker: google.maps.Marker | null = null;
        map.addListener('dblclick', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const lat = e.latLng.lat().toFixed(6);
            const lng = e.latLng.lng().toFixed(6);
            const coordsText = `${lat}, ${lng}`;
            
            // Remove previous temp marker
            if (tempGoogleMarker) {
              tempGoogleMarker.setMap(null);
            }
            
            // Add temporary pin
            tempGoogleMarker = new google.maps.Marker({
              position: e.latLng,
              map,
              icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#f59e0b',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
              zIndex: 9999,
            });
            
            // Copy to clipboard
            navigator.clipboard.writeText(coordsText).then(() => {
              toast.success(`تم نسخ الإحداثيات: ${coordsText}`, { duration: 2500 });
            }).catch(() => {
              toast.info(coordsText, { duration: 3000 });
            });
            
            // Remove pin after 2 seconds
            setTimeout(() => {
              if (tempGoogleMarker) {
                tempGoogleMarker.setMap(null);
                tempGoogleMarker = null;
              }
            }, 2000);
          }
        });
      } else {
        googleMapInstanceRef.current.setMapTypeId(mapTypeId);
        googleMapInstanceRef.current.setOptions({ styles: mapStyles.length > 0 ? mapStyles : null });
      }

      updateGoogleMarkers();
    };

    // Load Google Maps using Keyless API
    if (window.google && window.google.maps) {
      initGoogleMap();
    } else {
      loadGoogleMapsKeyless()
        .then(() => {
          const checkInterval = setInterval(() => {
            if (window.google && window.google.maps) {
              clearInterval(checkInterval);
              initGoogleMap();
            }
          }, 100);
          setTimeout(() => clearInterval(checkInterval), 10000);
        })
        .catch((error) => {
          console.error('Failed to load Google Maps:', error);
        });
    }
  }, [mapProvider, mapType]);

  // Update Google markers
  const updateGoogleMarkers = useCallback((skipFitBounds: boolean = false) => {
    if (!googleMapInstanceRef.current || !window.google?.maps) return;

    const map = googleMapInstanceRef.current;

    // Clean up existing markers and clusterer
    try {
      if (googleClustererRef.current) {
        googleClustererRef.current.clearMarkers();
        googleClustererRef.current = null;
      }
    } catch (e) {
      console.warn('Error clearing clusterer:', e);
    }
    
    googleMarkersRef.current.forEach(m => {
      try { m.setMap(null); } catch (e) {}
    });
    googleMarkersRef.current = [];

    if (!filteredBillboards.length) return;

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    filteredBillboards.forEach((b) => {
      const coords = parseCoords(b);
      if (!coords) return;

      const billboardId = (b as any).ID || 0;
      const isVisited = passedBillboardIds.has(billboardId);
      const pinData = createPinWithLabel(b, false, isVisited);

      const marker = new google.maps.Marker({
        position: coords,
        map: map,
        title: (b as any).Billboard_Name || 'لوحة إعلانية',
        icon: {
          url: pinData.url,
          scaledSize: new google.maps.Size(pinData.width, pinData.height),
          anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY)
        },
        optimized: false
      });

      const infoWindow = new google.maps.InfoWindow({
        content: createCompactPopupContent(b),
        // Mobile: قلّص العرض + اسمح بالـ auto-pan حتى لا يظهر مقصوص
        maxWidth: isMobile ? Math.max(220, Math.min(320, window.innerWidth - 32)) : 420,
        disableAutoPan: false,
        // ارفع الكرت قليلاً فوق الدبوس لتقليل قصّ الأسفل
        pixelOffset: new google.maps.Size(0, -8),
      });

      marker.addListener('click', () => {
        if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
        infoWindow.open(map, marker);
        googleInfoWindowRef.current = infoWindow;
        if (onBillboardClick) onBillboardClick(b);
      });

      googleMarkersRef.current.push(marker);
      bounds.extend(new google.maps.LatLng(coords.lat, coords.lng));
      hasMarkers = true;
    });

    // Clustering - with safety check
    if (googleMarkersRef.current.length > 0) {
      try {
        googleClustererRef.current = new MarkerClusterer({
          map,
          markers: googleMarkersRef.current,
          renderer: {
            render: ({ count, position }) => {
              // Smaller clusters on mobile to avoid covering the map
              const size = (() => {
                const factor = isMobile ? 6 : 8;
                const min = isMobile ? 24 : 30;
                const max = isMobile ? 52 : 60;
                return Math.min(Math.sqrt(count) * factor + min, max);
              })();
              
              const clusterSvg = `
                <svg width="${size}" height="${size}" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="clusterGradG" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#d4af37"/>
                      <stop offset="100%" style="stop-color:#b8860b"/>
                    </linearGradient>
                  </defs>
                  <circle cx="25" cy="25" r="23" fill="url(#clusterGradG)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
                  <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
                  <text x="25" y="30" text-anchor="middle" fill="#d4af37" font-size="14" font-weight="800" font-family="Tajawal, sans-serif">${count > 99 ? '99+' : count}</text>
                </svg>
              `;
              
              return new google.maps.Marker({
                position,
                icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(clusterSvg),
                  scaledSize: new google.maps.Size(size, size),
                  anchor: new google.maps.Point(size / 2, size / 2)
                },
                zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
              });
            },
          },
        });
      } catch (e) {
        console.warn('Clusterer error:', e);
      }
    }

    // ✅ Only fitBounds on initial load or filter changes, not every re-render
    const filterKey = `${filteredBillboards.length}-${filteredBillboards.map(b => (b as any).ID).join(',')}`;
    const isFilterChange = filterKey !== prevFilterKeyRef.current;
    prevFilterKeyRef.current = filterKey;

    if (hasMarkers && !isTracking && (isFilterChange || !hasFitBoundsRef.current)) {
      hasFitBoundsRef.current = true;
      try {
        setTimeout(() => {
          if (map && !bounds.isEmpty()) {
            map.fitBounds(bounds);
            const currentZoom = map.getZoom();
            if (currentZoom && currentZoom > 13) map.setZoom(13);
          }
        }, 100);
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    }
  }, [filteredBillboards, onBillboardClick, createPinWithLabel, isMobile, isTracking]);

  // Google: Live location marker - GTA Style with auto-zoom
  useEffect(() => {
    if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;

    if (googleLiveMarkerRef.current) {
      googleLiveMarkerRef.current.setMap(null);
      googleLiveMarkerRef.current = null;
    }

    const location = liveLocation || userLocation;
    if (location) {
      const heading = liveLocation?.heading || 0;
      const speed = (liveLocation?.speed || 0) * 3.6; // km/h
      
      // GTA-Style Arrow - Golden theme
      const arrowColor = speed > 60 ? '#ef4444' : speed > 30 ? '#f59e0b' : '#d4af37';
      const glowColor = speed > 60 ? 'rgba(239,68,68,0.6)' : speed > 30 ? 'rgba(245,158,11,0.6)' : 'rgba(212,175,55,0.6)';
      
      const trackingSvg = `
        <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="arrowGradGTA" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:${arrowColor}"/>
              <stop offset="100%" style="stop-color:#1a1a2e"/>
            </linearGradient>
            <filter id="gtaGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <!-- Outer pulse rings -->
          <circle cx="40" cy="40" r="35" fill="none" stroke="${arrowColor}" stroke-width="2" opacity="0.2">
            <animate attributeName="r" values="30;38;30" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="40" cy="40" r="28" fill="none" stroke="${arrowColor}" stroke-width="2" opacity="0.4">
            <animate attributeName="r" values="25;32;25" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          
          <!-- Main circle background -->
          <circle cx="40" cy="40" r="24" fill="#0a0a1a" stroke="${arrowColor}" stroke-width="3" filter="url(#gtaGlow)"/>
          
          <!-- Direction arrow - GTA style triangle -->
          <g transform="rotate(${heading}, 40, 40)" filter="url(#gtaGlow)">
            <path d="M40 12 L54 52 L40 42 L26 52 Z" fill="url(#arrowGradGTA)" stroke="${arrowColor}" stroke-width="1"/>
            <!-- Inner highlight -->
            <path d="M40 18 L48 44 L40 38 L32 44 Z" fill="${arrowColor}" opacity="0.6"/>
          </g>
          
          <!-- Center dot -->
          <circle cx="40" cy="40" r="4" fill="${arrowColor}">
            <animate attributeName="r" values="4;5;4" dur="0.8s" repeatCount="indefinite"/>
          </circle>
        </svg>
      `;
      
      googleLiveMarkerRef.current = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: googleMapInstanceRef.current,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(trackingSvg),
          scaledSize: new google.maps.Size(80, 80),
          anchor: new google.maps.Point(40, 40)
        },
        zIndex: 9000,
        optimized: false
      });

      // GTA-style smooth tracking with auto-zoom
      if (isTracking) {
        const map = googleMapInstanceRef.current;
        const currentZoom = map.getZoom() || 10;
        
        // Smooth pan to location
        map.panTo({ lat: location.lat, lng: location.lng });
        
        // Auto-zoom to tracking level if too zoomed out
        if (currentZoom < TRACKING_ZOOM_LEVEL - 1) {
          map.setZoom(TRACKING_ZOOM_LEVEL);
        }
      }
    }
  }, [liveLocation, userLocation, mapProvider, isTracking]);

  // Proximity detection - auto open popup when within 25m
  useEffect(() => {
    if (!isTracking || !liveLocation || !autoOpenPopup) return;
    
    filteredBillboards.forEach((billboard) => {
      const coords = parseCoords(billboard);
      if (!coords) return;
      
      const distance = calculateDistance(liveLocation.lat, liveLocation.lng, coords.lat, coords.lng);
      const billboardId = (billboard as any).ID || (billboard as any).id;
      
      if (distance <= 25 && !passedBillboardIds.has(billboardId)) {
        // Mark as passed
        setPassedBillboardIds(prev => new Set(prev).add(billboardId));
        addPassedBillboard({
          id: billboardId,
          name: (billboard as any).Billboard_Name || `لوحة ${billboardId}`,
          passedAt: new Date(),
          distance: Math.round(distance)
        });
        
        // Auto open popup for this billboard
        if (mapProvider === 'google' && googleMapInstanceRef.current) {
          const marker = googleMarkersRef.current.find(m => m.getTitle() === ((billboard as any).Billboard_Name || 'لوحة إعلانية'));
          if (marker) {
            google.maps.event.trigger(marker, 'click');
          }
        }
      }
    });
  }, [liveLocation, isTracking, autoOpenPopup, filteredBillboards, passedBillboardIds, addPassedBillboard, mapProvider]);

  // Update markers when billboards change for Google Maps
  // تمرير skipFitBounds=true أثناء التتبع لمنع الزوم المتقطع
  useEffect(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      updateGoogleMarkers(isTracking);
    }
  }, [filteredBillboards, mapProvider, updateGoogleMarkers, isTracking]);

  // Listen for image view events - open lightbox
  useEffect(() => {
    const handleShowImage = (event: CustomEvent) => {
      const imageUrl = event.detail;
      if (imageUrl) {
        setLightboxImage(imageUrl);
      }
      if (onImageView && imageUrl) onImageView(imageUrl);
    };

    window.addEventListener('showBillboardImage', handleShowImage as EventListener);
    return () => window.removeEventListener('showBillboardImage', handleShowImage as EventListener);
  }, [onImageView]);

  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl bg-[#0a0a1a] ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : ''} ${className || ''}`}
    >
       <style>{`
        /* InfoWindow: اجعل المحتوى لا يتقصّ على الهاتف */
        .gm-style-iw { padding: 0 !important; border-radius: 16px !important; overflow: visible !important; background: transparent !important; }
        .gm-style-iw-d { overflow: visible !important; max-height: none !important; padding: 0 !important; background: transparent !important; }
        .gm-style-iw-c { padding: 0 !important; border-radius: 16px !important; max-width: min(92vw, 420px) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.6) !important; background: transparent !important; }
        .gm-style-iw-t::after { display: none !important; }
        .gm-ui-hover-effect { display: none !important; }
        .leaflet-popup-dark .leaflet-popup-content-wrapper { background: transparent; border: none; box-shadow: none; padding: 0; }
        .leaflet-popup-dark .leaflet-popup-tip { background: rgba(26,26,46,0.98); }
        .leaflet-popup-dark .leaflet-popup-content { margin: 0; }
        .leaflet-popup-close-button { display: none !important; }
        @keyframes pulse-location { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.4); opacity: 0; } }
      `}</style>

      {/* Header - مخفي أثناء التتبع */}
      {!isTracking && (
        <div className={`absolute z-[1000] pointer-events-auto ${isMobile ? 'top-2 right-2' : 'top-4 right-4'} flex flex-col items-end gap-2`}>
          <MapHeader billboardCount={filteredBillboards.length} compact={isMobile} />
        </div>
      )}

      {/* Search Bar - مخفي أثناء التتبع وفي حالة وجود فلاتر خارجية */}
      {!externalSearchQuery && !isTracking && (
        <div className={`absolute z-[1000] pointer-events-auto ${
          isMobile 
            ? 'top-2 left-2 right-auto w-[72vw] max-w-[260px]' 
            : 'top-4 left-1/2 transform -translate-x-1/2 w-[320px] max-w-[90vw]'
        }`}>
          <MapSearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
            onRequestLocation={isMobile ? undefined : requestUserLocation}
            placeholder={isMobile ? 'بحث...' : 'ابحث عن...'}
          />
        </div>
      )}

      {/* Filter info - مضغوط للهاتف */}
      {!isTracking && (externalSearchQuery || (externalStatusFilter && externalStatusFilter.length > 0) || (externalCityFilter && externalCityFilter.length > 0) || (externalSizeFilter && externalSizeFilter.length > 0) || (externalMunicipalityFilter && externalMunicipalityFilter.length > 0)) && (
        <div className={`absolute z-[1000] bg-primary/90 backdrop-blur-sm border border-primary/50 pointer-events-none ${
          isMobile 
            ? 'top-2 left-2 right-12 rounded-md px-2 py-1' 
            : 'top-4 left-1/2 transform -translate-x-1/2 rounded-xl px-4 py-2'
        }`}>
          <p className={`text-primary-foreground font-bold ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
            {filteredBillboards.length} لوحة
          </p>
        </div>
      )}

      {/* Instructions - مخفي في الهاتف */}
      {!isMobile && !isTracking && (
        <div className="absolute top-20 left-4 z-[1000] bg-card/90 backdrop-blur-sm border border-border rounded-xl px-4 py-2 pointer-events-none">
          <p className="text-xs text-muted-foreground">نقرة = تفاصيل</p>
        </div>
      )}

      {/* Right Control Buttons - موضع متجاوب - مرئية دائمًا */}
      <div className={`absolute z-[1000] pointer-events-auto ${
        isMobile 
          ? 'bottom-14 right-1' 
          : 'top-20 right-4'
      }`}>
        <div className={`flex flex-col gap-0.5 bg-card/90 backdrop-blur-md border border-border/50 shadow-md ${
          isMobile ? 'rounded-lg p-0.5' : 'rounded-2xl p-2'
        }`}>
          <MapControlButtons
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onToggleLayers={() => setShowLayers(!showLayers)}
            isTracking={isTracking}
            onToggleTracking={isTracking ? stopTracking : startTracking}
            isRecording={false}
            onToggleRecording={() => {}}
            onCenterOnUser={handleCenterOnUser}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Layers Panel - متجاوب */}
      {showLayers && (
        <div className={`absolute z-[2000] bg-card/95 backdrop-blur-md border border-border/50 shadow-lg animate-fade-in pointer-events-auto ${
          isMobile 
            ? 'bottom-28 right-1 rounded-lg p-2 w-32' 
            : 'top-20 right-20 rounded-xl p-3 w-52'
        }`}>
          <h4 className={`text-primary font-bold mb-1.5 text-right border-b border-border/50 pb-1 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>الطبقات</h4>
          <div className="space-y-0.5">
            {[
              { type: 'satellite' as const, label: 'قمر صناعي' },
              { type: 'roadmap' as const, label: 'عادية' },
              { type: 'styled' as const, label: 'ذهبي' },
              { type: 'detailed' as const, label: 'بدون مسميات' }
            ].map((layer) => (
              <button
                key={layer.type}
                onClick={() => { setMapType(layer.type); }}
                className={`w-full flex items-center justify-end gap-1 rounded transition-all ${
                  isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-3 py-2 text-sm'
                } font-bold ${
                  mapType === layer.type 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-accent/50 text-foreground hover:bg-accent'
                }`}
              >
                {layer.label}
              </button>
            ))}
          </div>
          
          {/* سوسيت toggle inside layers panel */}
          {onShowSocietChange && (
            <>
              <div className={`border-t border-border/50 ${isMobile ? 'my-1' : 'my-1.5'}`} />
              <button
                onClick={() => onShowSocietChange(!externalShowSociet)}
                className={`w-full flex items-center justify-between rounded font-bold transition-all ${
                  isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-3 py-2 text-sm'
                } ${
                  externalShowSociet
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent/50 text-foreground hover:bg-accent'
                }`}
              >
                <span className={`${isMobile ? 'text-[8px]' : 'text-xs'}`}>{externalShowSociet ? '✓' : ''}</span>
                <span>سوسيت</span>
              </button>
            </>
          )}
          
          <button
            onClick={() => setShowLayers(false)}
            className={`w-full mt-1.5 rounded font-bold bg-muted text-muted-foreground hover:bg-accent transition-all ${
              isMobile ? 'px-1.5 py-0.5 text-[8px]' : 'px-3 py-1.5 text-xs'
            }`}
          >
            اغلاق
          </button>
        </div>
      )}

      {/* Legend - متجاوب ومطوي بشكل افتراضي في الهاتف */}
      {!isTracking && (
        <div className={`absolute z-[1000] pointer-events-auto ${
          isMobile ? 'bottom-1 right-1' : 'bottom-4 right-4'
        }`}>
          <MapLegend billboards={billboards} collapsed={isMobile} />
        </div>
      )}

      {/* Live Tracking Mode - نظام التتبع المباشر الكامل */}
      <LiveTrackingMode
        isActive={isTracking}
        onClose={stopTracking}
        billboards={billboards}
        onLocationUpdate={(loc) => {
          // Update live location marker on map
          if (mapProvider === 'google' && googleMapInstanceRef.current && window.google?.maps) {
            if (googleLiveMarkerRef.current) {
              googleLiveMarkerRef.current.setPosition({ lat: loc.lat, lng: loc.lng });
            }
          } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
            if (leafletLiveMarkerRef.current) {
              leafletLiveMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            }
          }
        }}
        onZoomToLocation={(lat, lng, zoom) => {
          if (mapProvider === 'google' && googleMapInstanceRef.current) {
            googleMapInstanceRef.current.setCenter({ lat, lng });
            googleMapInstanceRef.current.setZoom(zoom);
          } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
            leafletMapInstanceRef.current.setView([lat, lng], zoom);
          }
        }}
        onRequestLocation={requestUserLocation}
        onBillboardSelect={onBillboardClick}
      />

      {/* Provider Toggle - متجاوب */}
      {!isTracking && (
        <div className={`absolute z-[1000] pointer-events-auto ${
          isMobile ? 'bottom-1 left-1' : 'bottom-4 left-4'
        }`}>
          <div className={`flex items-center bg-card/90 backdrop-blur-md border border-border/50 shadow-md ${
            isMobile ? 'gap-0 rounded-lg p-0.5' : 'gap-1 rounded-2xl p-1.5'
          }`}>
            <button
              onClick={() => setMapProvider('openstreetmap')}
              className={`flex items-center gap-0.5 font-bold transition-all duration-300 ${
                isMobile ? 'px-1.5 py-1 rounded-md text-[8px]' : 'px-4 py-2.5 rounded-xl text-sm gap-2'
              } ${
                mapProvider === 'openstreetmap' 
                  ? 'bg-primary text-primary-foreground shadow' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Globe className={isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} />
              <span>OSM</span>
            </button>
            <button
              onClick={() => setMapProvider('google')}
              className={`flex items-center gap-0.5 font-bold transition-all duration-300 ${
                isMobile ? 'px-1.5 py-1 rounded-md text-[8px]' : 'px-4 py-2.5 rounded-xl text-sm gap-2'
              } ${
                mapProvider === 'google' 
                  ? 'bg-primary text-primary-foreground shadow' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <MapIcon className={isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} />
              <span>G</span>
            </button>
          </div>
        </div>
      )}

      {/* Recording Status Badge - Removed */}

      {/* Map Containers */}
      <div 
        ref={leafletMapRef} 
        style={{ 
          height: isFullscreen ? '100vh' : (isMobile ? '100%' : '700px'), 
          minHeight: isMobile ? '350px' : '700px',
          width: '100%', 
          display: mapProvider === 'openstreetmap' ? 'block' : 'none' 
        }} 
      />
      <div 
        ref={googleMapRef} 
        style={{ 
          height: isFullscreen ? '100vh' : (isMobile ? '100%' : '700px'), 
          minHeight: isMobile ? '350px' : '700px',
          width: '100%', 
          display: mapProvider === 'google' ? 'block' : 'none' 
        }} 
      />

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox 
          imageUrl={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}
    </div>
  );
}
