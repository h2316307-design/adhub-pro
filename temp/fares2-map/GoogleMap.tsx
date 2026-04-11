// Google Maps Component - v2
import { useEffect, useRef, useState, useCallback, memo, forwardRef, useImperativeHandle } from 'react'
import { Billboard } from '@/types'
import { MapPosition } from '@/types/map'
import { 
  createPinSvgUrl, 
  createInfoWindowContent, 
  clusterIconUrl 
} from '@/hooks/useMapMarkers'

declare global {
  interface Window {
    google: any
    initMap: () => void
    MarkerClusterer: any
    markerClusterer: any
    __mapPreloaded?: boolean
    __mapLoading?: boolean
  }
}

interface GoogleMapProps {
  billboards: Billboard[]
  selectedBillboards?: Set<string>
  onToggleSelection?: (billboardId: string) => void
  onSelectMultiple?: (billboardIds: string[]) => void
  onImageView: (imageUrl: string) => void
  mapStyle: 'roadmap' | 'satellite' | 'hybrid'
  isDrawingMode: boolean
  drawingPoints: MapPosition[]
  onDrawingPointAdd: (point: MapPosition) => void
  onMapReady: () => void
  showNotification: (message: string, type: 'select' | 'deselect') => void
  targetLocation?: { lat: number; lng: number; zoom?: number; boundary?: { north: number; south: number; east: number; west: number } } | null
  onTargetLocationReached?: () => void
  userLocation?: { lat: number; lng: number } | null
  navigationRoute?: { lat: number; lng: number }[]
  navigationCurrentIndex?: number
  liveTrackingLocation?: { lat: number; lng: number } | null
  recordedRoute?: { lat: number; lng: number; timestamp: number }[]
  visitedBillboards?: Set<string>
}

export interface GoogleMapRef {
  zoomIn: () => void
  zoomOut: () => void
}

// Company marker position
const COMPANY_POSITION: MapPosition = { lat: 32.4847, lng: 14.5959 }
const LIBYA_CENTER: MapPosition = { lat: 32.7, lng: 13.2 }

// Store current open InfoWindow
let currentInfoWindow: any = null

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d4af37" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d4af37" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdb76b" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283046" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d4af37" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#1e3a2f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a5568" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d8c" }] },
]

