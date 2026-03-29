/// <reference types="google.maps" />
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Map as MapIcon, Globe, MapPin, Camera, X, ExternalLink } from 'lucide-react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Billboard } from '@/types';
import type { MapProvider, SatelliteProvider } from '@/types/map';
import { OSM_TILE_LAYERS, SATELLITE_TILE_URLS, SATELLITE_PROVIDERS } from '@/types/map';
import { createCompactPopupContent, getBillboardStatus, getSizeColor } from '@/hooks/useMapMarkers';
import { useMapNavigation, calculateDistance } from '@/hooks/useMapNavigation';
import MapHeader from './MapHeader';
import MapLegend from './MapLegend';
import MapControlButtons from './MapControlButtons';
import MapSearchBar from './MapSearchBar';
import LiveTrackingMode from './LiveTrackingMode';
import { Button } from '@/components/ui/button';
import ImageLightbox from './ImageLightbox';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';
import { useFieldPhotos, useUpdateAllOrbitRadius, type FieldPhoto } from '@/hooks/useFieldPhotos';
import { createCircularPhotoIcon, buildPhotoInfoCard, computeDestination, CAMERA_ICON_HTML, ARROW_ICON_SVG } from './FieldPhotoMarkers';
import FieldPhotoUpload from './FieldPhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { Slider } from '@/components/ui/slider';
import { Circle, Target } from 'lucide-react';

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

