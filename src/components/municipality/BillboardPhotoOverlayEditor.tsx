import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Camera,
  ChevronRight,
  ChevronLeft,
  Ruler,
  Move,
  RotateCw,
  Maximize2,
  Save,
  CheckCircle2,
  X,
  Upload,
  Sparkles,
  Info,
  Building2,
  Plus,
  Minus,
  Eye,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export interface BillboardOverlayConfig {
  enabled: boolean;
  x_pct: number;            // 0-100% position X
  y_pct: number;            // 0-100% position Y
  scale_pct: number;        // scale % (100 default)
  rotation_deg: number;     // 0-360 deg
  reference_meters?: number;// e.g. 1.8m
  reference_pixels?: number;// line length in px
  cutout_image_url?: string | null;
}

export interface CollectionItemForOverlay {
  sequence_number: number;
  billboard_name?: string;
  location_text?: string;
  size: string;
  faces_count?: string;
  image_url?: string | null;
  municipality?: string;
  overlay_config?: BillboardOverlayConfig;
}

interface BillboardPhotoOverlayEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CollectionItemForOverlay[];
  initialIndex?: number;
  onSaveItemOverlay: (sequenceNumber: number, config: BillboardOverlayConfig) => void;
  defaultCutoutUrl?: string | null;
  sizeCutoutMap?: Record<string, string>;
}

// Utility: parse size string like "8x3" or "12x4x3"
const parseSizeDimensions = (sizeStr: string) => {
  if (!sizeStr) return { length: 8, width: 3, height: 0, ratio: 2.67, formatted: '8m × 3m' };
  const normalized = sizeStr.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x');
  const parts = normalized.split('x').map(p => p.trim());
  
  const cleanVal = (str: string) => {
    if (!str) return 0;
    const match = str.match(/^([0-9]+(?:\.[0-9]+)?)/);
    return match ? parseFloat(match[1]) : parseFloat(str) || 0;
  };

  const l = cleanVal(parts[0] || '') || 8;
  const w = cleanVal(parts[1] || '') || 3;
  const h = cleanVal(parts[2] || '') || 0;
  const ratio = l > 0 && w > 0 ? l / w : 2.5;
  return {
    length: l,
    width: w,
    height: h,
    ratio,
    formatted: `${l}m × ${w}m${h > 0 ? ` × ${h}m` : ''}`,
  };
};

