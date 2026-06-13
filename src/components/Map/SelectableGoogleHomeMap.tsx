/// <reference types="google.maps" />
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map as MapIcon, Globe, Maximize2, Minimize2, ZoomIn, ZoomOut, Layers, CheckCircle, X, Search, Building2, Ruler, Filter, Tag, MapPin } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Billboard } from '@/types';
import { isBillboardAvailable, getDaysUntilExpiry } from '@/utils/contractUtils';
import type { MapProvider } from '@/types/map';
import { OSM_TILE_LAYERS } from '@/types/map';
import { parseCoords } from '@/utils/parseCoords';
import { getBillboardStatus, getSizeColor, getDaysRemaining } from '@/hooks/useMapMarkers';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';
import { createUnifiedPin, createUnifiedClusterSvg } from './unifiedPin';

interface SelectableGoogleHomeMapProps {
  billboards: Billboard[];
  selectedBillboards?: Set<string>;
  onToggleSelection?: (billboardId: string) => void;
  onSelectMultiple?: (billboardIds: string[]) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  className?: string;
  // ✅ NEW: Duration-based pricing props
  pricingMode?: 'months' | 'days';
  durationMonths?: number;
  durationDays?: number;
  pricingCategory?: string;
  calculateBillboardPrice?: (billboard: Billboard) => number;
  // ✅ Hide the internal filter/search bar (used when parent provides its own filters)
  hideInternalFilters?: boolean;
}


const LIBYA_CENTER = { lat: 32.8872, lng: 13.1913 };

