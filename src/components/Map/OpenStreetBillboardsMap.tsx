import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type { Billboard } from "@/types";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Layers, Locate, Map as MapIcon, ChevronDown, ChevronUp, X } from "lucide-react";

// Add critical CSS for popup z-index
const popupStyles = `
  .leaflet-popup {
    z-index: 10000 !important;
  }
  .leaflet-popup-pane {
    z-index: 10000 !important;
  }
  .leaflet-popup-content-wrapper {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    border-radius: 12px !important;
    overflow: hidden;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    padding: 0 !important;
  }
  .leaflet-popup-tip-container {
    display: none !important;
  }
  .custom-marker-icon {
    z-index: 500 !important;
  }
  .custom-cluster-icon {
    z-index: 400 !important;
  }
  .leaflet-marker-pane {
    z-index: 600 !important;
  }
`;

// Inject styles once
if (typeof document !== 'undefined') {
  const styleId = 'openstreet-popup-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = popupStyles;
    document.head.appendChild(style);
  }
}

interface OpenStreetBillboardsMapProps {
  billboards: Billboard[];
  className?: string;
  onReady?: () => void;
  onImageView?: (imageUrl: string) => void;
  selectedBillboards?: Set<string>;
  onToggleSelection?: (billboardId: string) => void;
  onSelectMultiple?: (billboardIds: string[]) => void;
}

type MapStyle = "standard" | "satellite" | "hybrid";

// Color palette matching Google Maps InteractiveMap
const colorPalette = [
  { bg: "#ef4444", border: "#fca5a5", text: "#fff", name: "أحمر" },
  { bg: "#f97316", border: "#fdba74", text: "#fff", name: "برتقالي" },
  { bg: "#eab308", border: "#fde047", text: "#000", name: "أصفر" },
  { bg: "#22c55e", border: "#86efac", text: "#fff", name: "أخضر" },
  { bg: "#06b6d4", border: "#67e8f9", text: "#fff", name: "سماوي" },
  { bg: "#3b82f6", border: "#93c5fd", text: "#fff", name: "أزرق" },
  { bg: "#8b5cf6", border: "#c4b5fd", text: "#fff", name: "بنفسجي" },
  { bg: "#ec4899", border: "#f9a8d4", text: "#fff", name: "وردي" },
  { bg: "#14b8a6", border: "#5eead4", text: "#fff", name: "تركوازي" },
  { bg: "#f43f5e", border: "#fda4af", text: "#fff", name: "قرمزي" },
];

const sizeColorMap: Record<string, { bg: string; border: string; text: string }> = {};

const getSizeColor = (size: string): { bg: string; border: string; text: string } => {
  if (!sizeColorMap[size]) {
    let hash = 0;
    for (let i = 0; i < size.length; i++) {
      hash = size.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorPalette.length;
    sizeColorMap[size] = colorPalette[index];
  }
  return sizeColorMap[size];
};

// Helper function to calculate days remaining
const getDaysRemaining = (expiryDate: string | null): number | null => {
  if (!expiryDate) return null;

  let parsedDate: Date | null = null;

  if (expiryDate.includes("-") && expiryDate.length === 10 && expiryDate.indexOf("-") === 4) {
    const parts = expiryDate.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        parsedDate = new Date(year, month, day);
      }
    }
  }

  if (!parsedDate) {
    const parts = expiryDate.split(/[/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
        parsedDate = new Date(year, month, day);
      }
    }
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = parsedDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Format date for display
const formatExpiryDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  let parsedDate: Date | null = null;
  if (dateStr.includes("-") && dateStr.length === 10 && dateStr.indexOf("-") === 4) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        parsedDate = new Date(year, month, day);
      }
    }
  }
  if (!parsedDate) {
    const parts = dateStr.split(/[/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
        parsedDate = new Date(year, month, day);
      }
    }
  }
  if (!parsedDate || isNaN(parsedDate.getTime())) return dateStr;
  return parsedDate.toLocaleDateString("ar-LY", { year: "numeric", month: "short", day: "numeric" });
};

// Simplified high-performance pin SVG - cached by size
const pinCache = new Map<string, string>();

