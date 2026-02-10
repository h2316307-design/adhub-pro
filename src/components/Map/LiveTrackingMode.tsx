// Live Tracking Mode - Real-time GPS Navigation
import { useEffect, useState, useCallback, useRef } from 'react'
import { Billboard } from '@/types'
import { MapPin, Navigation, X, Gauge, Eye, Volume2, VolumeX, Locate, ChevronDown, ChevronUp, Moon, Sun, Share2, Trash2, CheckCircle2, Settings, ZoomOut, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LiveTrackingModeProps {
  isActive: boolean
  onClose: () => void
  billboards: Billboard[]
  onLocationUpdate: (location: { lat: number; lng: number; heading?: number; speed?: number }) => void
  onZoomToLocation: (lat: number, lng: number, zoom: number) => void
  onRequestLocation: () => void
  onRouteUpdate?: (route: RoutePoint[]) => void
  onVisitedBillboardsUpdate?: (visitedIds: Set<string>) => void
  onBillboardSelect?: (billboard: Billboard) => void
}

interface NearbyBillboard {
  billboard: Billboard
  distance: number
  direction: string
}

interface RoutePoint {
  lat: number
  lng: number
  timestamp: number
  speed?: number
}

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Get direction from heading
const getDirectionFromHeading = (heading: number): string => {
  const directions = ['↑ شمال', '↗ شمال شرق', '→ شرق', '↘ جنوب شرق', '↓ جنوب', '↙ جنوب غرب', '← غرب', '↖ شمال غرب']
  const index = Math.round(((heading % 360) + 360) % 360 / 45) % 8
  return directions[index]
}

// Get relative direction to a point
const getRelativeDirection = (currentLat: number, currentLng: number, targetLat: number, targetLng: number, heading: number): string => {
  const targetAngle = Math.atan2(targetLng - currentLng, targetLat - currentLat) * 180 / Math.PI
  let relativeAngle = targetAngle - heading
  if (relativeAngle < -180) relativeAngle += 360
  if (relativeAngle > 180) relativeAngle -= 360

  if (relativeAngle > -45 && relativeAngle <= 45) return 'أمامك ↑'
  if (relativeAngle > 45 && relativeAngle <= 135) return 'يمينك →'
  if (relativeAngle > -135 && relativeAngle <= -45) return 'يسارك ←'
  return 'خلفك ↓'
}

// Format distance
const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} م`
  return `${(meters / 1000).toFixed(1)} كم`
}

// Format speed
const formatSpeed = (mps: number): string => {
  const kmh = mps * 3.6
  return `${Math.round(kmh)}`
}

export default function LiveTrackingMode({
  isActive,
  onClose,
  billboards,
  onLocationUpdate,
  onZoomToLocation,
  onRequestLocation,
  onRouteUpdate,
  onVisitedBillboardsUpdate,
  onBillboardSelect
}: LiveTrackingModeProps) {
  const [isTracking, setIsTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [heading, setHeading] = useState<number>(0)
  const [speed, setSpeed] = useState<number>(0)
  const [nearbyBillboards, setNearbyBillboards] = useState<NearbyBillboard[]>([])
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [showNearbyPanel, setShowNearbyPanel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number>(0)
  const [nightMode, setNightMode] = useState(false)

  const [trackPath, setTrackPath] = useState<RoutePoint[]>([])
  const [visitedBillboards, setVisitedBillboards] = useState<Set<string>>(new Set())
  const [totalDistance, setTotalDistance] = useState<number>(0)

  const [showSettings, setShowSettings] = useState(false)
  const [autoZoomOut, setAutoZoomOut] = useState(false)
  const [autoOpenCards, setAutoOpenCards] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(17)

  const watchIdRef = useRef<number | null>(null)
  const announcedBillboardsRef = useRef<Set<string>>(new Set())
  const vibratedBillboardsRef = useRef<Set<string>>(new Set())
  const lastTrackPointRef = useRef<RoutePoint | null>(null)
  const lastAutoOpenedRef = useRef<string | null>(null)

  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  // Play notification sound with billboard info
  const playNotificationSound = useCallback((billboard: Billboard) => {
    if (!soundEnabledRef.current) return
    if (announcedBillboardsRef.current.has((billboard as any).ID?.toString() || billboard.id)) return

    announcedBillboardsRef.current.add((billboard as any).ID?.toString() || billboard.id)

    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }

    const size = (billboard as any).Size || (billboard as any).size || ''
    const sizeText = size ? size.replace(/x/gi, ' في ') : 'لوحة قريبة'
    const landmark = (billboard as any).Nearest_Landmark || (billboard as any).location || ''
    const landmarkText = landmark ? `، اقرب نقطة دالة ${landmark}` : ''
    const message = `لوحة ${sizeText}${landmarkText}`

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'ar-SA'
    utterance.rate = 1.0
    utterance.volume = 0.8
    speechSynthesis.speak(utterance)
  }, [])

  // Vibrate once per billboard
  const vibrateOnce = useCallback((billboard: Billboard) => {
    const id = (billboard as any).ID?.toString() || billboard.id
    if (vibratedBillboardsRef.current.has(id)) return
    vibratedBillboardsRef.current.add(id)

    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100])
    }
  }, [])

  // Track path point
  const trackPathPoint = useCallback((lat: number, lng: number, currentSpeed: number) => {
    const newPoint: RoutePoint = {
      lat,
      lng,
      timestamp: Date.now(),
      speed: currentSpeed
    }

    if (!lastTrackPointRef.current) {
      lastTrackPointRef.current = newPoint
      setTrackPath(prev => {
        const newPath = [...prev, newPoint]
        onRouteUpdate?.(newPath)
        return newPath
      })
      return
    }

    const dist = calculateDistance(
      lastTrackPointRef.current.lat,
      lastTrackPointRef.current.lng,
      lat,
      lng
    )

    if (dist < 5) return

    setTotalDistance(prev => prev + dist)
    lastTrackPointRef.current = newPoint

    setTrackPath(prev => {
      const newPath = [...prev, newPoint]
      onRouteUpdate?.(newPath)
      return newPath
    })
  }, [onRouteUpdate])

  // Parse billboard coordinates
  const parseBillboardCoords = (billboard: Billboard): { lat: number; lng: number } | null => {
    const coords = (billboard as any).GPS_Coordinates || billboard.coordinates
    if (!coords) return null
    
    if (typeof coords === 'string') {
      const parts = coords.split(',').map((c: string) => parseFloat(c.trim()))
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] }
      }
    }
    return null
  }

  // Update nearby billboards
  const updateNearbyBillboards = useCallback((lat: number, lng: number, currentHeading: number) => {
    const nearby: NearbyBillboard[] = []
    let closestBillboard: NearbyBillboard | null = null

    billboards.forEach(billboard => {
      const coords = parseBillboardCoords(billboard)
      if (!coords) return

      const distance = calculateDistance(lat, lng, coords.lat, coords.lng)
      const id = (billboard as any).ID?.toString() || billboard.id

      // Mark as visited if within 100m
      if (distance <= 100 && !visitedBillboards.has(id)) {
        setVisitedBillboards(prev => {
          const newSet = new Set(prev)
          newSet.add(id)
          onVisitedBillboardsUpdate?.(newSet)
          return newSet
        })

        playNotificationSound(billboard)
        vibrateOnce(billboard)
      }

      // Only show billboards within 2km
      if (distance <= 2000) {
        const direction = getRelativeDirection(lat, lng, coords.lat, coords.lng, currentHeading)
        const nearbyItem = { billboard, distance, direction }
        nearby.push(nearbyItem)

        if (!closestBillboard || distance < closestBillboard.distance) {
          closestBillboard = nearbyItem
        }

        if (distance <= 100) {
          playNotificationSound(billboard)
          vibrateOnce(billboard)
        }
      }
    })

    // Auto zoom out when approaching
    if (autoZoomOut && closestBillboard && closestBillboard.distance <= 300) {
      const targetZoom = 15
      if (currentZoom !== targetZoom) {
        setCurrentZoom(targetZoom)
        onZoomToLocation(lat, lng, targetZoom)
      }
    } else if (autoZoomOut && (!closestBillboard || closestBillboard.distance > 500)) {
      const targetZoom = 17
      if (currentZoom !== targetZoom) {
        setCurrentZoom(targetZoom)
        onZoomToLocation(lat, lng, targetZoom)
      }
    }

    // Auto open card
    if (autoOpenCards && closestBillboard && closestBillboard.distance <= 100) {
      const billboardId = (closestBillboard.billboard as any).ID?.toString() || closestBillboard.billboard.id
      if (lastAutoOpenedRef.current !== billboardId) {
        if (lastAutoOpenedRef.current) {
          const closeEvent = new CustomEvent('closeBillboardInfoWindow')
          document.dispatchEvent(closeEvent)
        }
        lastAutoOpenedRef.current = billboardId
        const event = new CustomEvent('openBillboardInfoWindow', { detail: billboardId })
        document.dispatchEvent(event)
      }
    }

    nearby.sort((a, b) => a.distance - b.distance)
    setNearbyBillboards(nearby.slice(0, 8))
  }, [billboards, playNotificationSound, vibrateOnce, visitedBillboards, onVisitedBillboardsUpdate, autoZoomOut, autoOpenCards, currentZoom, onZoomToLocation])

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع')
      return
    }

    setIsTracking(true)
    setError(null)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading: posHeading, speed: posSpeed, accuracy: posAccuracy } = position.coords

        setCurrentLocation({ lat: latitude, lng: longitude })
        setHeading(posHeading || 0)
        setSpeed(posSpeed || 0)
        setAccuracy(posAccuracy || 0)

        onLocationUpdate({ lat: latitude, lng: longitude, heading: posHeading || 0, speed: posSpeed || 0 })

        if (!autoZoomOut) {
          onZoomToLocation(latitude, longitude, 17)
        }

        updateNearbyBillboards(latitude, longitude, posHeading || 0)
        trackPathPoint(latitude, longitude, posSpeed || 0)
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError('فشل في تحديد الموقع. تأكد من تفعيل GPS.')
        setIsTracking(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }, [onLocationUpdate, onZoomToLocation, updateNearbyBillboards, trackPathPoint, autoZoomOut])

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
  }, [])

  // Clear route
  const clearRoute = useCallback(() => {
    setTrackPath([])
    setTotalDistance(0)
    lastTrackPointRef.current = null
    setVisitedBillboards(new Set())
    announcedBillboardsRef.current.clear()
    vibratedBillboardsRef.current.clear()
    onVisitedBillboardsUpdate?.(new Set())
    onRouteUpdate?.([])
  }, [onRouteUpdate, onVisitedBillboardsUpdate])

  // Share route
  const shareRoute = useCallback(async () => {
    if (trackPath.length === 0) return

    const shareText = `مسار التتبع المباشر\nالمسافة: ${formatDistance(totalDistance)}\nاللوحات التي تم الوصول إليها: ${visitedBillboards.size}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'مسار التتبع المباشر',
          text: shareText,
          url: window.location.href
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      navigator.clipboard.writeText(shareText)
      alert('تم نسخ بيانات المسار إلى الحافظة')
    }
  }, [trackPath, visitedBillboards, totalDistance])

  // Handle close
  const handleClose = useCallback(() => {
    stopTracking()
    onClose()
  }, [stopTracking, onClose])

  // Center on current location
  const centerOnLocation = useCallback(() => {
    if (currentLocation) {
      onZoomToLocation(currentLocation.lat, currentLocation.lng, 17)
    }
  }, [currentLocation, onZoomToLocation])

  // Effect to stop speech when disabled
  useEffect(() => {
    if (!soundEnabled && 'speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
  }, [soundEnabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel()
      }
    }
  }, [])

  // Auto-start tracking when activated
  useEffect(() => {
    if (isActive && !isTracking) {
      startTracking()
    } else if (!isActive && isTracking) {
      stopTracking()
    }
  }, [isActive, isTracking, startTracking, stopTracking])

  if (!isActive) return null

  return (
    <>
      {/* Top HUD Bar */}
      <div className="absolute top-2 left-2 right-2 z-[2000] pointer-events-auto">
        <div className={`backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden transition-colors duration-500 ${
          nightMode
            ? 'bg-zinc-950/95 border border-zinc-800/50'
            : 'bg-black/90 border border-primary/30'
        }`}>
          {/* Row 1 - Basic Info */}
          <div className="flex items-center justify-between p-2 sm:p-3 gap-1 sm:gap-2">
            {/* Close Button */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex-shrink-0 ${
                nightMode
                  ? 'bg-zinc-800/50 hover:bg-zinc-700/50'
                  : 'bg-destructive/20 hover:bg-destructive/40'
              }`}
              onClick={handleClose}
            >
              <X className={`w-4 h-4 sm:w-5 sm:h-5 ${nightMode ? 'text-zinc-400' : 'text-destructive'}`} />
            </Button>

            {/* Speed Display */}
            <div className={`flex items-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 ${
              nightMode ? 'bg-zinc-900/80' : 'bg-card/30'
            }`}>
              <Gauge className={`w-3 h-3 sm:w-4 sm:h-4 ${nightMode ? 'text-amber-600/80' : 'text-primary'}`} />
              <div className="flex items-baseline gap-0.5 sm:gap-1">
                <span className={`text-base sm:text-xl font-black tabular-nums ${
                  nightMode ? 'text-amber-100/90' : 'text-white'
                }`}>{formatSpeed(speed)}</span>
                <span className={`text-[8px] sm:text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>كم/س</span>
              </div>
            </div>

            {/* Direction Display */}
            <div className={`flex items-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 ${
              nightMode ? 'bg-zinc-900/80' : 'bg-card/30'
            }`}>
              <div
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${
                  nightMode ? 'bg-amber-900/30' : 'bg-primary/30'
                }`}
                style={{ transform: `rotate(${heading}deg)` }}
              >
                <Navigation className={`w-3 h-3 sm:w-4 sm:h-4 ${nightMode ? 'text-amber-500/80' : 'text-primary'}`} />
              </div>
              <span className={`text-xs sm:text-sm font-bold hidden sm:block ${
                nightMode ? 'text-amber-100/80' : 'text-white'
              }`}>{getDirectionFromHeading(heading)}</span>
            </div>

            {/* Accuracy */}
            <div className="hidden xs:flex sm:flex items-center gap-1 text-[10px] sm:text-xs">
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                accuracy <= 15
                  ? (nightMode ? 'bg-emerald-700' : 'bg-emerald-500')
                  : accuracy <= 50
                    ? (nightMode ? 'bg-amber-700' : 'bg-amber-500')
                    : (nightMode ? 'bg-red-800' : 'bg-destructive')
              }`} />
              <span className={nightMode ? 'text-zinc-500' : 'text-muted-foreground'}>±{Math.round(accuracy)}م</span>
            </div>
          </div>

          {/* Row 2 - Control Buttons */}
          <div className={`flex items-center justify-center gap-1.5 px-2 pb-2 border-t pt-2 flex-wrap ${
            nightMode ? 'border-zinc-800/50' : 'border-border/20'
          }`}>
            {/* Settings Button */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-8 h-8 rounded-xl flex-shrink-0 ${
                showSettings
                  ? (nightMode ? 'bg-zinc-700' : 'bg-primary/30')
                  : (nightMode ? 'hover:bg-zinc-800' : 'hover:bg-primary/20')
              }`}
              onClick={() => setShowSettings(!showSettings)}
              title="الإعدادات"
            >
              <Settings className={`w-4 h-4 ${showSettings ? (nightMode ? 'text-amber-400' : 'text-primary') : (nightMode ? 'text-amber-500/80' : 'text-primary')}`} />
            </Button>

            {/* Share Button */}
            {trackPath.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className={`w-8 h-8 rounded-xl ${nightMode ? 'hover:bg-zinc-800' : 'hover:bg-primary/20'}`}
                onClick={shareRoute}
                title="مشاركة المسار"
              >
                <Share2 className={`w-4 h-4 ${nightMode ? 'text-amber-500/80' : 'text-primary'}`} />
              </Button>
            )}

            {/* Clear Route Button */}
            {(trackPath.length > 0 || visitedBillboards.size > 0) && (
              <Button
                size="icon"
                variant="ghost"
                className={`w-8 h-8 rounded-xl ${nightMode ? 'hover:bg-zinc-800' : 'hover:bg-primary/20'}`}
                onClick={clearRoute}
                title="مسح المسار"
              >
                <Trash2 className={`w-4 h-4 ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`} />
              </Button>
            )}

            {/* Night Mode Toggle */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-8 h-8 rounded-xl ${
                nightMode
                  ? 'bg-amber-900/30 hover:bg-amber-900/50'
                  : 'hover:bg-primary/20'
              }`}
              onClick={() => setNightMode(!nightMode)}
              title="الوضع الليلي"
            >
              {nightMode ? (
                <Moon className="w-4 h-4 text-amber-500" />
              ) : (
                <Sun className="w-4 h-4 text-primary" />
              )}
            </Button>

            {/* Sound Toggle */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-8 h-8 rounded-xl ${nightMode ? 'hover:bg-zinc-800' : 'hover:bg-primary/20'}`}
              onClick={() => {
                const newValue = !soundEnabled
                setSoundEnabled(newValue)
                if (!newValue && 'speechSynthesis' in window) {
                  speechSynthesis.cancel()
                }
              }}
              title={soundEnabled ? 'إيقاف الصوت' : 'تفعيل الصوت'}
            >
              {soundEnabled ? (
                <Volume2 className={`w-4 h-4 ${nightMode ? 'text-amber-500/80' : 'text-primary'}`} />
              ) : (
                <VolumeX className={`w-4 h-4 ${nightMode ? 'text-zinc-600' : 'text-muted-foreground'}`} />
              )}
            </Button>

            {/* Center Location */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-8 h-8 rounded-xl ${nightMode ? 'hover:bg-zinc-800' : 'hover:bg-primary/20'}`}
              onClick={centerOnLocation}
              title="تركيز على موقعي"
            >
              <Locate className={`w-4 h-4 ${nightMode ? 'text-amber-500/80' : 'text-primary'}`} />
            </Button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className={`px-4 py-3 border-t ${
              nightMode
                ? 'bg-zinc-900/80 border-zinc-800/50'
                : 'bg-card/30 border-border/30'
            }`}>
              <p className={`text-xs font-bold mb-3 ${nightMode ? 'text-amber-100/80' : 'text-foreground'}`}>خيارات التتبع</p>
              <div className="space-y-3">
                {/* Auto Zoom Out Option */}
                <button
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    autoZoomOut
                      ? (nightMode ? 'bg-cyan-900/30 border border-cyan-700/50' : 'bg-primary/20 border border-primary/30')
                      : (nightMode ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-card/50 hover:bg-card/80 border border-border/30')
                  }`}
                  onClick={() => setAutoZoomOut(!autoZoomOut)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      autoZoomOut
                        ? (nightMode ? 'bg-cyan-800/50' : 'bg-primary/30')
                        : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                    }`}>
                      <ZoomOut className={`w-4 h-4 ${autoZoomOut ? (nightMode ? 'text-cyan-400' : 'text-primary') : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')}`} />
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>تكبير عند الاقتراب</p>
                      <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>زوم أوت تلقائي عند الاقتراب من لوحة</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                    autoZoomOut
                      ? (nightMode ? 'bg-cyan-600' : 'bg-primary')
                      : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      autoZoomOut ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                </button>

                {/* Auto Open Cards Option */}
                <button
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    autoOpenCards
                      ? (nightMode ? 'bg-cyan-900/30 border border-cyan-700/50' : 'bg-primary/20 border border-primary/30')
                      : (nightMode ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-card/50 hover:bg-card/80 border border-border/30')
                  }`}
                  onClick={() => setAutoOpenCards(!autoOpenCards)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      autoOpenCards
                        ? (nightMode ? 'bg-cyan-800/50' : 'bg-primary/30')
                        : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                    }`}>
                      <CreditCard className={`w-4 h-4 ${autoOpenCards ? (nightMode ? 'text-cyan-400' : 'text-primary') : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')}`} />
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>فتح البطاقة تلقائياً</p>
                      <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>عرض تفاصيل اللوحة عند الاقتراب منها</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                    autoOpenCards
                      ? (nightMode ? 'bg-cyan-600' : 'bg-primary')
                      : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      autoOpenCards ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Status Bar */}
          {(isTracking || trackPath.length > 0) && (
            <div className={`px-3 py-2 border-t flex items-center justify-between ${
              nightMode
                ? 'bg-zinc-900/50 border-zinc-800/50'
                : 'bg-card/20 border-border/30'
            }`}>
              <div className="flex items-center gap-3">
                {isTracking && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className={`text-xs font-medium ${nightMode ? 'text-emerald-400' : 'text-emerald-500'}`}>متصل</span>
                  </span>
                )}
                <span className={`text-xs ${nightMode ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                  المسافة: {formatDistance(totalDistance)}
                </span>
                <span className={`text-xs ${nightMode ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                  النقاط: {trackPath.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${nightMode ? 'text-emerald-600' : 'text-emerald-500'}`} />
                <span className={`text-xs font-medium ${nightMode ? 'text-emerald-600' : 'text-emerald-500'}`}>
                  {visitedBillboards.size} لوحة
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={`px-3 py-2 border-t flex items-center justify-between ${
              nightMode
                ? 'bg-red-950/30 border-red-900/30'
                : 'bg-destructive/20 border-destructive/30'
            }`}>
              <p className={`text-xs ${nightMode ? 'text-red-400/80' : 'text-destructive'}`}>{error}</p>
              <Button size="sm" variant="ghost" className={`text-xs h-7 ${nightMode ? 'text-zinc-400' : ''}`} onClick={startTracking}>
                إعادة المحاولة
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Nearby Billboards Panel - Bottom */}
      <div className="absolute bottom-2 left-2 right-2 z-[2000] pointer-events-auto">
        <div className={`backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden transition-colors duration-500 ${
          nightMode
            ? 'bg-zinc-950/95 border border-zinc-800/50'
            : 'bg-black/90 border border-primary/30'
        }`}>
          {/* Panel Header */}
          <button
            className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
              nightMode ? 'hover:bg-zinc-900/50' : 'hover:bg-primary/10'
            }`}
            onClick={() => setShowNearbyPanel(!showNearbyPanel)}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  nightMode
                    ? 'bg-amber-900/20'
                    : 'bg-primary/20'
                } ${isTracking ? 'animate-pulse' : ''}`}>
                  <Eye className={`w-5 h-5 ${nightMode ? 'text-amber-500/80' : 'text-primary'}`} />
                </div>
                {nearbyBillboards.length > 0 && (
                  <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    nightMode
                      ? 'bg-amber-700 text-amber-100'
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    {nearbyBillboards.length}
                  </span>
                )}
              </div>
              <div className="text-right">
                <h3 className={`font-bold text-sm ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>اللوحات القريبة</h3>
                <p className={`text-xs ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                  {isTracking ? `${nearbyBillboards.length} لوحة في نطاق 2 كم` : 'التتبع متوقف'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isTracking
                  ? (nightMode ? 'bg-amber-600 animate-pulse' : 'bg-emerald-500 animate-pulse')
                  : (nightMode ? 'bg-zinc-600' : 'bg-muted-foreground')
              }`} />
              {showNearbyPanel ? (
                <ChevronDown className={`w-5 h-5 ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`} />
              ) : (
                <ChevronUp className={`w-5 h-5 ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`} />
              )}
            </div>
          </button>

          {/* Panel Content */}
          {showNearbyPanel && (
            <div className={`border-t max-h-48 overflow-y-auto ${
              nightMode ? 'border-zinc-800/50' : 'border-border/30'
            }`}>
              {nearbyBillboards.length === 0 ? (
                <p className={`text-center py-6 text-sm ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                  {isTracking ? 'لا توجد لوحات قريبة' : 'ابدأ التتبع لرؤية اللوحات القريبة'}
                </p>
              ) : (
                <div className="divide-y divide-border/20">
                  {nearbyBillboards.map((item) => {
                    const billboardId = (item.billboard as any).ID?.toString() || item.billboard.id
                    const billboardName = (item.billboard as any).Billboard_Name || item.billboard.name || 'لوحة'
                    const billboardSize = (item.billboard as any).Size || item.billboard.size || ''
                    const isVisited = visitedBillboards.has(billboardId)
                    
                    return (
                      <button
                        key={billboardId}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                          nightMode ? 'hover:bg-zinc-900/50' : 'hover:bg-primary/5'
                        }`}
                        onClick={() => {
                          if (onBillboardSelect) {
                            onBillboardSelect(item.billboard)
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isVisited
                              ? (nightMode ? 'bg-emerald-900/30' : 'bg-emerald-500/20')
                              : item.distance <= 100
                                ? (nightMode ? 'bg-amber-900/30' : 'bg-primary/20')
                                : (nightMode ? 'bg-zinc-800' : 'bg-muted')
                          }`}>
                            {isVisited ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <MapPin className={`w-4 h-4 ${
                                item.distance <= 100
                                  ? (nightMode ? 'text-amber-500' : 'text-primary')
                                  : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')
                              }`} />
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium truncate max-w-[150px] ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>
                              {billboardName}
                            </p>
                            <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                              {billboardSize}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-bold ${
                            item.distance <= 100
                              ? (nightMode ? 'text-amber-500' : 'text-primary')
                              : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')
                          }`}>
                            {formatDistance(item.distance)}
                          </p>
                          <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                            {item.direction}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export type { RoutePoint }