export const BillboardPhotoOverlayEditor: React.FC<BillboardPhotoOverlayEditorProps> = ({
  open,
  onOpenChange,
  items,
  initialIndex = 0,
  onSaveItemOverlay,
  defaultCutoutUrl,
  sizeCutoutMap = {},
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const currentItem = items[currentIndex] || items[0];
  const dims = parseSizeDimensions(currentItem?.size || '');

  // Local Overlay state for the current item
  const [config, setConfig] = useState<BillboardOverlayConfig>({
    enabled: true,
    x_pct: 50,
    y_pct: 50,
    scale_pct: 100,
    rotation_deg: 0,
    reference_meters: 1.8,
    reference_pixels: 0,
    cutout_image_url: null,
  });

  // Sync state when current item changes
  useEffect(() => {
    if (currentItem) {
      const existing = currentItem.overlay_config;
      setConfig(
        existing ? { ...existing, enabled: true } : {
          enabled: true,
          x_pct: 50,
          y_pct: 50,
          scale_pct: 100,
          rotation_deg: 0,
          reference_meters: 1.8,
          reference_pixels: 0,
          cutout_image_url: null,
        }
      );
    }
  }, [currentIndex, currentItem]);

  // Mode: 'move' | 'ruler'
  const [activeTool, setActiveTool] = useState<'move' | 'ruler'>('move');

  // Drawing reference ruler line state
  const [isDrawingRuler, setIsDrawingRuler] = useState(false);
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);

  // Dragging billboard state
  const [isDraggingBillboard, setIsDraggingBillboard] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cutoutInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Auto-detect image dimensions on load and compute an ideal initial scale
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!currentItem.overlay_config) {
      const imgRatio = naturalWidth / naturalHeight;
      let initialScale = 100;
      if (imgRatio > 1.8) {
        initialScale = 85;
      } else if (imgRatio < 1) {
        initialScale = 120;
      }
      setConfig(prev => ({
        ...prev,
        scale_pct: initialScale,
      }));
    }
  };

  // Smart Auto-Scale & Center based on image dimensions
  const handleSmartAutoDetect = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const w = img.clientWidth || 800;

    const estimatedPxPerMeter = w / 20; 
    const targetBillboardWidthPx = dims.length * estimatedPxPerMeter;
    const calculatedScalePct = Math.round((targetBillboardWidthPx / 160) * 100);

    setConfig(prev => ({
      ...prev,
      x_pct: 50,
      y_pct: 55, 
      scale_pct: Math.max(30, Math.min(220, calculatedScalePct)),
      enabled: true,
    }));
    toast.success("تم التوسيط والتعرف الذكي على مقياس الصورة بنجاح! 🚀");
  };

  // Handle Cutout Image Upload
  const handleCutoutUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار صورة مفرغة بصيغة PNG أو SVG');
      return;
    }
    const url = URL.createObjectURL(file);
    setConfig(prev => ({ ...prev, cutout_image_url: url, enabled: true }));
    toast.success('تم رفع صورة اللوحة المفرغة وتفعيلها');
  };

  // Offset reference for smooth dragging from current position without jumping
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const configRef = useRef<BillboardOverlayConfig>(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Start billboard drag (Mouse or Touch)
  const startBillboardDrag = (clientX: number, clientY: number) => {
    if (!containerRef.current || activeTool !== 'move') return;
    const rect = containerRef.current.getBoundingClientRect();
    const mousePctX = ((clientX - rect.left) / rect.width) * 100;
    const mousePctY = ((clientY - rect.top) / rect.height) * 100;

    // Calculate exact offset from current overlay position
    dragOffsetRef.current = {
      x: mousePctX - configRef.current.x_pct,
      y: mousePctY - configRef.current.y_pct,
    };
    setIsDraggingBillboard(true);
  };

  const moveBillboardDrag = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mousePctX = ((clientX - rect.left) / rect.width) * 100;
    const mousePctY = ((clientY - rect.top) / rect.height) * 100;

    const newX = Math.max(2, Math.min(98, mousePctX - dragOffsetRef.current.x));
    const newY = Math.max(2, Math.min(98, mousePctY - dragOffsetRef.current.y));

    const updated = {
      ...configRef.current,
      x_pct: Math.round(newX * 10) / 10,
      y_pct: Math.round(newY * 10) / 10,
    };
    setConfig(updated);
  }, []);

  const endBillboardDrag = useCallback(() => {
    setIsDraggingBillboard(prev => {
      if (prev && currentItem) {
        // Auto-save position to Database and parent state immediately on drag release!
        onSaveItemOverlay(currentItem.sequence_number, configRef.current);
      }
      return false;
    });
  }, [currentItem, onSaveItemOverlay]);

  // Global mouse & touch listeners for continuous drag and drag-release
  useEffect(() => {
    if (!isDraggingBillboard) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      moveBillboardDrag(e.clientX, e.clientY);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        moveBillboardDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalEnd = () => {
      endBillboardDrag();
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalTouchMove);
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDraggingBillboard, moveBillboardDrag, endBillboardDrag]);

  // Canvas Mouse/Touch handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'ruler') {
      setIsDrawingRuler(true);
      setRulerStart({ x, y });
      setRulerEnd({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'ruler' && isDrawingRuler && rulerStart) {
      setRulerEnd({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'ruler' && isDrawingRuler && rulerStart && rulerEnd) {
      setIsDrawingRuler(false);
      const dx = rulerEnd.x - rulerStart.x;
      const dy = rulerEnd.y - rulerStart.y;
      const pxLen = Math.round(Math.sqrt(dx * dx + dy * dy));

      if (pxLen > 10) {
        const refMeters = config.reference_meters || 1.8;
        const pxPerMeter = pxLen / refMeters;
        const targetBillboardWidthPx = dims.length * pxPerMeter;
        const calculatedScalePct = Math.round((targetBillboardWidthPx / 160) * 100);

        const newCfg = {
          ...config,
          reference_pixels: pxLen,
          scale_pct: Math.max(20, Math.min(400, calculatedScalePct)),
          enabled: true,
        };
        setConfig(newCfg);
        if (currentItem) {
          onSaveItemOverlay(currentItem.sequence_number, newCfg);
        }
        setActiveTool('move');
        toast.success(`تم إحتساب السكيل الواقعي تلقائياً! (${pxLen}px = ${refMeters}m)`);
      }
    }
    endBillboardDrag();
  };

  // Save changes for current item
  const handleSaveCurrent = () => {
    if (currentItem) {
      onSaveItemOverlay(currentItem.sequence_number, config);
      toast.success(`تم حفظ وضعية اللوحة #${currentItem.sequence_number}`);
    }
  };

  if (!currentItem) return null;

  // Resolve active cutout URL (Item Cutout > Admin Size PNG Cutout > Default Cutout)
  const sizeKey = currentItem.size?.trim() || '';
  const sizeCutoutUrl = sizeCutoutMap[sizeKey] || sizeCutoutMap[sizeKey.replace(/×/g, 'x').replace(/X/g, 'x')] || null;
  const activeCutoutUrl = config.cutout_image_url || sizeCutoutUrl || defaultCutoutUrl || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[92vh] max-h-[92vh] border-border/30 rounded-3xl bg-background text-foreground shadow-2xl p-0 overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-6 py-3.5 border-b border-border/30 flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-md">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-extrabold text-lg flex items-center gap-2">
                <span>محرر تراكب اللوحة والتناسب الواقعي</span>
                <Badge className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 rounded-lg">
                  لوحة #{currentItem.sequence_number}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                تراكب بصري بمقياس واقعي للموقع الميداني للطباعة والحفظ
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/40 border border-border/40 px-4 py-2 rounded-2xl">
              <Switch
                checked={config.enabled}
                onCheckedChange={val => setConfig(p => ({ ...p, enabled: val }))}
              />
              <span className="text-sm font-bold">تفعيل تراكب اللوحة</span>
            </div>

            <Button
              onClick={handleSaveCurrent}
              className="rounded-2xl h-11 px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold shadow-md text-sm"
            >
              <Save className="h-4 w-4" />
              حفظ اللوحة
            </Button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">

          {/* ── LEFT CANVAS VIEW (8 Cols) ── */}
          <div className="lg:col-span-8 bg-slate-950 p-4 flex flex-col justify-between relative overflow-hidden select-none">

            {/* Real World Specs Badge */}
            <div className="absolute top-6 right-6 z-30 bg-slate-900/90 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-2.5 text-white shadow-xl pointer-events-none">
              <div className="flex items-center gap-2 font-extrabold text-amber-400 text-sm">
                <Info className="h-4 w-4" />
                <span>المواصفات الهندسية للوحة:</span>
              </div>
              <div className="text-xs text-slate-200 mt-1 flex items-center gap-3 font-mono dir-ltr">
                <span className="font-bold">{dims.formatted}</span>
                <span>| النسبة: {dims.ratio.toFixed(2)}:1</span>
              </div>
            </div>

            {/* Canvas Container */}
            <div
              ref={containerRef}
              className="relative w-full aspect-[16/9] max-h-[580px] rounded-2xl overflow-hidden bg-slate-900 border border-white/15 cursor-crosshair flex items-center justify-center shadow-lg"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {currentItem.image_url ? (
                <img
                  ref={imgRef}
                  src={currentItem.image_url}
                  alt="صورة الموقع"
                  className="w-full h-full object-contain pointer-events-none"
                  onLoad={handleImageLoad}
                />
              ) : (
                <div className="text-center text-slate-500 py-20">
                  <Camera className="h-16 w-16 mx-auto mb-3 opacity-30" />
                  <p className="text-base font-semibold">لا توجد صورة موقع لهذه اللوحة</p>
                </div>
              )}

              {/* Reference Ruler Line */}
              {rulerStart && rulerEnd && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                  <line
                    x1={rulerStart.x}
                    y1={rulerStart.y}
                    x2={rulerEnd.x}
                    y2={rulerEnd.y}
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeDasharray="8,5"
                  />
                  <circle cx={rulerStart.x} cy={rulerStart.y} r="7" fill="#f59e0b" className="animate-pulse" />
                  <circle cx={rulerEnd.x} cy={rulerEnd.y} r="7" fill="#f59e0b" className="animate-pulse" />
                  {config.reference_pixels ? (
                    <g transform={`translate(${(rulerStart.x + rulerEnd.x) / 2}, ${(rulerStart.y + rulerEnd.y) / 2 - 12})`}>
                      <rect x="-65" y="-14" width="130" height="24" rx="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="1" />
                      <text fill="#f59e0b" fontSize="12" fontWeight="bold" textAnchor="middle" y="3">
                        {config.reference_meters}m ({config.reference_pixels}px)
                      </text>
                    </g>
                  ) : null}
                </svg>
              )}

              {/* ── BILLBOARD OVERLAY FRAME ── */}
              {config.enabled && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${config.x_pct}%`,
                    top: `${config.y_pct}%`,
                    transform: `translate(-50%, -50%) scale(${(config.scale_pct / 100) * (isDraggingBillboard ? 1.05 : 1)}) rotate(${config.rotation_deg}deg)`,
                    transformOrigin: 'center center',
                    cursor: activeTool === 'move' ? (isDraggingBillboard ? 'grabbing' : 'grab') : 'crosshair',
                  }}
                  className={`z-30 transition-all duration-100 group ${
                    activeTool === 'ruler'
                      ? 'pointer-events-none opacity-30 select-none'
                      : 'pointer-events-auto opacity-100'
                  } ${isDraggingBillboard ? 'ring-4 ring-amber-400 ring-dashed rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] scale-105' : 'hover:ring-2 hover:ring-amber-500/50 rounded-2xl'}`}
                  onMouseDown={(e) => {
                    if (activeTool === 'move') {
                      e.stopPropagation();
                      startBillboardDrag(e.clientX, e.clientY);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (activeTool === 'move' && e.touches[0]) {
                      e.stopPropagation();
                      startBillboardDrag(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                >
                  {/* Canva Style Visual drag handles */}
                  {activeTool === 'move' && (
                    <>
                      {/* Floating status tag above */}
                      <div className={`absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900/90 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-xl transition-opacity whitespace-nowrap flex items-center gap-1.5 ${isDraggingBillboard ? 'opacity-100 scale-105' : 'opacity-0 group-hover:opacity-100'}`}>
                        <Move className="h-3.5 w-3.5 animate-pulse" />
                        <span>{isDraggingBillboard ? `جاري السحب والتحريك (${config.x_pct}%, ${config.y_pct}%)` : 'اسحب لتحريك اللوحة'}</span>
                      </div>
                      
                      {/* Corner crop/drag circles */}
                      <div className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full z-45 shadow-lg" />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full z-45 shadow-lg" />
                      <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full z-45 shadow-lg" />
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full z-45 shadow-lg" />
                      
                      {/* Bounding golden box */}
                      <div className="absolute inset-0 border-2 border-amber-500/40 rounded-2xl pointer-events-none group-hover:border-amber-500 transition-colors" />
                    </>
                  )}

                  {activeCutoutUrl ? (
                    <div className="relative">
                      <img
                        src={activeCutoutUrl}
                        alt="اللوحة المفرغة"
                        className="max-w-[280px] h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 rounded-xl transition-all"
                      />
                    </div>
                  ) : (
                    /* ── HIGH VISIBILITY DEFAULT 3D BILLBOARD FRAME ── */
                    <div className="flex flex-col items-center">
                      <div
                        className="bg-gradient-to-br from-amber-600 via-amber-700 to-slate-900 border-4 border-amber-400 text-white font-extrabold flex flex-col items-center justify-center p-3 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-md relative"
                        style={{
                          width: `${Math.max(140, 100 * dims.ratio)}px`,
                          height: '90px',
                        }}
                      >
                        <div className="absolute top-1 right-2 text-[9px] bg-black/50 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {currentItem.size}
                        </div>
                        <span className="text-sm font-bold text-center truncate max-w-full text-white drop-shadow">
                          {currentItem.billboard_name || `لوحة #${currentItem.sequence_number}`}
                        </span>
                        <span className="text-xs text-amber-200 mt-1 font-semibold">
                          {currentItem.location_text || 'موقع اللوحة'}
                        </span>
                      </div>
                      {/* Pole / Stand */}
                      <div className="w-2.5 h-16 bg-gradient-to-b from-slate-400 via-slate-600 to-slate-800 shadow-xl border-x border-white/20" />
                      <div className="w-12 h-2.5 bg-slate-900 rounded-full border border-white/20 shadow" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Tools Mode Switcher */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-white/15 rounded-2xl p-3 px-5 text-sm text-white">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant={activeTool === 'move' ? 'default' : 'ghost'}
                  onClick={() => setActiveTool('move')}
                  className={`h-10 rounded-xl gap-2 text-xs font-bold px-4 ${
                    activeTool === 'move' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Move className="h-4 w-4" />
                  سحب وتحريك اللوحة
                </Button>
                <Button
                  size="sm"
                  variant={activeTool === 'ruler' ? 'default' : 'ghost'}
                  onClick={() => setActiveTool('ruler')}
                  className={`h-10 rounded-xl gap-2 text-xs font-bold px-4 ${
                    activeTool === 'ruler' ? 'bg-primary text-primary-foreground shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Ruler className="h-4 w-4" />
                  رسم مقياس مرجعي
                </Button>
              </div>

              <div className="text-xs text-slate-300 font-medium">
                {activeTool === 'ruler'
                  ? 'انقر واسحب سهماً مرجعياً على عنصر معروف (مثل عرض سيارة 1.8م)'
                  : 'اسحب أيقونة اللوحة بالماوس لتموضعها على المكان المناسب بالصورة'}
              </div>
            </div>
          </div>

          {/* ── RIGHT CONTROLS PANEL (4 Cols) ── */}
          <div className="lg:col-span-4 p-6 space-y-6 border-r border-border/30 bg-card/60 overflow-y-auto min-h-0 select-text">

            {/* Smart Detection & Positioning */}
            <div className="space-y-2.5 p-4 bg-primary/10 border border-primary/30 rounded-2xl">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-extrabold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5" />
                  التعرف الذكي والتوسيط
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                كشف الأبعاد الميدانية للصورة تلقائياً وتوسيط اللوحة بلمسة واحدة
              </p>
              <Button
                onClick={handleSmartAutoDetect}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-extrabold gap-2 mt-1 shadow"
              >
                <RefreshCw className="h-4 w-4" />
                معايرة الأبعاد والتوسيط
              </Button>
            </div>

            {/* Cutout Image Section */}
            <div className="space-y-3 p-4 bg-muted/30 border border-border/30 rounded-2xl">
              <Label className="text-sm font-bold flex items-center justify-between">
                <span>صورة PNG مفرغة بدون خلفية</span>
                <Upload className="h-4 w-4 text-amber-500" />
              </Label>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => cutoutInputRef.current?.click()}
                  className="h-10 rounded-xl border-border bg-background gap-2 text-xs font-bold flex-1"
                >
                  <Upload className="h-4 w-4 text-primary" />
                  رفع صورة مفرغة
                </Button>
                <input
                  ref={cutoutInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleCutoutUpload(f);
                  }}
                />
                {config.cutout_image_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfig(p => ({ ...p, cutout_image_url: null }))}
                    className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10"
                    title="حذف الصورة المفرغة"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Reference Scale Controls */}
            <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <Label className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Ruler className="h-4.5 w-4.5" />
                المقياس المرجعي المعياري
              </Label>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setConfig(p => ({ ...p, reference_meters: Math.max(0.5, Number(((p.reference_meters || 1.8) - 0.1).toFixed(1))) }))}
                  className="h-9 w-9 rounded-xl"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="number"
                  step="0.1"
                  value={config.reference_meters || 1.8}
                  onChange={e =>
                    setConfig(p => ({
                      ...p,
                      reference_meters: parseFloat(e.target.value) || 1.8,
                    }))
                  }
                  className="h-9 text-sm rounded-xl bg-background text-center font-extrabold w-24"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setConfig(p => ({ ...p, reference_meters: Number(((p.reference_meters || 1.8) + 0.1).toFixed(1)) }))}
                  className="h-9 w-9 rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>

                <span className="text-xs font-bold text-muted-foreground">أمتار</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                (أمثلة مرجعية: عرض سيارة 1.8م • ارتفاع شخص 1.7م • طول إطار 2.3م)
              </p>
            </div>

            {/* Sliders & Numeric Controls */}
            <div className="space-y-5">
              {/* Scale Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>الحجم والسكيل (%)</span>
                  <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30">
                    {config.scale_pct}%
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[config.scale_pct]}
                    min={20}
                    max={300}
                    step={1}
                    onValueChange={([v]) => {
                      const updated = { ...config, scale_pct: v };
                      setConfig(updated);
                      if (currentItem) onSaveItemOverlay(currentItem.sequence_number, updated);
                    }}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Rotation Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>زاوية التدوير (درجة)</span>
                  <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30">
                    {config.rotation_deg}°
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[config.rotation_deg]}
                    min={-45}
                    max={45}
                    step={1}
                    onValueChange={([v]) => {
                      const updated = { ...config, rotation_deg: v };
                      setConfig(updated);
                      if (currentItem) onSaveItemOverlay(currentItem.sequence_number, updated);
                    }}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Direct X / Y Position Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">الموقع أفقي (X%)</Label>
                  <Input
                    type="number"
                    value={config.x_pct}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const updated = { ...config, x_pct: val };
                      setConfig(updated);
                      if (currentItem) onSaveItemOverlay(currentItem.sequence_number, updated);
                    }}
                    className="h-10 text-xs rounded-xl bg-background font-bold text-center"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">الموقع عمودي (Y%)</Label>
                  <Input
                    type="number"
                    value={config.y_pct}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const updated = { ...config, y_pct: val };
                      setConfig(updated);
                      if (currentItem) onSaveItemOverlay(currentItem.sequence_number, updated);
                    }}
                    className="h-10 text-xs rounded-xl bg-background font-bold text-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── BOTTOM THUMBNAILS CAROUSEL SLIDER ─── */}
        <div className="p-3 border-t border-border/30 bg-card flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="h-11 w-11 shrink-0 rounded-2xl border-border"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          <div className="flex items-center gap-2.5 flex-1 overflow-x-auto no-scrollbar py-1">
            {items.map((it, idx) => (
              <button
                key={it.sequence_number}
                onClick={() => setCurrentIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                  idx === currentIndex
                    ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                    : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted'
                }`}
              >
                <span className="font-extrabold">#{it.sequence_number}</span>
                <span className="max-w-[120px] truncate">{it.billboard_name || it.location_text || `لوحة ${it.sequence_number}`}</span>
                {it.overlay_config?.enabled && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
            disabled={currentIndex === items.length - 1}
            className="h-11 w-11 shrink-0 rounded-2xl border-border"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default BillboardPhotoOverlayEditor;
