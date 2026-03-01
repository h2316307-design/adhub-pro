import { Billboard } from '@/types'

// Color palette for sizes
const colorPalette = [
  { bg: "#ef4444", border: "#fca5a5", text: "#fff" },
  { bg: "#f97316", border: "#fdba74", text: "#fff" },
  { bg: "#eab308", border: "#fde047", text: "#000" },
  { bg: "#22c55e", border: "#86efac", text: "#fff" },
  { bg: "#06b6d4", border: "#67e8f9", text: "#fff" },
  { bg: "#3b82f6", border: "#93c5fd", text: "#fff" },
  { bg: "#8b5cf6", border: "#c4b5fd", text: "#fff" },
  { bg: "#ec4899", border: "#f9a8d4", text: "#fff" },
  { bg: "#14b8a6", border: "#5eead4", text: "#fff" },
  { bg: "#f43f5e", border: "#fda4af", text: "#fff" },
]

const sizeColorMap: Record<string, { bg: string, border: string, text: string }> = {}

const getSizeColor = (size: string): { bg: string, border: string, text: string } => {
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

// Helper to calculate days remaining
const getDaysRemaining = (expiryDate: string | null): number | null => {
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

// Compact Popup HTML - Unified for both Google Maps and Leaflet
export const createCompactPopupContent = (billboard: Billboard): string => {
  const daysRemaining = getDaysRemaining(billboard.expiryDate)
  const sizeColor = getSizeColor(billboard.size)
  const statusColor = billboard.status === 'متاح' ? '#10b981' : billboard.status === 'قريباً' ? '#f59e0b' : '#ef4444'
  const statusBg = billboard.status === 'متاح' ? 'rgba(16,185,129,0.15)' : billboard.status === 'قريباً' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
  
  const coords = billboard.coordinates.split(",").map((coord) => Number.parseFloat(coord.trim()))
  const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])
  const googleMapsUrl = hasValidCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
    : '#'

  return `
    <div class="map-popup-compact" style="
      font-family: 'Tajawal', 'Manrope', sans-serif; 
      direction: rtl; 
      width: 240px; 
      max-width: 85vw;
      background: linear-gradient(145deg, rgba(26,26,46,0.98), rgba(20,20,35,0.98));
      border-radius: 12px; 
      overflow: hidden; 
      border: 1px solid rgba(212,175,55,0.3);
      box-shadow: 0 12px 35px -5px rgba(0,0,0,0.5);
    ">
      <!-- Image -->
      <div style="
        position: relative; 
        height: 90px; 
        cursor: pointer;
        overflow: hidden;
      " onclick="document.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${billboard.imageUrl || '/roadside-billboard.png'}'}))">
        <img src="${billboard.imageUrl || '/roadside-billboard.png'}" 
             alt="${billboard.name}" 
             style="width: 100%; height: 100%; object-fit: cover;"
             onerror="this.src='/roadside-billboard.png'" />
        
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 20%, rgba(26,26,46,0.9) 100%);"></div>
        
        <!-- Size -->
        <div style="
          position: absolute; top: 6px; right: 6px; 
          background: ${sizeColor.bg};
          padding: 2px 8px; border-radius: 8px; 
          font-size: 11px; font-weight: 700; color: ${sizeColor.text};
        ">${billboard.size}</div>
        
        <!-- Status -->
        <div style="
          position: absolute; top: 6px; left: 6px; 
          background: ${statusBg}; 
          padding: 2px 8px; border-radius: 8px; 
          font-size: 10px; font-weight: 700; color: ${statusColor}; 
          display: flex; align-items: center; gap: 4px;
        ">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>
          ${billboard.status}
        </div>
      </div>
      
      <!-- Content -->
      <div style="padding: 10px;">
        <h3 style="font-weight: 700; font-size: 13px; color: #fff; margin: 0 0 8px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${billboard.name}
        </h3>
        
        <!-- Location -->
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <div style="width: 22px; height: 22px; background: linear-gradient(135deg, #d4af37, #b8860b); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" stroke-width="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p style="color: #b0b0b0; font-size: 11px; margin: 0; flex: 1; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${billboard.location}</p>
        </div>
        
        ${billboard.status !== 'متاح' && daysRemaining !== null && daysRemaining > 0 ? `
          <div style="background: rgba(245,158,11,0.12); padding: 6px 8px; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(245,158,11,0.25);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
              <circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>
            </svg>
            <span style="font-weight: 600; color: #f59e0b; font-size: 11px;">متبقي ${daysRemaining} يوم</span>
          </div>
        ` : ''}
        
        <!-- Tags -->
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;">
          ${billboard.area ? `<span style="background: rgba(245,158,11,0.12); color: #fbbf24; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">${billboard.area}</span>` : ''}
          <span style="background: rgba(212,175,55,0.12); color: #d4af37; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">${billboard.municipality}</span>
        </div>
        
        <!-- Navigate Button -->
        ${hasValidCoords ? `
          <a href="${googleMapsUrl}" target="_blank" style="
            display: flex; align-items: center; justify-content: center; gap: 6px;
            width: 100%; padding: 8px 12px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 8px; color: #fff; font-size: 12px; font-weight: 600;
            text-decoration: none; box-shadow: 0 4px 12px rgba(59,130,246,0.35);
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            التوجيه للموقع
          </a>
        ` : ''}
      </div>
    </div>
  `
}

export default createCompactPopupContent