import { useMemo } from 'react'
import { Billboard } from '@/types'
import { MarkerData, MarkerIcon, MapPosition } from '@/types/map'
import DOMPurify from 'dompurify'

// Helper function to escape HTML entities for safe rendering
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Highly distinct colors for each size category - ordered for maximum contrast
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
let sizeOrderLoaded = false
let initPromise: Promise<void> | null = null

// Initialize size colors from database sort_order
export const initSizeColorsFromDB = async () => {
  if (sizeOrderLoaded) return
  if (initPromise) return initPromise
  
  initPromise = (async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order', { ascending: true })
      
      if (!error && data) {
        // Clear existing maps and caches
        Object.keys(sizeColorMap).forEach(k => delete sizeColorMap[k])
        // Assign colors in order of sort_order
        data.forEach((size: any, index: number) => {
          sizeColorMap[size.name] = colorPalette[index % colorPalette.length]
        })
        sizeOrderLoaded = true
        console.log('✅ Size colors initialized from DB order:', Object.keys(sizeColorMap))
      }
    } catch (err) {
      console.error('Failed to load size colors from DB:', err)
    }
  })()
  
  return initPromise
}

// Also allow setting colors directly from already-loaded size data
export const setSizeColorsFromData = (sizes: { name: string; sort_order: number }[]) => {
  Object.keys(sizeColorMap).forEach(k => delete sizeColorMap[k])
  const sorted = [...sizes].sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999))
  sorted.forEach((size, index) => {
    sizeColorMap[size.name] = colorPalette[index % colorPalette.length]
  })
  sizeOrderLoaded = true
}

// Call on module load
initSizeColorsFromDB()

