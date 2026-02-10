import { useState, useRef, useEffect, useCallback } from "react"
import { Search, MapPin, Navigation, X, Loader2, Locate, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchResult {
  id: string
  name: string
  displayName: string
  lat: number
  lng: number
  type: string
  boundingBox?: [number, number, number, number] // [south, north, west, east]
}

interface LocationBoundary {
  north: number
  south: number
  east: number
  west: number
}

interface MapSearchBarProps {
  onLocationSelect: (lat: number, lng: number, zoom?: number, boundary?: LocationBoundary, placeName?: string) => void
  onCurrentLocation?: (lat: number, lng: number) => void
  className?: string
}

// مناطق ليبيا الشائعة مع الإحداثيات والحدود
const LIBYA_LOCATIONS: SearchResult[] = [
  { id: 'tripoli', name: 'طرابلس', displayName: 'طرابلس - العاصمة', lat: 32.8872, lng: 13.1913, type: 'city', boundingBox: [32.75, 32.95, 13.05, 13.35] },
  { id: 'benghazi', name: 'بنغازي', displayName: 'بنغازي', lat: 32.1194, lng: 20.0686, type: 'city', boundingBox: [32.00, 32.25, 19.95, 20.20] },
  { id: 'misrata', name: 'مصراتة', displayName: 'مصراتة', lat: 32.3754, lng: 15.0925, type: 'city', boundingBox: [32.30, 32.45, 15.00, 15.20] },
  { id: 'ain-zara', name: 'عين زارة', displayName: 'عين زارة - طرابلس', lat: 32.8350, lng: 13.0800, type: 'district', boundingBox: [32.81, 32.86, 13.05, 13.12] },
  { id: 'andalus', name: 'حي الأندلس', displayName: 'حي الأندلس - طرابلس', lat: 32.8650, lng: 13.1400, type: 'district', boundingBox: [32.85, 32.88, 13.12, 13.16] },
  { id: 'hay-damascus', name: 'حي دمشق', displayName: 'حي دمشق - طرابلس', lat: 32.8900, lng: 13.1700, type: 'district', boundingBox: [32.88, 32.91, 13.15, 13.19] },
  { id: 'tajoura', name: 'تاجوراء', displayName: 'تاجوراء', lat: 32.8830, lng: 13.3500, type: 'district', boundingBox: [32.86, 32.92, 13.30, 13.42] },
  { id: 'janzour', name: 'جنزور', displayName: 'جنزور', lat: 32.8300, lng: 13.0100, type: 'district', boundingBox: [32.80, 32.86, 12.96, 13.05] },
  { id: 'souq-juma', name: 'سوق الجمعة', displayName: 'سوق الجمعة - طرابلس', lat: 32.9100, lng: 13.1200, type: 'district', boundingBox: [32.89, 32.93, 13.09, 13.15] },
  { id: 'hay-alislami', name: 'الحي الإسلامي', displayName: 'الحي الإسلامي - طرابلس', lat: 32.8800, lng: 13.2000, type: 'district', boundingBox: [32.86, 32.90, 13.18, 13.22] },
  { id: 'fashloum', name: 'فشلوم', displayName: 'فشلوم - طرابلس', lat: 32.8950, lng: 13.1850, type: 'district', boundingBox: [32.88, 32.91, 13.17, 13.20] },
  { id: 'abu-slim', name: 'أبو سليم', displayName: 'أبو سليم - طرابلس', lat: 32.8450, lng: 13.1500, type: 'district', boundingBox: [32.82, 32.87, 13.12, 13.18] },
  { id: 'gurji', name: 'القرجي', displayName: 'القرجي - طرابلس', lat: 32.8600, lng: 13.1600, type: 'district', boundingBox: [32.84, 32.88, 13.14, 13.18] },
  { id: 'alfornaj', name: 'الفرناج', displayName: 'الفرناج - طرابلس', lat: 32.8700, lng: 13.1300, type: 'district', boundingBox: [32.85, 32.89, 13.11, 13.15] },
  { id: 'zawiya', name: 'الزاوية', displayName: 'الزاوية', lat: 32.7571, lng: 12.7278, type: 'city', boundingBox: [32.72, 32.80, 12.68, 12.78] },
  { id: 'sabratha', name: 'صبراتة', displayName: 'صبراتة', lat: 32.7922, lng: 12.4842, type: 'city', boundingBox: [32.76, 32.82, 12.44, 12.54] },
  { id: 'khoms', name: 'الخمس', displayName: 'الخمس', lat: 32.6486, lng: 14.2619, type: 'city', boundingBox: [32.61, 32.69, 14.21, 14.32] },
  { id: 'zliten', name: 'زليتن', displayName: 'زليتن', lat: 32.4672, lng: 14.5686, type: 'city', boundingBox: [32.42, 32.52, 14.52, 14.62] },
  { id: 'gharyan', name: 'غريان', displayName: 'غريان', lat: 32.1722, lng: 13.0203, type: 'city', boundingBox: [32.13, 32.22, 12.97, 13.08] },
  { id: 'sirte', name: 'سرت', displayName: 'سرت', lat: 31.2089, lng: 16.5886, type: 'city', boundingBox: [31.15, 31.27, 16.52, 16.66] },
  { id: 'sebha', name: 'سبها', displayName: 'سبها', lat: 27.0377, lng: 14.4283, type: 'city', boundingBox: [26.98, 27.10, 14.36, 14.50] },
  { id: 'derna', name: 'درنة', displayName: 'درنة', lat: 32.7678, lng: 22.6369, type: 'city', boundingBox: [32.72, 32.82, 22.58, 22.70] },
  { id: 'tobruk', name: 'طبرق', displayName: 'طبرق', lat: 32.0836, lng: 23.9764, type: 'city', boundingBox: [32.03, 32.14, 23.91, 24.05] },
  { id: 'ajdabiya', name: 'أجدابيا', displayName: 'أجدابيا', lat: 30.7554, lng: 20.2263, type: 'city', boundingBox: [30.70, 30.82, 20.16, 20.30] },
  { id: 'green-square', name: 'الساحة الخضراء', displayName: 'الساحة الخضراء - طرابلس', lat: 32.8973, lng: 13.1797, type: 'landmark', boundingBox: [32.895, 32.900, 13.175, 13.185] },
  { id: 'airport-road', name: 'طريق المطار', displayName: 'طريق المطار - طرابلس', lat: 32.8600, lng: 13.2800, type: 'road', boundingBox: [32.82, 32.90, 13.22, 13.35] },
  { id: 'coastal-road', name: 'الطريق الساحلي', displayName: 'الطريق الساحلي', lat: 32.8900, lng: 13.2500, type: 'road', boundingBox: [32.87, 32.92, 13.10, 13.40] },
  { id: 'gargaresh', name: 'قرقارش', displayName: 'قرقارش - طرابلس', lat: 32.8400, lng: 13.0400, type: 'district', boundingBox: [32.82, 32.86, 13.01, 13.07] },
  { id: 'ben-ashour', name: 'بن عاشور', displayName: 'بن عاشور - طرابلس', lat: 32.8850, lng: 13.1550, type: 'district', boundingBox: [32.87, 32.90, 13.13, 13.18] },
  { id: 'zawiyat-dahmani', name: 'زاوية الدهماني', displayName: 'زاوية الدهماني - طرابلس', lat: 32.8750, lng: 13.1450, type: 'district', boundingBox: [32.86, 32.89, 13.12, 13.17] },
  { id: 'salah-din', name: 'صلاح الدين', displayName: 'صلاح الدين - طرابلس', lat: 32.8550, lng: 13.1250, type: 'district', boundingBox: [32.84, 32.87, 13.10, 13.15] },
  { id: 'hay-akwakh', name: 'حي الأكواخ', displayName: 'حي الأكواخ - طرابلس', lat: 32.8720, lng: 13.1680, type: 'district', boundingBox: [32.86, 32.89, 13.15, 13.19] },
  { id: 'alfallah', name: 'الفلاح', displayName: 'الفلاح - طرابلس', lat: 32.8480, lng: 13.1380, type: 'district', boundingBox: [32.83, 32.87, 13.11, 13.17] },
  { id: 'suani', name: 'السواني', displayName: 'السواني - طرابلس', lat: 32.7950, lng: 13.0150, type: 'district', boundingBox: [32.77, 32.82, 12.98, 13.05] },
]

// مرادفات للبحث الذكي
const SEARCH_SYNONYMS: Record<string, string[]> = {
  'وسط البلد': ['المدينة القديمة', 'السوق', 'الساحة الخضراء', 'المركز'],
  'المطار': ['طريق المطار', 'مطار طرابلس', 'معيتيقة'],
  'البحر': ['الكورنيش', 'الطريق الساحلي', 'شاطئ'],
  'الجامعة': ['جامعة طرابلس', 'كلية'],
}

export default function MapSearchBar({ onLocationSelect, onCurrentLocation, className = "" }: MapSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // البحث الذكي في المناطق المحلية
  const searchLocally = useCallback((query: string): SearchResult[] => {
    if (!query.trim()) return []
    
    const normalizedQuery = query.toLowerCase().trim()
    const arabicQuery = query.trim()
    
    // البحث عن مرادفات
    let expandedQueries = [normalizedQuery, arabicQuery]
    Object.entries(SEARCH_SYNONYMS).forEach(([key, synonyms]) => {
      if (synonyms.some(s => s.includes(arabicQuery) || arabicQuery.includes(s))) {
        expandedQueries.push(key.toLowerCase())
      }
      if (key.includes(arabicQuery)) {
        expandedQueries.push(...synonyms.map(s => s.toLowerCase()))
      }
    })
    
    // حساب درجة التطابق
    const scoredResults = LIBYA_LOCATIONS.map(location => {
      let score = 0
      const locationName = location.name.toLowerCase()
      const displayName = location.displayName.toLowerCase()
      const locationId = location.id.toLowerCase()
      
      expandedQueries.forEach(q => {
        // تطابق تام
        if (locationName === q || location.name === arabicQuery) score += 100
        // يبدأ بالبحث
        else if (locationName.startsWith(q) || location.name.startsWith(arabicQuery)) score += 80
        // يحتوي على البحث
        else if (locationName.includes(q) || location.name.includes(arabicQuery)) score += 60
        // البحث في الاسم الكامل
        else if (displayName.includes(q) || location.displayName.includes(arabicQuery)) score += 40
        // البحث بالإنجليزية
        else if (locationId.includes(q)) score += 30
      })
      
      return { ...location, score }
    })
    
    return scoredResults
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [])

  // البحث في Nominatim API للمواقع غير المعروفة
  const searchOnline = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + " ليبيا Libya")}&limit=8&accept-language=ar&addressdetails=1&extratags=1`
      )
      const data = await response.json()
      
      return data.map((item: any, index: number) => ({
        id: `online-${index}`,
        name: item.display_name.split(',')[0],
        displayName: item.display_name.split(',').slice(0, 3).join('، '),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || item.class || 'place',
        boundingBox: item.boundingbox ? [
          parseFloat(item.boundingbox[0]),
          parseFloat(item.boundingbox[1]),
          parseFloat(item.boundingbox[2]),
          parseFloat(item.boundingbox[3])
        ] as [number, number, number, number] : undefined
      }))
    } catch (error) {
      console.error('Search error:', error)
      return []
    }
  }, [])

  // تنفيذ البحث
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    
    // البحث المحلي أولاً
    const localResults = searchLocally(query)
    
    if (localResults.length >= 3) {
      setResults(localResults)
      setIsOpen(true)
      setIsLoading(false)
    } else {
      // البحث عبر الإنترنت إذا لم يتم العثور على نتائج كافية محلياً
      const onlineResults = await searchOnline(query)
      const combinedResults = [...localResults, ...onlineResults.filter(
        online => !localResults.some(local => 
          Math.abs(local.lat - online.lat) < 0.01 && Math.abs(local.lng - online.lng) < 0.01
        )
      )].slice(0, 10)
      
      setResults(combinedResults)
      setIsOpen(combinedResults.length > 0)
      setIsLoading(false)
    }
    
    setSelectedIndex(-1)
  }, [searchLocally, searchOnline])

  // مراقبة تغيير البحث
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 250)
    
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  // التعامل مع اختيار نتيجة
  const handleResultSelect = (result: SearchResult) => {
    setSearchQuery(result.name)
    setIsOpen(false)
    
    // تحديد مستوى التكبير والحدود
    let zoom = 14
    let boundary: LocationBoundary
    
    if (result.boundingBox) {
      const [south, north, west, east] = result.boundingBox
      boundary = { north, south, east, west }
      // حساب الزوم المناسب بناءً على حجم المنطقة
      const latDiff = north - south
      const lngDiff = east - west
      const maxDiff = Math.max(latDiff, lngDiff)
      if (maxDiff > 0.1) zoom = 12
      else if (maxDiff > 0.05) zoom = 13
      else if (maxDiff > 0.02) zoom = 14
      else if (maxDiff > 0.01) zoom = 15
      else zoom = 16
    } else {
      // حدود افتراضية بناءً على النوع
      let boundaryRadius = 0.02
      if (result.type === 'city') {
        zoom = 12
        boundaryRadius = 0.06
      } else if (result.type === 'district') {
        zoom = 15
        boundaryRadius = 0.02
      } else if (result.type === 'landmark' || result.type === 'road') {
        zoom = 16
        boundaryRadius = 0.01
      }
      
      boundary = {
        north: result.lat + boundaryRadius,
        south: result.lat - boundaryRadius,
        east: result.lng + boundaryRadius * 1.3,
        west: result.lng - boundaryRadius * 1.3
      }
    }
    
    onLocationSelect(result.lat, result.lng, zoom, boundary, result.name)
  }

  // تحديد الموقع الحالي
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('المتصفح لا يدعم تحديد الموقع')
      return
    }
    
    setIsLocating(true)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setIsLocating(false)
        
        if (onCurrentLocation) {
          onCurrentLocation(latitude, longitude)
        }
        
        // التوجيه للموقع الحالي
        onLocationSelect(latitude, longitude, 16, {
          north: latitude + 0.005,
          south: latitude - 0.005,
          east: longitude + 0.007,
          west: longitude - 0.007
        }, 'موقعي الحالي')
      },
      (error) => {
        setIsLocating(false)
        console.error('Geolocation error:', error)
        if (error.code === 1) {
          alert('تم رفض إذن الموقع. يرجى السماح بالوصول للموقع من إعدادات المتصفح.')
        } else {
          alert('تعذر تحديد الموقع. تأكد من تفعيل GPS.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [onLocationSelect, onCurrentLocation])

  // التعامل مع لوحة المفاتيح
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleResultSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'city': return '🏙️'
      case 'district': return '📍'
      case 'landmark': return '🏛️'
      case 'road': return '🛣️'
      case 'building': return '🏢'
      case 'amenity': return '🏪'
      default: return '📌'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'city': return 'مدينة'
      case 'district': return 'حي'
      case 'landmark': return 'معلم'
      case 'road': return 'طريق'
      default: return 'موقع'
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* زر تحديد الموقع الحالي */}
        <Button
          size="icon"
          variant="secondary"
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-card/95 backdrop-blur-md border border-border/60 shadow-lg hover:bg-primary hover:text-primary-foreground transition-all duration-300 flex-shrink-0"
          onClick={handleLocateMe}
          disabled={isLocating}
          title="موقعي الحالي"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          ) : (
            <Locate className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </Button>
        
        {/* شريط البحث - مضغوط على الموبايل */}
        <div className="relative group flex-1 min-w-0">
          {/* Glow effect - مخفي على الموبايل */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40 rounded-lg sm:rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 hidden sm:block" />
          
          <div className="relative flex items-center">
            <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10">
              {isLoading ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-spin" />
              ) : (
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              )}
            </div>
            
            <Input
              ref={inputRef}
              type="text"
              placeholder="ابحث عن..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => searchQuery && results.length > 0 && setIsOpen(true)}
              className="pr-8 sm:pr-11 pl-7 sm:pl-10 text-right bg-card/95 backdrop-blur-md border border-border/60 focus:border-primary rounded-lg sm:rounded-xl py-2 sm:py-3 text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground shadow-lg transition-all duration-300"
            />
            
            {searchQuery && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 rounded-md sm:rounded-lg hover:bg-destructive/20"
                onClick={() => {
                  setSearchQuery("")
                  setResults([])
                  setIsOpen(false)
                  inputRef.current?.focus()
                }}
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* نتائج البحث */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full right-0 left-0 mt-2 bg-card/98 backdrop-blur-xl rounded-xl border border-border/60 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 max-h-[320px] overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => handleResultSelect(result)}
                className={`w-full text-right p-3 rounded-lg flex items-center gap-3 transition-all duration-200 ${
                  selectedIndex === index
                    ? 'bg-primary/20 text-foreground'
                    : 'hover:bg-muted/60 text-foreground/90'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  selectedIndex === index 
                    ? 'bg-primary/30' 
                    : 'bg-muted/50'
                }`}>
                  {getTypeIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{result.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {getTypeLabel(result.type)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{result.displayName}</p>
                </div>
                <Navigation className="w-4 h-4 text-primary/60 flex-shrink-0" />
              </button>
            ))}
          </div>
          
          <div className="px-3 py-2 bg-muted/30 border-t border-border/30 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              استخدم ↑↓ للتنقل و Enter للاختيار
            </p>
            <a 
              href={`https://www.google.com/maps/search/${encodeURIComponent(searchQuery + ' Libya')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              البحث في Google Maps
            </a>
          </div>
        </div>
      )}

      {/* رسالة عدم وجود نتائج */}
      {isOpen && !isLoading && results.length === 0 && searchQuery.length > 2 && (
        <div className="absolute top-full right-0 left-0 mt-2 bg-card/98 backdrop-blur-xl rounded-xl border border-border/60 shadow-2xl overflow-hidden z-50 p-4">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد نتائج لـ "{searchQuery}"</p>
            <p className="text-xs text-muted-foreground/70 mt-1">جرب البحث باسم آخر</p>
            <a 
              href={`https://www.google.com/maps/search/${encodeURIComponent(searchQuery + ' Libya')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              البحث في Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
