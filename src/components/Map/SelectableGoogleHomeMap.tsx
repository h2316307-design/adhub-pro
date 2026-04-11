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
import type { MapProvider } from '@/types/map';
import { OSM_TILE_LAYERS } from '@/types/map';
import { parseCoords } from '@/utils/parseCoords';
import { getBillboardStatus, getSizeColor, getDaysRemaining } from '@/hooks/useMapMarkers';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';

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
  calculateBillboardPrice
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
      
      // ✅ New rental status filter
      const matchesRentalStatus = filterRentalStatus === 'all' ||
        (filterRentalStatus === 'available' && status.label === 'متاحة') ||
        (filterRentalStatus === 'rented' && (status.label === 'مؤجرة' || status.label === 'محجوزة'));
      
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

  // ✅ 3D Teardrop pin with badge - matches main management map
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false) => {
    const status = getBillboardStatus(billboard);
    const size = (billboard as any).Size || '';
    const adType = (billboard as any).Ad_Type || '';
    const contractNumber = (billboard as any).Contract_Number || 0;
    const isHidden = (billboard as any).is_visible_in_available === false;
    const isAvailable = status.label === 'متاحة' || status.label === 'متاح';
    const isSoon = status.label === 'محجوزة';
    const statusColor = isHidden ? '#6b7280' : (isAvailable ? '#00ff6a' : isSoon ? '#f59e0b' : '#ef4444');
    
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
    const shortAdType = adType.length > 20 ? adType.substring(0, 18) + '..' : adType;
    const badgeText = hasContract ? `${contractNumber}` : '';
    const adBadgeText = shortAdType || '';
    const hasBadge = !!(badgeText || adBadgeText);

    const estimateTextWidth = (text: string, sz: number) => text.length * sz * 0.7 + 12;
    const adTextWidth = adBadgeText ? estimateTextWidth(adBadgeText, 9) : 0;
    const contractTextWidth = badgeText ? estimateTextWidth(`#${contractNumber}`, 9) : 0;
    const dynamicBadgeW = Math.max(48, Math.min(120, Math.max(adTextWidth, contractTextWidth) + 16));

    const pinSize = isSelected ? 44 : 32;
    const badgeHeight = hasBadge ? (hasContract && adBadgeText ? 28 : 22) : 0;
    const w = Math.max(pinSize + 32, dynamicBadgeW + 8);
    const cx = w / 2;

    const pinTopOffset = badgeHeight;
    const pinH = pinSize + 12;
    const pinW = pinSize;
    const headCY = pinTopOffset + pinH * 0.38;
    const pinTipY = pinTopOffset + pinH - 4;
    const h = pinTipY + 3;
    const uniqueId = `pin-${(billboard as any).ID || Math.random()}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
    const shortSize = size.length > 6 ? size.substring(0, 5) + '..' : size;
    const fontSize = isSelected ? 10 : 9;

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
      
      <ellipse cx="${cx}" cy="${pinTipY + 1}" rx="${pinW * 0.12}" ry="1.2" fill="rgba(0,0,0,0.3)"/>
      
      ${isAvailable ? `
      <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.45}" fill="none" stroke="${statusColor}" stroke-width="1.5" opacity="0.4">
        <animate attributeName="r" values="${pinW * 0.4};${pinW * 0.75}" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      ` : ''}
      
      <g filter="url(#s${uniqueId})">
        <path d="M${cx},${pinTipY}
                 C${cx - 1.5},${pinTopOffset + pinH - 12} ${cx - pinW / 2},${pinTopOffset + pinH * 0.55} ${cx - pinW / 2},${headCY}
                 A${pinW / 2},${pinW / 2} 0 1,1 ${cx + pinW / 2},${headCY}
                 C${cx + pinW / 2},${pinTopOffset + pinH * 0.55} ${cx + 1.5},${pinTopOffset + pinH - 12} ${cx},${pinTipY}Z"
              fill="url(#b${uniqueId})" 
              stroke="${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.4)'}" 
              stroke-width="${isSelected ? 2.5 : 1}"/>
        <path d="M${cx},${pinTipY}
                 C${cx - 1.5},${pinTopOffset + pinH - 12} ${cx - pinW / 2},${pinTopOffset + pinH * 0.55} ${cx - pinW / 2},${headCY}
                 A${pinW / 2},${pinW / 2} 0 1,1 ${cx + pinW / 2},${headCY}
                 C${cx + pinW / 2},${pinTopOffset + pinH * 0.55} ${cx + 1.5},${pinTopOffset + pinH - 12} ${cx},${pinTipY}Z"
              fill="url(#h${uniqueId})" opacity="0.6"/>
        <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.3}" fill="rgba(10,10,25,0.5)"/>
        <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.23}" fill="url(#g${uniqueId})"/>
        <ellipse cx="${cx - pinW * 0.05}" cy="${headCY - pinW * 0.06}" rx="${pinW * 0.1}" ry="${pinW * 0.07}" fill="rgba(255,255,255,0.5)" transform="rotate(-15 ${cx} ${headCY})"/>
        <circle cx="${cx}" cy="${headCY}" r="${pinW * 0.07}" fill="rgba(255,255,255,0.9)"/>
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

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border-2 border-amber-500/30 ${className || ''}`}
      style={{ height: isFullscreen ? '100vh' : '700px', background: '#1a1a2e' }}
      dir="rtl"
    >
      {/* Golden Header */}
      <div className="absolute top-0 left-0 right-0 z-[1100] bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur">
            <MapIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">اختيار اللوحات</h2>
            <p className="text-xs text-amber-100">
              {selectedCount > 0 ? `${selectedCount} لوحة محددة` : 'اضغط على اللوحة لتحديدها'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onSelectAll && (
            <Button size="sm" variant="secondary" onClick={onSelectAll} className="h-8 text-xs bg-white/20 hover:bg-white/30 text-white border-0">
              <CheckCircle className="h-3.5 w-3.5 ml-1" />
              تحديد الكل
            </Button>
          )}
          {onClearAll && selectedCount > 0 && (
            <Button size="sm" variant="secondary" onClick={onClearAll} className="h-8 text-xs bg-white/20 hover:bg-white/30 text-white border-0">
              <X className="h-3.5 w-3.5 ml-1" />
              إلغاء الكل
            </Button>
          )}
          
          <Button
            size="sm"
            variant="secondary"
            onClick={handleToggleProvider}
            className="h-8 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
          >
            {mapProvider === 'google' ? <Globe className="h-3.5 w-3.5 ml-1" /> : <MapIcon className="h-3.5 w-3.5 ml-1" />}
            {mapProvider === 'google' ? 'OSM' : 'قوقل'}
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="absolute top-[60px] left-0 right-0 z-[1050] bg-background/95 backdrop-blur-md border-b border-border px-3 py-2 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
          <Input
            ref={searchInputRef}
            placeholder="بحث بالاسم، المعلم، المنطقة، الإحداثيات..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="h-8 pr-8 pl-7 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground text-xs rounded-lg focus:ring-2 focus:ring-primary/40"
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          
          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full right-0 left-0 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-[1200] max-h-[260px] overflow-y-auto">
              {searchSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion.type}-${suggestion.value}-${idx}`}
                  onClick={() => {
                    // ✅ If coords suggestion, navigate map to that location
                    if (suggestion.type === 'coords' && suggestion.coords) {
                      const { lat, lng } = suggestion.coords;
                      if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
                        leafletMapInstanceRef.current.setView([lat, lng], 16, { animate: true });
                      } else if (mapProvider === 'google' && googleMapInstanceRef.current) {
                        googleMapInstanceRef.current.setCenter({ lat, lng });
                        googleMapInstanceRef.current.setZoom(16);
                      }
                      setSearchQuery('');
                    } else {
                      setSearchQuery(suggestion.value);
                    }
                    setShowSuggestions(false);
                  }}
                  className="w-full px-3 py-2 text-right text-xs text-popover-foreground hover:bg-accent transition-colors flex items-center gap-2 border-b border-border/30 last:border-0"
                >
                  <span className="text-sm">{suggestion.label.split(' ')[0]}</span>
                  <span className="flex-1 truncate">{suggestion.value}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {suggestion.type === 'billboard' ? 'لوحة' : 
                     suggestion.type === 'customer' ? 'زبون' : 
                     suggestion.type === 'city' ? 'مدينة' :
                     suggestion.type === 'landmark' ? 'معلم' :
                     suggestion.type === 'district' ? 'حي' :
                     suggestion.type === 'municipality' ? 'بلدية' :
                     suggestion.type === 'coords' ? 'إحداثيات' : 'إعلان'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Rental Status Pills */}
        <div className="flex items-center gap-1">
          {[
            { value: 'all', label: 'الكل', color: 'bg-muted-foreground' },
            { value: 'available', label: 'متاحة', color: 'bg-emerald-500' },
            { value: 'rented', label: 'مؤجرة', color: 'bg-destructive' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setFilterRentalStatus(s.value)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                filterRentalStatus === s.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
              {s.label}
            </button>
          ))}
        </div>
        
        {/* City Multi-Select */}
        <MultiSelect
          options={cities.map(c => ({ label: c, value: c }))}
          value={filterCity}
          onChange={setFilterCity}
          placeholder="المدن"
          className="h-8 w-[130px] text-[11px]"
          emptyText="لا توجد مدن"
          icon={<Building2 className="h-3 w-3" />}
        />
        
        {/* Size Multi-Select */}
        <MultiSelect
          options={sizes.map(s => ({ label: s, value: s }))}
          value={filterSize}
          onChange={setFilterSize}
          placeholder="المقاسات"
          className="h-8 w-[130px] text-[11px]"
          emptyText="لا توجد مقاسات"
          icon={<Ruler className="h-3 w-3" />}
        />
        
        {/* Selection Filter */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[100px] bg-muted/50 border-border text-foreground text-[11px] rounded-lg">
            <SelectValue placeholder="التحديد" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="selected">المحددة ✓</SelectItem>
            <SelectItem value="unselected">غير المحددة</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Stats */}
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-[11px] text-muted-foreground">
            المعروض: <span className="text-primary font-bold">{filteredBillboards.length}</span>
          </span>
          {selectedCount > 0 && (
            <span className="text-[11px] bg-primary/15 text-primary px-2 py-0.5 rounded-md font-bold border border-primary/30">
              ✓ {selectedCount} محددة
            </span>
          )}
          {(filterCity.length > 0 || filterSize.length > 0 || filterRentalStatus !== 'all') && (
            <button
              onClick={() => { setFilterCity([]); setFilterSize([]); setFilterRentalStatus('all'); setFilterStatus('all'); setSearchQuery(''); }}
              className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Zoom Metrics */}
      <div className="absolute left-4 top-[115px] z-[1000] rounded-lg border border-border bg-background/90 backdrop-blur px-3 py-2 shadow-md">
        <div className="text-[11px] text-muted-foreground">مستوى الزوم: <span className="font-bold text-foreground">{currentZoom}</span></div>
        <div className="text-[11px] text-muted-foreground">الارتفاع المرئي: <span className="font-bold text-foreground">{formatDistance(visibleHeightMeters)}</span></div>
      </div>

      {/* Control Buttons */}
      <div className="absolute left-4 top-[170px] z-[1000] flex flex-col gap-1.5">
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomIn}
          className="w-9 h-9 bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 text-white shadow-lg"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomOut}
          className="w-9 h-9 bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 text-white shadow-lg"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={toggleFullscreen}
          className="w-9 h-9 bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 text-white shadow-lg"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setShowLayers(!showLayers)}
          className={`w-9 h-9 bg-slate-900/90 hover:bg-slate-800 border shadow-lg ${showLayers ? 'border-amber-500 text-amber-400' : 'border-amber-500/30 text-white'}`}
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      {/* Layer Selector */}
      {showLayers && (
        <div className="absolute left-4 top-[300px] z-[1000] bg-slate-900/95 backdrop-blur rounded-lg border border-amber-500/30 p-2 shadow-xl min-w-[140px]">
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant={mapType === 'roadmap' ? 'default' : 'ghost'}
              onClick={() => setMapType('roadmap')}
              className={`h-8 text-xs justify-start ${mapType === 'roadmap' ? 'bg-amber-500 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <MapIcon className="h-3.5 w-3.5 ml-2" />
              خريطة
            </Button>
            <Button
              size="sm"
              variant={mapType === 'satellite' ? 'default' : 'ghost'}
              onClick={() => setMapType('satellite')}
              className={`h-8 text-xs justify-start ${mapType === 'satellite' ? 'bg-amber-500 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <Globe className="h-3.5 w-3.5 ml-2" />
              قمر صناعي
            </Button>
            
            {/* Labels Toggle */}
            <div className="border-t border-amber-500/20 mt-1 pt-1">
              <Button
                size="sm"
                variant={showLabels ? 'default' : 'ghost'}
                onClick={() => setShowLabels(!showLabels)}
                className={`h-8 text-xs justify-start w-full ${showLabels ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                <Tag className="h-3.5 w-3.5 ml-2" />
                {showLabels ? 'مسميات ✓' : 'بدون مسميات'}
              </Button>
            </div>
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
      <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-slate-900/95 backdrop-blur rounded-lg border border-amber-500/30 p-3 shadow-xl">
        <div className="flex justify-around text-sm">
          <div className="text-center">
            <div className="font-bold text-amber-400 text-lg">{selectedCount}</div>
            <div className="text-slate-400 text-xs">لوحة محددة</div>
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="text-center">
            <div className="font-bold text-green-400 text-lg">{filteredBillboards.length}</div>
            <div className="text-slate-400 text-xs">لوحة معروضة</div>
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="text-center">
            <div className="font-bold text-blue-400 text-lg">{billboards.length}</div>
            <div className="text-slate-400 text-xs">إجمالي اللوحات</div>
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
