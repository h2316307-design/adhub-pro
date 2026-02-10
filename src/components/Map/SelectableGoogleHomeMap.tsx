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

  // ✅ Enhanced pin creation - color indicates status, shows Ad Type on top and customer below
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false) => {
    const status = getBillboardStatus(billboard);
    const size = (billboard as any).Size || '';
    const adType = (billboard as any).Ad_Type || '';
    const customerName = (billboard as any).Customer_Name || '';
    const isRented = status.label === 'مؤجرة' || status.label === 'محجوزة';
    const isAvailable = status.label === 'متاحة';
    
    const sizeColors = getSizeColor(size);
    
    // ✅ Pin color based on status: green=available, red=rented, orange=reserved
    let pinColor = status.color;
    let centerColor = '#1a1a2e'; // default dark center
    
    if (isSelected) {
      pinColor = '#fbbf24'; // golden for selected
      centerColor = '#fbbf24';
    } else if (status.label === 'مؤجرة') {
      pinColor = '#ef4444'; // red
      centerColor = '#dc2626'; // darker red for center
    } else if (status.label === 'محجوزة') {
      pinColor = '#f59e0b'; // orange
      centerColor = '#d97706'; // darker orange for center
    } else if (isAvailable) {
      pinColor = '#22c55e'; // green
      centerColor = '#16a34a'; // darker green for center
    }
    
    const pinSize = isSelected ? 52 : 44;
    const topLabelHeight = 24; // Ad Type label
    const customerHeight = customerName && isRented ? 26 : 0;
    const width = 200;
    const totalHeight = topLabelHeight + pinSize + 50 + customerHeight;
    const cx = width / 2;
    const pinTop = topLabelHeight;
    const headR = pinSize / 2.2;
    const uniqueId = `pin-${(billboard as any).ID || Math.random()}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);

    // ✅ Show Ad Type on top (or Size if no Ad Type)
    const topLabel = adType || size;
    const shortTopLabel = topLabel.length > 18 ? topLabel.substring(0, 17) + '..' : topLabel;
    const shortCustomer = customerName ? (customerName.length > 18 ? customerName.substring(0, 17) + '..' : customerName) : '';

    const adjustColor = (hex: string, amount: number): string => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
      <defs>
        <linearGradient id="body${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${adjustColor(pinColor, 40)}"/>
          <stop offset="50%" stop-color="${pinColor}"/>
          <stop offset="100%" stop-color="${adjustColor(pinColor, -50)}"/>
        </linearGradient>
        <filter id="shadow${uniqueId}" x="-50%" y="-30%" width="200%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
        <filter id="textShadow${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.8)"/>
        </filter>
        <radialGradient id="centerGlow${uniqueId}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${adjustColor(centerColor, 60)}"/>
          <stop offset="60%" stop-color="${centerColor}"/>
          <stop offset="100%" stop-color="${adjustColor(centerColor, -30)}"/>
        </radialGradient>
        <linearGradient id="shine${uniqueId}" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.7)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      
      <!-- ✅ TOP LABEL: Ad Type (or Size) with status-colored background -->
      <g filter="url(#textShadow${uniqueId})">
        <rect x="${cx - 80}" y="2" width="160" height="20" rx="10" fill="${pinColor}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
        <text x="${cx}" y="16" text-anchor="middle" font-family="Tajawal, Arial, sans-serif" font-size="11" font-weight="bold" fill="#fff">${shortTopLabel}</text>
      </g>
      
      <!-- Ground shadow -->
      <ellipse cx="${cx}" cy="${totalHeight - customerHeight - 6}" rx="${pinSize * 0.28}" ry="5" fill="rgba(0,0,0,0.3)"/>
      
      ${isAvailable && !isSelected ? `
      <!-- Pulse rings for available - green glow -->
      <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR + 6}" fill="none" stroke="${pinColor}" stroke-width="2" opacity="0.5">
        <animate attributeName="r" values="${headR + 3};${headR + 16}" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      ` : ''}
      
      ${isSelected ? `
      <!-- Selection pulse rings - golden -->
      <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR + 12}" fill="none" stroke="#fbbf24" stroke-width="3" opacity="0.7">
        <animate attributeName="r" values="${headR + 8};${headR + 25}" dur="1.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;0" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      ` : ''}
      
      <!-- ✅ MAIN PIN - Color shows status: green=available, red=rented, orange=reserved -->
      <g filter="url(#shadow${uniqueId})">
        <path d="M${cx},${totalHeight - customerHeight - 8} 
                 C${cx - 5},${totalHeight - customerHeight - 20} ${cx - headR - 5},${pinTop + headR + 20} ${cx - headR - 5},${pinTop + headR + 8}
                 A${headR + 5},${headR + 5} 0 1,1 ${cx + headR + 5},${pinTop + headR + 8}
                 C${cx + headR + 5},${pinTop + headR + 20} ${cx + 5},${totalHeight - customerHeight - 20} ${cx},${totalHeight - customerHeight - 8}Z"
              fill="url(#body${uniqueId})" 
              stroke="${isSelected ? '#fff' : 'rgba(255,255,255,0.6)'}" 
              stroke-width="${isSelected ? 3.5 : 2}"/>
        
        <!-- Shine effect -->
        <ellipse cx="${cx - headR * 0.35}" cy="${pinTop + headR * 0.6 + 8}" rx="${headR * 0.45}" ry="${headR * 0.35}" 
                 fill="url(#shine${uniqueId})" opacity="0.8"/>
        
        <!-- ✅ CENTER CIRCLE - Color changes based on status -->
        <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR * 0.75}" fill="${adjustColor(centerColor, -20)}" opacity="0.4"/>
        <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR * 0.6}" fill="url(#centerGlow${uniqueId})"/>
        <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR * 0.22}" fill="rgba(255,255,255,0.95)"/>
      </g>
      
      <!-- ✅ CUSTOMER NAME at bottom for rented billboards -->
      ${shortCustomer && isRented ? `
      <g filter="url(#textShadow${uniqueId})">
        <rect x="${cx - 85}" y="${totalHeight - 24}" width="170" height="22" rx="11" fill="rgba(15,15,35,0.95)" stroke="${pinColor}" stroke-width="2.5"/>
        <text x="${cx}" y="${totalHeight - 9}" text-anchor="middle" font-family="Tajawal, Arial, sans-serif" font-size="12" font-weight="800" fill="#fbbf24">${shortCustomer}</text>
      </g>
      ` : ''}
      
      ${isSelected ? `
      <!-- Selection indicator with rotation -->
      <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR + 10}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="6,4" opacity="0.9">
        <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${pinTop + headR + 8}" to="360 ${cx} ${pinTop + headR + 8}" dur="5s" repeatCount="indefinite"/>
      </circle>
      <!-- Golden checkmark badge -->
      <g>
        <circle cx="${cx + headR + 2}" cy="${pinTop + 2}" r="11" fill="#fbbf24">
          <animate attributeName="r" values="11;13;11" dur="0.8s" repeatCount="indefinite"/>
        </circle>
        <path d="M${cx + headR - 2} ${pinTop + 2} l4 4 l6 -6" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      ` : ''}
    </svg>`;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      width,
      height: totalHeight,
      anchorX: cx,
      anchorY: totalHeight - customerHeight - 8
    };
  }, []);

  // ✅ Create popup with EXACT same design as GoogleHomeMap - Horizontal layout
  const createSelectablePopupContent = useCallback((billboard: Billboard, isSelected: boolean) => {
    const status = getBillboardStatus(billboard);
    const sizeColor = getSizeColor((billboard as any).Size || '');
    const statusColor = status.color;
    const statusBg = status.label === 'متاحة' ? 'rgba(34,197,94,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
    
    const name = (billboard as any).Billboard_Name || `لوحة ${(billboard as any).ID}`;
    const location = (billboard as any).Nearest_Landmark || '';
    const city = (billboard as any).City || '';
    const district = (billboard as any).District || '';
    const municipality = (billboard as any).Municipality || '';
    const size = (billboard as any).Size || '';
    const imageUrl = (billboard as any).Image_URL || '';
    const customerName = (billboard as any).Customer_Name || '';
    const adType = (billboard as any).Ad_Type || '';
    const billboardId = String((billboard as any).ID || billboard.ID);
    const isRented = status.label === 'مؤجرة' || status.label === 'محجوزة';
    const designFaceA = (billboard as any).design_face_a || '';
    const daysRemaining = getDaysRemaining((billboard as any).Rent_End_Date);

    // Get ad type color for card accent
    const getAdTypeColor = (type: string): { bg: string; border: string; text: string } => {
      const t = (type || '').toLowerCase();
      if (t.includes('تجاري') || t.includes('commercial')) return { bg: '#3b82f6', border: '#60a5fa', text: '#fff' };
      if (t.includes('سياسي') || t.includes('political')) return { bg: '#ef4444', border: '#f87171', text: '#fff' };
      if (t.includes('حكوم') || t.includes('government')) return { bg: '#22c55e', border: '#4ade80', text: '#fff' };
      if (t.includes('خيري') || t.includes('charity')) return { bg: '#8b5cf6', border: '#a78bfa', text: '#fff' };
      if (t.includes('رياض') || t.includes('sport')) return { bg: '#f97316', border: '#fb923c', text: '#fff' };
      if (t.includes('طب') || t.includes('medical')) return { bg: '#06b6d4', border: '#22d3ee', text: '#fff' };
      return { bg: '#d4af37', border: '#fbbf24', text: '#1a1a2e' };
    };
    
    const adTypeColor = getAdTypeColor(adType);
    const cardAccent = isRented && adType ? adTypeColor.bg : (isSelected ? '#fbbf24' : '#d4af37');
    
    // Helper to darken/lighten colors
    const adjustColor = (hex: string, amount: number): string => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };
    
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
    
    // ✅ EXACT same horizontal layout as GoogleHomeMap - Image takes full height
    return `
      <div class="map-popup-horizontal" style="
        font-family: 'Tajawal', 'Manrope', sans-serif; 
        direction: rtl; 
        width: 420px; 
        max-width: 95vw;
        background: linear-gradient(145deg, rgba(20,20,38,0.99), rgba(15,15,28,0.99));
        border-radius: 12px; 
        overflow: hidden; 
        border: 2px solid ${isSelected ? '#fbbf24' : cardAccent + '66'};
        box-shadow: 0 20px 50px -5px rgba(0,0,0,0.6), 0 0 20px ${cardAccent}22;
        display: flex;
        flex-direction: row;
      ">
        <!-- Left Side: LARGE Image spanning full height -->
        <div style="
          width: 180px;
          min-width: 180px;
          position: relative;
          display: flex;
          flex-direction: column;
          background: #0a0a14;
          cursor: pointer;
        " onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceA || imageUrl || '/roadside-billboard.png'}'}))">
          <!-- Full Height Billboard/Design Image -->
          <img src="${designFaceA || imageUrl || '/roadside-billboard.png'}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; min-height: 220px;" onerror="this.src='/roadside-billboard.png'" />
          
          <!-- Overlay gradient -->
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.7) 100%);"></div>
          
          <!-- Size badge -->
          <div style="position: absolute; top: 6px; right: 6px; background: ${sizeColor.bg}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: ${sizeColor.text}; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">${size}</div>
          
          <!-- Status badge -->
          <div style="position: absolute; bottom: 8px; right: 8px; background: ${statusBg}; backdrop-filter: blur(4px); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; color: ${statusColor}; display: flex; align-items: center; gap: 4px; border: 1px solid ${statusColor}44;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>
            ${status.label}
          </div>
          
          <!-- Zoom icon hint -->
          <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.6); padding: 4px; border-radius: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35M11 8v6m-3-3h6"/></svg>
          </div>
          
          ${isSelected ? `
          <!-- Selection badge on image -->
          <div style="position: absolute; top: 6px; left: 6px; background: #fbbf24; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; color: #1a1a2e; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            محددة
          </div>
          ` : ''}
        </div>
        
        <!-- Right Side: Content -->
        <div style="flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 240px;">
          <!-- Billboard Name -->
          <h3 style="font-weight: 800; font-size: 15px; color: #fff; margin: 0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${name}
          </h3>
          
          <!-- Customer & Ad Type Row -->
          ${isRented && (customerName || adType) ? `
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${customerName ? `
                <div style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; background: rgba(239,68,68,0.12); border-radius: 6px; border: 1px solid rgba(239,68,68,0.25);">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span style="font-size: 10px; color: #fca5a5; font-weight: 700;">${customerName}</span>
                </div>
              ` : ''}
              ${adType ? `
                <div style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; background: ${adTypeColor.bg}22; border-radius: 6px; border: 1px solid ${adTypeColor.bg}44;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${adTypeColor.bg}" stroke-width="2.5"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                  <span style="font-size: 10px; color: ${adTypeColor.border}; font-weight: 700;">${adType}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          <!-- Location -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 22px; height: 22px; background: linear-gradient(135deg, ${cardAccent}, ${adjustColor(cardAccent, -30)}); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <p style="color: #a0a0a0; font-size: 10px; margin: 0; flex: 1; line-height: 1.3;">${location || city || 'موقع غير محدد'}</p>
            
            ${status.label !== 'متاحة' && daysRemaining !== null && daysRemaining > 0 ? `
              <div style="display: flex; align-items: center; gap: 4px; padding: 3px 6px; background: rgba(245,158,11,0.12); border-radius: 6px; border: 1px solid rgba(245,158,11,0.25); flex-shrink: 0;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>
                <span style="font-weight: 700; color: #fbbf24; font-size: 9px;">${daysRemaining} يوم</span>
              </div>
            ` : ''}
          </div>
          
          <!-- Tags -->
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${district ? `<span style="background: rgba(245,158,11,0.12); color: #fbbf24; padding: 2px 6px; border-radius: 5px; font-size: 9px; font-weight: 700;">${district}</span>` : ''}
            ${municipality ? `<span style="background: rgba(212,175,55,0.12); color: #d4af37; padding: 2px 6px; border-radius: 5px; font-size: 9px; font-weight: 700;">${municipality}</span>` : ''}
          </div>
          
          <!-- ✅ Price with duration label -->
          <div style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(34,197,94,0.1); border-radius: 8px; border: 1px solid rgba(34,197,94,0.2);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12m-4-4h8"/></svg>
            <div style="flex: 1;">
              <span style="font-size: 9px; color: #888;">${priceLabel}</span>
              <p style="margin: 0; color: #22c55e; font-weight: 800; font-size: 14px;">${displayPrice} د.ل</p>
            </div>
          </div>
          
          <!-- Action buttons row -->
          <div style="display: flex; gap: 6px; margin-top: auto;">
            <!-- Navigate button -->
            ${hasValidCoords ? `
              <a href="${googleMapsUrl}" target="_blank" style="
                display: inline-flex; align-items: center; justify-content: center; gap: 4px;
                padding: 6px 12px;
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                border-radius: 8px; color: #fff; font-size: 10px; font-weight: 700;
                text-decoration: none; box-shadow: 0 2px 8px rgba(59,130,246,0.3);
                flex-shrink: 0;
              ">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                توجيه
              </a>
            ` : ''}
            
            <!-- Selection button -->
            <button 
              onclick="window.dispatchEvent(new CustomEvent('toggleBillboard', {detail: '${billboardId}'}))"
              style="flex: 1; padding: 8px 12px; background: ${isSelected ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'}; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 11px; font-family: 'Tajawal', sans-serif; box-shadow: 0 2px 8px ${isSelected ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}; display: flex; align-items: center; justify-content: center; gap: 4px;"
            >
              ${isSelected ? `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                إلغاء التحديد
              ` : `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                تحديد اللوحة
              `}
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
          styles: mapType === 'roadmap' ? [
            { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
          ] : []
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
        maxWidth: 320
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

    if (hasMarkers && bounds.isValid()) {
      leafletMapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    }
  }, [filteredBillboards, mapProvider, selectedBillboards, createPinWithLabel, createSelectablePopupContent]);

  // Update Google Maps markers - Selected markers excluded from cluster
  useEffect(() => {
    if (mapProvider !== 'google') return;
    
    // ✅ Wait for map to be ready using state flag
    if (!googleMapReady || !googleMapInstanceRef.current) {
      console.log('[SelectableGoogleHomeMap] Map not ready yet, waiting...');
      return;
    }
    
    console.log('[SelectableGoogleHomeMap] Updating markers, filtered count:', filteredBillboards.length);

    // Clear existing markers
    googleMarkersRef.current.forEach(m => m.setMap(null));
    googleMarkersRef.current = [];
    googleSelectedMarkersRef.current.forEach(m => m.setMap(null));
    googleSelectedMarkersRef.current = [];
    if (googleClustererRef.current) {
      googleClustererRef.current.clearMarkers();
    }
    if (googleInfoWindowRef.current) {
      googleInfoWindowRef.current.close();
    }

    const map = googleMapInstanceRef.current;
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
        icon: {
          url: pinData.url,
          scaledSize: new google.maps.Size(pinData.width, pinData.height),
          anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY)
        },
        zIndex: isSelected ? 2000 : 1,
        optimized: false
      });

      marker.addListener('click', () => {
        if (googleInfoWindowRef.current) {
          googleInfoWindowRef.current.close();
        }
        googleInfoWindowRef.current = new google.maps.InfoWindow({
          content: createSelectablePopupContent(b, isSelected)
        });
        googleInfoWindowRef.current.open(map, marker);
      });

      bounds.extend(coords);
      hasMarkers = true;

      if (isSelected) {
        selectedMarkers.push(marker);
      } else {
        unselectedMarkers.push(marker);
      }
    });

    console.log('[SelectableGoogleHomeMap] Created markers - unselected:', unselectedMarkers.length, 'selected:', selectedMarkers.length);

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

    // Add selected markers directly to map (not clustered)
    selectedMarkers.forEach(marker => {
      marker.setMap(map);
    });
    googleSelectedMarkersRef.current = selectedMarkers;

    // Fit bounds if we have markers
    if (hasMarkers && !bounds.isEmpty()) {
      // Small delay to ensure map is ready
      setTimeout(() => {
        if (googleMapInstanceRef.current) {
          googleMapInstanceRef.current.fitBounds(bounds, { top: 80, bottom: 80, left: 40, right: 40 });
          
          // Limit max zoom
          const listener = google.maps.event.addListenerOnce(googleMapInstanceRef.current, 'idle', () => {
            const zoom = googleMapInstanceRef.current?.getZoom();
            if (zoom && zoom > 15) {
              googleMapInstanceRef.current?.setZoom(15);
            }
          });
        }
      }, 100);
    }
  }, [filteredBillboards, mapProvider, selectedBillboards, createPinWithLabel, createSelectablePopupContent, googleMapReady]);

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
