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
  // Remove spaces and keep first part if too long
  const clean = size.replace(/\s+/g, '')
  if (clean.length <= 6) return clean
  // For sizes like "4x12", keep as is
  if (clean.includes('x') || clean.includes('×')) return clean
  // Otherwise truncate
  return clean.substring(0, 5)
}

// Shorten customer name
function shortenCustomer(name: string): string {
  if (!name) return ''
  // Take first word only
  const words = name.trim().split(/\s+/)
  const first = words[0] || ''
  return first.length > 8 ? first.substring(0, 7) + '..' : first
}

// Create clean modern pin SVG with size on top and customer name below
export const createPinSvgUrl = (size: string, status: string, isSelected: boolean = false, adType?: string, customerName?: string) => {
  const cacheKey = `${size}-${status}-${isSelected}-${adType || ''}-${customerName || ''}-v8`
  if (pinIconCache[cacheKey]) return pinIconCache[cacheKey]
  
  const colors = getSizeColor(size)
  const isAvailable = status === "متاحة" || status === "متاح"
  const isSoon = status === "قريباً" || status === "محجوزة"
  const isRented = status === "مؤجر" || status === "مؤجرة"
  const statusColor = isAvailable ? "#22c55e" : isSoon ? "#eab308" : "#ef4444"
  
  // Bigger pins
  const pinSize = isSelected ? 58 : 44
  const labelHeight = 32 // Space for labels on top
  const customerHeight = customerName ? 18 : 0 // Space for customer name below
  const w = pinSize + 40
  const h = pinSize + 44 + labelHeight + customerHeight
  const cx = w / 2
  const pinTop = labelHeight
  const headR = pinSize / 2.2
  const uniqueId = cacheKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)
  
  const shortSize = shortenSize(size)
  const shortCustomer = shortenCustomer(customerName || '')
  const shortAdType = adType ? (adType.length > 6 ? adType.substring(0, 5) + '..' : adType) : ''
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="body${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${adjustColor(colors.bg, 50)}"/>
        <stop offset="50%" stop-color="${colors.bg}"/>
        <stop offset="100%" stop-color="${adjustColor(colors.bg, -40)}"/>
      </linearGradient>
      <filter id="shadow${uniqueId}" x="-50%" y="-30%" width="200%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
      </filter>
      <filter id="textShadow${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.8)"/>
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
    
    <!-- Size label on TOP -->
    <g filter="url(#textShadow${uniqueId})">
      <rect x="${cx - 28}" y="2" width="56" height="18" rx="9" fill="${colors.bg}" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
      <text x="${cx}" y="14" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#fff">${shortSize}</text>
    </g>
    
    ${shortAdType ? `
    <!-- Ad Type label below size -->
    <g filter="url(#textShadow${uniqueId})">
      <rect x="${cx - 24}" y="21" width="48" height="14" rx="7" fill="${statusColor}" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
      <text x="${cx}" y="31" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="600" fill="#fff">${shortAdType}</text>
    </g>
    ` : ''}
    
    <!-- Ground shadow -->
    <ellipse cx="${cx}" cy="${h - customerHeight - 4}" rx="${pinSize * 0.25}" ry="4" fill="rgba(0,0,0,0.25)"/>
    
    ${isAvailable ? `
    <!-- Pulse rings for available -->
    <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR + 6}" fill="none" stroke="${statusColor}" stroke-width="2.5" opacity="0.5">
      <animate attributeName="r" values="${headR + 2};${headR + 16}" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    ` : ''}
    
    <!-- Main pin -->
    <g filter="url(#shadow${uniqueId})">
      <!-- Pin body - teardrop shape -->
      <path d="M${cx},${h - customerHeight - 6} 
               C${cx - 4},${h - customerHeight - 16} ${cx - headR - 4},${pinTop + headR + 18} ${cx - headR - 4},${pinTop + headR + 8}
               A${headR + 4},${headR + 4} 0 1,1 ${cx + headR + 4},${pinTop + headR + 8}
               C${cx + headR + 4},${pinTop + headR + 18} ${cx + 4},${h - customerHeight - 16} ${cx},${h - customerHeight - 6}Z"
            fill="url(#body${uniqueId})" 
            stroke="${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.5)'}" 
            stroke-width="${isSelected ? 3 : 1.5}"/>
      
      <!-- Shine highlight -->
      <ellipse cx="${cx - headR * 0.35}" cy="${pinTop + headR * 0.6 + 8}" rx="${headR * 0.4}" ry="${headR * 0.3}" 
               fill="url(#shine${uniqueId})" opacity="0.8"/>
      
      <!-- Inner circle background -->
      <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR * 0.75}" fill="#1a1a2e" opacity="0.3"/>
      
      <!-- Status indicator -->
      <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR * 0.6}" fill="url(#glow${uniqueId})"/>
      
      <!-- Inner white dot -->
      <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR * 0.22}" fill="rgba(255,255,255,0.95)"/>
    </g>
    
    ${shortCustomer ? `
    <!-- Customer name below pin -->
    <g filter="url(#textShadow${uniqueId})">
      <rect x="${cx - 32}" y="${h - 16}" width="64" height="14" rx="7" fill="rgba(26,26,46,0.9)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
      <text x="${cx}" y="${h - 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="500" fill="#fbbf24">${shortCustomer}</text>
    </g>
    ` : ''}
    
    ${isSelected ? `
    <!-- Selection indicator with rotation -->
    <circle cx="${cx}" cy="${pinTop + headR + 8}" r="${headR + 10}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="6,4" opacity="0.9">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${pinTop + headR + 8}" to="360 ${cx} ${pinTop + headR + 8}" dur="5s" repeatCount="indefinite"/>
    </circle>
    <!-- Golden checkmark badge -->
    <g>
      <circle cx="${cx + headR + 2}" cy="${pinTop + 2}" r="12" fill="#fbbf24">
        <animate attributeName="r" values="12;14;12" dur="0.8s" repeatCount="indefinite"/>
      </circle>
      <path d="M${cx + headR - 2} ${pinTop + 2} l4 4 l6 -6" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ` : ''}
  </svg>`
  
  const result = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    pinSize,
    labelOffset: labelHeight
  }
  
  pinIconCache[cacheKey] = result
  return result
}

// Create marker icon for Google Maps
export const createMarkerIcon = (size: string, status: string, isSelected: boolean = false, adType?: string, customerName?: string): MarkerIcon => {
  const { url, pinSize, labelOffset } = createPinSvgUrl(size, status, isSelected, adType, customerName)
  const customerHeight = customerName ? 18 : 0
  const w = pinSize + 40
  const h = pinSize + 44 + 32 + customerHeight
  
  return {
    url,
    size: { width: w, height: h },
    anchor: { x: w / 2, y: h - customerHeight - 4 },
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

// Create horizontal popup content for info windows - Dark theme with front design only - NO EMOJIS
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
  
  // Design images - FRONT DESIGN ONLY (design_face_a) - encode URL
  const designFaceA = encodeURI(billboard.design_face_a || '')
  
  // Ad type color for accent - use original unsanitized for color lookup
  const adTypeColor = getAdTypeColor(billboard.Ad_Type || billboard.ad_type || '')
  const cardAccent = isRented && adType ? adTypeColor.bg : '#d4af37'
  
  const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : []
  const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])
  const googleMapsUrl = hasValidCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
    : '#'

  // Horizontal layout popup - responsive for mobile (avoid clipping)
  return `
    <div class="map-popup-horizontal" style="
      font-family: 'Tajawal', 'Manrope', sans-serif; 
      direction: rtl; 
      width: min(400px, 92vw);
      max-width: 92vw;
      box-sizing: border-box;
      background: linear-gradient(145deg, rgba(20,20,38,0.99), rgba(15,15,28,0.99));
      border-radius: 12px; 
      overflow: hidden; 
      border: 2px solid ${cardAccent}66;
      box-shadow: 0 20px 50px -5px rgba(0,0,0,0.6), 0 0 20px ${cardAccent}22;
      display: flex;
      flex-direction: row;
    ">
      <!-- Left Side: Main Image + Design -->
      <div style="
        width: 34vw;
        max-width: 140px;
        min-width: 110px;
        position: relative;
        display: flex;
        flex-direction: column;
        background: #0f0f1c;
      ">
        <!-- Main Billboard Image -->
        <div style="height: 90px; position: relative; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${imageUrl || '/roadside-billboard.png'}'}))">
          <img src="${imageUrl || '/roadside-billboard.png'}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'" />
          
          <!-- Size badge -->
          <div style="position: absolute; top: 4px; right: 4px; background: ${sizeColor.bg}; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; color: ${sizeColor.text}; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">${size}</div>
          
          <!-- Status badge -->
          <div style="position: absolute; bottom: 4px; right: 4px; background: ${statusBg}; padding: 2px 5px; border-radius: 4px; font-size: 8px; font-weight: 700; color: ${statusColor}; display: flex; align-items: center; gap: 2px; border: 1px solid ${statusColor}44;">
            <span style="width: 4px; height: 4px; border-radius: 50%; background: ${statusColor};"></span>
            ${status.label}
          </div>
        </div>
        
        <!-- Front Design - Full Width -->
        ${designFaceA ? `
          <div style="flex: 1; cursor: pointer; border-top: 1px solid ${cardAccent}33; position: relative;" onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceA}'}))">
            <img src="${designFaceA}" alt="التصميم" style="width: 100%; height: 100%; object-fit: cover; min-height: 80px;" onerror="this.parentElement.style.display='none'" />
            <div style="position: absolute; bottom: 3px; left: 3px; background: rgba(0,0,0,0.7); padding: 1px 4px; border-radius: 3px; font-size: 7px; color: ${cardAccent}; font-weight: 700;">التصميم</div>
          </div>
        ` : ''}
      </div>
      
      <!-- Right Side: Content -->
      <div style="flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 200px;">
        <!-- Billboard Name -->
        <h3 style="font-weight: 800; font-size: 14px; color: #fff; margin: 0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${name}
        </h3>
        
        <!-- Customer & Ad Type Row - No Emoji -->
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
        
        <!-- Small Navigate Button -->
        ${hasValidCoords ? `
          <a href="${googleMapsUrl}" target="_blank" style="
            display: inline-flex; align-items: center; justify-content: center; gap: 4px;
            padding: 6px 12px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 8px; color: #fff; font-size: 10px; font-weight: 700;
            text-decoration: none; box-shadow: 0 2px 8px rgba(59,130,246,0.3);
            margin-top: auto;
            align-self: flex-start;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            توجيه
          </a>
        ` : ''}
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
