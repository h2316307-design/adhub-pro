import { useMemo } from 'react'
import { Billboard } from '@/types'
import { MarkerData, MarkerIcon, MapPosition } from '@/types/map'

// Highly distinct colors for each size category - maximum contrast
const colorPalette = [
  { bg: "#dc2626", border: "#fca5a5", text: "#fff" },  // Bright Red
  { bg: "#2563eb", border: "#93c5fd", text: "#fff" },  // Royal Blue
  { bg: "#16a34a", border: "#86efac", text: "#fff" },  // Forest Green
  { bg: "#9333ea", border: "#d8b4fe", text: "#fff" },  // Vivid Purple
  { bg: "#ea580c", border: "#fdba74", text: "#fff" },  // Deep Orange
  { bg: "#0891b2", border: "#67e8f9", text: "#fff" },  // Ocean Cyan
  { bg: "#db2777", border: "#f9a8d4", text: "#fff" },  // Hot Pink
  { bg: "#ca8a04", border: "#fde047", text: "#fff" },  // Gold Yellow
  { bg: "#4f46e5", border: "#a5b4fc", text: "#fff" },  // Indigo
  { bg: "#059669", border: "#6ee7b7", text: "#fff" },  // Emerald
  { bg: "#7c3aed", border: "#c4b5fd", text: "#fff" },  // Violet
  { bg: "#0284c7", border: "#7dd3fc", text: "#fff" },  // Sky Blue
]

const sizeColorMap: Record<string, { bg: string, border: string, text: string }> = {}

export const getSizeColor = (size: string): { bg: string, border: string, text: string } => {
  if (!sizeColorMap[size]) {
    let hash = 0
    for (let i = 0; i < size.length; i++) {
      hash = size.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % colorPalette.length
    sizeColorMap[size] = colorPalette[index]
  }
  return sizeColorMap[size]
}

// Helper function to calculate days remaining
export const getDaysRemaining = (expiryDate: string | null): number | null => {
  if (!expiryDate) return null
  
  let parsedDate: Date | null = null
  
  if (expiryDate.includes('-') && expiryDate.length === 10 && expiryDate.indexOf('-') === 4) {
    const parts = expiryDate.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const day = parseInt(parts[2])
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        parsedDate = new Date(year, month, day)
      }
    }
  }
  
  if (!parsedDate) {
    const parts = expiryDate.split(/[/-]/)
    if (parts.length === 3) {
      const day = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const year = parseInt(parts[2])
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
        parsedDate = new Date(year, month, day)
      }
    }
  }
  
  if (!parsedDate || isNaN(parsedDate.getTime())) return null
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = parsedDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Format date for display
export const formatExpiryDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  let parsedDate: Date | null = null
  if (dateStr.includes('-') && dateStr.length === 10 && dateStr.indexOf('-') === 4) {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const day = parseInt(parts[2])
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        parsedDate = new Date(year, month, day)
      }
    }
  }
  if (!parsedDate) {
    const parts = dateStr.split(/[/-]/)
    if (parts.length === 3) {
      const day = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const year = parseInt(parts[2])
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
        parsedDate = new Date(year, month, day)
      }
    }
  }
  if (!parsedDate || isNaN(parsedDate.getTime())) return dateStr
  return parsedDate.toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Cache for pin icons
const pinIconCache: Record<string, { url: string, pinSize: number }> = {}

// Helper to darken/lighten colors
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