const createPinSvg = (size: string, status: string, isSelected: boolean = false): string => {
  const cacheKey = `${size}-${status}-${isSelected}`;
  if (pinCache.has(cacheKey)) return pinCache.get(cacheKey)!;
  
  const colors = getSizeColor(size);
  const statusColor = status === "متاح" ? "#10b981" : status === "قريباً" ? "#f59e0b" : "#ef4444";
  const displaySize = size.length > 6 ? size.substring(0, 5) + ".." : size;
  const selectedStroke = isSelected ? '#d4af37' : colors.border;
  const strokeWidth = isSelected ? 3 : 2;
  
  // تصميم محسّن مع checkbox أكبر وأوضح فوق الـ pin
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="90" viewBox="0 0 56 90">
      <defs>
        <filter id="shadow-${cacheKey}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.4"/>
        </filter>
      </defs>
      <g filter="url(#shadow-${cacheKey})">
        <!-- Checkbox container - أكبر وأوضح -->
        <rect x="14" y="2" width="28" height="24" rx="6" 
              fill="${isSelected ? '#d4af37' : '#ffffff'}" 
              stroke="${isSelected ? '#1a1a2e' : '#888888'}" 
              stroke-width="2.5"/>
        ${isSelected ? `
          <!-- Checkmark -->
          <path d="M21 14 l5 5 l10 -10" fill="none" stroke="#1a1a2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ` : `
          <!-- Empty checkbox hint -->
          <rect x="22" y="10" width="12" height="8" rx="2" fill="#e0e0e0" opacity="0.5"/>
        `}
        <!-- Pin shadow -->
        <ellipse cx="28" cy="86" rx="12" ry="3" fill="rgba(0,0,0,0.35)"/>
        <!-- Pin body -->
        <path d="M28 28C15.954 28 7 36.954 7 48c0 14 21 38 21 38s21-24 21-38C49 36.954 40.046 28 28 28z"
              fill="${colors.bg}" stroke="${selectedStroke}" stroke-width="${strokeWidth}"/>
        <!-- Inner circle with glow effect -->
        <circle cx="28" cy="48" r="15" fill="#1a1a2e" stroke="${selectedStroke}" stroke-width="1.5"/>
        <!-- Status dot with pulse effect for available -->
        <circle cx="28" cy="48" r="6" fill="${statusColor}"/>
        ${status === "متاح" ? `<circle cx="28" cy="48" r="8" fill="none" stroke="${statusColor}" stroke-width="1" opacity="0.5"/>` : ''}
        <!-- Size label background - أكبر -->
        <rect x="4" y="68" width="48" height="18" rx="5" fill="#1a1a2e" stroke="${selectedStroke}" stroke-width="1"/>
        <!-- Size text -->
        <text x="28" y="80" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="${colors.bg}">${displaySize}</text>
      </g>
    </svg>
  `;
  
  pinCache.set(cacheKey, svg);
  return svg;
};

// Simplified cluster icon - cached
const clusterCache = new Map<number, string>();

const createClusterSvg = (count: number): string => {
  if (clusterCache.has(count)) return clusterCache.get(count)!;
  
  const displayCount = count > 99 ? "99+" : String(count);
  const fontSize = count > 99 ? 11 : count > 9 ? 13 : 15;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="23" fill="#d4af37" stroke="#1a1a2e" stroke-width="3"/>
      <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
      <text x="25" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#d4af37">${displayCount}</text>
    </svg>
  `;
  
  clusterCache.set(count, svg);
  return svg;
};

