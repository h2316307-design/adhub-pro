/**
 * Unified pin generator for all admin maps.
 * Design inspired by reference: dark teardrop body, colored status ring,
 * inner light disc, bold short label inside.
 */
import { getBillboardStatus } from '@/hooks/useMapMarkers';

export interface UnifiedPinResult {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

const statusPalette = (label: string, isHidden: boolean) => {
  if (isHidden) return { ring: '#94a3b8', glow: '148,163,184' };
  switch (label) {
    case 'متاحة':
    case 'متاح':
      return { ring: '#22c55e', glow: '34,197,94' };
    case 'محجوزة':
    case 'محجوز':
      return { ring: '#f59e0b', glow: '245,158,11' };
    case 'صيانة':
    case 'تحتاج صيانة':
    case 'قيد الصيانة':
    case 'متضررة اللوحة':
      return { ring: '#ef4444', glow: '239,68,68' };
    case 'إزالة':
      return { ring: '#6b7280', glow: '107,114,128' };
    default: // مؤجرة وغيرها
      return { ring: '#2d6bff', glow: '45,107,255' };
  }
};

const shortLabelFor = (billboard: any): string => {
  const name = String(billboard?.Billboard_Name || billboard?.name || '').trim();
  // اعرض الرقم/المعرّف فقط (آخر مقطع رقمي بعد الشرطة، أو القياس كاحتياطي)
  const m = name.match(/(\d{2,5})$/);
  if (m) return m[1];
  const size = String(billboard?.Size || billboard?.size || '').replace(/\s+/g, '').replace('×', 'x');
  if (size) return size.slice(0, 4);
  return String(billboard?.ID || billboard?.id || '').slice(-3) || '·';
};

export function createUnifiedPin(billboard: any, isSelected = false): UnifiedPinResult {
  const status = getBillboardStatus(billboard);
  const isHidden = billboard?.is_visible_in_available === false;
  const { ring, glow } = statusPalette(status.label, isHidden);
  const label = shortLabelFor(billboard);
  const adType = String(billboard?.Ad_Type || billboard?.ad_type || '').trim();
  const showAd = !!adType && adType.length <= 14;

  const W = isSelected ? 60 : 52;
  const H = isSelected ? 76 : 66;
  const cx = W / 2;
  const topPad = showAd ? 16 : 4;
  const r = isSelected ? 22 : 19; // outer head radius
  const innerR = r - 6;
  const coreR = innerR - 4;
  const headCy = topPad + r;
  const tipY = H - 2;

  // teardrop path: circle blended into pointer
  const tailControl = r * 0.55;
  const path = `M ${cx - r} ${headCy}
    A ${r} ${r} 0 1 1 ${cx + r} ${headCy}
    C ${cx + r} ${headCy + tailControl}, ${cx + 4} ${tipY - 6}, ${cx} ${tipY}
    C ${cx - 4} ${tipY - 6}, ${cx - r} ${headCy + tailControl}, ${cx - r} ${headCy} Z`;

  const uid = `u${Math.abs((Number(billboard?.ID || billboard?.id || 0) * 31 + label.length) | 0)}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="b${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1f2937"/>
        <stop offset="100%" stop-color="#0a0f1a"/>
      </linearGradient>
      <radialGradient id="g${uid}" cx="50%" cy="35%" r="60%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <filter id="s${uid}" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.55)"/>
      </filter>
    </defs>
    <ellipse cx="${cx}" cy="${tipY + 0.5}" rx="${r * 0.55}" ry="2.2" fill="rgba(0,0,0,0.35)"/>
    ${showAd ? `
      <g>
        <rect x="${cx - 32}" y="0" width="64" height="14" rx="7" fill="#0a0a14" stroke="#d6ac40" stroke-width="1"/>
        <text x="${cx}" y="10" text-anchor="middle" font-family="'Tajawal','Manrope',sans-serif" font-size="9" font-weight="800" fill="#f4c25a">${adType.slice(0, 14)}</text>
      </g>` : ''}
    <g filter="url(#s${uid})" opacity="${isHidden ? '0.7' : '1'}">
      <path d="${path}" fill="url(#b${uid})" stroke="${isSelected ? '#f4c25a' : 'rgba(255,255,255,0.18)'}" stroke-width="${isSelected ? 2 : 1.2}"/>
      <path d="${path}" fill="url(#g${uid})"/>
      <circle cx="${cx}" cy="${headCy}" r="${innerR}" fill="${ring}"/>
      <circle cx="${cx}" cy="${headCy}" r="${coreR}" fill="#f8fafc"/>
      <text x="${cx}" y="${headCy + 3.4}" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="${coreR > 9 ? 10 : 9}" font-weight="900" fill="#0a0f1a" letter-spacing="0.2">${label}</text>
    </g>
    ${status.label === 'متاحة' || status.label === 'متاح' ? `
      <circle cx="${cx}" cy="${headCy}" r="${r}" fill="none" stroke="rgba(${glow},0.65)" stroke-width="1.5">
        <animate attributeName="r" values="${r};${r + 6};${r}" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite"/>
      </circle>` : ''}
    ${isSelected ? `
      <circle cx="${cx + r - 4}" cy="${topPad + 4}" r="6" fill="#10b981" stroke="#fff" stroke-width="1.2"/>
      <path d="M ${cx + r - 7} ${topPad + 4} l 2 2 l 4 -4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    width: W,
    height: H,
    anchorX: W / 2,
    anchorY: tipY,
  };
}

export function createUnifiedClusterSvg(count: number, size = 50): string {
  const display = count > 999 ? '999+' : count > 99 ? '99+' : String(count);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 50 50">
    <defs>
      <radialGradient id="cg" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#f4c25a"/>
        <stop offset="100%" stop-color="#b8860b"/>
      </radialGradient>
      <filter id="cs" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.5)"/>
      </filter>
    </defs>
    <g filter="url(#cs)">
      <circle cx="25" cy="25" r="23" fill="url(#cg)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
      <circle cx="25" cy="25" r="16" fill="#0a0f1a"/>
      <text x="25" y="29" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="13" font-weight="900" fill="#f4c25a">${display}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