// Create clean modern pin SVG with pulse for available
export const createPinSvgUrl = (size: string, status: string, isSelected: boolean = false) => {
  const cacheKey = `${size}-${status}-${isSelected}-v4`
  if (pinIconCache[cacheKey]) return pinIconCache[cacheKey]
  
  const colors = getSizeColor(size)
  const isAvailable = status === "متاح"
  const isSoon = status === "قريباً"
  const statusColor = isAvailable ? "#22c55e" : isSoon ? "#eab308" : "#ef4444"
  
  const pinSize = isSelected ? 52 : 36
  const w = pinSize + 28
  const h = pinSize + 36
  const cx = w / 2
  const headR = pinSize / 2.3
  const uniqueId = cacheKey.replace(/[^a-zA-Z0-9]/g, '')
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="body${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${adjustColor(colors.bg, 50)}"/>
        <stop offset="50%" stop-color="${colors.bg}"/>
        <stop offset="100%" stop-color="${adjustColor(colors.bg, -40)}"/>
      </linearGradient>
      <filter id="shadow${uniqueId}" x="-50%" y="-30%" width="200%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
      <linearGradient id="shine${uniqueId}" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.7)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </linearGradient>
      <radialGradient id="glow${uniqueId}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${statusColor}"/>
        <stop offset="70%" stop-color="${adjustColor(statusColor, -20)}"/>
        <stop offset="100%" stop-color="${adjustColor(statusColor, -40)}"/>
      </radialGradient>
    </defs>
    
    <!-- Ground shadow -->
    <ellipse cx="${cx}" cy="${h - 4}" rx="${pinSize * 0.2}" ry="3" fill="rgba(0,0,0,0.2)"/>
    
    ${isAvailable ? `
    <!-- Pulse rings for available -->
    <circle cx="${cx}" cy="${headR + 10}" r="${headR + 4}" fill="none" stroke="${statusColor}" stroke-width="2" opacity="0.5">
      <animate attributeName="r" values="${headR};${headR + 12}" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${headR + 10}" r="${headR + 2}" fill="none" stroke="${statusColor}" stroke-width="1.5" opacity="0.3">
      <animate attributeName="r" values="${headR - 2};${headR + 8}" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
    </circle>
    ` : ''}
    
    <!-- Main pin -->
    <g filter="url(#shadow${uniqueId})">
      <!-- Pin body - clean teardrop -->
      <path d="M${cx},${h - 6} 
               C${cx - 3},${h - 14} ${cx - headR - 3},${headR + 18} ${cx - headR - 3},${headR + 10}
               A${headR + 3},${headR + 3} 0 1,1 ${cx + headR + 3},${headR + 10}
               C${cx + headR + 3},${headR + 18} ${cx + 3},${h - 14} ${cx},${h - 6}Z"
            fill="url(#body${uniqueId})" 
            stroke="${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.4)'}" 
            stroke-width="${isSelected ? 2.5 : 1}"/>
      
      <!-- Shine highlight -->
      <ellipse cx="${cx - headR * 0.35}" cy="${headR * 0.6 + 10}" rx="${headR * 0.4}" ry="${headR * 0.25}" 
               fill="url(#shine${uniqueId})" opacity="0.8"/>
      
      <!-- Inner circle background -->
      <circle cx="${cx}" cy="${headR + 10}" r="${headR * 0.7}" fill="#1a1a2e" opacity="0.3"/>
      
      <!-- Status indicator -->
      <circle cx="${cx}" cy="${headR + 10}" r="${headR * 0.55}" fill="url(#glow${uniqueId})"/>
      
      <!-- Inner white dot -->
      <circle cx="${cx}" cy="${headR + 10}" r="${headR * 0.2}" fill="rgba(255,255,255,0.95)"/>
    </g>
    
    ${isSelected ? `
    <!-- Selection indicator with rotation -->
    <circle cx="${cx}" cy="${headR + 10}" r="${headR + 8}" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="5,3" opacity="0.9">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${headR + 10}" to="360 ${cx} ${headR + 10}" dur="5s" repeatCount="indefinite"/>
    </circle>
    <!-- Golden checkmark badge -->
    <g>
      <circle cx="${cx + headR}" cy="${headR - 2}" r="10" fill="#fbbf24">
        <animate attributeName="r" values="10;12;10" dur="0.8s" repeatCount="indefinite"/>
      </circle>
      <path d="M${cx + headR - 4} ${headR - 2} l3 3 l5 -5" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ` : ''}
  </svg>`
  
  const result = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    pinSize
  }
  
  pinIconCache[cacheKey] = result
  return result
}

// Create marker icon
export const createMarkerIcon = (size: string, status: string, isSelected: boolean = false): MarkerIcon => {
  const { url, pinSize } = createPinSvgUrl(size, status, isSelected)
  const w = pinSize + 28
  const h = pinSize + 36
  
  return {
    url,
    size: { width: w, height: h },
    anchor: { x: w / 2, y: h - 4 },
    labelOrigin: { x: w / 2, y: h + 8 }
  }
}

// Parse billboard coordinates
export const parseBillboardCoordinates = (coordinates: string): MapPosition | null => {
  const coords = coordinates.split(",").map((coord) => Number.parseFloat(coord.trim()))
  if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return null
  return { lat: coords[0], lng: coords[1] }
}

// Hook to prepare marker data
export function useMapMarkers(
  billboards: Billboard[],
  selectedBillboards?: Set<string>
): MarkerData[] {
  return useMemo(() => {
    return billboards
      .map((billboard) => {
        const position = parseBillboardCoordinates(billboard.coordinates)
        if (!position) return null

        const isSelected = selectedBillboards?.has(billboard.id) || false
        const icon = createMarkerIcon(billboard.size, billboard.status, isSelected)

        return {
          id: billboard.id,
          position,
          title: billboard.name,
          icon,
          label: billboard.size,
          zIndex: isSelected ? 1000 : 1,
          data: billboard
        }
      })
      .filter((marker): marker is MarkerData => marker !== null)
  }, [billboards, selectedBillboards])
}

// Re-export compact popup from unified component
export { createCompactPopupContent as createInfoWindowContent } from '@/components/map/MapPopupContent'

// Modern cluster icon with gradient
export const clusterIconUrl = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
    <defs>
      <linearGradient id="clusterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#d4af37;stop-opacity:1"/>
        <stop offset="100%" style="stop-color:#b8860b;stop-opacity:1"/>
      </linearGradient>
      <filter id="clusterShadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
      </filter>
    </defs>
    <g filter="url(#clusterShadow)">
      <circle cx="25" cy="25" r="22" fill="url(#clusterGrad)"/>
      <circle cx="25" cy="25" r="17" fill="#1a1a2e"/>
      <circle cx="25" cy="25" r="17" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>
    </g>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
})()