function parseCoords(b: Billboard): { lat: number; lng: number } | null {
  const coords = (b as any).GPS_Coordinates || (b as any).coordinates;
  if (!coords) return null;

  if (typeof coords === "string") {
    const parts = coords.split(",").map((c: string) => parseFloat(c.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
  } else if (typeof coords === "object") {
    const lat = (coords as any).lat ?? (coords as any).latitude;
    const lng = (coords as any).lng ?? (coords as any).longitude;
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return null;
}

// Create compact popup content with clean UI
const createPopupContent = (b: Billboard): string => {
  const status = String((b as any).Status || (b as any).status || "متاح").trim();
  const size = String((b as any).Size || "");
  const sizeColor = getSizeColor(size);
  const name = (b as any).Billboard_Name || (b as any).name || "لوحة";
  const location = (b as any).Nearest_Landmark || (b as any).location || "";
  const city = (b as any).City || "";
  const district = (b as any).District || "";
  const customerName = (b as any).Customer_Name || (b as any).customer_name || "";
  const adType = (b as any).Ad_Type || (b as any).ad_type || "";
  const imageUrl = (b as any).Image_URL || (b as any).imageUrl || "";
  const expiryDate = (b as any).Rent_End_Date || (b as any).expiryDate || null;
  const gpsCoords = (b as any).GPS_Coordinates || "";
  const isRented = status === "مؤجر" || status === "محجوز" || status.toLowerCase() === "rented";
  const daysRemaining = getDaysRemaining(expiryDate);
  
  const statusBg = status === "متاح" ? "#10b981" : status === "قريباً" ? "#f59e0b" : "#ef4444";

  return `
    <div style="font-family: 'Tajawal',system-ui,sans-serif; direction: rtl; width: 240px; background: #1a1a2e; border-radius: 12px; overflow: hidden;">
      
      <!-- Header with image - clickable to zoom -->
      <div style="position: relative; height: 100px; background: #252542; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('openstreet-image-zoom', { detail: '${imageUrl || "/roadside-billboard.png"}' }))">
        <img src="${imageUrl || "/roadside-billboard.png"}"
             alt="${name}"
             style="width: 100%; height: 100%; object-fit: contain; background: #252542;"
             onerror="this.style.display='none'" />
        
        <!-- Zoom hint -->
        <div style="position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
        </div>
        
        <!-- Status badge -->
        <div style="position: absolute; top: 6px; left: 6px; background: ${statusBg}; padding: 3px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
          <span style="width: 5px; height: 5px; border-radius: 50%; background: white;"></span>
          <span style="color: white; font-size: 10px; font-weight: 600;">${status}</span>
        </div>
        
        <!-- Size badge -->
        <div style="position: absolute; top: 6px; right: 6px; background: ${sizeColor.bg}; padding: 3px 10px; border-radius: 12px;">
          <span style="color: ${sizeColor.text}; font-size: 10px; font-weight: 700;">${size}</span>
        </div>
      </div>

      <!-- Content -->
      <div style="padding: 10px;">
        <!-- Title -->
        <h3 style="font-size: 12px; font-weight: 700; color: #fff; margin: 0 0 8px 0; line-height: 1.3;">${name}</h3>

        <!-- Info rows -->
        <div style="display: flex; flex-direction: column; gap: 5px;">
          
          ${isRented && customerName ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(239,68,68,0.12); border-radius: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style="font-size: 10px; color: #ef4444; font-weight: 600;">${customerName}</span>
            </div>
          ` : ""}

          ${isRented && adType ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(139,92,246,0.12); border-radius: 6px;">
              <span style="font-size: 10px;">📢</span>
              <span style="font-size: 10px; color: #8b5cf6; font-weight: 600;">${adType}</span>
            </div>
          ` : ""}

          ${location ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(212,175,55,0.08); border-radius: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style="font-size: 9px; color: #888;">${location}</span>
            </div>
          ` : ""}

          ${status !== "متاح" && daysRemaining !== null && daysRemaining > 0 ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(245,158,11,0.12); border-radius: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span style="font-size: 10px; color: #f59e0b; font-weight: 700;">متبقي ${daysRemaining} يوم</span>
            </div>
          ` : ""}
        </div>

        <!-- Tags -->
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0;">
          ${district ? `<span style="background: rgba(245,158,11,0.12); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">${district}</span>` : ""}
          ${city ? `<span style="background: rgba(59,130,246,0.12); color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">${city}</span>` : ""}
        </div>

        <!-- Action button -->
        ${gpsCoords ? `
          <a href="https://www.google.com/maps?q=${gpsCoords}" target="_blank" rel="noopener noreferrer"
             style="display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px; border-radius: 8px; background: linear-gradient(135deg, #d4af37, #b8860b); color: #1a1a2e; text-decoration: none; font-weight: 600; font-size: 10px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            فتح في خرائط جوجل
          </a>
        ` : ""}

        <!--SELECTION_SLOT-->
      </div>
    </div>
  `;
};

export default function OpenStreetBillboardsMap({ billboards, className, onReady, onImageView, selectedBillboards, onToggleSelection, onSelectMultiple }: OpenStreetBillboardsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const floatingLabelsRef = useRef<L.Marker[]>([]);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("hybrid");
  const [showLegend, setShowLegend] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  // Track if initial fit was done to prevent refitting on selection changes
  const initialFitDoneRef = useRef(false);
  const prevPointsLengthRef = useRef(0);
  
  // Ref to store current selection for use in event handlers
  const selectedBillboardsRef = useRef<Set<string>>(new Set());
  
  // Keep the ref in sync with the prop
  useEffect(() => {
    selectedBillboardsRef.current = selectedBillboards || new Set();
  }, [selectedBillboards]);

  // Listen for image zoom events from popup
  useEffect(() => {
    const handleImageZoom = (e: CustomEvent) => {
      if (onImageView) {
        onImageView(e.detail);
      } else {
        setZoomedImage(e.detail);
      }
    };
    window.addEventListener("openstreet-image-zoom", handleImageZoom as EventListener);
    return () => window.removeEventListener("openstreet-image-zoom", handleImageZoom as EventListener);
  }, [onImageView]);

  // Listen for selection toggle events from popup
  useEffect(() => {
    const handleToggleSelection = (e: CustomEvent) => {
      if (onToggleSelection) {
        onToggleSelection(e.detail);
      }
    };
    window.addEventListener("osm-toggle-selection", handleToggleSelection as EventListener);
    return () => window.removeEventListener("osm-toggle-selection", handleToggleSelection as EventListener);
  }, [onToggleSelection]);

  const points = useMemo(
    () =>
      billboards
        .map((b) => {
          const coords = parseCoords(b);
          if (!coords) return null;
          return { b, coords };
        })
        .filter(Boolean) as Array<{ b: Billboard; coords: { lat: number; lng: number } }>,
    [billboards]
  );

  // Get unique sizes for legend
  const uniqueSizes = useMemo(() => {
    const sizes = new Set<string>();
    billboards.forEach((b) => {
      const size = String((b as any).Size || "");
      if (size) sizes.add(size);
    });
    return Array.from(sizes).map((size) => ({ size, color: getSizeColor(size) }));
  }, [billboards]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 120,
      });

      const syncFloatingLabelsWithZoom = () => {
        const zoom = map.getZoom();
        // Make sure labels appear only when user is zoomed in enough to effectively uncluster markers
        const shouldShow = zoom >= 14;

        floatingLabelsRef.current.forEach((label) => {
          const isOnMap = map.hasLayer(label);
          if (shouldShow && !isOnMap) label.addTo(map);
          if (!shouldShow && isOnMap) map.removeLayer(label);
        });
      };

      map.on("zoomend", syncFloatingLabelsWithZoom);
      map.on("moveend", syncFloatingLabelsWithZoom);

      mapRef.current = map;
    }

    return () => {
      // Cleanup handled in separate effect
    };
  }, []);

  // Handle tile layer based on style
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // Add new tile layers based on style
    if (mapStyle === "satellite") {
      // Satellite only
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
      }).addTo(map);
    } else if (mapStyle === "hybrid") {
      // Satellite + Labels overlay
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
      }).addTo(map);
      // Add labels overlay
      L.tileLayer("https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        opacity: 0.7,
      }).addTo(map);
    } else {
      // Standard map
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
    }
  }, [mapStyle]);

  // Handle markers - only rebuild when points change, not on selection changes
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Remove old cluster
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    // Remove old selected markers layer
    if (selectedMarkersLayerRef.current) {
      map.removeLayer(selectedMarkersLayerRef.current);
    }

    // Remove old floating labels
    floatingLabelsRef.current.forEach((label) => map.removeLayer(label));
    floatingLabelsRef.current = [];
    
    // Clear markers map
    markersMapRef.current.clear();

    // Create layer for selected markers (not clustered)
    const selectedMarkersLayer = L.layerGroup().addTo(map);
    selectedMarkersLayerRef.current = selectedMarkersLayer;

    // Create cluster with custom icons - optimized
    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 25,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 15,
      maxClusterRadius: 60,
      animate: false, // Disable animations for performance
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (clusterObj: any) => {
        const count = clusterObj.getChildCount();
        return L.divIcon({
          html: createClusterSvg(count),
          className: "custom-cluster-icon",
          iconSize: [50, 50],
          iconAnchor: [25, 25],
        });
      },
    }) as L.MarkerClusterGroup;

    cluster.addTo(map);
    clusterRef.current = cluster;

    // Batch add markers for better performance
    const clusterMarkers: L.Marker[] = [];

    points.forEach(({ b, coords }) => {
      const billboardId = String((b as any).ID || (b as any).id || "");
      const status = String((b as any).Status || (b as any).status || "متاح").trim();
      const size = String((b as any).Size || "");
      const customerName = (b as any).Customer_Name || (b as any).customer_name || "";
      const adType = (b as any).Ad_Type || (b as any).ad_type || "";
      const isRented = status === "مؤجر" || status === "محجوز" || status.toLowerCase() === "rented";
      const isSelected = selectedBillboardsRef.current?.has(billboardId) || false;

      // Create icon with selection indicator (always visible like a checkbox)
      const createIcon = (selected: boolean) => {
        // استخدام SVG مع الـ checkbox المدمج
        const iconHtml = `
          <div style="position: relative; cursor: pointer;" title="انقر للتحديد">
            ${createPinSvg(size, status, selected)}
          </div>
        `;
        return L.divIcon({
          html: iconHtml,
          className: "custom-marker-icon" + (selected ? " selected" : ""),
          iconSize: [56, 90],
          iconAnchor: [28, 86],
          popupAnchor: [0, -80],
        });
      };

      const marker = L.marker([coords.lat, coords.lng], { icon: createIcon(isSelected) });
      
      // Store marker and its data for later updates
      (marker as any)._billboardId = billboardId;
      (marker as any)._size = size;
      (marker as any)._status = status;
      (marker as any)._createIcon = createIcon;
      markersMapRef.current.set(billboardId, marker);

      // Create popup with selection control
      const popupContent = createPopupContent(b);

      const selectionSlotHtml = `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button id="osm-select-btn-${billboardId}" type="button" style="
            width: 100%;
            padding: 8px 12px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            background: ${isSelected ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'}; color: white;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${isSelected ? '<path d="M18 6L6 18M6 6l12 12"/>' : '<polyline points="20,6 9,17 4,12"/>'}
            </svg>
            ${isSelected ? 'إلغاء التحديد' : 'تحديد اللوحة'}
          </button>
        </div>
      `;

      const popupWithSelection = onToggleSelection
        ? popupContent.replace("<!--SELECTION_SLOT-->", selectionSlotHtml)
        : popupContent.replace("<!--SELECTION_SLOT-->", "");

      // Pre-bind popup for reliable opening
      marker.bindPopup(popupWithSelection, {
        closeButton: true,
        className: "custom-popup",
        maxWidth: 280,
        minWidth: 240,
        autoPan: true,
        autoPanPadding: L.point(50, 50),
        offset: L.point(0, -10),
      });

      // Wire popup button click using DOM listener (more reliable than inline onclick)
      marker.on("popupopen", () => {
        if (!onToggleSelection) return;

        const popupEl = marker.getPopup()?.getElement();
        if (popupEl) {
          // Prevent popup interactions from being treated as map clicks/drags
          L.DomEvent.disableClickPropagation(popupEl);
          L.DomEvent.disableScrollPropagation(popupEl);
        }

        const btn = document.getElementById(`osm-select-btn-${billboardId}`) as HTMLButtonElement | null;
        if (!btn) return;

        btn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onToggleSelection(billboardId);
        };
      });

      // Click on pin: toggle selection (so it's usable directly from the map) and open popup
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onToggleSelection) onToggleSelection(billboardId);
        marker.openPopup();
      });

      // Add selected markers to separate layer (not clustered), others to cluster
      if (isSelected) {
        selectedMarkersLayer.addLayer(marker);
      } else {
        clusterMarkers.push(marker);
      }

      // Add floating label for rented billboards (display is controlled by zoom)
      if (isRented && (customerName || adType)) {
        const labelIcon = L.divIcon({
          html: `
            <div class="floating-label-content" style="
              background: rgba(26,26,46,0.95);
              padding: 4px 8px;
              border-radius: 6px;
              font-family: system-ui, sans-serif;
              direction: rtl;
              text-align: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              border: 1px solid rgba(212,175,55,0.5);
              white-space: nowrap;
            ">
              ${customerName ? `<div style="color: #d4af37; font-size: 9px; font-weight: 700;">${customerName.length > 12 ? customerName.substring(0, 11) + ".." : customerName}</div>` : ""}
              ${adType ? `<div style="color: #a0a0a0; font-size: 8px; margin-top: 2px;">${adType.length > 14 ? adType.substring(0, 13) + ".." : adType}</div>` : ""}
            </div>
          `,
          className: "floating-label-icon",
          iconSize: [100, 40],
          iconAnchor: [50, 80],
        });

        const labelMarker = L.marker([coords.lat, coords.lng], {
          icon: labelIcon,
          interactive: false,
          zIndexOffset: 500,
        });

        floatingLabelsRef.current.push(labelMarker);
      }
    });

    // Batch add non-selected markers to cluster
    cluster.addLayers(clusterMarkers);

    // Sync labels once after we rebuild them
    {
      const zoom = map.getZoom();
      const shouldShow = zoom >= 14;
      floatingLabelsRef.current.forEach((label) => {
        const isOnMap = map.hasLayer(label);
        if (shouldShow && !isOnMap) label.addTo(map);
        if (!shouldShow && isOnMap) map.removeLayer(label);
      });
    }

    // Only fit bounds on initial load or when points change (not on selection changes)
    const shouldFitBounds = !initialFitDoneRef.current || points.length !== prevPointsLengthRef.current;
    
    if (shouldFitBounds) {
      if (points.length) {
        const bounds = L.latLngBounds(points.map(({ coords }) => [coords.lat, coords.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], animate: false });
      } else {
        map.setView([32.8872, 13.1913], 8, { animate: false });
      }
      initialFitDoneRef.current = true;
      prevPointsLengthRef.current = points.length;
    }

    const t = window.setTimeout(() => onReady?.(), 50);
    return () => window.clearTimeout(t);
  }, [points, onReady]); // Rebuild only when points change

  // Update marker icons + move selected markers out of clusters
  useEffect(() => {
    if (!clusterRef.current || !selectedMarkersLayerRef.current) return;

    const cluster = clusterRef.current;
    const selectedLayer = selectedMarkersLayerRef.current;

    markersMapRef.current.forEach((marker, billboardId) => {
      const isSelected = selectedBillboards?.has(billboardId) || false;

      // Update icon
      const createIcon = (marker as any)._createIcon;
      if (createIcon) {
        marker.setIcon(createIcon(isSelected));
      }

      // Move layer: selected -> out of cluster, unselected -> into cluster
      const inSelectedLayer = (selectedLayer as any).hasLayer?.(marker);
      const inCluster = (cluster as any).hasLayer?.(marker);

      if (isSelected) {
        if (inCluster) (cluster as any).removeLayer(marker);
        if (!inSelectedLayer) selectedLayer.addLayer(marker);
      } else {
        if (inSelectedLayer) selectedLayer.removeLayer(marker);
        if (!inCluster) (cluster as any).addLayer(marker);
      }

      // Update popup button if open
      const popup = marker.getPopup();
      if (popup && popup.isOpen()) {
        const btn = document.getElementById(`osm-select-btn-${billboardId}`);
        if (btn) {
          btn.style.background = isSelected
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #22c55e, #16a34a)';
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${isSelected ? '<path d="M18 6L6 18M6 6l12 12"/>' : '<polyline points="20,6 9,17 4,12"/>'}
            </svg>
            ${isSelected ? 'إلغاء التحديد' : 'تحديد اللوحة'}
          `;
        }
      }
    });

    cluster.refreshClusters();
  }, [selectedBillboards]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleLocate = () => {
    if (points.length && mapRef.current) {
      const bounds = L.latLngBounds(points.map(({ coords }) => [coords.lat, coords.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const cycleMapStyle = () => {
    setMapStyle((s) => {
      if (s === "standard") return "satellite";
      if (s === "satellite") return "hybrid";
      return "standard";
    });
  };

  const getMapStyleLabel = () => {
    if (mapStyle === "standard") return "عادي";
    if (mapStyle === "satellite") return "قمر صناعي";
    return "هجين";
  };

  return (
    <div className={`relative ${className ?? "w-full h-[600px]"}`}>
      {/* Map container */}
      <div ref={containerRef} className="w-full h-full rounded-lg" />

      {/* Image Lightbox - Full screen overlay with highest z-index */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          style={{ zIndex: 99999 }}
          onClick={() => setZoomedImage(null)}
        >
          {/* Close button */}
          <button
            className="absolute top-6 right-6 z-10 h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all duration-200 border border-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
            }}
          >
            <X className="h-7 w-7" />
          </button>
          
          {/* Hint text */}
          <div className="absolute top-6 left-6 text-white/60 text-sm font-medium">
            اضغط في أي مكان للإغلاق
          </div>
          
          {/* Image container */}
          <div 
            className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImage}
              alt="Billboard"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/roadside-billboard.png";
              }}
            />
          </div>
        </div>
      )}

      {/* Custom controls matching Google Maps style */}
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2">
        {/* Zoom controls */}
        <div className="bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#d4af37]/30 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-10 w-10 rounded-none border-b border-[#d4af37]/20 hover:bg-[#d4af37]/10 text-[#d4af37]"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-10 w-10 rounded-none hover:bg-[#d4af37]/10 text-[#d4af37]"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Locate button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleLocate}
          className="h-10 w-10 bg-[#1a1a2e]/95 backdrop-blur-sm shadow-lg border-[#d4af37]/30 hover:bg-[#d4af37]/10 text-[#d4af37]"
        >
          <Locate className="h-5 w-5" />
        </Button>

        {/* Layer toggle with label */}
        <Button
          variant="outline"
          size="sm"
          onClick={cycleMapStyle}
          className="h-auto py-2 px-3 bg-[#1a1a2e]/95 backdrop-blur-sm shadow-lg border-[#d4af37]/30 hover:bg-[#d4af37]/10 text-[#d4af37] flex flex-col items-center gap-1"
        >
          <Layers className="h-5 w-5" />
          <span className="text-[10px]">{getMapStyleLabel()}</span>
        </Button>
      </div>

      {/* Legend / Color Map */}
      <div className="absolute top-4 right-4 z-[1000]">
        <div className="bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#d4af37]/30 overflow-hidden">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              <span className="text-xs font-bold">دليل الألوان</span>
            </div>
            {showLegend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showLegend && uniqueSizes.length > 0 && (
            <div className="px-3 py-2 border-t border-[#d4af37]/20 max-h-48 overflow-y-auto">
              <div className="space-y-1.5">
                {uniqueSizes.slice(0, 10).map(({ size, color }) => (
                  <div key={size} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                      style={{ backgroundColor: color.bg, borderColor: color.border }}
                    />
                    <span className="text-[10px] text-white/80 truncate">{size}</span>
                  </div>
                ))}
                {uniqueSizes.length > 10 && (
                  <div className="text-[10px] text-[#d4af37]/70 pt-1">
                    +{uniqueSizes.length - 10} أحجام أخرى
                  </div>
                )}
              </div>
              
              {/* Status legend */}
              <div className="mt-3 pt-2 border-t border-[#d4af37]/20 space-y-1.5">
                <div className="text-[10px] text-[#d4af37] font-bold mb-1">الحالة</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                  <span className="text-[10px] text-white/80">متاح</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <span className="text-[10px] text-white/80">قريباً</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="text-[10px] text-white/80">مؤجر</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats badge matching Google Maps */}
      <div className="absolute bottom-6 left-4 z-[1000]">
        <div className="bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-[#d4af37]/30">
          <span className="text-sm font-bold text-[#d4af37]">{points.length} لوحة</span>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        .custom-marker-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-cluster-icon {
          background: transparent !important;
          border: none !important;
        }
        .floating-label-icon {
          background: transparent !important;
          border: none !important;
          pointer-events: none !important;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border-radius: 16px;
          box-shadow: none;
          padding: 0;
          overflow: visible;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
          width: 300px !important;
        }
        .custom-popup .leaflet-popup-tip-container {
          display: none;
        }
        .custom-popup .leaflet-popup-close-button {
          color: #d4af37 !important;
          font-size: 24px;
          padding: 8px 12px;
          top: 6px !important;
          right: 6px !important;
          z-index: 10;
          background: rgba(26,26,46,0.8);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .custom-popup .leaflet-popup-close-button:hover {
          background: rgba(212,175,55,0.2);
        }
        .leaflet-container {
          font-family: system-ui, -apple-system, sans-serif;
          background: #1a1a2e;
        }
        .leaflet-tile-pane {
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