import { parseCoords } from '@/utils/parseCoords';

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
  const googleMarkerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const googleClustererRef = useRef<MarkerClusterer | null>(null);
  const googleInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const googleUserMarkerRef = useRef<google.maps.Marker | null>(null);
  const googleLiveMarkerRef = useRef<google.maps.Marker | null>(null);
  const googleRouteRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const googleRecordedRouteRef = useRef<google.maps.Polyline | null>(null);
  const googleSmartRouteLineRef = useRef<google.maps.Polyline | null>(null);
  const googleSmartRouteRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const googleSmartRouteMarkersRef = useRef<google.maps.Marker[]>([]);
  const prevFilterKeyRef = useRef<string>('');
  const hasFitBoundsRef = useRef(false);
  
  // Field photos refs
  const googlePhotoMarkersRef = useRef<google.maps.Marker[]>([]);
  const googlePhotoCirclesRef = useRef<google.maps.Circle[]>([]);
  const googlePhotoArrowsRef = useRef<google.maps.Polyline[]>([]);
  
  // Leaflet refs
  const leafletMapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const leafletClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletLabelsRef = useRef<L.TileLayer | null>(null);
  const leafletUserMarkerRef = useRef<L.Marker | null>(null);
  const leafletLiveMarkerRef = useRef<L.Marker | null>(null);
  const leafletRecordedRouteRef = useRef<L.Polyline | null>(null);
  const leafletPhotoLayerRef = useRef<L.LayerGroup | null>(null);
  const leafletTrackingRouteRef = useRef<L.Polyline | null>(null);
  const trackingPointsRef = useRef<{lat: number; lng: number}[]>([]);
  const osrmPendingRef = useRef(false);
  
  // Search pin refs
  const googleSearchPinRef = useRef<google.maps.Marker | null>(null);
  const leafletSearchPinRef = useRef<L.Marker | null>(null);
  
  // Container ref for fullscreen
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State - Google is the default provider (Keyless loader)
  const [mapProvider, setMapProvider] = useState<MapProvider>('google');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'styled' | 'detailed'>('satellite');
  const [satelliteProvider, setSatelliteProvider] = useState<SatelliteProvider>(() => {
    return (localStorage.getItem("osm_satellite_provider") as SatelliteProvider) || "google";
  });
  const [showLabels, setShowLabels] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showFieldPhotos, setShowFieldPhotos] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showOrbitCalibration, setShowOrbitCalibration] = useState(false);
  const [globalOrbitRadius, setGlobalOrbitRadius] = useState(50);
  const [calibrationRadius, setCalibrationRadius] = useState(50);
  
  // Simple tracking state (just follow location, no full tracking UI)
  const [isSimpleTracking, setIsSimpleTracking] = useState(false);
  const simpleTrackWatchRef = useRef<number | null>(null);
  const simpleTrackWakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // Billboard detail panel (for fullscreen mode)
  const [detailBillboard, setDetailBillboard] = useState<Billboard | null>(null);
  
  // Smooth marker animation helper
  const smoothMoveGoogleMarker = useCallback((marker: google.maps.Marker, newPos: { lat: number; lng: number }) => {
    const oldPos = marker.getPosition();
    if (!oldPos) { marker.setPosition(newPos); return; }
    const startLat = oldPos.lat(), startLng = oldPos.lng();
    const deltaLat = newPos.lat - startLat, deltaLng = newPos.lng - startLng;
    if (Math.abs(deltaLat) < 0.0000001 && Math.abs(deltaLng) < 0.0000001) return;
    const duration = 300; // ms
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      marker.setPosition({ lat: startLat + deltaLat * ease, lng: startLng + deltaLng * ease });
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  // Premium tracking marker SVG — glass-morphic beacon with directional arrow
  const createSimpleTrackingSvg = useCallback((_accuracy: number) => {
    return `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pulse-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="core-grad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- Outer pulse ring -->
      <circle cx="40" cy="40" r="36" fill="url(#pulse-grad)">
        <animate attributeName="r" values="24;36;24" dur="2.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <!-- Direction arrow (north-pointing, rotated by heading if available) -->
      <polygon points="40,12 46,28 40,24 34,28" fill="#3b82f6" opacity="0.7" filter="url(#glow)"/>
      <!-- Outer ring -->
      <circle cx="40" cy="40" r="16" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.4"/>
      <!-- Core dot with gradient -->
      <circle cx="40" cy="40" r="11" fill="url(#core-grad)" filter="url(#glow)"/>
      <!-- Inner highlight -->
      <circle cx="40" cy="40" r="5" fill="#93c5fd" opacity="0.9"/>
      <!-- Specular -->
      <circle cx="37" cy="37" r="2.5" fill="white" opacity="0.5"/>
    </svg>`;
  }, []);
  
  // Field photos data
  const { data: fieldPhotos = [], refetch: refetchPhotos } = useFieldPhotos();
  const updateAllOrbit = useUpdateAllOrbitRadius();

  // Load global orbit radius from system_settings
  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'field_photo_orbit_radius')
          .maybeSingle();
        if (data?.setting_value) {
          const val = Number(data.setting_value);
          if (val > 0) {
            setGlobalOrbitRadius(val);
            setCalibrationRadius(val);
            (window as any).__globalOrbitRadius = val;
          }
        }
      } catch (e) { console.error('Failed to load global orbit radius', e); }
    })();
  }, []);

  // ✅ Reset internal search when external billboard list changes
  useEffect(() => {
    setSearchQuery('');
  }, [billboards.length]);

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
  
  // OSRM route fetcher
  const fetchOSRMRoute = useCallback(async (points: {lat: number; lng: number}[]) => {
    if (points.length < 2) return null;
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    try {
      const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      const data = await resp.json();
      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
        return data.routes[0].geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
      }
    } catch (e) { console.warn('OSRM fetch error:', e); }
    return null;
  }, []);

  // Update OSRM route on map
  const updateTrackingRoute = useCallback(async () => {
    if (osrmPendingRef.current || trackingPointsRef.current.length < 2) return;
    osrmPendingRef.current = true;
    try {
      // Take last 25 points max to avoid URL length issues
      const pts = trackingPointsRef.current.slice(-25);
      const routeCoords = await fetchOSRMRoute(pts);
      if (!routeCoords || routeCoords.length < 2) return;

      // Draw on Leaflet
      const leafMap = leafletMapInstanceRef.current;
      if (leafMap) {
        if (leafletTrackingRouteRef.current) {
          leafletTrackingRouteRef.current.setLatLngs(routeCoords.map((c: {lat:number;lng:number}) => [c.lat, c.lng]));
        } else {
          leafletTrackingRouteRef.current = L.polyline(
            routeCoords.map((c: {lat:number;lng:number}) => [c.lat, c.lng] as L.LatLngExpression),
            { color: '#4285F4', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }
          ).addTo(leafMap);
        }
      }

      // Draw on Google Maps
      const gMap = googleMapInstanceRef.current;
      if (gMap) {
        if (googleSmartRouteLineRef.current) {
          googleSmartRouteLineRef.current.setPath(routeCoords);
        } else {
          googleSmartRouteLineRef.current = new google.maps.Polyline({
            path: routeCoords,
            geodesic: true,
            strokeColor: '#4285F4',
            strokeOpacity: 0.85,
            strokeWeight: 5,
            map: gMap,
            zIndex: 800,
          });
        }
      }
    } finally {
      osrmPendingRef.current = false;
    }
  }, [fetchOSRMRoute]);

  // Simple tracking toggle
  const toggleSimpleTracking = useCallback(() => {
    if (isSimpleTracking) {
      // Stop simple tracking
      if (simpleTrackWatchRef.current !== null) {
        navigator.geolocation.clearWatch(simpleTrackWatchRef.current);
        simpleTrackWatchRef.current = null;
      }
      if (simpleTrackWakeLockRef.current) {
        simpleTrackWakeLockRef.current.release();
        simpleTrackWakeLockRef.current = null;
      }
      if ((simpleTrackWakeLockRef as any)._visHandler) {
        document.removeEventListener('visibilitychange', (simpleTrackWakeLockRef as any)._visHandler);
        (simpleTrackWakeLockRef as any)._visHandler = null;
      }
      // Keep route visible but stop tracking
      setIsSimpleTracking(false);
    } else {
      if (!navigator.geolocation) {
        toast.error('المتصفح لا يدعم تحديد الموقع');
        return;
      }
      // Clear previous route
      trackingPointsRef.current = [];
      if (leafletTrackingRouteRef.current) {
        leafletTrackingRouteRef.current.remove();
        leafletTrackingRouteRef.current = null;
      }
      if (googleSmartRouteLineRef.current) {
        googleSmartRouteLineRef.current.setMap(null);
        googleSmartRouteLineRef.current = null;
      }

      setIsSimpleTracking(true);
      // Request Wake Lock
      if ('wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').then((lock: WakeLockSentinel) => {
          simpleTrackWakeLockRef.current = lock;
        }).catch(() => {});
        const handleVisibility = async () => {
          if (document.visibilityState === 'visible') {
            try { simpleTrackWakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (_) {}
          }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        (simpleTrackWakeLockRef as any)._visHandler = handleVisibility;
      }
      // Watch position
      simpleTrackWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const accuracy = pos.coords.accuracy || 30;
          
          // Collect points for OSRM route
          const lastPt = trackingPointsRef.current[trackingPointsRef.current.length - 1];
          const shouldAdd = !lastPt || calculateDistance(lastPt.lat, lastPt.lng, loc.lat, loc.lng) > 10; // min 10m between points
          if (shouldAdd) {
            trackingPointsRef.current.push(loc);
            // Fetch road-snapped route every 5 new points
            if (trackingPointsRef.current.length % 5 === 0 || trackingPointsRef.current.length === 2) {
              updateTrackingRoute();
            }
          }

          // Pan & zoom Google map
          if (googleMapInstanceRef.current) {
            googleMapInstanceRef.current.panTo(loc);
            // Zoom in on first position fix
            if (trackingPointsRef.current.length <= 1) {
              googleMapInstanceRef.current.setZoom(17);
            }
            if (googleUserMarkerRef.current) {
              smoothMoveGoogleMarker(googleUserMarkerRef.current, loc);
            } else {
              const simpleTrackSvg = createSimpleTrackingSvg(accuracy);
              googleUserMarkerRef.current = new google.maps.Marker({
                position: loc,
                map: googleMapInstanceRef.current,
                icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(simpleTrackSvg),
                  scaledSize: new google.maps.Size(80, 80),
                  anchor: new google.maps.Point(40, 40),
                },
                zIndex: 9999,
                optimized: false,
              });
            }
          }
          // Pan & zoom Leaflet map + user marker
          if (leafletMapInstanceRef.current) {
            const leafMap = leafletMapInstanceRef.current;
            if (trackingPointsRef.current.length <= 1) {
              leafMap.setView([loc.lat, loc.lng], 17, { animate: true, duration: 0.8 });
            } else {
              leafMap.panTo([loc.lat, loc.lng], { animate: true, duration: 0.5 });
            }
            // Add/update Leaflet user marker
            if (leafletUserMarkerRef.current) {
              leafletUserMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            } else {
              const icon = L.divIcon({
                className: '',
                html: `<div style="width:44px;height:44px;position:relative;">
                  <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);animation:pulse 2.5s ease-in-out infinite;"></div>
                  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#1d4ed8);box-shadow:0 0 12px rgba(59,130,246,0.6);border:3px solid white;"></div>
                </div>`,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              });
              leafletUserMarkerRef.current = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 9999 }).addTo(leafMap);
            }
          }
        },
        (err) => {
          console.error('Simple tracking error:', err);
          toast.error('تعذر تحديد الموقع');
          setIsSimpleTracking(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [isSimpleTracking, updateTrackingRoute, smoothMoveGoogleMarker, createSimpleTrackingSvg]);

  // Cleanup simple tracking on unmount
  useEffect(() => {
    return () => {
      if (simpleTrackWatchRef.current !== null) {
        navigator.geolocation.clearWatch(simpleTrackWatchRef.current);
      }
      if (simpleTrackWakeLockRef.current) {
        simpleTrackWakeLockRef.current.release();
      }
      if ((simpleTrackWakeLockRef as any)._visHandler) {
        document.removeEventListener('visibilitychange', (simpleTrackWakeLockRef as any)._visHandler);
      }
    };
  }, []);

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
      const parsedCoords = parseCoords(b);
      if (!parsedCoords) {
        // Skip billboards without valid coordinates silently
        return false;
      }

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

  // Navigate to coordinates (search pin)
  const navigateToCoords = useCallback((lat: number, lng: number) => {
    // Clear old search pin
    if (googleSearchPinRef.current) { googleSearchPinRef.current.setMap(null); googleSearchPinRef.current = null; }
    if (leafletSearchPinRef.current && leafletMapInstanceRef.current) { leafletMapInstanceRef.current.removeLayer(leafletSearchPinRef.current); leafletSearchPinRef.current = null; }

    if (mapProvider === 'google' && googleMapInstanceRef.current && window.google?.maps) {
      const pin = new google.maps.Marker({
        position: { lat, lng },
        map: googleMapInstanceRef.current,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#ef4444', fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 3 },
        zIndex: 999,
        title: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
      googleSearchPinRef.current = pin;
      googleMapInstanceRef.current.setCenter({ lat, lng });
      googleMapInstanceRef.current.setZoom(17);
      // Auto-remove after 30s
      setTimeout(() => { pin.setMap(null); if (googleSearchPinRef.current === pin) googleSearchPinRef.current = null; }, 30000);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      const pin = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div style="width:24px;height:24px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>', iconSize: [24, 24], iconAnchor: [12, 12] }),
      }).addTo(leafletMapInstanceRef.current);
      leafletSearchPinRef.current = pin;
      leafletMapInstanceRef.current.setView([lat, lng], 17);
      setTimeout(() => { pin.remove(); if (leafletSearchPinRef.current === pin) leafletSearchPinRef.current = null; }, 30000);
    }
    toast.success(`تم التوجه للإحداثي: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }, [mapProvider]);

  // Focus on a billboard from search
  const focusOnBillboard = useCallback((billboard: Billboard) => {
    const coords = parseCoords(billboard);
    if (!coords) { toast.error('لا توجد إحداثيات لهذه اللوحة'); return; }
    
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      googleMapInstanceRef.current.setCenter({ lat: coords.lat, lng: coords.lng });
      googleMapInstanceRef.current.setZoom(18);
      // Try to open the marker's info window
      const id = String((billboard as any).ID || billboard.id || '');
      const marker = googleMarkerMapRef.current.get(id);
      if (marker) {
        google.maps.event.trigger(marker, 'click');
      }
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setView([coords.lat, coords.lng], 18);
    }
    
    // Show detail panel if in fullscreen
    if (document.fullscreenElement) {
      setDetailBillboard(billboard);
    } else if (onBillboardClick) {
      onBillboardClick(billboard);
    }
  }, [mapProvider, onBillboardClick]);


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

  // Create pin with billboard shape based on type (tower/standard/tpole)
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false, isVisited: boolean = false) => {
    const status = getBillboardStatus(billboard);
    const size = (billboard as any).Size || '';
    const adType = (billboard as any).Ad_Type || '';
    const billboardType = (billboard as any).billboard_type || '';
    const contractNumber = (billboard as any).Contract_Number || 0;
    const isHidden = (billboard as any).is_visible_in_available === false;
    const isAvailable = status.label === 'متاحة' || status.label === 'متاح';
    const isSoon = status.label === 'محجوزة';
    const statusColor = isHidden ? '#6b7280' : isVisited ? '#00ff6a' : (isAvailable ? '#00ff6a' : isSoon ? '#f59e0b' : '#ef4444');
    
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

    // Build info badge text
    const hasContract = contractNumber && Number(contractNumber) > 0;
    // Show full ad type text - only truncate if extremely long
    const shortAdType = adType.length > 20 ? adType.substring(0, 18) + '..' : adType;
    const badgeText = hasContract ? `${contractNumber}` : '';
    const adBadgeText = shortAdType || '';
    const hasBadge = !!(badgeText || adBadgeText);

    // Dynamic badge width based on text length
    const estimateTextWidth = (text: string, size: number) => {
      // Arabic chars are wider; estimate ~0.7 * fontSize per char
      return text.length * size * 0.7 + 12;
    };
    const adTextWidth = adBadgeText ? estimateTextWidth(adBadgeText, 9) : 0;
    const contractTextWidth = badgeText ? estimateTextWidth(`#${contractNumber}`, 9) : 0;
    const dynamicBadgeW = Math.max(48, Math.min(120, Math.max(adTextWidth, contractTextWidth) + 16));

    // New 3D teardrop pin design
    const pinSize = isSelected ? 44 : 32;
    const badgeHeight = hasBadge ? (hasContract && adBadgeText ? 28 : 22) : 0;
    const w = Math.max(pinSize + 32, dynamicBadgeW + 8);
    const cx = w / 2;

    // Pin geometry - pinH is total teardrop height, pinTipY is exact tip coordinate
    const pinTopOffset = badgeHeight;
    const pinH = pinSize + 12;
    const pinW = pinSize;
    const headCY = pinTopOffset + pinH * 0.38;
    const pinTipY = pinTopOffset + pinH - 4; // exact tip of teardrop
    const h = pinTipY + 3; // minimal space below tip for ground shadow
    const uniqueId = `pin-${(billboard as any).ID || Math.random()}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
    const shortSize = size.length > 6 ? size.substring(0, 5) + '..' : size;
    const fontSize = isSelected ? 10 : 9;

    // Badge section (contract number + ad type) - wider, taller, RTL-friendly
    const badgeSvg = hasBadge ? `
      <rect x="${cx - dynamicBadgeW / 2}" y="0" width="${dynamicBadgeW}" height="${badgeHeight}" rx="5" ry="5" 
            fill="rgba(0,0,0,0.82)" stroke="${hasContract ? statusColor : 'rgba(255,255,255,0.25)'}" stroke-width="1"/>
      ${hasContract && adBadgeText ? `
        <text x="${cx}" y="${badgeHeight * 0.35}" text-anchor="middle" dominant-baseline="middle"
              fill="${statusColor}" font-size="9.5px" font-weight="bold" font-family="Tahoma, Arial, sans-serif"
              direction="rtl">${adBadgeText}</text>
        <text x="${cx}" y="${badgeHeight * 0.72}" text-anchor="middle" dominant-baseline="middle"
              fill="#fff" font-size="9.5px" font-weight="800" font-family="Tahoma, Arial, sans-serif"
              >#${contractNumber}</text>
      ` : hasContract ? `
        <text x="${cx}" y="${badgeHeight / 2 + 1}" text-anchor="middle" dominant-baseline="middle"
              fill="#fff" font-size="10px" font-weight="800" font-family="Tahoma, Arial, sans-serif"
              >#${contractNumber}</text>
      ` : `
        <text x="${cx}" y="${badgeHeight / 2 + 1}" text-anchor="middle" dominant-baseline="middle"
              fill="${statusColor}" font-size="9.5px" font-weight="bold" font-family="Tahoma, Arial, sans-serif"
              direction="rtl">${adBadgeText}</text>
      `}
    ` : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="b${uniqueId}" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="${adjustColor(colors.bg, 80)}"/>
          <stop offset="35%" stop-color="${colors.bg}"/>
          <stop offset="70%" stop-color="${adjustColor(colors.bg, -30)}"/>
          <stop offset="100%" stop-color="${adjustColor(colors.bg, -70)}"/>
        </linearGradient>
        <radialGradient id="h${uniqueId}" cx="35%" cy="25%" r="50%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.6)"/>
          <stop offset="60%" stop-color="rgba(255,255,255,0.1)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
        <radialGradient id="g${uniqueId}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${statusColor}"/>
          <stop offset="70%" stop-color="${adjustColor(statusColor, -25)}"/>
          <stop offset="100%" stop-color="${adjustColor(statusColor, -50)}"/>
        </radialGradient>
        <filter id="s${uniqueId}" x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      
      ${badgeSvg}
      ${hasBadge ? `<line x1="${cx}" y1="${badgeHeight}" x2="${cx}" y2="${pinTopOffset + 4}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>` : ''}
      
      <!-- Ground shadow - tight, right at pin tip -->
      <ellipse cx="${cx}" cy="${pinTipY + 1}" rx="${pinW * 0.12}" ry="1.2" fill="rgba(0,0,0,0.3)"/>
      
      ${isAvailable ? `
      <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.45}" fill="none" stroke="${statusColor}" stroke-width="1.5" opacity="0.4">
        <animate attributeName="r" values="${pinW * 0.4};${pinW * 0.75}" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      ` : ''}
      
      <g filter="url(#s${uniqueId})">
        <!-- Teardrop body -->
        <path d="M${cx},${pinTipY}
                 C${cx - 1.5},${pinTopOffset + pinH - 12} ${cx - pinW / 2},${pinTopOffset + pinH * 0.55} ${cx - pinW / 2},${headCY}
                 A${pinW / 2},${pinW / 2} 0 1,1 ${cx + pinW / 2},${headCY}
                 C${cx + pinW / 2},${pinTopOffset + pinH * 0.55} ${cx + 1.5},${pinTopOffset + pinH - 12} ${cx},${pinTipY}Z"
              fill="url(#b${uniqueId})" 
              stroke="${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.4)'}" 
              stroke-width="${isSelected ? 2.5 : 1}"/>
        <!-- Specular highlight -->
        <path d="M${cx},${pinTipY}
                 C${cx - 1.5},${pinTopOffset + pinH - 12} ${cx - pinW / 2},${pinTopOffset + pinH * 0.55} ${cx - pinW / 2},${headCY}
                 A${pinW / 2},${pinW / 2} 0 1,1 ${cx + pinW / 2},${headCY}
                 C${cx + pinW / 2},${pinTopOffset + pinH * 0.55} ${cx + 1.5},${pinTopOffset + pinH - 12} ${cx},${pinTipY}Z"
              fill="url(#h${uniqueId})" opacity="0.6"/>
        <!-- Inner dark circle -->
        <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.3}" fill="rgba(10,10,25,0.5)"/>
        <!-- Status indicator -->
        <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.23}" fill="url(#g${uniqueId})"/>
        <!-- Glass reflection -->
        <ellipse cx="${cx - pinW * 0.05}" cy="${headCY - pinW * 0.06}" rx="${pinW * 0.1}" ry="${pinW * 0.07}" fill="rgba(255,255,255,0.5)" transform="rotate(-15 ${cx} ${headCY})"/>
        <!-- Center dot -->
        <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.07}" fill="rgba(255,255,255,0.9)"/>
        <!-- Size text on body -->
        <text x="${cx}" y="${headCY + pinW * 0.45}" text-anchor="middle" 
              fill="rgba(255,255,255,0.9)" font-size="${fontSize}px" font-weight="bold" font-family="Arial, sans-serif"
              style="text-shadow: 0 1px 2px rgba(0,0,0,0.8)">${shortSize}</text>
      </g>
      
      ${isSelected ? `
      <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.48}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4,2" opacity="0.85">
        <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${headCY}" to="360 ${cx} ${headCY}" dur="4s" repeatCount="indefinite"/>
      </circle>
      <g>
        <circle cx="${cx + pinW * 0.38}" cy="${pinTopOffset + 4}" r="8" fill="#fbbf24"/>
        <path d="M${cx + pinW * 0.38 - 2.5} ${pinTopOffset + 4} l2.5 2.5 l4.5 -4.5" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>
      ` : ''}
    </svg>`;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      width: w,
      height: h,
      anchorX: cx,
      anchorY: pinTipY
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
      maxZoom: 21,
      minZoom: 5
    });

    leafletMapInstanceRef.current = map;

    // Copy coordinates helper for Leaflet (shared by dblclick and contextmenu)
    let tempLeafletMarker: L.Marker | null = null;
    const leafletCopyCoords = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);
      const coordsText = `${lat}, ${lng}`;
      
      if (tempLeafletMarker) map.removeLayer(tempLeafletMarker);
      
      const tempIcon = L.divIcon({
        className: 'temp-coord-pin',
        html: `<div style="
          width: 32px; height: 32px;
          background: #f59e0b;
          border: 3px solid #fff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
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
      
      navigator.clipboard.writeText(coordsText).then(() => {
        toast.success(`تم نسخ الإحداثيات: ${coordsText}`, { duration: 2500 });
      }).catch(() => {
        toast.info(coordsText, { duration: 3000 });
      });
      
      setTimeout(() => {
        if (tempLeafletMarker) {
          map.removeLayer(tempLeafletMarker);
          tempLeafletMarker = null;
        }
      }, 2000);
    };
    
    map.on('dblclick', leafletCopyCoords);
    map.on('contextmenu', leafletCopyCoords);

    const satConfig = SATELLITE_TILE_URLS[satelliteProvider];
    const tileConfig = mapType === 'satellite' ? { url: satConfig.url, attribution: satConfig.attribution } : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: Math.min(satConfig.maxZoom || 21, 21)
    }).addTo(map);

    // Add labels overlay if satellite mode and showLabels
    if (mapType === 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google',
        maxZoom: 21,
        pane: 'overlayPane'
      }).addTo(map);
    }

    leafletClusterRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 55,
      disableClusteringAtZoom: 15,
      animate: true,
      animateAddingMarkers: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const displayCount = count > 999 ? '999+' : count > 99 ? '99+' : String(count);
        const tier = count > 100 ? 3 : count > 30 ? 2 : count > 10 ? 1 : 0;
        const size = [48, 54, 62, 72][tier];
        const colors = [
          { ring: '#3b82f6', core: '#1e40af', glow: 'rgba(59,130,246,0.3)' },
          { ring: '#8b5cf6', core: '#5b21b6', glow: 'rgba(139,92,246,0.3)' },
          { ring: '#f59e0b', core: '#b45309', glow: 'rgba(245,158,11,0.3)' },
          { ring: '#ef4444', core: '#991b1b', glow: 'rgba(239,68,68,0.3)' },
        ][tier];
        
        return L.divIcon({
          html: `
            <div style="width: ${size}px; height: ${size}px; position: relative; filter: drop-shadow(0 4px 12px ${colors.glow});">
              <svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="cg${count}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${colors.ring}"/>
                    <stop offset="100%" stop-color="${colors.core}"/>
                  </linearGradient>
                </defs>
                <circle cx="30" cy="30" r="28" fill="url(#cg${count})" opacity="0.9"/>
                <circle cx="30" cy="30" r="21" fill="rgba(0,0,0,0.5)"/>
                <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
              </svg>
              <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1;">
                <span style="color: #fff; font-weight: 900; font-size: ${tier >= 2 ? 15 : 14}px; font-family: Tajawal, sans-serif; text-shadow: 0 1px 4px rgba(0,0,0,0.5);">${displayCount}</span>
              </div>
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
    if (leafletLabelsRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletLabelsRef.current);
      leafletLabelsRef.current = null;
    }
    
    const satConfig = SATELLITE_TILE_URLS[satelliteProvider];
    const tileConfig = mapType === 'satellite' ? { url: satConfig.url, attribution: satConfig.attribution } : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: Math.min(satConfig.maxZoom || 21, 21)
    }).addTo(leafletMapInstanceRef.current);

    // Add labels overlay if satellite mode and showLabels
    if (mapType === 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google',
        maxZoom: 21,
        pane: 'overlayPane'
      }).addTo(leafletMapInstanceRef.current);
    }
  }, [mapType, mapProvider, satelliteProvider, showLabels]);

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
        
        // Copy coordinates helper (shared by dblclick and rightclick)
        let tempGoogleMarker: google.maps.Marker | null = null;
        const copyCoordinates = (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const lat = e.latLng.lat().toFixed(6);
            const lng = e.latLng.lng().toFixed(6);
            const coordsText = `${lat}, ${lng}`;
            
            if (tempGoogleMarker) tempGoogleMarker.setMap(null);
            
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
            
            navigator.clipboard.writeText(coordsText).then(() => {
              toast.success(`تم نسخ الإحداثيات: ${coordsText}`, { duration: 2500 });
            }).catch(() => {
              toast.info(coordsText, { duration: 3000 });
            });
            
            setTimeout(() => {
              if (tempGoogleMarker) {
                tempGoogleMarker.setMap(null);
                tempGoogleMarker = null;
              }
            }, 2000);
          }
        };
        
        // Double-click: copy coordinates
        map.addListener('dblclick', copyCoordinates);
        
        // Right-click: copy coordinates
        map.addListener('rightclick', copyCoordinates);
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

  // Update Google markers - diff-based for performance
  const updateGoogleMarkers = useCallback((skipFitBounds: boolean = false) => {
    if (!googleMapInstanceRef.current || !window.google?.maps) return;

    const map = googleMapInstanceRef.current;

    // Build new billboard ID set
    const newBillboardMap = new Map<string, Billboard>();
    filteredBillboards.forEach(b => {
      const id = String((b as any).ID || (b as any).id || '');
      if (id && parseCoords(b)) {
        newBillboardMap.set(id, b);
      }
    });

    const existingIds = new Set(googleMarkerMapRef.current.keys());
    const newIds = new Set(newBillboardMap.keys());

    // Find IDs to remove and add
    const toRemove: string[] = [];
    const toAdd: string[] = [];

    existingIds.forEach(id => {
      if (!newIds.has(id)) toRemove.push(id);
    });
    newIds.forEach(id => {
      if (!existingIds.has(id)) toAdd.push(id);
    });

    // Remove old markers
    toRemove.forEach(id => {
      const marker = googleMarkerMapRef.current.get(id);
      if (marker) {
        try { marker.setMap(null); } catch (e) {}
        googleMarkerMapRef.current.delete(id);
      }
    });

    // Clear clusterer if there are changes
    const hasChanges = toRemove.length > 0 || toAdd.length > 0;
    if (hasChanges) {
      try {
        if (googleClustererRef.current) {
          googleClustererRef.current.clearMarkers();
          googleClustererRef.current = null;
        }
      } catch (e) {
        console.warn('Error clearing clusterer:', e);
      }
    }

    // Add new markers
    toAdd.forEach(id => {
      const b = newBillboardMap.get(id)!;
      const coords = parseCoords(b);
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || isNaN(coords.lat) || isNaN(coords.lng)) return;
      const billboardId = Number(id) || 0;
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
        optimized: true
      });

      // Lazy InfoWindow
      let infoWindow: google.maps.InfoWindow | null = null;
      marker.addListener('click', () => {
        if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
        if (!infoWindow) {
          infoWindow = new google.maps.InfoWindow({
            content: createCompactPopupContent(b),
            maxWidth: isMobile ? Math.max(220, Math.min(320, window.innerWidth - 32)) : 420,
            disableAutoPan: false,
            pixelOffset: new google.maps.Size(0, -8),
          });
        }
        infoWindow.open(map, marker);
        googleInfoWindowRef.current = infoWindow;
        if (document.fullscreenElement) {
          setDetailBillboard(b);
        } else {
          if (onBillboardClick) onBillboardClick(b);
        }
      });

      googleMarkerMapRef.current.set(id, marker);
    });

    // Rebuild markers array from map
    googleMarkersRef.current = Array.from(googleMarkerMapRef.current.values());

    if (!googleMarkersRef.current.length) return;

    // Rebuild clusterer
    if (hasChanges && googleMarkersRef.current.length > 0) {
      try {
        googleClustererRef.current = new MarkerClusterer({
          map,
          markers: googleMarkersRef.current,
          renderer: {
            render: ({ count, position }) => {
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

    // Fit bounds logic
    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;
    googleMarkersRef.current.forEach(m => {
      try {
        const pos = m.getPosition();
        if (pos && typeof pos.lat() === 'number' && !isNaN(pos.lat()) && typeof pos.lng() === 'number' && !isNaN(pos.lng())) {
          bounds.extend(pos);
          hasMarkers = true;
        }
      } catch (e) {
        // Skip invalid marker positions
      }
    });

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
  }, [filteredBillboards, onBillboardClick, createPinWithLabel, isMobile, isTracking, passedBillboardIds]);

  // Google: Live location marker - Refined design with smooth movement
  const googleLiveMarkerPrevPos = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;

    const location = liveLocation || userLocation;
    if (!location) {
      if (googleLiveMarkerRef.current) {
        googleLiveMarkerRef.current.setMap(null);
        googleLiveMarkerRef.current = null;
      }
      return;
    }

    const heading = liveLocation?.heading || 0;
    const speed = (liveLocation?.speed || 0) * 3.6;
    const accuracy = liveLocation?.accuracy || 30;
    
    // Color based on speed
    const arrowColor = speed > 60 ? '#ef4444' : speed > 30 ? '#f59e0b' : '#22c55e';
    
    // Refined tracking marker - 60x60 with accuracy ring and direction
    const trackingSvg = `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="accRing" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stop-color="${arrowColor}" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="${arrowColor}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="arrGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="${arrowColor}"/>
          <stop offset="100%" stop-color="${arrowColor}" stop-opacity="0.3"/>
        </linearGradient>
        <filter id="glow2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- Accuracy ring -->
      <circle cx="30" cy="30" r="28" fill="url(#accRing)"/>
      <!-- Pulse ring -->
      <circle cx="30" cy="30" r="22" fill="none" stroke="${arrowColor}" stroke-width="1.5" opacity="0.2">
        <animate attributeName="r" values="18;26;18" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      <!-- Outer ring -->
      <circle cx="30" cy="30" r="16" fill="#0d1117" stroke="${arrowColor}" stroke-width="2" filter="url(#glow2)"/>
      <!-- Direction arrow -->
      <g transform="rotate(${heading}, 30, 30)">
        <path d="M30 10 L38 38 L30 32 L22 38 Z" fill="url(#arrGrad)" stroke="${arrowColor}" stroke-width="0.5" opacity="0.9"/>
      </g>
      <!-- Center dot -->
      <circle cx="30" cy="30" r="4" fill="${arrowColor}" filter="url(#glow2)"/>
      <circle cx="30" cy="30" r="2" fill="#fff" opacity="0.9"/>
      ${speed > 5 ? `<text x="30" y="56" text-anchor="middle" fill="${arrowColor}" font-size="8" font-weight="bold" font-family="monospace">${Math.round(speed)}km/h</text>` : ''}
    </svg>`;

    if (googleLiveMarkerRef.current) {
      // Update icon and smooth-move
      googleLiveMarkerRef.current.setIcon({
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(trackingSvg),
        scaledSize: new google.maps.Size(60, 60),
        anchor: new google.maps.Point(30, 30)
      });
      smoothMoveGoogleMarker(googleLiveMarkerRef.current, { lat: location.lat, lng: location.lng });
    } else {
      googleLiveMarkerRef.current = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: googleMapInstanceRef.current,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(trackingSvg),
          scaledSize: new google.maps.Size(60, 60),
          anchor: new google.maps.Point(30, 30)
        },
        zIndex: 9000,
        optimized: false
      });
    }

    // Smooth pan
    if (isTracking) {
      const map = googleMapInstanceRef.current;
      const currentZoom = map.getZoom() || 10;
      map.panTo({ lat: location.lat, lng: location.lng });
      if (currentZoom < TRACKING_ZOOM_LEVEL - 1) {
        map.setZoom(TRACKING_ZOOM_LEVEL);
      }
    }
    
    googleLiveMarkerPrevPos.current = { lat: location.lat, lng: location.lng };
  }, [liveLocation, userLocation, mapProvider, isTracking, smoothMoveGoogleMarker]);

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

  // ===== Field Photos Layer (Google Maps) — orbits show on click only =====
  useEffect(() => {
    // Cleanup previous
    googlePhotoMarkersRef.current.forEach(m => m.setMap(null));
    googlePhotoMarkersRef.current = [];
    googlePhotoCirclesRef.current.forEach(c => c.setMap(null));
    googlePhotoCirclesRef.current = [];
    googlePhotoArrowsRef.current.forEach(a => a.setMap(null));
    googlePhotoArrowsRef.current = [];

    if (!showFieldPhotos || mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;

    const map = googleMapInstanceRef.current;
    const photosWithGps = fieldPhotos.filter((p: FieldPhoto) => p.lat && p.lng);

    // Helper to clear active orbit overlays
    const clearActiveOrbit = () => {
      googlePhotoCirclesRef.current.forEach(c => c.setMap(null));
      googlePhotoCirclesRef.current = [];
      googlePhotoArrowsRef.current.forEach(a => a.setMap(null));
      googlePhotoArrowsRef.current = [];
    };

    photosWithGps.forEach(async (photo: FieldPhoto) => {
      if (!photo.lat || !photo.lng) return;

      const iconUrl = await createCircularPhotoIcon(photo.bucket_url || '', 44);

      const marker = new google.maps.Marker({
        position: { lat: photo.lat, lng: photo.lng },
        map,
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(50, 50),
          anchor: new google.maps.Point(25, 25),
        },
        zIndex: 500,
        title: photo.file_name,
      });

      // Show orbit + arrow only on click
      marker.addListener('click', () => {
        clearActiveOrbit();

        if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
        const iw = new google.maps.InfoWindow({
          content: buildPhotoInfoCard(photo),
          maxWidth: 340,
        });
        iw.open(map, marker);
        googleInfoWindowRef.current = iw;

        // Draw orbit circle
        const radius = photo.orbit_radius_meters || globalOrbitRadius || 50;
        const circle = new google.maps.Circle({
          center: { lat: photo.lat!, lng: photo.lng! },
          radius,
          map,
          strokeColor: '#f59e0b',
          strokeOpacity: 0.5,
          strokeWeight: 2,
          fillColor: '#f59e0b',
          fillOpacity: 0.06,
          zIndex: 400,
          clickable: false,
        });
        googlePhotoCirclesRef.current.push(circle);

        // Direction arrow
        if (photo.direction_degrees !== null && photo.direction_degrees !== undefined) {
          const arrowEnd = computeDestination(photo.lat!, photo.lng!, photo.direction_degrees, radius * 0.9);
          const arrowLine = new google.maps.Polyline({
            path: [
              { lat: photo.lat!, lng: photo.lng! },
              arrowEnd,
            ],
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.9,
            strokeWeight: 3,
            map,
            zIndex: 450,
            icons: [{
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 1,
              },
              offset: '100%',
            }],
          });
          googlePhotoArrowsRef.current.push(arrowLine);
        }

        // Clear orbit when infowindow closes
        iw.addListener('closeclick', clearActiveOrbit);
      });

      googlePhotoMarkersRef.current.push(marker);
    });
  }, [showFieldPhotos, fieldPhotos, mapProvider, globalOrbitRadius]);

  // Listen for orbit-radius-change events from the info card slider to update circles live
  useEffect(() => {
    const handler = (e: Event) => {
      const { radius } = (e as CustomEvent).detail;
      googlePhotoCirclesRef.current.forEach(c => c.setRadius(radius));
    };
    window.addEventListener('orbit-radius-change', handler);
    return () => window.removeEventListener('orbit-radius-change', handler);
  }, []);

  // ===== Field Photos Layer for Leaflet (OpenStreetMap) — orbits show on click only =====
  useEffect(() => {
    if (leafletPhotoLayerRef.current && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletPhotoLayerRef.current);
      leafletPhotoLayerRef.current = null;
    }

    if (!showFieldPhotos || mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current) return;

    const map = leafletMapInstanceRef.current;

    if (!map.getPane('field-photos-pane')) {
      const markerPane = map.createPane('field-photos-pane');
      markerPane.style.zIndex = '680';
    }
    if (!map.getPane('field-photos-overlay-pane')) {
      const overlayPane = map.createPane('field-photos-overlay-pane');
      overlayPane.style.zIndex = '670';
    }

    const normalizedPhotos = fieldPhotos
      .filter((p: FieldPhoto) => p.lat && p.lng)
      .map((photo: FieldPhoto) => ({
        photo,
        lat: Number(photo.lat),
        lng: Number(photo.lng),
      }))
      .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng));

    const layerGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="width:40px;height:40px;border-radius:50%;background:#f59e0b;color:#1a1a2e;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fbbf24;">${count}</div>`,
          className: 'field-photo-cluster',
          iconSize: [40, 40] as any,
          iconAnchor: [20, 20] as any,
        });
      },
    }).addTo(map);
    leafletPhotoLayerRef.current = layerGroup;

    // Track active orbit layers so we can clear on next click
    let activeOrbitLayers: L.Layer[] = [];

    const clearActiveOrbit = () => {
      activeOrbitLayers.forEach(l => layerGroup.removeLayer(l));
      activeOrbitLayers = [];
    };

    normalizedPhotos.forEach(({ photo, lat, lng }) => {
      const cameraFallback = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${CAMERA_ICON_HTML}</div>`;
      const iconHtml = photo.bucket_url
        ? `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #f59e0b;overflow:hidden;background:#1a1a2e;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
            <img src="${photo.bucket_url}" style="width:100%;height:100%;object-fit:cover;display:block;" referrerpolicy="no-referrer" onerror="this.remove(); this.parentNode.insertAdjacentHTML('beforeend','${cameraFallback.replace(/'/g, "\\'")}')" />
           </div>`
        : `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #f59e0b;background:#1a1a2e;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${CAMERA_ICON_HTML}</div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'field-photo-marker',
        iconSize: [54, 54],
        iconAnchor: [27, 27],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: 5000, pane: 'field-photos-pane' });
      marker.bindPopup(buildPhotoInfoCard(photo), {
        maxWidth: 340,
        className: 'leaflet-popup-dark',
      });

      // Show orbit + arrow only on click
      marker.on('click', () => {
        clearActiveOrbit();

        const radius = Number(photo.orbit_radius_meters) > 0 ? Number(photo.orbit_radius_meters) : (globalOrbitRadius || 50);
        const circle = L.circle([lat, lng], {
          radius,
          color: '#f59e0b',
          weight: 2,
          opacity: 0.5,
          fillColor: '#f59e0b',
          fillOpacity: 0.06,
          interactive: false,
          pane: 'field-photos-overlay-pane',
        }).addTo(layerGroup);
        activeOrbitLayers.push(circle);

        const direction = Number(photo.direction_degrees);
        if (Number.isFinite(direction)) {
          const arrowEnd = computeDestination(lat, lng, direction, radius * 0.9);
          const line = L.polyline([[lat, lng], [arrowEnd.lat, arrowEnd.lng]], {
            color: '#3b82f6', weight: 3, opacity: 0.9, dashArray: '6,4', interactive: false, pane: 'field-photos-overlay-pane'
          }).addTo(layerGroup);
          activeOrbitLayers.push(line);

          const arrowIcon = L.divIcon({
            html: `<div style="transform:rotate(${direction}deg);line-height:1;">${ARROW_ICON_SVG}</div>`,
            className: 'field-photo-arrow',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          const arrowMarker = L.marker([arrowEnd.lat, arrowEnd.lng], { icon: arrowIcon, interactive: false, pane: 'field-photos-pane' }).addTo(layerGroup);
          activeOrbitLayers.push(arrowMarker);
        }
      });

      // Clear orbit when popup closes
      marker.on('popupclose', clearActiveOrbit);

      marker.addTo(layerGroup);
    });

    if (normalizedPhotos.length > 0) {
      const anyVisible = normalizedPhotos.some(({ lat, lng }) => map.getBounds().contains([lat, lng] as L.LatLngExpression));
      if (!anyVisible) {
        const bounds = L.latLngBounds(normalizedPhotos.map(({ lat, lng }) => [lat, lng] as [number, number]));
        map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
      }
    }
  }, [showFieldPhotos, fieldPhotos, mapProvider, globalOrbitRadius]);

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
            billboards={billboards}
            onSelectBillboard={focusOnBillboard}
            onNavigateToCoords={navigateToCoords}
            placeholder={isMobile ? 'بحث...' : 'ابحث عن لوحة، منطقة، إحداثيات...'}
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
          ? 'bottom-16 right-2' 
          : isFullscreen ? 'top-20 right-5' : 'top-20 right-4'
      }`}>
        <div className={`flex flex-col gap-1 bg-card/90 backdrop-blur-md border border-border/50 shadow-lg ${
          isMobile ? 'rounded-xl p-1' : isFullscreen ? 'rounded-2xl p-2' : 'rounded-2xl p-1.5'
        }`}>
          <MapControlButtons
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onToggleLayers={() => setShowLayers(!showLayers)}
            onCenterOnUser={handleCenterOnUser}
            isSimpleTracking={isSimpleTracking}
            onToggleSimpleTracking={toggleSimpleTracking}
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
          
          {/* Labels toggle - when in satellite mode and OSM provider */}
          {mapType === 'satellite' && mapProvider === 'openstreetmap' && (
            <>
              <div className={`border-t border-border/50 ${isMobile ? 'my-1' : 'my-1.5'}`} />
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`w-full flex items-center justify-between rounded font-bold transition-all ${
                  isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-3 py-2 text-sm'
                } ${
                  showLabels
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent/50 text-foreground hover:bg-accent'
                }`}
              >
                <span className={`${isMobile ? 'text-[8px]' : 'text-xs'}`}>{showLabels ? '✓' : ''}</span>
                <span>مسميات</span>
              </button>
            </>
          )}

          {/* Satellite provider selector - when in satellite mode and OSM provider */}
          {mapType === 'satellite' && mapProvider === 'openstreetmap' && (
            <>
              <div className={`border-t border-border/50 ${isMobile ? 'my-1' : 'my-1.5'}`} />
              <h5 className={`text-primary/80 font-bold text-right ${isMobile ? 'text-[8px] mb-0.5' : 'text-xs mb-1'}`}>مزود الصور</h5>
              <div className="space-y-0.5">
                {SATELLITE_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSatelliteProvider(p.id);
                      localStorage.setItem("osm_satellite_provider", p.id);
                    }}
                    className={`w-full flex items-center justify-end gap-1 rounded transition-all ${
                      isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-3 py-2 text-sm'
                    } font-bold ${
                      satelliteProvider === p.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent/50 text-foreground hover:bg-accent'
                    }`}
                  >
                    {p.labelAr}
                  </button>
                ))}
              </div>
            </>
          )}
          
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

          {/* Field Photos toggle */}
          <div className={`border-t border-border/50 ${isMobile ? 'my-1' : 'my-1.5'}`} />
          <button
            onClick={() => {
              const next = !showFieldPhotos;
              if (next) refetchPhotos();
              setShowFieldPhotos(next);
            }}
            className={`w-full flex items-center justify-between rounded font-bold transition-all ${
              isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-3 py-2 text-sm'
            } ${
              showFieldPhotos
                ? 'bg-amber-500 text-white'
                : 'bg-accent/50 text-foreground hover:bg-accent'
            }`}
          >
            <span className={`${isMobile ? 'text-[8px]' : 'text-xs'}`}>{showFieldPhotos ? '✓' : ''}</span>
            <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> صور ميدانية {fieldPhotos.length > 0 ? `(${fieldPhotos.length})` : ''}</span>
          </button>
          <button
            onClick={() => setShowPhotoUpload(true)}
            className={`w-full flex items-center justify-center gap-1 rounded font-bold transition-all bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 ${
              isMobile ? 'px-1.5 py-1 text-[9px] mt-0.5' : 'px-3 py-1.5 text-xs mt-1'
            }`}
          >
            <Camera className="w-3 h-3" /> رفع صور
          </button>
          <button
            onClick={() => setShowOrbitCalibration(true)}
            className={`w-full flex items-center justify-center gap-1 rounded font-bold transition-all bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 ${
              isMobile ? 'px-1.5 py-1 text-[9px] mt-0.5' : 'px-3 py-1.5 text-xs mt-1'
            }`}
          >
            <Target className="w-3 h-3" /> معايرة المدار
          </button>
          
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

      {/* Orbit Calibration Panel */}
      {showOrbitCalibration && (
        <div className={`absolute z-[1100] pointer-events-auto ${
          isMobile ? 'top-14 left-1 right-1' : 'top-16 left-4 w-80'
        }`}>
          <div className="bg-card border border-border rounded-xl shadow-2xl p-4 space-y-4" dir="rtl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-500" />
                معايرة المدار
              </h3>
              <button onClick={() => setShowOrbitCalibration(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">قطر المدار</span>
                <span className="font-bold text-violet-500">{calibrationRadius} متر</span>
              </div>
              <Slider
                min={10}
                max={500}
                step={5}
                value={[calibrationRadius]}
                onValueChange={([val]) => {
                  setCalibrationRadius(val);
                  // Live preview: update all visible circles
                  googlePhotoCirclesRef.current.forEach(c => c.setRadius(val));
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10م</span><span>250م</span><span>500م</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await updateAllOrbit.mutateAsync(calibrationRadius);
                    setGlobalOrbitRadius(calibrationRadius);
                    (window as any).__globalOrbitRadius = calibrationRadius;
                    // Also save to system_settings
                    await (supabase as any)
                      .from('system_settings')
                      .upsert({ setting_key: 'field_photo_orbit_radius', setting_value: String(calibrationRadius) }, { onConflict: 'setting_key' });
                    toast.success(`تم تطبيق ${calibrationRadius}م على جميع الصور (${fieldPhotos.length})`);
                  } catch (e) {
                    toast.error('فشل تحديث المدار');
                  }
                }}
                disabled={updateAllOrbit.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {updateAllOrbit.isPending ? 'جاري التطبيق...' : `تطبيق على الكل (${fieldPhotos.length})`}
              </button>
              <button
                onClick={() => {
                  setGlobalOrbitRadius(calibrationRadius);
                  (window as any).__globalOrbitRadius = calibrationRadius;
                  setShowOrbitCalibration(false);
                  // Trigger re-render of photos
                  if (showFieldPhotos) {
                    setShowFieldPhotos(false);
                    setTimeout(() => setShowFieldPhotos(true), 100);
                  }
                  toast.success(`تم ضبط المدار على ${calibrationRadius}م`);
                }}
                className="bg-accent hover:bg-accent/80 text-foreground rounded-lg py-2 px-3 text-xs font-bold transition-colors"
              >
                معاينة
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              اضبط القطر ثم اضغط "تطبيق على الكل" لتحديث جميع الصور في قاعدة البيانات، أو "معاينة" لرؤية التغيير على الخريطة فقط.
            </p>
          </div>
        </div>
      )}


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
        onSmartRouteChange={(routePoints) => {
          // Draw smart route on Google Maps using DirectionsService for road-following paths
          if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;
          
          // Clear existing smart route
          if (googleSmartRouteLineRef.current) {
            googleSmartRouteLineRef.current.setMap(null);
            googleSmartRouteLineRef.current = null;
          }
          googleSmartRouteRenderersRef.current.forEach(r => { try { r.setMap(null); } catch(e) {} });
          googleSmartRouteRenderersRef.current = [];
          googleSmartRouteMarkersRef.current.forEach(m => { try { m.setMap(null); } catch(e) {} });
          googleSmartRouteMarkersRef.current = [];
          
          if (!routePoints || routePoints.length === 0) return;
          
          const map = googleMapInstanceRef.current;
          
          // Add numbered markers for each stop (with cluster count)
          routePoints.forEach((point, index) => {
            const count = (point as any).billboardCount || 1;
            const label = count > 1 ? `${index + 1} (${count})` : `${index + 1}`;
            const size = count > 1 ? 36 : 28;
            const fontSize = count > 1 ? 10 : 12;
            const numberSvg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2-1}" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
              <text x="${size/2}" y="${size/2 + fontSize/3}" text-anchor="middle" fill="#fff" font-size="${fontSize}" font-weight="bold" font-family="Arial">${label}</text>
            </svg>`;
            
            const marker = new google.maps.Marker({
              position: { lat: point.lat, lng: point.lng },
              map,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(numberSvg),
                scaledSize: new google.maps.Size(size, size),
                anchor: new google.maps.Point(size/2, size/2),
              },
              zIndex: 700,
              title: point.name,
            });
            googleSmartRouteMarkersRef.current.push(marker);
          });
          
          // Use DirectionsService for road-following route
          const directionsService = new google.maps.DirectionsService();
          const MAX_WAYPOINTS = 23; // Google limit is 25 total (origin + destination + 23 waypoints)
          
          // Split into batches if needed
          const batches: { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral; waypoints: google.maps.DirectionsWaypoint[] }[] = [];
          
          for (let i = 0; i < routePoints.length - 1; i += MAX_WAYPOINTS + 1) {
            const batchEnd = Math.min(i + MAX_WAYPOINTS + 2, routePoints.length);
            const batchPoints = routePoints.slice(i, batchEnd);
            if (batchPoints.length < 2) continue;
            
            batches.push({
              origin: { lat: batchPoints[0].lat, lng: batchPoints[0].lng },
              destination: { lat: batchPoints[batchPoints.length - 1].lat, lng: batchPoints[batchPoints.length - 1].lng },
              waypoints: batchPoints.slice(1, -1).map(p => ({
                location: { lat: p.lat, lng: p.lng },
                stopover: true,
              })),
            });
          }
          
          // Request directions for each batch
          const fallbackToPolyline = () => {
            const path = routePoints.map(p => ({ lat: p.lat, lng: p.lng }));
            googleSmartRouteLineRef.current = new google.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: '#3b82f6',
              strokeOpacity: 0,
              strokeWeight: 4,
              map,
              zIndex: 600,
              icons: [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: '#3b82f6', scale: 4 },
                offset: '0',
                repeat: '20px',
              }, {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  strokeOpacity: 0.8, strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8, scale: 3,
                },
                offset: '50%',
                repeat: '200px',
              }],
            });
          };
          
          let successCount = 0;
          batches.forEach((batch, batchIdx) => {
            directionsService.route({
              origin: batch.origin,
              destination: batch.destination,
              waypoints: batch.waypoints,
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false, // We already optimized the order
            }, (result, status) => {
              if (status === google.maps.DirectionsStatus.OK && result) {
                const renderer = new google.maps.DirectionsRenderer({
                  map,
                  directions: result,
                  suppressMarkers: true, // We use our own numbered markers
                  polylineOptions: {
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.7,
                    strokeWeight: 5,
                    zIndex: 600,
                  },
                  preserveViewport: batchIdx > 0, // Only first batch sets viewport
                });
                googleSmartRouteRenderersRef.current.push(renderer);
                successCount++;
              } else {
                console.warn('DirectionsService failed for batch', batchIdx, status);
                // If first batch fails, fall back to polyline for entire route
                if (batchIdx === 0 && successCount === 0) {
                  fallbackToPolyline();
                }
              }
            });
          });
          
          // Fit bounds to show full route
          const bounds = new google.maps.LatLngBounds();
          routePoints.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
          map.fitBounds(bounds, { top: 100, bottom: 50, left: 50, right: 50 });
        }}
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

      {/* Field Photo Upload Dialog */}
      {showPhotoUpload && (
        <FieldPhotoUpload
          onClose={() => setShowPhotoUpload(false)}
          onUploadComplete={() => {
            refetchPhotos();
            setShowFieldPhotos(true);
          }}
        />
      )}

      {/* Billboard Detail Panel (Fullscreen Mode) */}
      {detailBillboard && (
        <div className="absolute top-0 left-0 bottom-0 z-[2000] w-80 max-w-[85vw] bg-card/95 backdrop-blur-xl border-r border-border/50 shadow-2xl overflow-y-auto pointer-events-auto animate-in slide-in-from-left duration-300">
          <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/30 p-4 flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm truncate flex-1">{(detailBillboard as any).Billboard_Name || detailBillboard.name || 'لوحة'}</h3>
            <Button size="icon" variant="ghost" className="w-8 h-8 flex-shrink-0" onClick={() => setDetailBillboard(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4 space-y-3">
            {/* Image */}
            {((detailBillboard as any).Image_URL || detailBillboard.image) && (
              <img 
                src={(detailBillboard as any).Image_URL || detailBillboard.image} 
                alt="" 
                className="w-full h-40 object-cover rounded-xl border border-border/30"
                onClick={() => setLightboxImage((detailBillboard as any).Image_URL || detailBillboard.image || null)}
              />
            )}
            {/* Info */}
            <div className="space-y-2 text-sm" dir="rtl">
              {[
                ['ID', (detailBillboard as any).ID],
                ['المدينة', (detailBillboard as any).City],
                ['البلدية', (detailBillboard as any).Municipality],
                ['المنطقة', (detailBillboard as any).District],
                ['الحجم', (detailBillboard as any).Size],
                ['المستوى', (detailBillboard as any).Level],
                ['الحالة', (detailBillboard as any).Status],
                ['أقرب نقطة دالة', (detailBillboard as any).Nearest_Landmark],
                ['العميل', (detailBillboard as any).Customer_Name],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label as string} className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="font-medium text-foreground text-xs">{String(val)}</span>
                </div>
              ))}
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                className="flex-1 gap-1 text-xs"
                onClick={() => {
                  setDetailBillboard(null);
                  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                  setTimeout(() => { if (onBillboardClick) onBillboardClick(detailBillboard); }, 300);
                }}
              >
                <ExternalLink className="w-3 h-3" />
                فتح صفحة التعديل
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
