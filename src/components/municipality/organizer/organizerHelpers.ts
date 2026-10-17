// مساعدات تنسيق الأبعاد والمقاسات لصفحة تنظيم اللوحات للبلديات

export const normalizeMuniName = (name: string | null | undefined): string => {
  if (!name) return '';
  const clean = String(name).trim();
  const legacyMap: Record<string, string> = {
    'قصر خيار': 'قصر الاخيار',
    'قصر_خيار': 'قصر الاخيار',
    'قصر الخيار': 'قصر الاخيار',
    'القره بوللي': 'القره بوللي',
    'القره_بوللي': 'القره بوللي',
    'القرهبوللي': 'القره بوللي',
    'طرابلس': 'طرابلس المركز',
    'طرابلس القديمة': 'طرابلس المركز',
    'صبراتة': 'صبراته',
    'امسلاته': 'امسلاتة',
    'مسلاتة': 'امسلاتة',
  };
  return legacyMap[clean] || clean;
};

export const parseDimensions = (sizeStr: string) => {
  if (!sizeStr) return { length: '', width: '', height: '' };
  
  const normalized = String(sizeStr || '').trim();
  const lower = normalized.toLowerCase();

  // Specific preset mapping for non-numeric labels
  if (lower.includes('سوسيت') || lower.includes('soussette') || lower.includes('mupi')) {
    return { length: '2', width: '1.2', height: '' };
  }

  // Split by 'x' or 'X' or '×' or '*'
  const parts = normalized.replace(/×/g, 'x').replace(/\*/g, 'x').split(/x/i).map(p => p.trim());

  if (parts.length >= 2) {
    const cleanNum = (str: string) => {
      const match = str.match(/([0-9]+(?:\.[0-9]+)?)/);
      return match ? match[1] : '';
    };

    const d1 = cleanNum(parts[0]);
    const d2 = cleanNum(parts[1]);
    const d3 = parts[2] ? cleanNum(parts[2]) : '';

    if (d1 && d2) {
      const num1 = parseFloat(d1);
      const num2 = parseFloat(d2);
      const length = Math.max(num1, num2).toString();
      const width = Math.min(num1, num2).toString();
      return { length, width, height: d3 };
    }
  }

  // Fallback regex match for any 2 numbers in string
  const nums = normalized.match(/([0-9]+(?:\.[0-9]+)?)/g);
  if (nums && nums.length >= 2) {
    const n1 = parseFloat(nums[0]);
    const n2 = parseFloat(nums[1]);
    return {
      length: Math.max(n1, n2).toString(),
      width: Math.min(n1, n2).toString(),
      height: nums[2] || ''
    };
  }

  return { length: '', width: '', height: '' };
};

// Same as parseDimensions but returns numeric values + ratio (used in print overlay)
export const parseSizeDimensions = (sizeStr: string) => {
  const dims = parseDimensions(sizeStr);
  const l = parseFloat(dims.length) || 8;
  const w = parseFloat(dims.width) || 3;
  const h = parseFloat(dims.height) || 0;
  return { length: l, width: w, height: h, ratio: l > 0 && w > 0 ? l / w : 2.67 };
};

export const formatDimensions = (length: string, width: string, height: string) => {
  const l = String(length || '').trim();
  const w = String(width || '').trim();
  const h = String(height || '').trim();
  if (!l && !w && !h) return '';
  return `${l}x${w}${h ? 'x' + h : ''}`;
};

export const formatSizeForPrint = (sizeStr: string, showHeight: boolean) => {
  if (!sizeStr) return '';
  const dims = parseDimensions(sizeStr);
  if (!dims.length && !dims.width && !dims.height) return '';
  if (showHeight && dims.height) {
    return `${dims.length} × ${dims.width} × ${dims.height}`;
  }
  return `${dims.length} × ${dims.width}`;
};

export const generatePrintedSizeHtml = (sizeStr: string, showHeight: boolean, showLabels: boolean = false) => {
  if (!sizeStr) return '';
  const dims = parseDimensions(sizeStr);
  if (!dims.length && !dims.width && !dims.height) return '';

  const showH = showHeight && !!dims.height;
  
  return `
    <div class="print-size-container">
      <div class="print-dim-col">
        ${showLabels ? `<div class="print-dim-label">طول</div>` : ''}
        <div class="print-dim-value">${dims.length || '-'}</div>
      </div>
      <div class="print-dim-separator">×</div>
      <div class="print-dim-col">
        ${showLabels ? `<div class="print-dim-label">عرض</div>` : ''}
        <div class="print-dim-value">${dims.width || '-'}</div>
      </div>
      ${showH ? `
        <div class="print-dim-separator">×</div>
        <div class="print-dim-col">
          ${showLabels ? `<div class="print-dim-label">ارتفاع</div>` : ''}
          <div class="print-dim-value">${dims.height}</div>
        </div>
      ` : ''}
    </div>
  `;
};

