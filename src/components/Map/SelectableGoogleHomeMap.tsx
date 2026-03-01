/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map as MapIcon, Globe, Maximize2, Minimize2, ZoomIn, ZoomOut, Layers, CheckCircle, X, Search } from 'lucide-react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Billboard } from '@/types';
import type { MapProvider } from '@/types/map';
import { OSM_TILE_LAYERS } from '@/types/map';
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
  const leafletSelectedMarkersRef = useRef<L.Marker[]>([]);
  
  // Container ref for fullscreen
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State - Google is the default provider
  const [mapProvider, setMapProvider] = useState<MapProvider>('google');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'styled' | 'detailed'>('satellite');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRentalStatus, setFilterRentalStatus] = useState<string>('all');
  const [allSizes, setAllSizes] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [googleMapReady, setGoogleMapReady] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Listen for image lightbox events
  useEffect(() => {
    const handleShowImage = (e: CustomEvent) => {
      setLightboxImage(e.detail);
    };
    window.addEventListener('showBillboardImage' as any, handleShowImage);
    return () => window.removeEventListener('showBillboardImage' as any, handleShowImage);
  }, []);
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

  // ✅ Search suggestions based on input
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions: { type: string; value: string; label: string }[] = [];
    
    // Billboard names
    billboards.forEach(b => {
      const name = (b as any).Billboard_Name || '';
      if (name.toLowerCase().includes(query) && suggestions.length < 5) {
        suggestions.push({ type: 'billboard', value: name, label: `🎯 ${name}` });
      }
    });
    
    // Customer names
    customerNames.forEach(name => {
      if (name.toLowerCase().includes(query) && suggestions.length < 8) {
        suggestions.push({ type: 'customer', value: name, label: `👤 ${name}` });
      }
    });
    
    // Cities
    cities.forEach(city => {
      if (city.toLowerCase().includes(query) && suggestions.length < 10) {
        suggestions.push({ type: 'city', value: city, label: `📍 ${city}` });
      }
    });
    
    // Ad types
    adTypes.forEach(adType => {
      if (adType.toLowerCase().includes(query) && suggestions.length < 12) {
        suggestions.push({ type: 'adType', value: adType, label: `📺 ${adType}` });
      }
    });
    
    return suggestions.slice(0, 8);
  }, [searchQuery, billboards, customerNames, cities, adTypes]);

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
      const status = getBillboardStatus(b);
      
      // ✅ Enhanced search - includes customer name and ad type
      const matchesSearch = searchQuery === '' || 
        name.includes(searchQuery.toLowerCase()) ||
        landmark.includes(searchQuery.toLowerCase()) ||
        city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerName.includes(searchQuery.toLowerCase()) ||
        adType.includes(searchQuery.toLowerCase()) ||
        billboardId.includes(searchQuery);
      
      const matchesCity = filterCity === 'all' || city === filterCity;
      const matchesSize = filterSize === 'all' || size === filterSize;
      
      const isSelected = selectedBillboards?.has(billboardId);
      const matchesSelection = filterStatus === 'all' || 
        (filterStatus === 'selected' ? isSelected : !isSelected);
      
      // ✅ New rental status filter
      const matchesRentalStatus = filterRentalStatus === 'all' ||
        (filterRentalStatus === 'available' && status.label === 'متاحة') ||
        (filterRentalStatus === 'rented' && (status.label === 'مؤجرة' || status.label === 'محجوزة'));
      
      return matchesSearch && matchesCity && matchesSize && matchesSelection && matchesRentalStatus && parseCoords(b) !== null;
    });
  }, [billboards, searchQuery, filterCity, filterSize, filterStatus, selectedBillboards]);

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

  const handleToggleProvider = useCallback(() => {
    setMapProvider(prev => prev === 'google' ? 'openstreetmap' : 'google');
  }, []);

  // ✅ Medium pin with size label INSIDE the pin head
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false) => {
    const status = getBillboardStatus(billboard);
    const size = (billboard as any).Size || '';
    const isHidden = (billboard as any).is_visible_in_available === false;
    const isAvailable = status.label === 'متاحة';
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
    
    // ✅ Ultra-compact popup card
    return `
      <div style="
        font-family: 'Tajawal', sans-serif; direction: rtl; width: 220px; max-width: 80vw;
        background: linear-gradient(145deg, rgba(26,26,46,0.97), rgba(18,18,32,0.97));
        border-radius: 10px; overflow: hidden; 
        border: 1px solid ${isSelected ? '#fbbf24' : 'rgba(212,175,55,0.25)'};
        box-shadow: 0 8px 24px -4px rgba(0,0,0,0.5);
      ">
        <!-- Image -->
        <div style="position: relative; height: 80px; overflow: hidden; cursor: pointer;"
             onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceA || imageUrl || '/roadside-billboard.png'}'}))">
          <img src="${designFaceA || imageUrl || '/roadside-billboard.png'}" alt="${name}" 
               style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/roadside-billboard.png'" />
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, rgba(26,26,46,0.85) 100%);"></div>
          <div style="position: absolute; top: 4px; right: 4px; background: ${sizeColor.bg}; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; color: ${sizeColor.text};">${size}</div>
          <div style="position: absolute; top: 4px; left: 4px; background: ${statusBg}; padding: 1px 6px; border-radius: 6px; font-size: 9px; font-weight: 700; color: ${statusColor}; display: flex; align-items: center; gap: 3px;">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: ${statusColor};"></span>${status.label}
          </div>
          ${isSelected ? `<div style="position: absolute; bottom: 4px; left: 4px; background: #fbbf24; padding: 1px 6px; border-radius: 5px; font-size: 9px; font-weight: 800; color: #1a1a2e;">✓ محددة</div>` : ''}
        </div>
        
        <div style="padding: 8px;">
          <h3 style="font-weight: 700; font-size: 12px; color: #fff; margin: 0 0 5px 0; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</h3>
          
          <p style="color: #999; font-size: 10px; margin: 0 0 5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📍 ${location || city || 'موقع غير محدد'}</p>
          
          ${status.label !== 'متاحة' && daysRemaining !== null && daysRemaining > 0 ? `
            <div style="background: rgba(245,158,11,0.1); padding: 3px 6px; border-radius: 5px; margin-bottom: 5px; font-size: 10px; font-weight: 600; color: #f59e0b; border: 1px solid rgba(245,158,11,0.2);">⏱ متبقي ${daysRemaining} يوم</div>
          ` : ''}
          
          <!-- Price -->
          <div style="display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: rgba(34,197,94,0.08); border-radius: 5px; margin-bottom: 6px; border: 1px solid rgba(34,197,94,0.15);">
            <div style="flex: 1;">
              <span style="font-size: 8px; color: #777;">${priceLabel}</span>
              <p style="margin: 0; color: #22c55e; font-weight: 800; font-size: 12px;">${displayPrice} د.ل</p>
            </div>
          </div>
          
          <!-- Buttons -->
          <div style="display: flex; gap: 4px;">
            ${hasValidCoords ? `
              <a href="${googleMapsUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; padding: 5px 8px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 6px; color: #fff; font-size: 10px; font-weight: 600; text-decoration: none;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </a>
            ` : ''}
            <button onclick="window.dispatchEvent(new CustomEvent('toggleBillboard', {detail: '${billboardId}'}))"
              style="flex: 1; padding: 5px 8px; background: ${isSelected ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'}; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 10px; font-family: 'Tajawal', sans-serif;">
              ${isSelected ? '✕ إلغاء' : '✓ تحديد'}
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
          mapTypeId: mapType === 'satellite' ? 'hybrid' : 'roadmap',
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
  }, [mapProvider, mapType]);

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

  // Update Leaflet markers - Selected markers excluded from cluster
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletClusterRef.current) return;

    // ✅ Track filter changes for Leaflet too
    const leafletFilterKey = `leaflet-${filteredBillboards.length}-${searchQuery}-${filterCity}-${filterSize}-${filterStatus}`;
    const isLeafletFilterChange = leafletFilterKey !== prevFilterKeyRef.current;

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
        maxWidth: 280
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
    const filterKey = `${filteredBillboards.length}-${searchQuery}-${filterCity}-${filterSize}-${filterStatus}-${filterRentalStatus}`;
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
      googleMapInstanceRef.current.setMapTypeId(mapType === 'satellite' ? 'hybrid' : 'roadmap');
    }
  }, [mapType, mapProvider]);

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
      <div className="absolute top-[60px] left-0 right-0 z-[1050] bg-slate-900/95 backdrop-blur border-b border-amber-500/20 px-4 py-2 flex flex-wrap items-center gap-2">
        {/* ✅ Enhanced Search with Suggestions */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
          <Input
            ref={searchInputRef}
            placeholder="بحث بالاسم، المدينة، الزبون..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="h-9 pr-9 bg-slate-800/90 border-slate-600 text-white placeholder:text-slate-400 text-sm rounded-lg focus:ring-2 focus:ring-amber-500/50"
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          {/* ✅ Search Suggestions Dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full right-0 left-0 mt-1 bg-slate-800/98 backdrop-blur-sm border border-slate-600 rounded-lg shadow-xl overflow-hidden z-[1200] max-h-[280px] overflow-y-auto">
              {searchSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion.type}-${suggestion.value}-${idx}`}
                  onClick={() => {
                    setSearchQuery(suggestion.value);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-4 py-2.5 text-right text-sm text-white hover:bg-amber-500/20 transition-colors flex items-center gap-2 border-b border-slate-700/50 last:border-0"
                >
                  <span className="text-lg">{suggestion.label.split(' ')[0]}</span>
                  <span className="flex-1 truncate">{suggestion.value}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                    {suggestion.type === 'billboard' ? 'لوحة' : 
                     suggestion.type === 'customer' ? 'زبون' : 
                     suggestion.type === 'city' ? 'مدينة' : 'إعلان'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* ✅ Rental Status Filter */}
        <Select value={filterRentalStatus} onValueChange={setFilterRentalStatus}>
          <SelectTrigger className="h-9 w-32 bg-slate-800/90 border-slate-600 text-white text-xs rounded-lg">
            <SelectValue placeholder="حالة التأجير" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="available">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                متاحة فقط
              </span>
            </SelectItem>
            <SelectItem value="rented">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                مؤجرة/محجوزة
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="h-9 w-28 bg-slate-800/90 border-slate-600 text-white text-xs rounded-lg">
            <SelectValue placeholder="المدينة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المدن</SelectItem>
            {cities.map(city => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterSize} onValueChange={setFilterSize}>
          <SelectTrigger className="h-9 w-28 bg-slate-800/90 border-slate-600 text-white text-xs rounded-lg">
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
          <SelectTrigger className="h-9 w-28 bg-slate-800/90 border-slate-600 text-white text-xs rounded-lg">
            <SelectValue placeholder="التحديد" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="selected">المحددة ✓</SelectItem>
            <SelectItem value="unselected">غير المحددة</SelectItem>
          </SelectContent>
        </Select>
        
        {/* ✅ Stats with color indicators */}
        <div className="flex items-center gap-3 mr-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>متاحة</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span>محجوزة</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>مؤجرة</span>
          </div>
          <span className="text-xs text-slate-400 border-r border-slate-600 pr-3 mr-1">|</span>
          <span className="text-xs text-slate-400">المعروض: <span className="text-amber-400 font-bold">{filteredBillboards.length}</span></span>
          {selectedCount > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg font-bold border border-amber-500/30">
              ✓ {selectedCount} محددة
            </span>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute left-4 top-[130px] z-[1000] flex flex-col gap-2">
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
        <div className="absolute left-4 top-[290px] z-[1000] bg-slate-900/95 backdrop-blur rounded-lg border border-amber-500/30 p-2 shadow-xl">
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
