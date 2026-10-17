import { ChevronDown, Check, SlidersHorizontal } from 'lucide-react';
import { parseDimensions, formatDimensions } from '@/components/municipality/organizer/organizerHelpers';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Status preset options with color themes and icons
export const STATUS_PRESETS = [
  { value: 'تم التركيب', label: 'تم التركيب', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  { value: 'لم يتم التركيب', label: 'لم يتم التركيب', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
];

export const StatusQuickSelector = ({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => {
  const currentPreset = STATUS_PRESETS.find(p => p.value === value) || {
    value: value || 'تم التركيب',
    label: value || 'تم التركيب',
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500',
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border transition-all hover:scale-105 shadow-xs cursor-pointer ${currentPreset.color} ${className}`}
        >
          <span className="flex items-center gap-1.5 truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 ${currentPreset.dot} animate-pulse`} />
            <span className="truncate">{currentPreset.label}</span>
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2.5 rounded-2xl border border-border bg-popover/98 backdrop-blur-xl shadow-2xl space-y-2 dir-rtl" align="center">
        <div className="text-[11px] font-black text-muted-foreground px-1 pb-1 border-b border-border/10 flex items-center justify-between">
          <span>اختر حالة اللوحة:</span>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {STATUS_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                value === preset.value
                  ? `${preset.color} font-black shadow-xs`
                  : 'hover:bg-muted/60 text-foreground'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${preset.dot}`} />
                <span>{preset.label}</span>
              </span>
              {value === preset.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
        <div className="pt-1.5 border-t border-border/10 space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground px-1">حالة مخصصة:</span>
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="أدخل حالة مخصصة..."
            className="h-8 text-xs font-bold rounded-xl bg-background border-border/30"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const SIZE_PRESETS = [
  '8x3',
  '10x4',
  '12x4',
  '6x3',
  '14x4',
  '15x5',
  '4x3',
  '5x3',
  '2x1',
  '3x2',
  '8x3x3',
  '12x4x3',
];

// Unified custom Dimension input component with Sliders and Presets
export const DimensionInput = ({
  value,
  onChange,
  availableSizes = [],
  className = ''
}: {
  value: string;
  onChange: (v: string) => void;
  availableSizes?: string[];
  className?: string;
}) => {
  const { length, width, height } = parseDimensions(value);

  const numLength = parseFloat(String(length)) || 8;
  const numWidth = parseFloat(String(width)) || 3;

  const activePresets = availableSizes && availableSizes.length > 0 ? availableSizes : SIZE_PRESETS;

  const handleChange = (field: 'length' | 'width' | 'height', val: string) => {
    const newDims = { length, width, height };
    newDims[field] = val;
    onChange(formatDimensions(newDims.length, newDims.width, newDims.height));
  };

  const handleSliderLength = (val: number) => {
    onChange(formatDimensions(String(val), String(width), String(height)));
  };

  const handleSliderWidth = (val: number) => {
    onChange(formatDimensions(String(length), String(val), String(height)));
  };

  const formattedDisplay = value ? value : 'حدد المقاس';
  const parsedValue = parseDimensions(value);
  const numericBadge = parsedValue.length && parsedValue.width ? `${parsedValue.length}×${parsedValue.width}م` : '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all hover:scale-105 shadow-xs cursor-pointer ${className}`}
        >
          <span className="flex items-center gap-1.5 font-mono">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-bold">{formattedDisplay}</span>
            {numericBadge && (
              <span className="text-[10px] opacity-75 font-normal bg-primary/10 px-1.5 py-0.5 rounded-md dir-ltr">
                ({numericBadge})
              </span>
            )}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3.5 rounded-2xl border border-border bg-popover/98 backdrop-blur-xl shadow-2xl space-y-3 dir-rtl" align="center">
        <div className="flex items-center justify-between border-b border-border/10 pb-2">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> اختيار المقاس
          </span>
          <Badge className="bg-primary/15 text-primary text-[10px] font-mono font-extrabold px-2 py-0.5">
            {formattedDisplay} {numericBadge ? `(${numericBadge})` : ''}
          </Badge>
        </div>

        {/* Quick Presets Grid from Settings */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground">مقاسات ونماذج الإعدادات:</span>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-0.5">
            {activePresets.map((preset) => {
              const isSelected = String(value || '').trim().toLowerCase() === String(preset || '').trim().toLowerCase();
              const pDims = parseDimensions(preset);
              const pDimStr = pDims.length && pDims.width ? `${pDims.length}×${pDims.width}م` : '';

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-between border ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-muted/40 border-border/15 text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="font-extrabold truncate max-w-[110px]">{preset}</span>
                  {pDimStr && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isSelected ? 'text-primary-foreground bg-primary-foreground/10' : 'text-muted-foreground bg-muted/60'}`}>
                      {pDimStr}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Sliders Section */}
        <div className="space-y-2.5 pt-1.5 border-t border-border/10">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-muted-foreground">الطول:</span>
              <span className="font-mono text-primary ">{numLength} م</span>
            </div>
            <Slider
              value={[numLength]}
              min={1}
              max={25}
              step={0.5}
              onValueChange={([v]) => handleSliderLength(v)}
              className="py-1"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-muted-foreground">العرض:</span>
              <span className="font-mono text-primary ">{numWidth} م</span>
            </div>
            <Slider
              value={[numWidth]}
              min={1}
              max={12}
              step={0.5}
              onValueChange={([v]) => handleSliderWidth(v)}
              className="py-1"
            />
          </div>
        </div>

        {/* Custom 3D Inputs */}
        <div className="pt-2 border-t border-border/10 space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground">تخصيص يدوي (طول × عرض × ارتفاع):</span>
          <div className="flex items-center gap-1.5 justify-between bg-muted/40 p-1.5 rounded-xl border border-border/15">
            <Input
              type="text"
              value={length}
              onChange={e => handleChange('length', e.target.value)}
              className="w-16 h-7.5 text-xs text-center font-bold rounded-lg bg-background border-border/15"
              placeholder="طول"
            />
            <span className="text-xs font-bold text-muted-foreground">×</span>
            <Input
              type="text"
              value={width}
              onChange={e => handleChange('width', e.target.value)}
              className="w-16 h-7.5 text-xs text-center font-bold rounded-lg bg-background border-border/15"
              placeholder="عرض"
            />
            <span className="text-xs font-bold text-muted-foreground">×</span>
            <Input
              type="text"
              value={height}
              onChange={e => handleChange('height', e.target.value)}
              className="w-16 h-7.5 text-xs text-center font-bold rounded-lg bg-background border-border/15"
              placeholder="ارتفاع"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Returns true if the URL is a Google Maps short link that needs expansion.
 */
export const isShortGoogleMapsUrl = (url: string): boolean => {
  const str = url.trim().toLowerCase();
  return str.includes('maps.app.goo.gl') || str.includes('goo.gl/maps');
};

/**
 * Extracts lat/lng from a Google Maps URL.
 * Supports formats:
 *  - https://www.google.com/maps?q=lat,lng
 *  - https://www.google.com/maps/@lat,lng,zoom
 *  - https://www.google.com/maps/place/.../data=...!3dlat!4dlng
 *  - https://www.google.com/maps/place/name/@lat,lng,zoom
 *  - Raw HTML pages containing coordinate patterns
 */
export const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
  if (!url || !url.trim()) return null;
  const str = url.trim();

  // Pattern 1: ?q=lat,lng or ?q=lat%2Clng
  const qMatch = str.match(/[?&]q=(-?\d+\.?\d*)[,%2C]+(-?\d+\.?\d*)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 2: /@lat,lng,zoom
  const atMatch = str.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 3: !3dlat!4dlng (data param)
  const d3Match = str.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (d3Match) {
    const lat = parseFloat(d3Match[1]);
    const lng = parseFloat(d3Match[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 4: plain coords anywhere in URL/text (fallback)
  const coordMatch = str.match(/(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }

  return null;
};

/**
 * Expands a short Google Maps URL (maps.app.goo.gl / goo.gl/maps)
 * by fetching it through allorigins.win CORS proxy.
 * Returns the final expanded URL and/or extracted coordinates.
 */
export const expandShortGoogleMapsUrl = async (
  shortUrl: string
): Promise<{ lat: number; lng: number } | null> => {
  // Try via allorigins which follows redirects and returns status.url
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(shortUrl)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const data = await res.json();

  // 1. Try the final redirect URL from allorigins metadata
  if (data.status?.url) {
    const coords = parseGoogleMapsUrl(data.status.url);
    if (coords) return coords;
  }

  // 2. Search raw HTML content for coordinate patterns
  const html: string = data.contents || '';
  const coords = parseGoogleMapsUrl(html);
  if (coords) return coords;

  // 3. Try og:url meta tag inside the HTML
  const ogMatch = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i);
  if (ogMatch) {
    const coords2 = parseGoogleMapsUrl(ogMatch[1]);
    if (coords2) return coords2;
  }

  // 4. Try canonical link
  const canonMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  if (canonMatch) {
    const coords3 = parseGoogleMapsUrl(canonMatch[1]);
    if (coords3) return coords3;
  }

  return null;
};

