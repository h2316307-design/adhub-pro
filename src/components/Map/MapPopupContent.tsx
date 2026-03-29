import { Billboard } from '@/types'
import { getSizeColor, getBillboardStatus, getDaysRemaining } from '@/hooks/useMapMarkers'

// Create compact popup HTML content - Dark theme with design images
export const createCompactPopupContent = (billboard: Billboard | any): string => {
  const status = getBillboardStatus(billboard)
  const daysRemaining = getDaysRemaining(billboard.Rent_End_Date || billboard.expiryDate)
  const sizeColor = getSizeColor(billboard.Size || billboard.size || '')
  const statusColor = status.color
  const statusBg = status.label === 'متاحة' ? 'rgba(34,197,94,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
  
  const name = billboard.Billboard_Name || billboard.name || `لوحة ${billboard.ID || billboard.id}`
  const location = billboard.Nearest_Landmark || billboard.location || ''
  const city = billboard.City || billboard.city || ''
  const district = billboard.District || billboard.district || ''
  const municipality = billboard.Municipality || billboard.municipality || ''
  const size = billboard.Size || billboard.size || ''
  const imageUrl = billboard.Image_URL || billboard.imageUrl || ''
  const customerName = billboard.Customer_Name || billboard.customer_name || ''
  const adType = billboard.Ad_Type || billboard.ad_type || ''
  const gpsCoords = billboard.GPS_Coordinates || billboard.coordinates || ''
  const isRented = status.label === 'مؤجرة' || status.label === 'محجوزة'
  
  // Design images - multiple sources
  const designFaceA = billboard.design_face_a || billboard.installed_design_face_a || ''
  const designFaceB = billboard.design_face_b || billboard.installed_design_face_b || ''
  const installedImageA = billboard.installed_image_face_a_url || ''
  const installedImageB = billboard.installed_image_face_b_url || ''
  const hasDesigns = designFaceA || designFaceB || installedImageA || installedImageB
  
  const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : []
  const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])
  const googleMapsUrl = hasValidCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
    : '#'

  return `
    <div class="map-popup-compact" style="
      font-family: 'Tajawal', 'Manrope', sans-serif; 
      direction: rtl; 
      width: 280px; 
      max-width: 90vw;
      background: linear-gradient(145deg, rgba(26,26,46,0.98), rgba(20,20,35,0.98));
      border-radius: 14px; 
      overflow: hidden; 
      border: 1px solid rgba(212,175,55,0.3);
      box-shadow: 0 15px 40px -5px rgba(0,0,0,0.5);
    ">
      <!-- Image Header -->
      <div style="
        position: relative; 
        height: 100px; 
        cursor: pointer;
        overflow: hidden;
        background: #252542;
      " onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${imageUrl || '/roadside-billboard.png'}'}))">
        <img src="${imageUrl || '/roadside-billboard.png'}" 
             alt="${name}" 
             style="width: 100%; height: 100%; object-fit: cover;"
             onerror="this.style.display='none'" />
        
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, rgba(26,26,46,0.95) 100%);"></div>
        
        <!-- Size badge -->
        <div style="
          position: absolute; top: 8px; right: 8px; 
          background: ${sizeColor.bg};
          padding: 3px 10px; border-radius: 10px; 
          font-size: 11px; font-weight: 700; color: ${sizeColor.text};
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">${size}</div>
        
        <!-- Status badge -->
        <div style="
          position: absolute; top: 8px; left: 8px; 
          background: ${statusBg}; 
          padding: 3px 10px; border-radius: 10px; 
          font-size: 10px; font-weight: 700; color: ${statusColor}; 
          display: flex; align-items: center; gap: 5px;
          border: 1px solid ${statusColor}33;
        ">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: ${statusColor};"></span>
          ${status.label}
        </div>
        
        <!-- Zoom hint -->
        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.6); padding: 3px 8px; border-radius: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/>
          </svg>
        </div>
      </div>
      
      <!-- Content -->
      <div style="padding: 12px;">
        <div style="display: flex; align-items: center; gap: 6px; margin: 0 0 10px 0;">
          <h3 style="font-weight: 700; font-size: 14px; color: #fff; margin: 0; flex: 1; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${name}
          </h3>
          <button onclick="navigator.clipboard.writeText('${name.replace(/'/g, "\\'")}').then(()=>{this.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#22c55e\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg>';setTimeout(()=>{this.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#d4af37\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'/><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'/></svg>'},1500)})" style="
            flex-shrink: 0; width: 28px; height: 28px; border-radius: 7px;
            background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: all 0.2s;
          " title="نسخ اسم اللوحة">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
        
        ${isRented && customerName ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 6px 10px; background: rgba(239,68,68,0.12); border-radius: 8px; border: 1px solid rgba(239,68,68,0.2);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span style="font-size: 11px; color: #ef4444; font-weight: 600;">${customerName}</span>
          </div>
        ` : ''}
        
        ${isRented && adType ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 6px 10px; background: rgba(139,92,246,0.12); border-radius: 8px;">
            <span style="font-size: 12px;">📢</span>
            <span style="font-size: 11px; color: #8b5cf6; font-weight: 600;">${adType}</span>
          </div>
        ` : ''}
        
        <!-- Design Images Section -->
        ${hasDesigns ? `
          <div style="padding: 8px; background: rgba(236,72,153,0.08); border-radius: 10px; border: 1px solid rgba(236,72,153,0.25); margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style="font-size: 11px; color: #ec4899; font-weight: 700;">التصاميم المُركّبة</span>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${(installedImageA || designFaceA) ? `
                <div style="flex: 1; min-width: 80px; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${installedImageA || designFaceA}'}))">
                  <img src="${installedImageA || designFaceA}" alt="وجه أ" style="width: 100%; height: 55px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(236,72,153,0.4);" onerror="this.parentElement.style.display='none'"/>
                  <div style="text-align: center; font-size: 9px; color: #ec4899; margin-top: 4px; font-weight: 600;">${installedImageA ? 'مُركّب أ' : 'وجه أ'}</div>
                </div>
              ` : ''}
              ${(installedImageB || designFaceB) ? `
                <div style="flex: 1; min-width: 80px; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${installedImageB || designFaceB}'}))">
                  <img src="${installedImageB || designFaceB}" alt="وجه ب" style="width: 100%; height: 55px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(168,85,247,0.4);" onerror="this.parentElement.style.display='none'"/>
                  <div style="text-align: center; font-size: 9px; color: #a855f7; margin-top: 4px; font-weight: 600;">${installedImageB ? 'مُركّب ب' : 'وجه ب'}</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <!-- Location -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <div style="width: 26px; height: 26px; background: linear-gradient(135deg, #d4af37, #b8860b); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" stroke-width="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p style="color: #b0b0b0; font-size: 11px; margin: 0; flex: 1; line-height: 1.4;">${location || city || 'موقع غير محدد'}</p>
        </div>
        
        ${status.label !== 'متاحة' && daysRemaining !== null && daysRemaining > 0 ? `
          <div style="background: rgba(245,158,11,0.12); padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(245,158,11,0.25);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
              <circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>
            </svg>
            <span style="font-weight: 700; color: #f59e0b; font-size: 12px;">متبقي ${daysRemaining} يوم</span>
          </div>
        ` : ''}
        
        <!-- Tags -->
        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px;">
          ${district ? `<span style="background: rgba(245,158,11,0.12); color: #fbbf24; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 600;">${district}</span>` : ''}
          ${municipality ? `<span style="background: rgba(212,175,55,0.12); color: #d4af37; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 600;">${municipality}</span>` : ''}
          ${city && !district ? `<span style="background: rgba(59,130,246,0.12); color: #3b82f6; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 600;">${city}</span>` : ''}
        </div>
        
        <!-- Navigate Button -->
        ${hasValidCoords ? `
          <a href="${googleMapsUrl}" target="_blank" style="
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 10px 14px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 10px; color: #fff; font-size: 13px; font-weight: 600;
            text-decoration: none; box-shadow: 0 4px 15px rgba(59,130,246,0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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
