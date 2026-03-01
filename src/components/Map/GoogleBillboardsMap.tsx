/// <reference types="@types/google.maps" />
import { useEffect, useRef } from 'react';
import type { Billboard } from '@/types';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';

interface GoogleBillboardsMapProps {
  billboards: Billboard[];
}

function parseCoords(b: Billboard): { lat: number; lng: number } | null {
  const coords = (b as any).GPS_Coordinates || (b as any).coordinates;
  if (!coords) return null;
  
  if (typeof coords === 'string') {
    const parts = coords.split(',').map((c: string) => parseFloat(c.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
  } else if (typeof coords === 'object' && typeof (coords as any).lat === 'number' && typeof (coords as any).lng === 'number') {
    return { lat: (coords as any).lat, lng: (coords as any).lng };
  }
  return null;
}

export default function GoogleBillboardsMap({ billboards }: GoogleBillboardsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.google) return;

      // Initialize map
      const center = { lat: 32.8872, lng: 13.1913 };
      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 11,
        mapTypeId: 'roadmap',
      });

      mapInstanceRef.current = map;

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Add markers
      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;

      billboards.forEach((b) => {
        const coords = parseCoords(b);
        if (!coords) return;

        const marker = new google.maps.Marker({
          position: coords,
          map,
          title: b.Billboard_Name || b.name || 'لوحة إعلانية',
        });

        const price = (b.Price || 0).toLocaleString('ar-LY');
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family: 'Doran', sans-serif; text-align: right; direction: rtl; padding: 8px;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold;">${b.Billboard_Name || b.name || 'لوحة إعلانية'}</h3>
              <p style="margin: 4px 0;">${b.City || b.location || ''}</p>
              <p style="margin: 4px 0; font-weight: bold; color: #2563eb;">${price} د.ل/شهر</p>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        markersRef.current.push(marker);
        bounds.extend(coords);
        hasMarkers = true;
      });

      // Fit bounds if we have markers
      if (hasMarkers) {
        map.fitBounds(bounds);
      }
    };

    // Load Google Maps using Keyless API
    if (window.google && window.google.maps) {
      initMap();
    } else {
      loadGoogleMapsKeyless()
        .then(() => {
          const checkInterval = setInterval(() => {
            if (window.google && window.google.maps) {
              clearInterval(checkInterval);
              initMap();
            }
          }, 100);
          
          // Timeout after 10 seconds
          setTimeout(() => clearInterval(checkInterval), 10000);
        })
        .catch((error) => {
          console.error('Failed to load Google Maps:', error);
        });
    }
  }, [billboards]);

  return <div ref={mapRef} className="w-full h-96 rounded-lg border" />;
}