export const getSizeColor = (size: string): { bg: string, border: string, text: string } => {
  if (sizeColorMap[size]) return sizeColorMap[size]
  // Fallback: hash-based for sizes not in DB
  let hash = 0
  for (let i = 0; i < size.length; i++) {
    hash = size.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colorPalette.length
  sizeColorMap[size] = colorPalette[index]
  return sizeColorMap[size]
}

// Get billboard status info with all status types
export function getBillboardStatus(billboard: any): { color: string; label: string } {
  const status = String(billboard.Status || billboard.status || '').trim().toLowerCase()
  const maintenanceStatus = String(billboard.maintenance_status || '').trim()
  const maintenanceType = String(billboard.maintenance_type || '').trim()
  const customerName = billboard.Customer_Name || billboard.customer_name
  const contractNumber = billboard.Contract_Number || billboard.contract_number
  const rentEndDate = billboard.Rent_End_Date || billboard.rent_end_date
  const rentStartDate = billboard.Rent_Start_Date || billboard.rent_start_date
  
  // إزالة / removed
  if (status === 'إزالة' || status === 'ازالة' || status === 'removed' || 
      maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' ||
      maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
      maintenanceType === 'تمت الإزالة' || maintenanceType === 'تحتاج إزالة' || maintenanceType === 'لم يتم التركيب') {
    return { color: '#808080', label: 'إزالة' }
  }
  
  // صيانة
  if (status === 'صيانة' || maintenanceStatus === 'maintenance' || maintenanceStatus === 'قيد الصيانة') {
    return { color: '#f97316', label: 'صيانة' }
  }
  
  // تحتاج صيانة
  if (maintenanceStatus === 'repair_needed' || maintenanceStatus === 'تحتاج إصلاح' || 
      maintenanceStatus === 'متضررة اللوحة') {
    return { color: '#eab308', label: 'تحتاج صيانة' }
  }
  
  // خارج الخدمة
  if (maintenanceStatus === 'out_of_service' || maintenanceStatus === 'خارج الخدمة') {
    return { color: '#4b5563', label: 'خارج الخدمة' }
  }
  
  // Rental/Reservation detection (for map pins)
  const hasCustomer = !!(customerName && String(customerName).trim())
  const hasContract = !!(contractNumber && Number(contractNumber) > 0)
  const hasRentalData = hasCustomer || hasContract

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const parseDate = (value: any): Date | null => {
    if (!value) return null
    const d = new Date(value)
    if (isNaN(d.getTime())) return null
    d.setHours(0, 0, 0, 0)
    return d
  }

  const start = parseDate(rentStartDate)
  const end = parseDate(rentEndDate)
  const isExpired = !!(end && end < today)
  const isFutureStart = !!(start && start > today)

  // If rental has expired, it's available
  if (hasRentalData && isExpired) {
    return { color: '#22c55e', label: 'متاحة' }
  }

  // Explicit reserved status - RESERVED (orange)
  if (status === 'محجوز' || status === 'محجوزة' || status === 'reserved') {
    return { color: '#f59e0b', label: 'محجوزة' }
  }

  // Explicit rented status - RENTED (red)
  if (status === 'مؤجر' || status === 'مؤجرة' || status === 'rented') {
    return { color: '#ef4444', label: 'مؤجرة' }
  }

  // If we have contract/customer info but no explicit status:
  if (hasRentalData) {
    // Contract exists but hasn't started yet
    if (isFutureStart) {
      return { color: '#f59e0b', label: 'محجوزة' }
    }

    // If we only have a contract number with no customer name, treat as reserved
    if (hasContract && !hasCustomer) {
      return { color: '#f59e0b', label: 'محجوزة' }
    }

    // Otherwise treat as rented (active or unknown dates)
    return { color: '#ef4444', label: 'مؤجرة' }
  }
  
  // متاحة - Available (green)
  return { color: '#22c55e', label: 'متاحة' }
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
const pinIconCache: Record<string, { url: string, pinSize: number, labelOffset: number }> = {}

// Helper to darken/lighten colors
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

// Shorten size text for display
function shortenSize(size: string): string {
  if (!size) return ''
  const clean = size.replace(/\s+/g, '')
  if (clean.length <= 7) return clean
  if (clean.includes('x') || clean.includes('×')) return clean
  return clean.substring(0, 6)
}

// Shorten customer name
function shortenCustomer(name: string): string {
  if (!name) return ''
  const words = name.trim().split(/\s+/)
  const first = words[0] || ''
  return first.length > 8 ? first.substring(0, 7) + '..' : first
}

// Determine billboard physical type from size (kept for compatibility)
export type BillboardShapeType = 'tower' | 'standard' | 'tpole'

export function getBillboardShapeType(size: string, adType?: string, billboardType?: string): BillboardShapeType {
  const bt = (billboardType || '').trim()
  if (bt === 'تيبول' || bt.toLowerCase() === 'tpole' || bt.toLowerCase() === 't-pole') return 'tpole'
  if (bt === 'عادية' || bt.toLowerCase() === 'standard') return 'standard'
  if (bt === 'برجية' || bt.toLowerCase() === 'tower') return 'tower'
  const s = (size || '').toLowerCase().replace(/\s+/g, '').replace('×', 'x')
  const parts = s.replace('-t', '').split('x').map(Number).filter(n => !isNaN(n))
  const normalized = parts.length === 2 ? `${Math.min(parts[0], parts[1])}x${Math.max(parts[0], parts[1])}` : s
  if (s.includes('-t') || normalized === '4x10' || normalized === '4x12' || normalized === '5x13') return 'tpole'
  if (normalized === '3x4' || normalized === '2.5x4') {
    const t = (adType || '').trim()
    if (t === 'العادية' || t === 'عادية' || t.toLowerCase() === 'standard') return 'standard'
    return 'tower'
  }
  if (normalized === '3x6' || normalized === '3x8' || normalized === '3x5') return 'tower'
  return 'tower'
}

// Hex to RGB helper
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const num = parseInt(hex.replace('#', ''), 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

// Create 3D teardrop pin SVG
export const createPinSvgUrl = (size: string, status: string, isSelected: boolean = false, adType?: string, customerName?: string, overrideColor?: string, overrideTextColor?: string, billboardType?: string) => {
  const cacheKey = `${size}-${status}-${isSelected}-${adType || ''}-${customerName || ''}-${overrideColor || ''}-${overrideTextColor || ''}-${billboardType || ''}-v21-3d`
  if (pinIconCache[cacheKey]) return pinIconCache[cacheKey]
  
  const baseColors = getSizeColor(size)
  const colors = overrideColor ? { bg: overrideColor, border: baseColors.border, text: overrideTextColor || '#fff' } : { ...baseColors, text: overrideTextColor || baseColors.text }
  const isAvailable = status === "متاحة" || status === "متاح"
  const isSoon = status === "قريباً" || status === "محجوزة"
  const isRemoved = status === "إزالة"
  const isMaintenance = status === "صيانة" || status === "تحتاج صيانة"
  const statusColor = isAvailable ? "#22c55e" : isSoon ? "#f59e0b" : isRemoved ? "#6b7280" : isMaintenance ? "#f97316" : "#ef4444"
  const statusGlow = isAvailable ? "0,255,106" : isSoon ? "245,158,11" : isRemoved ? "107,114,128" : isMaintenance ? "249,115,22" : "239,68,68"
  
  const pinH = isSelected ? 62 : 48
  const pinW = isSelected ? 42 : 32
  const labelH = 20
  const customerH = customerName ? 18 : 0
  const w = pinW + 32
  const h = pinH + labelH + customerH + 12
  const cx = w / 2
  const uid = cacheKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
  const rgb = hexToRgb(colors.bg)
  
  const shortSize = shortenSize(size)
  const shortCustomer = shortenCustomer(customerName || '')
  
  // 3D teardrop pin with glassmorphism
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <!-- Main body gradient - 3D effect -->
      <linearGradient id="b${uid}" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stop-color="${adjustColor(colors.bg, 80)}"/>
        <stop offset="35%" stop-color="${colors.bg}"/>
        <stop offset="70%" stop-color="${adjustColor(colors.bg, -30)}"/>
        <stop offset="100%" stop-color="${adjustColor(colors.bg, -70)}"/>
      </linearGradient>
      <!-- Specular highlight -->
      <radialGradient id="h${uid}" cx="35%" cy="25%" r="50%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.65)"/>
        <stop offset="60%" stop-color="rgba(255,255,255,0.1)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <!-- Status glow -->
      <radialGradient id="g${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${statusColor}" stop-opacity="1"/>
        <stop offset="60%" stop-color="${adjustColor(statusColor, -20)}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${adjustColor(statusColor, -50)}" stop-opacity="0.7"/>
      </radialGradient>
      <!-- Drop shadow -->
      <filter id="s${uid}" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/>
      </filter>
      <!-- Inner shadow for depth -->
      <filter id="is${uid}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.6)"/>
      </filter>
      <!-- Glass edge glow -->
      <filter id="eg${uid}" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="1" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>
    
    <!-- Size label badge -->
    <g>
      <rect x="${cx - 30}" y="0" width="60" height="20" rx="10" fill="#000000" stroke="rgba(255,255,255,0.7)" stroke-width="1.2"/>
      <rect x="${cx - 30}" y="0" width="60" height="10" rx="10" fill="rgba(255,255,255,0.1)"/>
      <text x="${cx}" y="14.5" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="13" font-weight="800" fill="#ffffff" style="text-shadow: 0 1px 3px rgba(0,0,0,0.5);" letter-spacing="0.5">${shortSize}</text>
    </g>
    
    <!-- Ground shadow ellipse - tight at pin tip -->
    <ellipse cx="${cx}" cy="${labelH + pinH - 1}" rx="${pinW * 0.14}" ry="1.2" fill="rgba(0,0,0,0.25)">
      ${isSelected ? '<animate attributeName="rx" values="' + (pinW * 0.14) + ';' + (pinW * 0.2) + ';' + (pinW * 0.14) + '" dur="2s" repeatCount="indefinite"/>' : ''}
    </ellipse>
    
    ${isAvailable ? `
    <!-- Pulse rings for available -->
    <circle cx="${cx}" cy="${labelH + pinH * 0.38}" r="${pinW * 0.45}" fill="none" stroke="rgba(${statusGlow},0.5)" stroke-width="2">
      <animate attributeName="r" values="${pinW * 0.4};${pinW * 0.8}" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${labelH + pinH * 0.38}" r="${pinW * 0.35}" fill="none" stroke="rgba(${statusGlow},0.3)" stroke-width="1.5">
      <animate attributeName="r" values="${pinW * 0.3};${pinW * 0.65}" dur="1.8s" begin="0.6s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.4;0" dur="1.8s" begin="0.6s" repeatCount="indefinite"/>
    </circle>
    ` : ''}
    
    <!-- Main 3D teardrop -->
    <g filter="url(#s${uid})">
      <!-- Teardrop body -->
      <path d="M${cx},${labelH + pinH - 2}
               C${cx - 2},${labelH + pinH - 10} ${cx - pinW / 2 - 1},${labelH + pinH * 0.55} ${cx - pinW / 2 - 1},${labelH + pinH * 0.38}
               A${pinW / 2 + 1},${pinW / 2 + 1} 0 1,1 ${cx + pinW / 2 + 1},${labelH + pinH * 0.38}
               C${cx + pinW / 2 + 1},${labelH + pinH * 0.55} ${cx + 2},${labelH + pinH - 10} ${cx},${labelH + pinH - 2}Z"
            fill="url(#b${uid})" 
            stroke="${isSelected ? '#fbbf24' : `rgba(255,255,255,0.45)`}" 
            stroke-width="${isSelected ? 2.5 : 1}"/>
      
      <!-- 3D specular highlight -->
      <path d="M${cx},${labelH + pinH - 2}
               C${cx - 2},${labelH + pinH - 10} ${cx - pinW / 2 - 1},${labelH + pinH * 0.55} ${cx - pinW / 2 - 1},${labelH + pinH * 0.38}
               A${pinW / 2 + 1},${pinW / 2 + 1} 0 1,1 ${cx + pinW / 2 + 1},${labelH + pinH * 0.38}
               C${cx + pinW / 2 + 1},${labelH + pinH * 0.55} ${cx + 2},${labelH + pinH - 10} ${cx},${labelH + pinH - 2}Z"
            fill="url(#h${uid})" opacity="0.7"/>
      
      <!-- Inner dark circle (glass depth) -->
      <circle cx="${cx}" cy="${labelH + pinH * 0.38}" r="${pinW * 0.32}" fill="rgba(10,10,25,0.5)" filter="url(#is${uid})"/>
      
      <!-- Status indicator circle -->
      <circle cx="${cx}" cy="${labelH + pinH * 0.38}" r="${pinW * 0.25}" fill="url(#g${uid})">
        ${isAvailable ? `<animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite"/>` : ''}
      </circle>
      
      <!-- Glass reflection on status circle -->
      <ellipse cx="${cx - pinW * 0.06}" cy="${labelH + pinH * 0.33}" rx="${pinW * 0.12}" ry="${pinW * 0.08}" fill="rgba(255,255,255,0.5)" transform="rotate(-15 ${cx} ${labelH + pinH * 0.33})"/>
      
      <!-- Inner bright dot -->
      <circle cx="${cx}" cy="${labelH + pinH * 0.38}" r="${pinW * 0.08}" fill="rgba(255,255,255,0.9)"/>
      
      <!-- Bottom edge highlight -->
      <path d="M${cx - pinW * 0.15},${labelH + pinH * 0.7} Q${cx},${labelH + pinH * 0.78} ${cx + pinW * 0.15},${labelH + pinH * 0.7}" 
            fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-linecap="round"/>
    </g>
    
    ${shortCustomer ? `
    <!-- Customer name badge -->
    <g>
      <rect x="${cx - 30}" y="${h - 16}" width="60" height="14" rx="7" fill="rgba(20,20,40,0.92)" stroke="rgba(${statusGlow},0.4)" stroke-width="0.7"/>
      <text x="${cx}" y="${h - 6}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="8.5" font-weight="600" fill="#fbbf24">${shortCustomer}</text>
    </g>
    ` : ''}
    
    ${isSelected ? `
    <!-- Selection ring -->
    <circle cx="${cx}" cy="${labelH + pinH * 0.38}" r="${pinW * 0.48}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="5,3" opacity="0.9">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${labelH + pinH * 0.38}" to="360 ${cx} ${labelH + pinH * 0.38}" dur="4s" repeatCount="indefinite"/>
    </circle>
    <!-- Check badge -->
    <circle cx="${cx + pinW * 0.4}" cy="${labelH + 4}" r="9" fill="#fbbf24" stroke="#fff" stroke-width="1.5">
      <animate attributeName="r" values="9;10.5;9" dur="1s" repeatCount="indefinite"/>
    </circle>
    <path d="M${cx + pinW * 0.4 - 3.5} ${labelH + 4} l2.5 3 l5 -5.5" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ` : ''}
  </svg>`
  
  const result = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    pinSize: pinH,
    labelOffset: labelH
  }
  
  pinIconCache[cacheKey] = result
  return result
}

// Create marker icon for Google Maps
export const createMarkerIcon = (size: string, status: string, isSelected: boolean = false, adType?: string, customerName?: string): MarkerIcon => {
  const { url, pinSize, labelOffset } = createPinSvgUrl(size, status, isSelected, adType, customerName)
  const customerHeight = customerName ? 18 : 0
  const pinW = isSelected ? 42 : 32
  const w = pinW + 32
  const h = pinSize + 20 + customerHeight + 12
  // anchorY should point to pin tip: labelH(20) + pinH - 2
  const pinTipY = labelOffset + pinSize - 2
  
  return {
    url,
    size: { width: w, height: h },
    anchor: { x: w / 2, y: pinTipY },
    labelOrigin: { x: w / 2, y: h + 8 }
  }
}

// Get ad type color for card accent
function getAdTypeColor(adType: string): { bg: string; border: string; text: string } {
  const type = (adType || '').toLowerCase()
  if (type.includes('تجاري') || type.includes('commercial')) return { bg: '#3b82f6', border: '#60a5fa', text: '#fff' }
  if (type.includes('سياسي') || type.includes('political')) return { bg: '#ef4444', border: '#f87171', text: '#fff' }
  if (type.includes('حكوم') || type.includes('government')) return { bg: '#22c55e', border: '#4ade80', text: '#fff' }
  if (type.includes('خيري') || type.includes('charity')) return { bg: '#8b5cf6', border: '#a78bfa', text: '#fff' }
  if (type.includes('رياض') || type.includes('sport')) return { bg: '#f97316', border: '#fb923c', text: '#fff' }
  if (type.includes('طب') || type.includes('medical')) return { bg: '#06b6d4', border: '#22d3ee', text: '#fff' }
  return { bg: '#d4af37', border: '#fbbf24', text: '#1a1a2e' }
}

// Create horizontal popup content for info windows - Dark theme with both designs - NO EMOJIS
export function createCompactPopupContent(billboard: any): string {
  const status = getBillboardStatus(billboard)
  const daysRemaining = getDaysRemaining(billboard.Rent_End_Date || billboard.expiryDate)
  const sizeColor = getSizeColor(billboard.Size || billboard.size || '')
  const statusColor = status.color
  const statusBg = status.label === 'متاحة' ? 'rgba(34,197,94,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
  
  // Sanitize all user-provided data to prevent XSS
  const name = escapeHtml(billboard.Billboard_Name || billboard.name || `لوحة ${billboard.ID || billboard.id}`)
  const location = escapeHtml(billboard.Nearest_Landmark || billboard.location || '')
  const city = escapeHtml(billboard.City || billboard.city || '')
  const district = escapeHtml(billboard.District || billboard.district || '')
  const municipality = escapeHtml(billboard.Municipality || billboard.municipality || '')
  const size = escapeHtml(billboard.Size || billboard.size || '')
  const imageUrl = encodeURI(billboard.Image_URL || billboard.imageUrl || '')
  const customerName = escapeHtml(billboard.Customer_Name || billboard.customer_name || '')
  const adType = escapeHtml(billboard.Ad_Type || billboard.ad_type || '')
  const gpsCoords = billboard.GPS_Coordinates || billboard.coordinates || ''
  const isRented = status.label === 'مؤجرة' || status.label === 'محجوزة'
  
  // Design images - both faces
  const designFaceA = encodeURI(billboard.design_face_a || '')
  const designFaceB = encodeURI(billboard.design_face_b || '')
  const hasDesigns = !!(designFaceA || designFaceB)
  
  // Ad type color for accent
  const adTypeColor = getAdTypeColor(billboard.Ad_Type || billboard.ad_type || '')
  const cardAccent = isRented && adType ? adTypeColor.bg : '#d4af37'
  
  const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : []
  const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])
  const googleMapsUrl = hasValidCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
    : '#'

  // ✅ Compact vertical card with design faces
  return `
    <div style="
      font-family: 'Tajawal', sans-serif; direction: rtl; width: 240px; max-width: 85vw;
      background: linear-gradient(145deg, rgba(26,26,46,0.97), rgba(18,18,32,0.97));
      border-radius: 10px; overflow: hidden; 
      border: 1px solid ${cardAccent}44;
      box-shadow: 0 8px 24px -4px rgba(0,0,0,0.5);
    ">
      <!-- Image -->
      <div style="position: relative; height: 85px; overflow: hidden; cursor: pointer;"
           onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${imageUrl || '/roadside-billboard.png'}'}))">
        <img src="${imageUrl || '/roadside-billboard.png'}" alt="${name}" 
             style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/roadside-billboard.png'" />
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, rgba(26,26,46,0.85) 100%);"></div>
        <div style="position: absolute; top: 4px; right: 4px; background: ${sizeColor.bg}; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; color: ${sizeColor.text};">${size}</div>
        <div style="position: absolute; top: 4px; left: 4px; display: flex; gap: 3px; flex-direction: column; align-items: flex-start;">
          <div style="background: ${statusBg}; padding: 1px 6px; border-radius: 6px; font-size: 9px; font-weight: 700; color: ${statusColor}; display: flex; align-items: center; gap: 3px;">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: ${statusColor};"></span>${status.label}
          </div>
          ${billboard.is_visible_in_available === false ? `
            <div style="background: rgba(107,114,128,0.9); padding: 1px 6px; border-radius: 6px; font-size: 8px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 2px;">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              مخفية
            </div>
          ` : ''}
        </div>
      </div>
      
      <div style="padding: 8px;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <h3 style="font-weight: 700; font-size: 12px; color: #fff; margin: 0; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${name}</h3>
          <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${name.replace(/'/g, "\\'")}'); this.innerHTML='<svg width=\\'10\\' height=\\'10\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#22c55e\\' stroke-width=\\'2.5\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg>'; setTimeout(() => this.innerHTML='<svg width=\\'10\\' height=\\'10\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'/><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'/></svg>', 1500)" style="background: rgba(255,255,255,0.1); border: none; border-radius: 4px; padding: 3px; cursor: pointer; color: #999; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="نسخ اسم اللوحة">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
        
        ${isRented && customerName ? `
          <div style="display: flex; align-items: center; gap: 3px; margin-bottom: 4px; padding: 2px 6px; background: rgba(239,68,68,0.1); border-radius: 5px; border: 1px solid rgba(239,68,68,0.2);">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style="font-size: 9px; color: #fca5a5; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${customerName}</span>
          </div>
        ` : ''}
        
        <!-- Design Faces Section -->
        ${hasDesigns ? `
          <div style="padding: 5px; background: rgba(236,72,153,0.08); border-radius: 7px; border: 1px solid rgba(236,72,153,0.2); margin-bottom: 5px;">
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 5px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style="font-size: 9px; color: #ec4899; font-weight: 700;">التصاميم</span>
            </div>
            <div style="display: flex; gap: 4px;">
              ${designFaceA ? `
                <div style="flex: 1; cursor: pointer;" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceA}'}))">
                  <img src="${designFaceA}" alt="وجه أ" style="width: 100%; height: 50px; object-fit: cover; border-radius: 5px; border: 1.5px solid rgba(236,72,153,0.4);" onerror="this.parentElement.style.display='none'"/>
                  <div style="text-align: center; font-size: 8px; color: #ec4899; margin-top: 2px; font-weight: 600;">وجه أ</div>
                </div>
              ` : ''}
              ${designFaceB ? `
                <div style="flex: 1; cursor: pointer;" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceB}'}))">
                  <img src="${designFaceB}" alt="وجه ب" style="width: 100%; height: 50px; object-fit: cover; border-radius: 5px; border: 1.5px solid rgba(168,85,247,0.4);" onerror="this.parentElement.style.display='none'"/>
                  <div style="text-align: center; font-size: 8px; color: #a855f7; margin-top: 2px; font-weight: 600;">وجه ب</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <p style="color: #999; font-size: 10px; margin: 0 0 5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📍 ${location || city || 'موقع غير محدد'}</p>
        
        ${status.label !== 'متاحة' && daysRemaining !== null && daysRemaining > 0 ? `
          <div style="background: rgba(245,158,11,0.1); padding: 3px 6px; border-radius: 5px; margin-bottom: 5px; font-size: 10px; font-weight: 600; color: #f59e0b; border: 1px solid rgba(245,158,11,0.2);">⏱ متبقي ${daysRemaining} يوم</div>
        ` : ''}
        
        ${district || municipality ? `
          <div style="display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 5px;">
            ${district ? `<span style="background: rgba(245,158,11,0.12); color: #fbbf24; padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 700;">${district}</span>` : ''}
            ${municipality ? `<span style="background: rgba(212,175,55,0.12); color: #d4af37; padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 700;">${municipality}</span>` : ''}
          </div>
        ` : ''}
        
        <!-- Buttons -->
        <div style="display: flex; gap: 3px; flex-wrap: wrap;">
          ${hasValidCoords ? `
            <a href="${googleMapsUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; padding: 5px 8px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 6px; color: #fff; font-size: 10px; font-weight: 600; text-decoration: none;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </a>
          ` : ''}
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('edit-billboard', {detail: '${billboard.ID || billboard.id}'}));" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 3px; padding: 5px 8px; background: linear-gradient(135deg, #d4af37, #b8860b); border-radius: 6px; color: #1a1a2e; font-size: 10px; font-weight: 700; text-decoration: none; border: none; cursor: pointer;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            تعديل
          </button>
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('billboard-maintenance', {detail: '${billboard.ID || billboard.id}'}));" style="display: flex; align-items: center; justify-content: center; gap: 3px; padding: 5px 8px; background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 6px; color: #fff; font-size: 10px; font-weight: 700; border: none; cursor: pointer;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            صيانة
          </button>
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('billboard-toggle-visibility', {detail: '${billboard.ID || billboard.id}'}));" style="display: flex; align-items: center; justify-content: center; gap: 3px; padding: 5px 8px; background: ${billboard.is_visible_in_available === false ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'}; border-radius: 6px; color: #fff; font-size: 10px; font-weight: 700; border: none; cursor: pointer; box-shadow: ${billboard.is_visible_in_available === false ? '0 2px 8px rgba(239,68,68,0.4)' : '0 2px 8px rgba(34,197,94,0.4)'};">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${billboard.is_visible_in_available === false ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}</svg>
            ${billboard.is_visible_in_available === false ? 'إظهار' : 'إخفاء'}
          </button>
        </div>
      </div>
    </div>
  `
}

// Parse billboard coordinates
export const parseBillboardCoordinates = (coordinates: string): MapPosition | null => {
  if (!coordinates) return null
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
        const gpsCoords = (billboard as any).GPS_Coordinates || (billboard as any).coordinates || ''
        const position = parseBillboardCoordinates(gpsCoords)
        if (!position) return null

        const isSelected = selectedBillboards?.has(String((billboard as any).ID || (billboard as any).id)) || false
        const status = getBillboardStatus(billboard)
        const size = (billboard as any).Size || ''
        const icon = createMarkerIcon(size, status.label, isSelected)

        return {
          id: String((billboard as any).ID || (billboard as any).id),
          position,
          title: (billboard as any).Billboard_Name || 'لوحة',
          icon,
          label: size,
          zIndex: isSelected ? 1000 : 1,
          data: billboard
        } as MarkerData
      })
      .filter((marker): marker is MarkerData => marker !== null)
  }, [billboards, selectedBillboards])
}

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

// Create Leaflet divIcon HTML
export function createLeafletMarkerHtml(color: string, isRented: boolean = false): string {
  const pulseClass = isRented ? '' : 'animate-pulse'
  
  return `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-10 h-10 rounded-full ${pulseClass}" style="background-color: ${color}; opacity: 0.4;"></div>
      <div class="relative w-8 h-10 flex flex-col items-center">
        <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center" style="background: linear-gradient(to bottom, ${color}, ${color}dd);">
          <div class="w-5 h-5 bg-white rounded-full flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="${color}">
              <rect x="3" y="3" width="18" height="12" rx="1"/>
              <rect x="11" y="15" width="2" height="5"/>
              <rect x="7" y="19" width="10" height="2" rx="1"/>
            </svg>
          </div>
        </div>
        <div class="w-0 h-0 border-l-4 border-r-4 border-t-8 -mt-1" style="border-left-color: transparent; border-right-color: transparent; border-top-color: ${color};"></div>
      </div>
    </div>
  `
}

export default useMapMarkers