const GoogleMapComponent = forwardRef<GoogleMapRef, GoogleMapProps>(({
  billboards,
  selectedBillboards,
  onToggleSelection,
  onSelectMultiple,
  onImageView,
  mapStyle,
  isDrawingMode,
  drawingPoints,
  onDrawingPointAdd,
  onMapReady,
  showNotification,
  targetLocation,
  onTargetLocationReached,
  userLocation,
  navigationRoute,
  navigationCurrentIndex,
  liveTrackingLocation,
  recordedRoute,
  visitedBillboards
}, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const clustererRef = useRef<any>(null)
  const drawingPolygonRef = useRef<any>(null)
  const boundaryRectRef = useRef<any>(null)
  const directionsRendererRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const liveMarkerRef = useRef<any>(null)
  const routeMarkersRef = useRef<any[]>([])
  const recordedRouteLineRef = useRef<any>(null)
  const recordedRouteGlowRef = useRef<any>(null)
  const recordedRouteAnimatedRef = useRef<any>(null)
  const routeAnimationFrameRef = useRef<number | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Expose zoom methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (mapRef.current) {
        mapRef.current.setZoom(mapRef.current.getZoom() + 1)
      }
    },
    zoomOut: () => {
      if (mapRef.current) {
        mapRef.current.setZoom(mapRef.current.getZoom() - 1)
      }
    }
  }), [])

  // Initialize map
  useEffect(() => {
    let isMounted = true
    
    const initializeMap = async () => {
      // Wait for Google Maps to be ready
      if (!window.google?.maps) {
        await new Promise<void>((resolve) => {
          if (window.google?.maps) {
            resolve()
            return
          }
          const check = setInterval(() => {
            if (window.google?.maps) {
              clearInterval(check)
              resolve()
            }
          }, 25)
          setTimeout(() => {
            clearInterval(check)
            resolve()
          }, 5000)
        })
      }

      if (!isMounted || !mapContainerRef.current || !window.google?.maps || mapRef.current) return

      const isMobile = window.innerWidth < 768
      
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: LIBYA_CENTER,
        zoom: isMobile ? 7 : 8,
        mapTypeId: 'satellite',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        scaleControl: false,
        rotateControl: false,
        panControl: false,
        keyboardShortcuts: false,
        gestureHandling: 'greedy',
        maxZoom: 19,
        minZoom: 5,
        clickableIcons: false,
        disableDoubleClickZoom: isMobile,
        tilt: 0,
        // Smoother animations
        scrollwheel: true,
        draggableCursor: 'grab',
        draggingCursor: 'grabbing',
      })

      mapRef.current = map
      // Store map reference globally for live tracking access
      ;(window as any).__googleMapInstance = map
      setIsReady(true)
      onMapReady()

      // Close InfoWindow when clicking on map
      map.addListener("click", (e: any) => {
        if (isDrawingMode) {
          onDrawingPointAdd({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        } else if (currentInfoWindow) {
          currentInfoWindow.close()
          currentInfoWindow = null
        }
      })

      // Company marker with actual logo
      const companyMarker = new window.google.maps.Marker({
        position: COMPANY_POSITION,
        map: map,
        icon: {
          url: '/logo-symbol.svg',
          scaledSize: new window.google.maps.Size(60, 60),
          anchor: new window.google.maps.Point(30, 30),
        },
        title: "مقر الفارس الذهبي",
        optimized: false,
        zIndex: 9999,
      })

      const companyInfoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="
            padding: 0; 
            font-family: 'Doran', 'Manrope', 'Tajawal', sans-serif; 
            direction: rtl; 
            min-width: 240px;
            background: linear-gradient(145deg, rgba(26,26,46,0.98), rgba(20,20,35,0.98));
            border-radius: 14px;
            border: 1px solid rgba(212,175,55,0.4);
            box-shadow: 0 15px 40px -5px rgba(0,0,0,0.6);
            overflow: hidden;
          ">
            <!-- Close Button -->
            <button onclick="this.closest('.gm-style-iw-c').querySelector('button.gm-ui-hover-effect').click()" style="
              position: absolute;
              top: 8px;
              left: 8px;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: rgba(255,255,255,0.1);
              border: 1px solid rgba(255,255,255,0.2);
              color: #fff;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
              line-height: 1;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">×</button>
            
            <div style="padding: 20px;">
              <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
                <img src="/logo-symbol.svg" alt="الفارس الذهبي" style="
                  width: 52px; 
                  height: 52px; 
                  border-radius: 10px;
                  box-shadow: 0 4px 15px rgba(212,175,55,0.4);
                " />
                <div>
                  <h3 style="font-weight: 800; font-size: 17px; color: #d4af37; margin: 0 0 4px 0;">الفارس الذهبي</h3>
                  <p style="color: #9ca3af; margin: 0; font-size: 13px;">للدعاية والإعلان</p>
                </div>
              </div>
              
              <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 12px; margin-bottom: 14px;">
                <div style="display: flex; align-items: center; gap: 8px; color: #d1d5db; font-size: 12px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span>زليتن، ليبيا</span>
                </div>
              </div>
              
              <a href="https://www.google.com/maps/dir/?api=1&destination=32.4847,14.5959&travelmode=driving" target="_blank" 
                 style="
                   display: flex; 
                   align-items: center; 
                   justify-content: center; 
                   gap: 8px;
                   background: linear-gradient(135deg, #d4af37, #b8860b); 
                   color: #1a1a1a; 
                   padding: 12px 18px; 
                   border-radius: 10px; 
                   font-size: 13px; 
                   font-weight: 700; 
                   text-decoration: none;
                   box-shadow: 0 4px 15px rgba(212,175,55,0.35);
                   transition: all 0.2s;
                 " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(212,175,55,0.5)'" 
                    onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(212,175,55,0.35)'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                التوجيه للمقر
              </a>
            </div>
          </div>
        `,
        maxWidth: 280,
      })

      companyMarker.addListener("click", () => {
        if (currentInfoWindow) {
          currentInfoWindow.close()
        }
        companyInfoWindow.open(map, companyMarker)
        currentInfoWindow = companyInfoWindow
      })
    }

    initializeMap()
    
    return () => {
      isMounted = false
    }
  }, [])

  // Handle drawing mode click
  useEffect(() => {
    if (!mapRef.current || !isReady) return

    const clickListener = mapRef.current.addListener("click", (e: any) => {
      if (isDrawingMode) {
        onDrawingPointAdd({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      } else if (currentInfoWindow) {
        currentInfoWindow.close()
        currentInfoWindow = null
      }
    })

    return () => {
      window.google?.maps?.event?.removeListener(clickListener)
    }
  }, [isReady, isDrawingMode, onDrawingPointAdd])

  // Handle map style changes
  useEffect(() => {
    if (!mapRef.current || !isReady) return
    
    if (mapStyle === 'roadmap') {
      mapRef.current.setMapTypeId('roadmap')
      mapRef.current.setOptions({ styles: darkMapStyles })
    } else {
      mapRef.current.setMapTypeId(mapStyle)
      mapRef.current.setOptions({ styles: [] })
    }
  }, [mapStyle, isReady])

  // Add billboard markers
  const addBillboardMarkers = useCallback((map: any) => {
    if (!map || !window.google?.maps) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
    }

    const clusterableMarkers: any[] = []
    const selectedMarkers: any[] = []

    billboards.forEach((billboard) => {
      const coords = billboard.coordinates.split(",").map((coord) => Number.parseFloat(coord.trim()))
      if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return

      const [lat, lng] = coords
      const isSelected = selectedBillboards?.has(billboard.id) || false
      const { url, pinSize } = createPinSvgUrl(billboard.size, billboard.status, isSelected)
      const w = pinSize + 8
      const h = pinSize + 14
      
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        title: billboard.name,
        icon: {
          url,
          scaledSize: new window.google.maps.Size(w, h),
          anchor: new window.google.maps.Point(w / 2, h - 2),
          labelOrigin: new window.google.maps.Point(w / 2, h + 8)
        },
        label: {
          text: billboard.size,
          color: isSelected ? '#d4af37' : '#fff',
          fontWeight: 'bold',
          fontSize: isSelected ? '11px' : '10px',
          className: 'marker-label'
        },
        optimized: true,
        zIndex: isSelected ? 1000 : 1
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: createInfoWindowContent(billboard),
      })

      // Create hover tooltip with dark background
      const statusText = billboard.status === "متاح" ? "متاح" : billboard.status === "قريباً" ? "قريباً" : "محجوز"
      const statusColor = billboard.status === "متاح" ? "#22c55e" : billboard.status === "قريباً" ? "#eab308" : "#ef4444"
      const hoverInfoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="
            background: linear-gradient(135deg, rgba(26,26,46,0.98), rgba(15,15,25,0.98));
            border: 1px solid rgba(212,175,55,0.4);
            border-radius: 12px;
            padding: 12px 16px;
            min-width: 160px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            text-align: center;
            font-family: 'Doran', sans-serif;
          ">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: #fff;">${billboard.name}</div>
            <div style="font-size: 12px; color: #d4af37; margin-bottom: 4px;">${billboard.size}</div>
            <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
              <span style="color: ${statusColor};">${statusText}</span>
            </div>
            ${billboard.landmark ? `<div style="font-size: 10px; color: #aaa; margin-top: 6px;">📍 ${billboard.landmark}</div>` : ''}
            <div style="font-size: 10px; color: #888; margin-top: 4px;">${billboard.area ? `${billboard.area} - ` : ''}${billboard.city}</div>
          </div>
        `,
        disableAutoPan: true
      })

      let hoverTimeout: ReturnType<typeof setTimeout> | null = null
      
      // Mouse over: Show hover tooltip
      marker.addListener("mouseover", () => {
        hoverTimeout = setTimeout(() => {
          hoverInfoWindow.open(map, marker)
        }, 200)
      })
      
      // Mouse out: Hide hover tooltip
      marker.addListener("mouseout", () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          hoverTimeout = null
        }
        hoverInfoWindow.close()
      })

      // Single click: Open info window
      let clickTimeout: ReturnType<typeof setTimeout> | null = null
      
      marker.addListener("click", () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout)
          clickTimeout = null
          return
        }
        
        // Close hover tooltip on click
        hoverInfoWindow.close()
        
        clickTimeout = setTimeout(() => {
          clickTimeout = null
          if (currentInfoWindow) {
            currentInfoWindow.close()
          }
          currentInfoWindow = infoWindow
          infoWindow.open(map, marker)
        }, 250)
      })
      
      // Double click: Toggle selection
      marker.addListener("dblclick", () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout)
          clickTimeout = null
        }
        if (onToggleSelection) {
          const wasSelected = selectedBillboards?.has(billboard.id) || false
          onToggleSelection(billboard.id)
          showNotification(
            wasSelected ? `تم إلغاء تحديد: ${billboard.name}` : `تم تحديد: ${billboard.name}`,
            wasSelected ? 'deselect' : 'select'
          )
        }
      })

      markersRef.current.push(marker)
      
      // Selected markers should NOT be clustered - add directly to map
      if (isSelected) {
        marker.setMap(map)
        selectedMarkers.push(marker)
      } else {
        clusterableMarkers.push(marker)
      }
    })

    // Add clustering only for non-selected markers
    if (window.markerClusterer && clusterableMarkers.length > 0) {
      const isMobile = window.innerWidth < 768
      
      clustererRef.current = new window.markerClusterer.MarkerClusterer({
        map,
        markers: clusterableMarkers,
        // Improved clustering - less aggressive grouping for better UX
        algorithm: new window.markerClusterer.SuperClusterAlgorithm({
          maxZoom: 14, // Stop clustering at zoom 14+
          radius: isMobile ? 60 : 40, // Smaller radius = less grouping
          minPoints: isMobile ? 4 : 3, // Require more points to form cluster
        }),
        renderer: {
          render: ({ count, position }: any) => {
            const displayCount = count > 99 ? '99+' : String(count)
            // Dynamic size based on count
            const size = count > 50 ? 48 : count > 20 ? 44 : 40
            return new window.google.maps.Marker({
              position,
              icon: {
                url: clusterIconUrl,
                scaledSize: new window.google.maps.Size(size, size),
                anchor: new window.google.maps.Point(size / 2, size / 2),
                labelOrigin: new window.google.maps.Point(size / 2, size / 2)
              },
              label: {
                text: displayCount,
                color: "#d4af37",
                fontWeight: "bold",
                fontSize: count > 50 ? "14px" : "12px",
              },
              optimized: true,
              zIndex: count + 100
            })
          },
        },
        onClusterClick: (event: any, cluster: any, map: any) => {
          // Smooth zoom into cluster
          const bounds = cluster.bounds
          map.fitBounds(bounds, { padding: 80 })
        }
      })
    } else {
      clusterableMarkers.forEach(marker => marker.setMap(map))
    }
  }, [billboards, selectedBillboards, onToggleSelection, showNotification])

  // Debounced marker update for better performance
  const updateMarkersTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  
  // Update markers when data changes (debounced)
  useEffect(() => {
    if (mapRef.current && isReady) {
      // Clear any pending update
      if (updateMarkersTimeoutRef.current) {
        clearTimeout(updateMarkersTimeoutRef.current)
      }
      
      // Debounce marker updates to prevent rapid re-renders
      updateMarkersTimeoutRef.current = setTimeout(() => {
        addBillboardMarkers(mapRef.current)
      }, 50)
    }
    
    return () => {
      if (updateMarkersTimeoutRef.current) {
        clearTimeout(updateMarkersTimeoutRef.current)
      }
    }
  }, [billboards, isReady, selectedBillboards, addBillboardMarkers])

  // Handle drawing polygon
  useEffect(() => {
    if (!mapRef.current || !isReady) return

    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null)
      drawingPolygonRef.current = null
    }

    if (drawingPoints.length >= 2 && window.google?.maps) {
      drawingPolygonRef.current = new window.google.maps.Polygon({
        paths: drawingPoints,
        strokeColor: "#d4af37",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        fillColor: "#d4af37",
        fillOpacity: 0.2,
        map: mapRef.current,
      })
    }
  }, [drawingPoints, isReady])

  // Listen for image view events
  useEffect(() => {
    const handleShowImage = (event: any) => {
      onImageView(event.detail)
    }

    document.addEventListener("showBillboardImage", handleShowImage)
    
    return () => {
      document.removeEventListener("showBillboardImage", handleShowImage)
    }
  }, [onImageView])

  // Handle target location navigation
  useEffect(() => {
    if (targetLocation && mapRef.current && window.google?.maps) {
      // Remove previous boundary
      if (boundaryRectRef.current) {
        boundaryRectRef.current.setMap(null)
        boundaryRectRef.current = null
      }
      
      const zoom = targetLocation.zoom || 14
      mapRef.current.panTo({ lat: targetLocation.lat, lng: targetLocation.lng })
      mapRef.current.setZoom(zoom)
      
      // Add boundary rectangle if provided
      if (targetLocation.boundary) {
        const { north, south, east, west } = targetLocation.boundary
        boundaryRectRef.current = new window.google.maps.Rectangle({
          bounds: { north, south, east, west },
          strokeColor: '#22c55e',
          strokeOpacity: 0.9,
          strokeWeight: 3,
          fillColor: '#22c55e',
          fillOpacity: 0.1,
          map: mapRef.current
        })
      }
      
      // Call callback after animation
      if (onTargetLocationReached) {
        setTimeout(() => {
          onTargetLocationReached()
        }, 1000)
      }
    }
  }, [targetLocation, onTargetLocationReached])

  // Handle navigation route using Google Directions API (built-in, no extra API key needed)
  useEffect(() => {
    if (!mapRef.current || !isReady || !window.google?.maps) return

    // Clear previous route
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }
    routeMarkersRef.current.forEach(m => m.setMap(null))
    routeMarkersRef.current = []

    if (navigationRoute && navigationRoute.length >= 2) {
      // Dark elegant route color
      const routeColor = '#1e3a5f' // Deep navy blue
      const routeOutlineColor = '#0f1f35' // Darker outline
      
      // Use Google Directions Service for accurate road routing
      const directionsService = new window.google.maps.DirectionsService()
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true, // We'll add custom markers
        polylineOptions: {
          strokeColor: routeColor,
          strokeOpacity: 1,
          strokeWeight: 6,
          zIndex: 500
        }
      })
      
      directionsRendererRef.current = directionsRenderer

      // Build waypoints (Google allows max 23 waypoints)
      const origin = navigationRoute[0]
      const destination = navigationRoute[navigationRoute.length - 1]
      const waypoints = navigationRoute.slice(1, -1).slice(0, 23).map(point => ({
        location: new window.google.maps.LatLng(point.lat, point.lng),
        stopover: true
      }))

      const request = {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false, // Keep our order
        unitSystem: window.google.maps.UnitSystem.METRIC
      }

      directionsService.route(request, (result: any, status: any) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result)
          
          // Add custom start marker (green flag style)
          const startMarker = new window.google.maps.Marker({
            position: origin,
            map: mapRef.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#059669',
              fillOpacity: 1,
              strokeColor: '#022c22',
              strokeWeight: 4
            },
            zIndex: 600,
            title: 'نقطة البداية'
          })

          // Add custom end marker (red finish style)
          const endMarker = new window.google.maps.Marker({
            position: destination,
            map: mapRef.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#dc2626',
              fillOpacity: 1,
              strokeColor: '#450a0a',
              strokeWeight: 4
            },
            zIndex: 600,
            title: 'نقطة النهاية'
          })

          routeMarkersRef.current.push(startMarker, endMarker)
        } else {
          // Fallback: draw simple polyline if Directions API fails
          console.log('Directions API fallback:', status)
          
          // Draw outline first
          const polylineOutline = new window.google.maps.Polyline({
            path: navigationRoute,
            strokeColor: routeOutlineColor,
            strokeOpacity: 1,
            strokeWeight: 8,
            map: mapRef.current,
            zIndex: 499
          })
          
          // Draw main route
          const polyline = new window.google.maps.Polyline({
            path: navigationRoute,
            strokeColor: routeColor,
            strokeOpacity: 1,
            strokeWeight: 5,
            map: mapRef.current,
            zIndex: 500
          })
          
          // Store polylines for cleanup
          directionsRendererRef.current = { 
            setMap: (m: any) => {
              polyline.setMap(m)
              polylineOutline.setMap(m)
            }
          }

          const startMarker = new window.google.maps.Marker({
            position: navigationRoute[0],
            map: mapRef.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#059669',
              fillOpacity: 1,
              strokeColor: '#022c22',
              strokeWeight: 4
            },
            zIndex: 600
          })

          const endMarker = new window.google.maps.Marker({
            position: navigationRoute[navigationRoute.length - 1],
            map: mapRef.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#dc2626',
              fillOpacity: 1,
              strokeColor: '#450a0a',
              strokeWeight: 4
            },
            zIndex: 600
          })

          routeMarkersRef.current.push(startMarker, endMarker)

          // Fit bounds
          const bounds = new window.google.maps.LatLngBounds()
          navigationRoute.forEach(point => bounds.extend(point))
          mapRef.current.fitBounds(bounds, { padding: 50 })
        }
      })
    }
  }, [navigationRoute, isReady])

  // Handle user location marker
  useEffect(() => {
    if (!mapRef.current || !isReady || !window.google?.maps) return

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
      userMarkerRef.current = null
    }

    if (userLocation) {
      userMarkerRef.current = new window.google.maps.Marker({
        position: userLocation,
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3
        },
        zIndex: 700
      })
    }
  }, [userLocation, isReady])

  // Handle live tracking location with directional arrow
  useEffect(() => {
    if (!mapRef.current || !isReady || !window.google?.maps) return

    if (liveMarkerRef.current) {
      liveMarkerRef.current.setMap(null)
      liveMarkerRef.current = null
    }

    if (liveTrackingLocation && typeof liveTrackingLocation.lat === 'number' && typeof liveTrackingLocation.lng === 'number' && isFinite(liveTrackingLocation.lat) && isFinite(liveTrackingLocation.lng)) {
      // Create a custom marker with a car/arrow icon that rotates
      const heading = (liveTrackingLocation as any).heading || 0
      
      // Create custom SVG for the tracking arrow
      const trackingSvg = `
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#22c55e" flood-opacity="0.8"/>
            </filter>
            <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#22c55e"/>
              <stop offset="100%" style="stop-color:#16a34a"/>
            </linearGradient>
          </defs>
          <!-- Pulsing outer ring -->
          <circle cx="30" cy="30" r="25" fill="none" stroke="#22c55e" stroke-width="3" opacity="0.3">
            <animate attributeName="r" values="20;28;20" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite"/>
          </circle>
          <!-- Inner circle -->
          <circle cx="30" cy="30" r="18" fill="#1a1a2e" stroke="#22c55e" stroke-width="3"/>
          <!-- Direction arrow -->
          <path d="M30 12 L40 35 L30 28 L20 35 Z" fill="url(#arrowGrad)" filter="url(#glow)" transform="rotate(${heading}, 30, 30)"/>
          <!-- Center dot -->
          <circle cx="30" cy="30" r="4" fill="#22c55e"/>
        </svg>
      `
      
      const encodedSvg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(trackingSvg)
      
      liveMarkerRef.current = new window.google.maps.Marker({
        position: { lat: liveTrackingLocation.lat, lng: liveTrackingLocation.lng },
        map: mapRef.current,
        icon: {
          url: encodedSvg,
          scaledSize: new window.google.maps.Size(60, 60),
          anchor: new window.google.maps.Point(30, 30)
        },
        zIndex: 9000,
        optimized: false
      })

      // Smooth pan to live location
      mapRef.current.panTo({ lat: liveTrackingLocation.lat, lng: liveTrackingLocation.lng })
    }
  }, [liveTrackingLocation, isReady])

  // Handle recorded route line with animated glow effect
  useEffect(() => {
    if (!mapRef.current || !isReady || !window.google?.maps) return

    // Cancel any existing animation
    if (routeAnimationFrameRef.current) {
      cancelAnimationFrame(routeAnimationFrameRef.current)
      routeAnimationFrameRef.current = null
    }

    // Remove previous route lines
    if (recordedRouteLineRef.current) {
      recordedRouteLineRef.current.setMap(null)
      recordedRouteLineRef.current = null
    }
    if (recordedRouteGlowRef.current) {
      recordedRouteGlowRef.current.setMap(null)
      recordedRouteGlowRef.current = null
    }
    if (recordedRouteAnimatedRef.current) {
      recordedRouteAnimatedRef.current.setMap(null)
      recordedRouteAnimatedRef.current = null
    }

    if (recordedRoute && recordedRoute.length > 1) {
      const routePath = recordedRoute.map(point => ({ lat: point.lat, lng: point.lng }))
      
      // Layer 1: Outer glow (wide, semi-transparent)
      recordedRouteGlowRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#06b6d4',
        strokeOpacity: 0.3,
        strokeWeight: 14,
        map: mapRef.current,
        zIndex: 4998
      })
      
      // Layer 2: Main route line
      recordedRouteLineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#06b6d4',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: mapRef.current,
        zIndex: 4999
      })
      
      // Layer 3: Animated flowing line (dashed, moving)
      let dashOffset = 0
      const lineSymbol = {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 3
      }
      
      recordedRouteAnimatedRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeOpacity: 0,
        icons: [{
          icon: lineSymbol,
          offset: '0%',
          repeat: '20px'
        }],
        map: mapRef.current,
        zIndex: 5000
      })
      
      // Animate the dashed line
      const animateLine = () => {
        dashOffset = (dashOffset + 0.5) % 200
        if (recordedRouteAnimatedRef.current) {
          const icons = recordedRouteAnimatedRef.current.get('icons')
          if (icons && icons[0]) {
            icons[0].offset = `${dashOffset / 2}%`
            recordedRouteAnimatedRef.current.set('icons', icons)
          }
        }
        routeAnimationFrameRef.current = requestAnimationFrame(animateLine)
      }
      
      animateLine()
    }

    // Cleanup function
    return () => {
      if (routeAnimationFrameRef.current) {
        cancelAnimationFrame(routeAnimationFrameRef.current)
      }
    }
  }, [recordedRoute, isReady])

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ background: '#1a1a2e' }}
    />
  )
})

GoogleMapComponent.displayName = 'GoogleMapComponent'

export default memo(GoogleMapComponent)