export default function SelectableGoogleHomeMap({ 
  billboards, 
  selectedBillboards,
  onToggleSelection,
  onSelectMultiple,
  onSelectAll,
  onClearAll,
  className,
  pricingMode = 'months',
  durationMonths = 3,
  durationDays = 0,
  pricingCategory = 'عادي',
  calculateBillboardPrice,
  hideInternalFilters = false,
}: SelectableGoogleHomeMapProps) {
  // Google Maps refs
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googleSelectedMarkersRef = useRef<google.maps.Marker[]>([]);
  const googleClustererRef = useRef<MarkerClusterer | null>(null);
  const googleInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  // ✅ Track previous filter state to know when to fitBounds vs just update markers
  const prevFilterKeyRef = useRef<string>('');
  const hasFitBoundsRef = useRef(false);
  
  // Leaflet refs
  const leafletMapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const leafletClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletLabelsRef = useRef<L.TileLayer | null>(null);
  const leafletSelectedMarkersRef = useRef<L.Marker[]>([]);
  
  // Container ref for fullscreen
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State - OSM is the default provider
  const [mapProvider, setMapProvider] = useState<MapProvider>('openstreetmap');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'styled' | 'detailed'>('satellite');
  const [showLabels, setShowLabels] = useState(true); // ✅ Labels on by default
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [filterCity, setFilterCity] = useState<string[]>([]);
  const [filterSize, setFilterSize] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRentalStatus, setFilterRentalStatus] = useState<string>('all');
  const [allSizes, setAllSizes] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [googleMapReady, setGoogleMapReady] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(8);
  const [visibleHeightMeters, setVisibleHeightMeters] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Listen for image lightbox events
  useEffect(() => {
    const handleShowImage = (e: CustomEvent) => {
      setLightboxImage(e.detail);
    };
    window.addEventListener('showBillboardImage' as any, handleShowImage);
    return () => window.removeEventListener('showBillboardImage' as any, handleShowImage);
  }, []);
  // ✅ Reset internal filters when external billboard list changes
  useEffect(() => {
    setSearchQuery('');
    setFilterCity([]);
    setFilterSize([]);
    setFilterRentalStatus('all');
    setFilterStatus('all');
  }, [billboards.length]);

  // Load sizes from database
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

  // Get cities and sizes from billboards
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    billboards.forEach(b => {
      const city = (b as any).City;
      if (city) citySet.add(city);
    });
    return Array.from(citySet).sort();
  }, [billboards]);

  const sizes = useMemo(() => {
    const sizeSet = new Set<string>(allSizes);
    billboards.forEach(b => {
      const size = (b as any).Size;
      if (size) sizeSet.add(size);
    });
    return [...allSizes, ...Array.from(sizeSet).filter(s => !allSizes.includes(s))];
  }, [billboards, allSizes]);

  // ✅ Get unique customer names for suggestions
  const customerNames = useMemo(() => {
    const nameSet = new Set<string>();
    billboards.forEach(b => {
      const customer = (b as any).Customer_Name;
      if (customer) nameSet.add(customer);
    });
    return Array.from(nameSet).sort();
  }, [billboards]);

  // ✅ Get unique ad types for suggestions
  const adTypes = useMemo(() => {
    const typeSet = new Set<string>();
    billboards.forEach(b => {
      const adType = (b as any).Ad_Type;
      if (adType) typeSet.add(adType);
    });
    return Array.from(typeSet).sort();
  }, [billboards]);

  // ✅ Get unique landmarks for suggestions
  const landmarks = useMemo(() => {
    const landmarkSet = new Set<string>();
    billboards.forEach(b => {
      const landmark = (b as any).Nearest_Landmark;
      if (landmark) landmarkSet.add(landmark);
    });
    return Array.from(landmarkSet).sort();
  }, [billboards]);

  // ✅ Get unique districts for suggestions
  const districts = useMemo(() => {
    const districtSet = new Set<string>();
    billboards.forEach(b => {
      const district = (b as any).District;
      if (district) districtSet.add(district);
    });
    return Array.from(districtSet).sort();
  }, [billboards]);

  // ✅ Get unique municipalities for suggestions
  const municipalities = useMemo(() => {
    const munSet = new Set<string>();
    billboards.forEach(b => {
      const mun = (b as any).Municipality;
      if (mun) munSet.add(mun);
    });
    return Array.from(munSet).sort();
  }, [billboards]);

  // ✅ Smart search suggestions - names, landmarks, districts, coordinates, municipalities
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const suggestions: { type: string; value: string; label: string; coords?: { lat: number; lng: number } }[] = [];
    
    // ✅ Check if query looks like coordinates (e.g., "32.88, 13.19" or "32.88,13.19")
    const coordMatch = query.match(/^(-?\d+\.?\d*)\s*[,،\s]\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        suggestions.push({ 
          type: 'coords', 
          value: `${lat}, ${lng}`, 
          label: `📌 انتقل إلى: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          coords: { lat, lng }
        });
      }
    }
    
    // Billboard names
    billboards.forEach(b => {
      const name = (b as any).Billboard_Name || '';
      if (name.toLowerCase().includes(query) && suggestions.length < 5) {
        suggestions.push({ type: 'billboard', value: name, label: `🎯 ${name}` });
      }
    });
    
    // ✅ Nearest landmarks
    landmarks.forEach(landmark => {
      if (landmark.toLowerCase().includes(query) && suggestions.length < 8) {
        suggestions.push({ type: 'landmark', value: landmark, label: `📍 ${landmark}` });
      }
    });
    
    // ✅ Districts
    districts.forEach(district => {
      if (district.toLowerCase().includes(query) && suggestions.length < 10) {
        suggestions.push({ type: 'district', value: district, label: `🏘️ ${district}` });
      }
    });
    
    // ✅ Municipalities
    municipalities.forEach(mun => {
      if (mun.toLowerCase().includes(query) && suggestions.length < 12) {
        suggestions.push({ type: 'municipality', value: mun, label: `🏛️ ${mun}` });
      }
    });
    
    // Customer names
    customerNames.forEach(name => {
      if (name.toLowerCase().includes(query) && suggestions.length < 14) {
        suggestions.push({ type: 'customer', value: name, label: `👤 ${name}` });
      }
    });
    
    // Cities
    cities.forEach(city => {
      if (city.toLowerCase().includes(query) && suggestions.length < 16) {
        suggestions.push({ type: 'city', value: city, label: `🌆 ${city}` });
      }
    });
    
    // Ad types
    adTypes.forEach(adType => {
      if (adType.toLowerCase().includes(query) && suggestions.length < 18) {
        suggestions.push({ type: 'adType', value: adType, label: `📺 ${adType}` });
      }
    });
    
    return suggestions.slice(0, 10);
  }, [searchQuery, billboards, customerNames, cities, adTypes, landmarks, districts, municipalities]);

  // Filter billboards
  const filteredBillboards = useMemo(() => {
    return billboards.filter(b => {
      const billboardId = String((b as any).ID || (b as any).id || '');
      const name = (b as any).Billboard_Name?.toLowerCase() || '';
      const landmark = (b as any).Nearest_Landmark?.toLowerCase() || '';
      const city = (b as any).City || '';
      const size = (b as any).Size || '';
      const customerName = (b as any).Customer_Name?.toLowerCase() || '';
      const adType = (b as any).Ad_Type?.toLowerCase() || '';
      const district = (b as any).District?.toLowerCase() || '';
      const municipality = (b as any).Municipality?.toLowerCase() || '';
      const gpsCoords = (b as any).GPS_Coordinates?.toLowerCase() || '';
      const status = getBillboardStatus(b);
      
      // ✅ Smart search - names, landmarks, districts, municipalities, coordinates
      const q = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' || 
        name.includes(q) ||
        landmark.includes(q) ||
        city.toLowerCase().includes(q) ||
        customerName.includes(q) ||
        adType.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        gpsCoords.includes(q) ||
        billboardId.includes(searchQuery);
      
      const matchesCity = filterCity.length === 0 || filterCity.includes(city);
      const matchesSize = filterSize.length === 0 || filterSize.includes(size);
      
      const isSelected = selectedBillboards?.has(billboardId);
      const matchesSelection = filterStatus === 'all' || 
        (filterStatus === 'selected' ? isSelected : !isSelected);
      
      // ✅ New rental status filter — uses isBillboardAvailable for consistency with cards
      // Hidden billboards (is_visible_in_available === false) are excluded from all
      // status buckets except when no status filter is applied at all.
      const isHiddenFromAvailable = (b as any).is_visible_in_available === false;
      const isAvail = isBillboardAvailable(b, true) && !isHiddenFromAvailable;
      const daysLeft = getDaysUntilExpiry((b as any).Rent_End_Date || (b as any).rent_end_date || null);
      const isUpcoming = !isAvail && daysLeft !== null && daysLeft >= 0 && daysLeft <= 90;
      const matchesRentalStatus = filterRentalStatus === 'all' ||
        (filterRentalStatus === 'available' && isAvail) ||
        (filterRentalStatus === 'upcoming' && isUpcoming && !isHiddenFromAvailable) ||
        (filterRentalStatus === 'rented' && !isAvail && !isUpcoming && !isHiddenFromAvailable);

      return matchesSearch && matchesCity && matchesSize && matchesSelection && matchesRentalStatus && parseCoords(b) !== null;
    });
  }, [billboards, searchQuery, filterCity, filterSize, filterStatus, filterRentalStatus]);

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
      const current = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(current + 2);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomIn(2);
    }
  }, [mapProvider]);

  const handleZoomOut = useCallback(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const current = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(current - 2);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomOut(2);
    }
  }, [mapProvider]);

  const handleToggleProvider = useCallback(() => {
    setMapProvider(prev => prev === 'google' ? 'openstreetmap' : 'google');
  }, []);

  const calculateVerticalDistanceMeters = useCallback((north: number, south: number) => {
    const earthRadius = 6_371_000;
    return Math.abs((north - south) * (Math.PI / 180) * earthRadius);
  }, []);

  const formatDistance = useCallback((meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return '--';
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} كم` : `${Math.round(meters)} م`;
  }, []);

  // Create pin with a modern, floating 3D teardrop design
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false) => {
    return createUnifiedPin(billboard, isSelected);
  }, []);

  // ✅ Compact popup design from repo - with selection button
  const createSelectablePopupContent = useCallback((billboard: Billboard, isSelected: boolean) => {
    const status = getBillboardStatus(billboard);
    const sizeColor = getSizeColor((billboard as any).Size || '');
    const statusColor = status.color;
    const statusBg = status.label === 'متاحة' ? 'rgba(34,197,94,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
    
    const name = (billboard as any).Billboard_Name || `لوحة ${(billboard as any).ID}`;
    const location = (billboard as any).Nearest_Landmark || '';
    const city = (billboard as any).City || '';
    const municipality = (billboard as any).Municipality || '';
    const size = (billboard as any).Size || '';
    const imageUrl = (billboard as any).Image_URL || '';
    const billboardId = String((billboard as any).ID || billboard.ID);
    const designFaceA = (billboard as any).design_face_a || '';
    const daysRemaining = getDaysRemaining((billboard as any).Rent_End_Date);
    const district = (billboard as any).District || '';

    // ✅ Calculate price based on duration
    let displayPrice = '0';
    let priceLabel = 'السعر';
    
    if (calculateBillboardPrice) {
      const calculatedPrice = calculateBillboardPrice(billboard);
      displayPrice = calculatedPrice.toLocaleString('ar-LY');
      if (pricingMode === 'months') {
        priceLabel = durationMonths === 1 ? 'سعر الشهر' : `سعر ${durationMonths} أشهر`;
      } else {
        priceLabel = durationDays === 1 ? 'سعر اليوم' : `سعر ${durationDays} يوم`;
      }
    } else {
      const basePrice = (billboard as any).Price || 0;
      displayPrice = basePrice.toLocaleString('ar-LY');
      priceLabel = 'السعر/شهر';
    }
    
    // GPS coordinates for navigation
    const gpsCoords = (billboard as any).GPS_Coordinates || '';
    const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : [];
    const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
    const googleMapsUrl = hasValidCoords 
      ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
      : '#';
    
    // ✅ Enhanced popup card - matching main map style
    const contractNumber = (billboard as any).Contract_Number || 0;
    const hasContract = contractNumber && Number(contractNumber) > 0;
    const adType = (billboard as any).Ad_Type || '';
    const level = (billboard as any).Level || '';

    return `
      <div style="
        font-family: 'Tajawal', sans-serif; direction: rtl; width: 260px; max-width: 85vw;
        background: linear-gradient(145deg, rgba(26,26,46,0.98), rgba(15,15,30,0.98));
        border-radius: 12px; overflow: hidden; 
        border: 1px solid ${isSelected ? '#fbbf24' : 'rgba(212,175,55,0.2)'};
        box-shadow: 0 12px 32px -4px rgba(0,0,0,0.6);
      ">
        <!-- Image -->
        <div style="position: relative; height: 100px; overflow: hidden; cursor: pointer;"
             onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceA || imageUrl || '/roadside-billboard.png'}'}))">
          <img src="${designFaceA || imageUrl || '/roadside-billboard.png'}" alt="${name}" 
               style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/roadside-billboard.png'" />
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 20%, rgba(15,15,30,0.9) 100%);"></div>
          <div style="position: absolute; top: 6px; right: 6px; display: flex; gap: 4px;">
            <div style="background: ${sizeColor.bg}; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; color: ${sizeColor.text}; backdrop-filter: blur(4px);">${size}</div>
            ${level ? `<div style="background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; color: #d4af37; backdrop-filter: blur(4px);">${level}</div>` : ''}
          </div>
          <div style="position: absolute; top: 6px; left: 6px; background: ${statusBg}; backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 8px; font-size: 9px; font-weight: 700; color: ${statusColor}; display: flex; align-items: center; gap: 4px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor}; ${status.label === 'متاحة' ? 'box-shadow: 0 0 6px ' + statusColor + ';' : ''}"></span>${status.label}
          </div>
          ${isSelected ? `<div style="position: absolute; bottom: 6px; left: 6px; background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; color: #1a1a2e; box-shadow: 0 2px 8px rgba(251,191,36,0.4);">✓ محددة</div>` : ''}
          <div style="position: absolute; bottom: 6px; right: 6px; color: rgba(255,255,255,0.8); font-size: 11px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.8);">${name}</div>
        </div>
        
        <div style="padding: 10px;">
          <!-- Location info -->
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
            <span style="font-size: 11px;">📍</span>
            <p style="color: #aaa; font-size: 10px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${location || city || 'موقع غير محدد'}</p>
            ${municipality ? `<span style="color: #666; font-size: 9px;">${municipality}</span>` : ''}
          </div>
          
          ${hasContract ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 4px 8px; background: rgba(239,68,68,0.08); border-radius: 6px; border: 1px solid rgba(239,68,68,0.15);">
            <span style="font-size: 9px; color: #999;">عقد</span>
            <span style="font-size: 11px; font-weight: 800; color: #ef4444;">#${contractNumber}</span>
            ${adType ? `<span style="font-size: 9px; color: #999; margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100px;">${adType}</span>` : ''}
          </div>
          ` : ''}
          
          ${status.label !== 'متاحة' && daysRemaining !== null && daysRemaining > 0 ? `
            <div style="background: rgba(245,158,11,0.08); padding: 4px 8px; border-radius: 6px; margin-bottom: 6px; font-size: 10px; font-weight: 600; color: #f59e0b; border: 1px solid rgba(245,158,11,0.15); display: flex; align-items: center; gap: 4px;">
              <span>⏱</span> متبقي ${daysRemaining} يوم
            </div>
          ` : ''}
          
          <!-- Price -->
          <div style="display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: rgba(34,197,94,0.06); border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(34,197,94,0.12);">
            <div style="flex: 1;">
              <span style="font-size: 9px; color: #777;">${priceLabel}</span>
              <p style="margin: 0; color: #22c55e; font-weight: 800; font-size: 14px; letter-spacing: 0.5px;">${displayPrice} <span style="font-size: 10px; font-weight: 600;">د.ل</span></p>
            </div>
          </div>
          
          <!-- Buttons -->
          <div style="display: flex; gap: 4px;">
            ${hasValidCoords ? `
              <a href="${googleMapsUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; padding: 6px 10px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 8px; color: #fff; font-size: 10px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 8px rgba(59,130,246,0.3);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </a>
            ` : ''}
            <button onclick="window.dispatchEvent(new CustomEvent('toggleBillboard', {detail: '${billboardId}'}))"
              style="flex: 1; padding: 7px 10px; background: ${isSelected ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'}; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 11px; font-family: 'Tajawal', sans-serif; box-shadow: 0 2px 8px ${isSelected ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}; transition: transform 0.1s;">
              ${isSelected ? '✕ إلغاء التحديد' : '✓ تحديد اللوحة'}
            </button>
          </div>
        </div>
      </div>
    `;
  }, [calculateBillboardPrice, pricingMode, durationMonths, durationDays]);

  // Listen for toggle events
  useEffect(() => {
    const handleToggle = (e: CustomEvent) => {
      if (onToggleSelection) {
        onToggleSelection(e.detail);
      }
    };
    window.addEventListener('toggleBillboard' as any, handleToggle);
    return () => window.removeEventListener('toggleBillboard' as any, handleToggle);
  }, [onToggleSelection]);

  // Initialize Google Maps with keyless loader
  useEffect(() => {
    if (mapProvider !== 'google') {
      setGoogleMapReady(false);
      return;
    }
    
    let isMounted = true;
    
    const initMap = async () => {
      try {
        await loadGoogleMapsKeyless();
        
        if (!isMounted || !googleMapRef.current) return;
        
        // If map already exists, just update and return
        if (googleMapInstanceRef.current) {
          setGoogleMapReady(true);
          return;
        }
        
        googleMapInstanceRef.current = new google.maps.Map(googleMapRef.current, {
          center: LIBYA_CENTER,
          zoom: 8,
          mapTypeId: mapType === 'satellite' ? (showLabels ? 'hybrid' : 'satellite') : 'roadmap',
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          disableDoubleClickZoom: true, // ✅ Disable default double-click zoom since we use it for selection
          styles: mapType === 'roadmap' ? [
            { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
          ] : []
        });
        
        // ✅ Close InfoWindow when clicking on the map
        googleMapInstanceRef.current.addListener('click', () => {
          if (googleInfoWindowRef.current) {
            googleInfoWindowRef.current.close();
            googleInfoWindowRef.current = null;
          }
        });
        
        console.log('[SelectableGoogleHomeMap] Google Map initialized successfully');
        
        // ✅ Signal that map is ready AFTER initialization
        if (isMounted) {
          setGoogleMapReady(true);
        }
      } catch (error) {
        console.error('[SelectableGoogleHomeMap] Failed to initialize Google Maps:', error);
      }
    };
    
    initMap();
    
    return () => {
      isMounted = false;
    };
  }, [mapProvider, mapType, showLabels]);

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

    // Google satellite: lyrs=y (with labels) or lyrs=s (no labels)
    const satLyrs = showLabels ? 'y' : 's';
    const tileConfig = mapType === 'satellite' 
      ? { url: `https://mt1.google.com/vt/lyrs=${satLyrs}&x={x}&y={y}&z={z}`, attribution: '&copy; Google', maxZoom: 21 }
      : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 21
    }).addTo(map);

    // Add labels overlay for non-satellite mode if enabled
    if (mapType !== 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '',
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
        const clusterColors = [
          { ring: '#3b82f6', core: '#1e40af', glow: 'rgba(59,130,246,0.3)' },
          { ring: '#8b5cf6', core: '#5b21b6', glow: 'rgba(139,92,246,0.3)' },
          { ring: '#f59e0b', core: '#b45309', glow: 'rgba(245,158,11,0.3)' },
          { ring: '#ef4444', core: '#991b1b', glow: 'rgba(239,68,68,0.3)' },
        ][tier];
        
        return L.divIcon({
          html: `
            <div style="width: ${size}px; height: ${size}px; position: relative; filter: drop-shadow(0 4px 12px ${clusterColors.glow});">
              <svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="cg${count}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${clusterColors.ring}"/>
                    <stop offset="100%" stop-color="${clusterColors.core}"/>
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

  // Update Leaflet tile layer (mapType, showLabels)
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletTileRef.current) return;

    leafletMapInstanceRef.current.removeLayer(leafletTileRef.current);
    if (leafletLabelsRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletLabelsRef.current);
      leafletLabelsRef.current = null;
    }
    
    const satLyrs = showLabels ? 'y' : 's';
    const tileConfig = mapType === 'satellite' 
      ? { url: `https://mt1.google.com/vt/lyrs=${satLyrs}&x={x}&y={y}&z={z}`, attribution: '&copy; Google', maxZoom: 21 }
      : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 21
    }).addTo(leafletMapInstanceRef.current);

    // Add labels overlay for non-satellite mode if enabled
    if (mapType !== 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '',
        maxZoom: 21,
        pane: 'overlayPane'
      }).addTo(leafletMapInstanceRef.current);
    }
  }, [mapType, mapProvider, showLabels]);

  // Update Leaflet markers - Selected markers excluded from cluster
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletClusterRef.current) return;

    // ✅ Track filter changes for Leaflet too
    const leafletFilterKey = `leaflet-${searchQuery}-${filterCity.join(',')}-${filterSize.join(',')}-${filterStatus}-${filterRentalStatus}`;
    const isLeafletFilterChange = leafletFilterKey !== prevFilterKeyRef.current;
    prevFilterKeyRef.current = leafletFilterKey;

    // ✅ Save current view before clearing
    const savedCenter = leafletMapInstanceRef.current.getCenter();
    const savedZoom = leafletMapInstanceRef.current.getZoom();

    leafletClusterRef.current.clearLayers();
    leafletSelectedMarkersRef.current.forEach(m => m.remove());
    leafletSelectedMarkersRef.current = [];

    const bounds = L.latLngBounds([]);
    let hasMarkers = false;

    filteredBillboards.forEach((b) => {
      const coords = parseCoords(b);
      if (!coords) return;

      const billboardId = String((b as any).ID || b.ID);
      const isSelected = selectedBillboards?.has(billboardId) || false;
      const pinData = createPinWithLabel(b, isSelected);
      
      const icon = L.icon({
        iconUrl: pinData.url,
        iconSize: [pinData.width, pinData.height],
        iconAnchor: [pinData.anchorX, pinData.anchorY],
        popupAnchor: [0, -pinData.anchorY]
      });

      const marker = L.marker([coords.lat, coords.lng], { 
        icon,
        zIndexOffset: isSelected ? 2000 : 0
      });
      
      const popupContent = createSelectablePopupContent(b, isSelected);
      marker.bindPopup(popupContent, { 
        className: 'leaflet-popup-dark',
        maxWidth: 300
      });
      
      marker.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onToggleSelection) {
          onToggleSelection(billboardId);
        }
      });

      if (isSelected) {
        marker.addTo(leafletMapInstanceRef.current!);
        leafletSelectedMarkersRef.current.push(marker);
      } else {
        leafletClusterRef.current?.addLayer(marker);
      }

      bounds.extend([coords.lat, coords.lng]);
      hasMarkers = true;
    });

    // ✅ Only fitBounds on filter changes
    if (hasMarkers && bounds.isValid() && isLeafletFilterChange) {
      leafletMapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    } else if (!isLeafletFilterChange && savedCenter && savedZoom) {
      // ✅ Restore view on selection-only changes
      leafletMapInstanceRef.current.setView(savedCenter, savedZoom, { animate: false });
    }
  }, [filteredBillboards, mapProvider, selectedBillboards, createPinWithLabel, createSelectablePopupContent, onToggleSelection, searchQuery, filterCity, filterSize, filterStatus]);

  // Update Google Maps markers - Selected markers excluded from cluster
  useEffect(() => {
    if (mapProvider !== 'google') return;
    
    // ✅ Wait for map to be ready using state flag
    if (!googleMapReady || !googleMapInstanceRef.current) {
      console.log('[SelectableGoogleHomeMap] Map not ready yet, waiting...');
      return;
    }
    
    // ✅ Compute a filter key to detect filter/billboard changes vs selection-only changes
    const filterKey = `${searchQuery}-${filterCity.join(',')}-${filterSize.join(',')}-${filterStatus}-${filterRentalStatus}`;
    const isFilterChange = filterKey !== prevFilterKeyRef.current;
    prevFilterKeyRef.current = filterKey;

    const map = googleMapInstanceRef.current;
    
    // ✅ Save current view BEFORE clearing markers (prevents zoom-out on selection change)
    const savedCenter = map.getCenter();
    const savedZoom = map.getZoom();

    // Clear existing markers
    googleMarkersRef.current.forEach(m => m.setMap(null));
    googleMarkersRef.current = [];
    googleSelectedMarkersRef.current.forEach(m => m.setMap(null));
    googleSelectedMarkersRef.current = [];
    if (googleClustererRef.current) {
      googleClustererRef.current.clearMarkers();
      googleClustererRef.current.setMap(null);
      googleClustererRef.current = null;
    }
    if (googleInfoWindowRef.current) {
      googleInfoWindowRef.current.close();
    }

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    const unselectedMarkers: google.maps.Marker[] = [];
    const selectedMarkers: google.maps.Marker[] = [];

    filteredBillboards.forEach(b => {
      const coords = parseCoords(b);
      if (!coords) return;

      const billboardId = String((b as any).ID || b.ID);
      const isSelected = selectedBillboards?.has(billboardId) || false;
      const pinData = createPinWithLabel(b, isSelected);

      const marker = new google.maps.Marker({
        position: coords,
        title: (b as any).Billboard_Name || '',
        icon: {
          url: pinData.url,
          scaledSize: new google.maps.Size(pinData.width, pinData.height),
          anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY),
        },
        zIndex: isSelected ? 2000 : 1,
        optimized: true
      });

      // Single click: Open popup
      let clickTimeout: ReturnType<typeof setTimeout> | null = null;
      
      marker.addListener('click', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
          return;
        }
        clickTimeout = setTimeout(() => {
          clickTimeout = null;
          if (googleInfoWindowRef.current) {
            googleInfoWindowRef.current.close();
          }
          googleInfoWindowRef.current = new google.maps.InfoWindow({
            content: createSelectablePopupContent(b, isSelected)
          });
          googleInfoWindowRef.current.open(map, marker);
        }, 250);
      });
      
      // Double-click: Toggle selection
      marker.addListener('dblclick', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
        if (onToggleSelection) {
          onToggleSelection(billboardId);
        }
      });

      bounds.extend(coords);
      hasMarkers = true;

      if (isSelected) {
        selectedMarkers.push(marker);
      } else {
        unselectedMarkers.push(marker);
      }
    });

    googleMarkersRef.current = unselectedMarkers;
    
    // Create clusterer for unselected markers
    if (unselectedMarkers.length > 0) {
      googleClustererRef.current = new MarkerClusterer({
        map,
        markers: unselectedMarkers,
        renderer: {
          render: ({ count, position }) => {
            const size = count > 50 ? 56 : count > 20 ? 48 : 44;
            const svg = `
              <svg width="${size}" height="${size}" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="clusterGradG" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#d4af37"/>
                    <stop offset="100%" style="stop-color:#b8860b"/>
                  </linearGradient>
                </defs>
                <circle cx="25" cy="25" r="23" fill="url(#clusterGradG)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
                <text x="25" y="30" text-anchor="middle" fill="#d4af37" font-size="14" font-weight="800" font-family="Tajawal, sans-serif">${count > 99 ? '99+' : count}</text>
              </svg>
            `;
            return new google.maps.Marker({
              position,
              icon: {
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
                scaledSize: new google.maps.Size(size, size),
                anchor: new google.maps.Point(size / 2, size / 2)
              },
              zIndex: 500
            });
          }
        }
      });
    }

    // Add selected markers directly to map
    selectedMarkers.forEach(marker => {
      marker.setMap(map);
    });
    googleSelectedMarkersRef.current = selectedMarkers;

    // ✅ Only fitBounds on initial load or filter changes
    if (hasMarkers && !bounds.isEmpty() && (isFilterChange || !hasFitBoundsRef.current)) {
      hasFitBoundsRef.current = true;
      setTimeout(() => {
        if (googleMapInstanceRef.current) {
          googleMapInstanceRef.current.fitBounds(bounds, { top: 80, bottom: 80, left: 40, right: 40 });
          google.maps.event.addListenerOnce(googleMapInstanceRef.current, 'idle', () => {
            const zoom = googleMapInstanceRef.current?.getZoom();
            if (zoom && zoom > 15) {
              googleMapInstanceRef.current?.setZoom(15);
            }
          });
        }
      }, 100);
    } else if (!isFilterChange && savedCenter && savedZoom) {
      // ✅ Restore saved view on selection-only changes to prevent zoom-out
      requestAnimationFrame(() => {
        if (googleMapInstanceRef.current) {
          googleMapInstanceRef.current.setCenter(savedCenter);
          googleMapInstanceRef.current.setZoom(savedZoom);
        }
      });
    }
  }, [filteredBillboards, mapProvider, selectedBillboards, createPinWithLabel, createSelectablePopupContent, googleMapReady, onToggleSelection, searchQuery, filterCity, filterSize, filterStatus, filterRentalStatus]);

  // Update map type
  useEffect(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      googleMapInstanceRef.current.setMapTypeId(mapType === 'satellite' ? (showLabels ? 'hybrid' : 'satellite') : 'roadmap');
    }
  }, [mapType, mapProvider, showLabels]);

  useEffect(() => {
    if (mapProvider === 'google') {
      const map = googleMapInstanceRef.current;
      if (!googleMapReady || !map) return;

      const updateGoogleMetrics = () => {
        const zoom = map.getZoom() ?? 8;
        setCurrentZoom(zoom);

        const bounds = map.getBounds();
        if (!bounds) return;

        const north = bounds.getNorthEast().lat();
        const south = bounds.getSouthWest().lat();
        setVisibleHeightMeters(calculateVerticalDistanceMeters(north, south));
      };

      updateGoogleMetrics();
      const zoomListener = map.addListener('zoom_changed', updateGoogleMetrics);
      const idleListener = map.addListener('idle', updateGoogleMetrics);

      return () => {
        google.maps.event.removeListener(zoomListener);
        google.maps.event.removeListener(idleListener);
      };
    }

    if (mapProvider === 'openstreetmap') {
      const map = leafletMapInstanceRef.current;
      if (!map) return;

      const updateLeafletMetrics = () => {
        setCurrentZoom(map.getZoom());
        const bounds = map.getBounds();
        setVisibleHeightMeters(calculateVerticalDistanceMeters(bounds.getNorth(), bounds.getSouth()));
      };

      updateLeafletMetrics();
      map.on('zoomend moveend', updateLeafletMetrics);

      return () => {
        map.off('zoomend moveend', updateLeafletMetrics);
      };
    }
  }, [mapProvider, googleMapReady, calculateVerticalDistanceMeters]);

  const selectedCount = selectedBillboards?.size || 0;

  const navigateToCoords = useCallback((lat: number, lng: number) => {
    if (mapProvider === 'google' && googleMapInstanceRef.current && window.google?.maps) {
      googleMapInstanceRef.current.setCenter({ lat, lng });
      googleMapInstanceRef.current.setZoom(16);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setView([lat, lng], 16);
    }
  }, [mapProvider]);

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
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-[2rem] border border-amber-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 ${className || ''}`}
      style={{ 
        height: isFullscreen ? '100vh' : (className?.includes('h-') ? undefined : '700px'), 
        background: '#0a0a1a' 
      }}
      dir="rtl"
    >
      {/* Golden Header */}
      <div className="absolute top-0 left-0 right-0 h-16 z-[1100] bg-slate-950/80 backdrop-blur-md border-b border-amber-500/20 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center backdrop-blur">
            <MapIcon className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-100" style={{ fontFamily: 'Tajawal, sans-serif' }}>اختيار اللوحات الإعلانية</h2>
            <p className="text-[10px] text-amber-500/90 font-bold" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {selectedCount > 0 ? `${selectedCount} لوحة محددة حالياً` : 'اضغط على اللوحة لتحديدها'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onSelectAll && (
            <Button size="sm" variant="secondary" onClick={onSelectAll} className="h-8 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow border-0">
              <CheckCircle className="h-3.5 w-3.5 ml-1" />
              تحديد الكل
            </Button>
          )}
          {onClearAll && selectedCount > 0 && (
            <Button size="sm" variant="secondary" onClick={onClearAll} className="h-8 text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border-0">
              <X className="h-3.5 w-3.5 ml-1" />
              إلغاء الكل
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Row - Fits perfectly in the 44px gap (from top-16 to top-[108px]) */}
      {!hideInternalFilters && (
      <div className="absolute top-[64px] left-0 right-0 z-[1050] bg-slate-950/90 backdrop-blur-md border-b border-amber-500/20 px-4 py-1.5 flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-amber-500/75" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="ابحث بالاسم، الرقم، المنطقة..."
            className="w-full h-7 pr-8 pl-6 text-[10px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-200 placeholder:text-slate-400/50 rounded-lg focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-right"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950/95 backdrop-blur-xl border border-amber-500/20 rounded-xl shadow-2xl z-[2000] max-h-48 overflow-y-auto custom-scrollbar">
              {searchSuggestions.map((s, i) => (
                <button
                  key={`${s.type}-${i}`}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-500/10 text-right transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (s.coords) {
                      navigateToCoords(s.coords.lat, s.coords.lng);
                    } else {
                      setSearchQuery(s.value);
                    }
                    setShowSuggestions(false);
                  }}
                >
                  <span className="text-[9px] text-slate-200 font-bold">{s.label}</span>
                  <span className="text-[8px] text-amber-500/70">{getTypeLabel(s.type)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rental Status Filter */}
        <div className="w-[100px] flex-shrink-0">
          <Select value={filterRentalStatus} onValueChange={setFilterRentalStatus}>
            <SelectTrigger className="h-7 text-[10px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg">
              <SelectValue placeholder="حالة التأجير" />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border-amber-500/20 text-slate-300 text-[10px]">
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="available">متاح فقط</SelectItem>
              <SelectItem value="upcoming">محجوز قريباً</SelectItem>
              <SelectItem value="rented">مؤجر</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selection Filter */}
        <div className="w-[90px] flex-shrink-0">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 text-[10px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg">
              <SelectValue placeholder="التحديد" />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border-amber-500/20 text-slate-300 text-[10px]">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="selected">المحددة</SelectItem>
              <SelectItem value="unselected">غير المحددة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* City Filter */}
        <div className="w-[100px] flex-shrink-0">
          <MultiSelect
            options={cities.map(c => ({ label: c, value: c }))}
            value={filterCity}
            onChange={setFilterCity}
            placeholder="المدن"
            className="h-7 text-[9px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg"
          />
        </div>

        {/* Size Filter */}
        <div className="w-[100px] flex-shrink-0">
          <MultiSelect
            options={sizes.map(s => ({ label: s, value: s }))}
            value={filterSize}
            onChange={setFilterSize}
            placeholder="المقاسات"
            className="h-7 text-[9px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg"
          />
        </div>
      </div>
      )}

      {/* Zoom Metrics */}
      <div className={cn(
        "absolute left-4 z-[1000] rounded-xl border border-amber-500/25 bg-slate-950/80 backdrop-blur px-3 py-1.5 shadow-lg flex flex-col gap-0.5",
        hideInternalFilters ? "top-[76px]" : "top-[125px]"
      )}>
        <div className="text-[10px] text-slate-400 font-extrabold" style={{ fontFamily: 'Tajawal, sans-serif' }}>مستوى التقريب: <span className="text-slate-100 font-bold">{currentZoom}</span></div>
        <div className="text-[10px] text-slate-400 font-extrabold" style={{ fontFamily: 'Tajawal, sans-serif' }}>الارتفاع المرئي: <span className="text-slate-100 font-bold">{formatDistance(visibleHeightMeters)}</span></div>
      </div>

      {/* Control Buttons */}
      <div className={cn(
        "absolute left-4 z-[1000] flex flex-col gap-1.5",
        hideInternalFilters ? "top-[136px]" : "top-[185px]"
      )}>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomIn}
          className="w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border border-amber-500/20 hover:border-amber-500/60 text-slate-300 hover:text-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all shadow-lg active:scale-90 backdrop-blur-md rounded-xl"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomOut}
          className="w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border border-amber-500/20 hover:border-amber-500/60 text-slate-300 hover:text-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all shadow-lg active:scale-90 backdrop-blur-md rounded-xl"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={toggleFullscreen}
          className="w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border border-amber-500/20 hover:border-amber-500/60 text-slate-300 hover:text-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all shadow-lg active:scale-90 backdrop-blur-md rounded-xl"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setShowLayers(!showLayers)}
          className={`w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border transition-all shadow-lg rounded-xl ${showLayers ? 'border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'border-amber-500/20 text-slate-300'}`}
        >
          <Layers className="h-5 w-5" />
        </Button>
      </div>

      {/* Layer Selector */}
      {showLayers && (
        <div className="absolute left-4 top-[360px] z-[1000] bg-slate-950/90 backdrop-blur rounded-2xl border border-amber-500/20 p-2.5 shadow-xl min-w-[140px] flex flex-col gap-1">
          <Button
            size="sm"
            variant={mapType === 'roadmap' ? 'default' : 'ghost'}
            onClick={() => setMapType('roadmap')}
            className={`h-8 text-xs justify-start rounded-xl ${mapType === 'roadmap' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            <MapIcon className="h-4 w-4 ml-2" />
            خريطة عادية
          </Button>
          <Button
            size="sm"
            variant={mapType === 'satellite' ? 'default' : 'ghost'}
            onClick={() => setMapType('satellite')}
            className={`h-8 text-xs justify-start rounded-xl ${mapType === 'satellite' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            <Globe className="h-4 w-4 ml-2" />
            قمر صناعي
          </Button>
          
          <div className="border-t border-white/5 mt-1 pt-1">
            <Button
              size="sm"
              variant={showLabels ? 'default' : 'ghost'}
              onClick={() => setShowLabels(!showLabels)}
              className={`h-8 text-xs justify-start w-full rounded-xl ${showLabels ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              <Tag className="h-4 w-4 ml-2" />
              {showLabels ? 'مسميات ✓' : 'بدون مسميات'}
            </Button>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="absolute inset-0 pt-[108px]">
        {/* Google Map */}
        <div 
          ref={googleMapRef}
          className={`absolute inset-0 ${mapProvider === 'google' ? 'block' : 'hidden'}`}
        />
        
        {/* Leaflet Map */}
        <div 
          ref={leafletMapRef}
          className={`absolute inset-0 ${mapProvider === 'openstreetmap' ? 'block' : 'hidden'}`}
        />
      </div>

      {/* Bottom Stats */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-slate-950/85 backdrop-blur-md rounded-2xl border border-amber-500/20 p-3.5 shadow-2xl">
        <div className="flex justify-around text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          <div>
            <div className="font-extrabold text-amber-500 text-lg">{selectedCount}</div>
            <div className="text-slate-400 text-[10px] font-bold">لوحة محددة</div>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div>
            <div className="font-extrabold text-emerald-400 text-lg">{filteredBillboards.length}</div>
            <div className="text-slate-400 text-[10px] font-bold">لوحة معروضة</div>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div>
            <div className="font-extrabold text-blue-400 text-lg">{billboards.length}</div>
            <div className="text-slate-400 text-[10px] font-bold">إجمالي اللوحات</div>
          </div>
        </div>
      </div>

      {/* Leaflet Popup Styles + Google Maps Popup Styles to remove white border */}
      <style>{`
        .leaflet-popup-dark .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-dark .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-dark .leaflet-popup-tip {
          background: rgba(26,26,46,0.98) !important;
          border: 1px solid rgba(212,175,55,0.3) !important;
        }
        .custom-cluster-icon {
          background: transparent !important;
        }
        .marker-label {
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          font-family: 'Tajawal', sans-serif !important;
        }
        /* Remove white border from Google Maps InfoWindow */
        .gm-style .gm-style-iw-c {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 12px !important;
          overflow: visible !important;
        }
        .gm-style .gm-style-iw-d {
          overflow: visible !important;
          padding: 0 !important;
        }
        .gm-style .gm-style-iw-tc {
          display: none !important;
        }
        .gm-style .gm-style-iw-t::after {
          background: rgba(26,26,46,0.98) !important;
          box-shadow: none !important;
        }
        .gm-style-iw button.gm-ui-hover-effect {
          top: 4px !important;
          right: 4px !important;
          background: rgba(0,0,0,0.6) !important;
          border-radius: 50% !important;
          width: 28px !important;
          height: 28px !important;
        }
        .gm-style-iw button.gm-ui-hover-effect span {
          background-color: #fff !important;
        }
      `}</style>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxImage} 
            alt="تكبير الصورة" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
