import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { toBlob as htmlToImageBlob, getFontEmbedCSS } from 'html-to-image';
import { extractImagePalette, pickAccentColor, pickGlowColor, pickSecondaryColor, alphaToHex } from '@/utils/extractImagePalette';
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Save,
  Download,
  Upload,
  FolderOpen,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Layout,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Lock,
  Unlock,
  Phone,
  Globe,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Mail,
  MessageSquare,
  Star,
  Check,
  Heart,
  Info,
  Smile,
  Instagram,
  Facebook,
  Twitter,
  Gift,
  Award,
  Plus,
  Trash,
  ArrowRight,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignCenterHorizontal,
  Copy,
  Move,
  Layers,
  X,
  RotateCcw,
  Maximize2,
  Pencil,
  Shuffle,
} from 'lucide-react';

// ====================== TYPES ======================

interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'icon';
  label: string;
  textKey: string;
  visible: boolean;
  fontSize: number;
  fontColor: string;
  fontWeight: string;
  alignment: 'left' | 'center' | 'right';
  x: number;
  y: number;
  customText?: string;
  fontFamily?: string;
  
  // Icon inside text element (group icon)
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  iconBackground?: boolean;
  iconBgColor?: string;

  // Custom Image element
  url?: string;
  width?: number;
  height?: number;
  borderRadius?: number;

  // Custom Icon element
  iconName?: string;

  // Grouping
  groupId?: string;
  parentStrip?: 'panel' | 'location';

  // Composite multi-part text (e.g. "البلدية - المنطقة") with independent per-part styling
  parts?: {
    separator?: string;
    municipality?: { fontSize?: number; fontWeight?: string; fontColor?: string };
    region?: { fontSize?: number; fontWeight?: string; fontColor?: string };
  };
}

interface ImageStyle {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadow: boolean;
  objectFit?: string;
}

interface GlassPanelStyle {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  blur: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  shadow: boolean;
}

interface CompanyInfo {
  name: string;
  subtitle: string;
  phone: string;
  website: string;
  logoUrl: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  canvas_width: number;
  canvas_height: number;
  bg_type: 'replica_blur' | 'solid' | 'gradient' | 'image';
  bg_color?: string;
  bg_image_url?: string;
  blur_amount: number;
  glass_panel_style: GlassPanelStyle & {
    locationStrip?: {
      visible: boolean;
      height: number;
      backgroundColor: string;
      textColor: string;
      fontSize: number;
      opacity?: number;
      blur?: number;
      borderWidth?: number;
      borderColor?: string;
      borderRadius?: number;
    };
    companyInfo?: CompanyInfo;
    layoutMode?: 'normal' | 'cover';
    coverTitle1?: string;
    coverTitle2?: string;
    coverBadge?: string;
    coverKicker?: string;
    coverCampaignName?: string;
    coverTagline?: string;
    coverCopyright?: string;
    coverFooterRight?: string;
    coverShow?: { clientInfo?: boolean; companyBrand?: boolean; kicker?: boolean; tagline?: boolean; badge?: boolean; copyright?: boolean; footerRight?: boolean; collage?: boolean };
  };
  text_elements: CanvasElement[];
  image_style: ImageStyle;
}

interface GroupedContract {
  contract_id: string | number;
  taskIds: string[];
  teams: string[];
  created_at: string;
  customerName?: string;
  adType?: string;
  designImage?: string;
  totalItems?: number;
  photoItems?: number;
  photoStatus?: 'all' | 'partial' | 'none' | 'unknown';
}

interface InstallationTask {
  id: string;
  contract_id: string | number;
  task_type: string;
  created_at: string;
  installation_teams: { team_name: string } | null;
}

interface TaskItem {
  id: string;
  task_id: string;
  billboard_id: string | number;
  installation_date?: string;
  installed_image_url?: string;
  installed_image_face_a_url?: string;
  installed_image_face_b_url?: string;
  design_face_a?: string;
  design_face_b?: string;
}

interface ItemDetails {
  customer_name: string;
  ad_type: string;
  municipality: string;
  region: string;
  landmark: string;
  billboard_code: string;
  size: string;
  installation_date: string;
  installed_image: string;
  installed_face_a: string;
  installed_face_b: string;
  company_name: string;
  company_subtitle: string;
  campaign_label: string;
  size_label: string;
  phone: string;
  website: string;
  [key: string]: string;
}

// Icon mapper for dynamic icons
const iconMap: Record<string, React.ComponentType<any>> = {
  'phone': Phone,
  'globe': Globe,
  'map-pin': MapPin,
  'mail': Mail,
  'message': MessageSquare,
  'star': Star,
  'check': Check,
  'heart': Heart,
  'info': Info,
  'sparkles': Sparkles,
  'smile': Smile,
  'instagram': Instagram,
  'facebook': Facebook,
  'twitter': Twitter,
  'gift': Gift,
  'award': Award,
};

const renderLucideIcon = (name: string, color: string, size: number) => {
  const IconComponent = iconMap[name.toLowerCase()] || Sparkles;
  return <IconComponent color={color} size={size} />;
};

// ====================== DEFAULT TEMPLATE CONFIG ======================

const DEFAULT_CANVAS_WIDTH = 1500;
const DEFAULT_CANVAS_HEIGHT = 2000;

// Main image: fills the canvas behind everything
const DEFAULT_IMAGE_STYLE = {
  x: 0,
  y: 0,
  width: 1500,
  height: 1600,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#ffffff',
  shadow: false,
  objectFit: 'cover',
};

// Bottom info bar
const DEFAULT_GLASS_PANEL = {
  visible: true,
  x: 0,
  y: 1600,
  width: 1500,
  height: 280,
  opacity: 0.92,
  blur: 15,
  borderRadius: 0,
  borderWidth: 2,
  borderColor: '#ffffff20',
  backgroundColor: '#1a1a2e',
  shadow: false,
};

// Location strip at the very bottom
const DEFAULT_LOCATION_STRIP = {
  visible: true,
  height: 120,
  backgroundColor: '#c9a84c',
  textColor: '#1a1a2e',
  fontSize: 32,
  opacity: 0.9,
  blur: 10,
  borderWidth: 0,
  borderColor: '#ffffff20',
  borderRadius: 0,
};

// Default text elements
const DEFAULT_TEXT_ELEMENTS: CanvasElement[] = [
  // Left Section: Company Logo & Subtitle
  { id: 'company_logo', type: 'image', label: 'شعار الشركة', textKey: 'company_logo', visible: true, fontSize: 12, fontColor: '', fontWeight: 'normal', alignment: 'center', x: 180, y: 40, url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 10 L80 25 L80 55 C80 75 50 90 50 90 C50 90 20 75 20 55 L20 25 Z" fill="none" stroke="%23c9a84c" stroke-width="4" /><path d="M50 20 L70 32 L70 52 C70 67 50 78 50 78 C50 78 30 67 30 52 L30 32 Z" fill="%23c9a84c" opacity="0.3" /><text x="50" y="58" font-size="22" font-weight="bold" fill="%23c9a84c" text-anchor="middle" font-family="sans-serif">AD</text></svg>', width: 120, height: 120, borderRadius: 0, parentStrip: 'panel' },
  { id: 'company_subtitle', type: 'text', label: 'الوصف', textKey: 'company_subtitle', visible: false, fontSize: 16, fontColor: '#b0b0b0', fontWeight: '400', alignment: 'center', x: 180, y: 170, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  // Center-Left: Campaign
  { id: 'campaign_label', type: 'text', label: 'عنوان الحملة', textKey: 'campaign_label', visible: true, fontSize: 20, fontColor: '#b0b0b0', fontWeight: '400', alignment: 'center', x: 660, y: 40, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  { id: 'client_name', type: 'text', label: 'شعار الحملة', textKey: 'customer_name', visible: true, fontSize: 32, fontColor: '#ffffff', fontWeight: '700', alignment: 'center', x: 660, y: 105, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif", customText: 'إعلانك بارز مع الفارس' },
  { id: 'ad_type', type: 'text', label: 'نوع الإعلان', textKey: 'ad_type', visible: true, fontSize: 22, fontColor: '#c9a84c', fontWeight: '600', alignment: 'center', x: 660, y: 175, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  // Center-Right: Size
  { id: 'size_label', type: 'text', label: 'المقاس', textKey: 'size_label', visible: true, fontSize: 20, fontColor: '#b0b0b0', fontWeight: '400', alignment: 'center', x: 1035, y: 60, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  { id: 'size', type: 'text', label: 'المقاس', textKey: 'size', visible: true, fontSize: 48, fontColor: '#ffffff', fontWeight: '700', alignment: 'center', x: 1035, y: 120, parentStrip: 'panel', fontFamily: "'Montserrat', sans-serif" },
  // Right: Contact
  { id: 'phone', type: 'text', label: 'الهاتف', textKey: 'phone', visible: true, fontSize: 22, fontColor: '#ffffff', fontWeight: '600', alignment: 'right', x: 1470, y: 60, parentStrip: 'panel', icon: 'phone', iconColor: '#1a1a2e', iconSize: 16, iconBackground: true, iconBgColor: '#c9a84c', fontFamily: "'Montserrat', sans-serif" },
  { id: 'website', type: 'text', label: 'الموقع', textKey: 'website', visible: true, fontSize: 22, fontColor: '#c9a84c', fontWeight: '600', alignment: 'right', x: 1470, y: 110, parentStrip: 'panel', icon: 'globe', iconColor: '#1a1a2e', iconSize: 16, iconBackground: true, iconBgColor: '#c9a84c', fontFamily: "'Montserrat', sans-serif" },
  // Location strip texts
  { id: 'municipality_region', type: 'text', label: 'البلدية + المنطقة', textKey: 'municipality_region', visible: true, fontSize: 28, fontColor: '#1a1a2e', fontWeight: '700', alignment: 'center', x: 750, y: 25, parentStrip: 'location', parts: { separator: ' - ', municipality: { fontSize: 30, fontWeight: '700' }, region: { fontSize: 24, fontWeight: '600' } } },
  { id: 'landmark', type: 'text', label: 'أقرب نقطة', textKey: 'landmark', visible: true, fontSize: 20, fontColor: '#4a4a6a', fontWeight: '400', alignment: 'center', x: 750, y: 85, parentStrip: 'location' },
];

export default function DesignStudio() {
  const navigate = useNavigate();

  // ═══════ UI & State ═══════
  const [tasks, setTasks] = useState<InstallationTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [groupedContracts, setGroupedContracts] = useState<GroupedContract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  
  // ═══════ Photoshop-like Undo/Redo & Layout Mode States ═══════
  const [layoutMode, setLayoutMode] = useState<'normal' | 'cover'>('normal');
  const [coverTitle1, setCoverTitle1] = useState('زبونك يهتم بمظهر');
  const [coverTitle2, setCoverTitle2] = useState('علامتك التجارية');
  const [coverBadge, setCoverBadge] = useState('معاينة لوحات التركيب');
  // ═══════ Gold Cover (new) ═══════
  const [coverKicker, setCoverKicker] = useState('حملتك الإعلانية');
  const [coverCampaignName, setCoverCampaignName] = useState('');
  const [coverTagline, setCoverTagline] = useState('إعلانك بارز مع الفارس');
  const [coverCopyright, setCoverCopyright] = useState('All artistic and intellectual property rights of the displayed works are fully reserved.');
  const [coverFooterRight, setCoverFooterRight] = useState('Built on experience');
  const [coverShow, setCoverShow] = useState({
    clientInfo: true,
    companyBrand: true,
    companyLogo: true,
    companyName: true,
    kicker: true,
    tagline: true,
    badge: false,
    copyright: true,
    footerRight: true,
    collage: true,
  });

  const [coverFontSizes, setCoverFontSizes] = useState({
    kicker: 32,
    campaignName: 128,
    tagline: 30,
    badge: 22,
    copyright: 14,
    footerRight: 22,
    companyBrandLogo: 64,
    companyBrandName: 30,
  });

  const [coverAccentColor, setCoverAccentColor] = useState('#d6ac40');
  const [coverSecondaryColor, setCoverSecondaryColor] = useState('#ffffff');
  const [coverGlowColor, setCoverGlowColor] = useState('#000000');
  const [coverTemplate, setCoverTemplate] = useState<'template1' | 'template2' | 'template3' | 'template4' | 'template5'>('template3');
  // Helper to change templates and load sensible defaults for sliders to avoid clashes
  // Helper to change templates and load sensible defaults for sliders to avoid clashes
  const handleSelectTemplate = (id: 'template1' | 'template2' | 'template3' | 'template4' | 'template5') => {
    setCoverTemplate(id);
    
    // Check if there are user saved default settings in localStorage
    try {
      const saved = localStorage.getItem(`design_studio:default_settings:${id}`);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.coverT4) setCoverT4(s.coverT4);
        if (s.coverT5Style) setCoverT5Style(s.coverT5Style);
        if (s.coverT5ColorMode !== undefined) setCoverT5ColorMode(s.coverT5ColorMode);
        if (s.coverT5FillBackground !== undefined) setCoverT5FillBackground(s.coverT5FillBackground);
        if (s.coverT5BgColorOnly !== undefined) setCoverT5BgColorOnly(s.coverT5BgColorOnly);
        if (s.coverT5SlatCount !== undefined) setCoverT5SlatCount(s.coverT5SlatCount);
        if (s.coverT5BgShatter !== undefined) setCoverT5BgShatter(s.coverT5BgShatter);
        if (s.coverAccentColor) setCoverAccentColor(s.coverAccentColor);
        if (s.coverSecondaryColor) setCoverSecondaryColor(s.coverSecondaryColor);
        if (s.coverGlowColor) setCoverGlowColor(s.coverGlowColor);
        if (s.coverGlowIntensity) setCoverGlowIntensity(s.coverGlowIntensity);
        if (s.coverSwapSides !== undefined) setCoverSwapSides(s.coverSwapSides);
        if (s.coverTextCentered !== undefined) setCoverTextCentered(s.coverTextCentered);
        if (s.coverFontSizes) setCoverFontSizes(s.coverFontSizes);
        if (s.coverElementColors) setCoverElementColors(s.coverElementColors);
        if (s.coverThemeMode) setCoverThemeMode(s.coverThemeMode);
        if (s.coverMixImages !== undefined) setCoverMixImages(s.coverMixImages);
        if (s.coverUseInstalledImages !== undefined) setCoverUseInstalledImages(s.coverUseInstalledImages);
        if (s.coverIncludeBackFace !== undefined) setCoverIncludeBackFace(s.coverIncludeBackFace);
        if (s.bgType) setBgType(s.bgType);
        if (s.bgColor1) setBgColor1(s.bgColor1);
        if (s.bgColor2) setBgColor2(s.bgColor2);
        if (s.blurAmount !== undefined) setBlurAmount(s.blurAmount);
        return; // Skip hardcoded defaults
      }
    } catch (e) {
      console.error('Failed to load custom defaults from local storage:', e);
    }

    if (id === 'template1') {
      setCoverT4({ cardHeight: 45, fgBlur: 1.8, bgBlur: 35, zoom: 1.0 });
    } else if (id === 'template2') {
      setCoverT4({ cardHeight: 1.0, fgBlur: 1.4, bgBlur: 10, zoom: 1.2 });
    } else if (id === 'template3') {
      setCoverT4({ cardHeight: 1.0, fgBlur: 1.4, bgBlur: 10, zoom: 1.0 });
    } else if (id === 'template4') {
      setCoverT4({ cardHeight: 1.0, fgBlur: 1.4, bgBlur: 10, zoom: 1.3 });
    } else if (id === 'template5') {
      setCoverT4({ cardHeight: 1.0, fgBlur: 0, bgBlur: 10, zoom: 1.3 });
    }
  };

  const handleSaveDefaultTemplateSettings = () => {
    const defaultSettings = {
      coverT4,
      coverT5Style,
      coverT5ColorMode,
      coverT5FillBackground,
      coverT5BgColorOnly,
      coverT5SlatCount,
      coverT5BgShatter,
      coverAccentColor,
      coverSecondaryColor,
      coverGlowColor,
      coverGlowIntensity,
      coverSwapSides,
      coverTextCentered,
      coverFontSizes,
      coverElementColors,
      coverThemeMode,
      coverMixImages,
      coverUseInstalledImages,
      coverIncludeBackFace,
      bgType,
      bgColor1,
      bgColor2,
      blurAmount,
    };
    try {
      localStorage.setItem(`design_studio:default_settings:${coverTemplate}`, JSON.stringify(defaultSettings));
      const templateNum = coverTemplate === 'template1' ? '1' : coverTemplate === 'template2' ? '2' : coverTemplate === 'template3' ? '3' : coverTemplate === 'template4' ? '4' : '5';
      toast.success(`تم حفظ الإعدادات الحالية كافتراضية لقالب ${templateNum} بنجاح!`);
    } catch (e) {
      toast.error('فشل حفظ الإعدادات الافتراضية');
    }
  };

  const handleResetDefaultTemplateSettings = () => {
    try {
      localStorage.removeItem(`design_studio:default_settings:${coverTemplate}`);
      toast.success('تمت إعادة تعيين القالب للإعدادات الأصلية الافتراضية.');
      
      // Load standard defaults
      const id = coverTemplate;
      if (id === 'template1') {
        setCoverT4({ cardHeight: 45, fgBlur: 1.8, bgBlur: 35, zoom: 1.0 });
      } else if (id === 'template2') {
        setCoverT4({ cardHeight: 1.0, fgBlur: 1.4, bgBlur: 10, zoom: 1.2 });
      } else if (id === 'template3') {
        setCoverT4({ cardHeight: 1.0, fgBlur: 1.4, bgBlur: 10, zoom: 1.0 });
      } else if (id === 'template4') {
        setCoverT4({ cardHeight: 1.0, fgBlur: 1.4, bgBlur: 10, zoom: 1.3 });
      } else if (id === 'template5') {
        setCoverT4({ cardHeight: 1.0, fgBlur: 0, bgBlur: 10, zoom: 1.3 });
      }
    } catch (e) {
      toast.error('فشل إعادة تعيين الإعدادات الافتراضية');
    }
  };

  // Swap the sides of images and text in any cover template
  const [coverSwapSides, setCoverSwapSides] = useState<boolean>(false);
  const [coverTextCentered, setCoverTextCentered] = useState<boolean>(true);
  const [coverT4, setCoverT4] = useState({ cardHeight: 1, fgBlur: 1.4, bgBlur: 10, zoom: 1.3 });
  const [coverShuffleSeed, setCoverShuffleSeed] = useState<number>(() => Date.now());
  const [coverUseInstalledImages, setCoverUseInstalledImages] = useState<boolean>(false);
  const [coverMixImages, setCoverMixImages] = useState<boolean>(false);
  const [coverIncludeBackFace, setCoverIncludeBackFace] = useState<boolean>(false);
  const [coverT5FillBackground, setCoverT5FillBackground] = useState<boolean>(false);
  const [coverT5Style, setCoverT5Style] = useState<'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6'>('style1');
  const [coverT5ColorMode, setCoverT5ColorMode] = useState<boolean>(true);
  const [coverT5BgColorOnly, setCoverT5BgColorOnly] = useState<boolean>(false);
  const [coverT5SlatCount, setCoverT5SlatCount] = useState<number>(5);
  const [coverT5BgShatter, setCoverT5BgShatter] = useState<boolean>(true);

  // Glow / blur intensity behind text — sliders
  const [coverGlowIntensity, setCoverGlowIntensity] = useState({ opacity: 1, blur: 90, spread: 70 });

  // Per-element colors. Empty string = fall back to accent (current behavior).
  type CoverElementColors = {
    kicker: string; campaignName: string; tagline: string; badge: string;
    footerRight: string; brandName: string; useAccentForAll: boolean;
  };
  const [coverElementColors, setCoverElementColors] = useState<CoverElementColors>({
    kicker: '', campaignName: '', tagline: '', badge: '',
    footerRight: '', brandName: '', useAccentForAll: true,
  });

  // Palette extracted from current design image + theme mode
  const [coverPalette, setCoverPalette] = useState<string[]>([]);
  const [coverThemeMode, setCoverThemeMode] = useState<'manual' | 'auto'>('manual');

  // Dynamic transparent masks for cover portal template (separated)
  const [coverPortalMaskWindowUrl, setCoverPortalMaskWindowUrl] = useState<string>('');
  const [coverPortalMaskReflectionUrl, setCoverPortalMaskReflectionUrl] = useState<string>('');
  const [coverPortalMaskChairUrl, setCoverPortalMaskChairUrl] = useState<string>('');

  useEffect(() => {
    const processMask = (src: string, setUrl: (url: string) => void) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          data[i + 3] = lum; // Set alpha channel to luminance
        }
        ctx.putImageData(imgData, 0, 0);
        setUrl(canvas.toDataURL('image/png'));
      };
      img.onerror = (e) => {
        console.error(`Failed to load mask image: ${src}`, e);
      };
      img.src = src;
    };

    processMask('/cover-portal-mask-window.png', setCoverPortalMaskWindowUrl);
    processMask('/cover-portal-mask-reflection.png', setCoverPortalMaskReflectionUrl);
    processMask('/cover-portal-mask-chair.png', setCoverPortalMaskChairUrl);
  }, []);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedItemDetails, setSelectedItemDetails] = useState<ItemDetails | null>(null);
  const [imageSource, setImageSource] = useState<'installed' | 'face_a' | 'face_b'>('face_a');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [showContractModal, setShowContractModal] = useState(false);
  const [photoFilter, setPhotoFilter] = useState<'all' | 'with_all' | 'partial' | 'none'>('all');

  // ═══════ Canvas ═══════
  const [canvasWidth, setCanvasWidth] = useState<number>(DEFAULT_CANVAS_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState<number>(DEFAULT_CANVAS_HEIGHT);
  const [zoom, setZoom] = useState<number>(0.38);
  const [bgType, setBgType] = useState<'replica_blur' | 'solid' | 'gradient' | 'image'>('replica_blur');
  const [bgColor1, setBgColor1] = useState<string>('#1a1a2e');
  const [bgColor2, setBgColor2] = useState<string>('#0f0f1e');
  const [bgImageUrl, setBgImageUrl] = useState<string>('');
  const [blurAmount, setBlurAmount] = useState<number>(30);

  // ═══════ Layers ═══════
  const [imageStyle, setImageStyle] = useState(DEFAULT_IMAGE_STYLE);
  const [glassPanel, setGlassPanel] = useState(DEFAULT_GLASS_PANEL);
  const [locationStrip, setLocationStrip] = useState(DEFAULT_LOCATION_STRIP);
  const [textElements, setTextElements] = useState<CanvasElement[]>(DEFAULT_TEXT_ELEMENTS);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('image');
  // Multi-selection support
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(['image']);
  // Panel (info bar) transform active
  const [panelTransformActive, setPanelTransformActive] = useState(false);
  // Active sidebar tab: 'data' | 'design' | 'layers'
  const [sidebarTab, setSidebarTab] = useState<'data' | 'design' | 'layers'>('data');

  // ═══════ Lock Mode: only image can be moved/resized ═══════
  const [lockMode, setLockMode] = useState(false);
  const [showQuickControls, setShowQuickControls] = useState(true);

  // ═══════ Export Mode: hide editor chrome (rings, handles, guides) during capture ═══════
  const [isExporting, setIsExporting] = useState(false);

  // ═══════ Company Info ═══════
  const [companyInfo, setCompanyInfo] = useState({
    name: 'الفـارس الذهـبي',
    subtitle: '',
    phone: '+218 91 322 8908',
    website: 'GLKN.LY',
    logoUrl: '',
  });

  // ═══════ Templates ═══════
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Studio-only override for the "ad type" text across ALL billboards (not persisted to DB)
  const [adTypeOverride, setAdTypeOverride] = useState<string>('');

  // ═══════ Designs from installation tasks ═══════
  const taskDesignsRef = useRef<Map<string, { a?: string; b?: string; cutout?: string }>>(new Map());
  // Forward ref so loadTemplates (declared above) can call handleLoadTemplate (declared below)
  const handleLoadTemplateRef = useRef<((id: string) => void) | null>(null);

  // ═══════ Drag & Snapping Guides ═══════
  const canvasRef = useRef<HTMLDivElement>(null);
  const [snapGuides, setSnapGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [dragState, setDragState] = useState<{
    activeId: string | null;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialPositions?: { id: string; x: number; y: number }[];
  }>({ activeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // ═══════ Photoshop-like Transform Bounding Box ═══════
  const [transformActive, setTransformActive] = useState(false);
  const [handleDragState, setHandleDragState] = useState<{
    handle: string | null;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
  }>({ handle: null, startX: 0, startY: 0, initialX: 0, initialY: 0, initialWidth: 0, initialHeight: 0 });

  // Panel (info bar) height-resize drag state
  const [panelHandleDragState, setPanelHandleDragState] = useState<{
    handle: string | null;
    startY: number;
    initialY: number;
    initialHeight: number;
    initialTextElements: CanvasElement[];
  }>({ handle: null, startY: 0, initialY: 0, initialHeight: 0, initialTextElements: [] });


  useEffect(() => {
    if (selectedLayerId !== 'image') {
      setTransformActive(false);
    }
    if (selectedLayerId !== 'panel') {
      setPanelTransformActive(false);
    }
  }, [selectedLayerId]);


  // ═══════ Refs for stable access ═══════
  const taskItemsRef = useRef<TaskItem[]>([]);
  const tasksRef = useRef<InstallationTask[]>([]);
  const companyInfoRef = useRef(companyInfo);
  // Always-current imageStyle snapshot for export and pointer interactions.
  const imageStyleRef = useRef(imageStyle);
  // Tracks whether user (or a loaded template) modified imageStyle so the
  // auto fit-to-canvas effect doesn't overwrite their settings.
  const imageStyleUserModifiedRef = useRef<boolean>(false);
  const setImageStyleSynced: typeof setImageStyle = (v: any) => {
    const next = typeof v === 'function' ? v(imageStyleRef.current) : v;
    imageStyleRef.current = next;
    setImageStyle(next);
  };
  // Wrapper that flips the user-modified flag so the auto fit-to-canvas
  // effect won't overwrite manual or template-driven imageStyle changes.
  const setImageStyleUser: typeof setImageStyle = (v: any) => {
    imageStyleUserModifiedRef.current = true;
    setImageStyleSynced(v);
  };

  useEffect(() => { taskItemsRef.current = taskItems; }, [taskItems]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { companyInfoRef.current = companyInfo; }, [companyInfo]);
  useEffect(() => { imageStyleRef.current = imageStyle; }, [imageStyle]);

  // Auto-populate cover campaign name from selected contract's Ad Type (only if user hasn't customized it)
  const lastAutoCampaignRef = useRef<string>('');
  useEffect(() => {
    const c = groupedContracts.find(x => String(x.contract_id) === selectedContractId) as any;
    const adType = c?.adType || '';
    if (!adType) return;
    if (!coverCampaignName || coverCampaignName === lastAutoCampaignRef.current) {
      setCoverCampaignName(adType);
      lastAutoCampaignRef.current = adType;
    }
  }, [selectedContractId, groupedContracts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill ad-type override input with current contract's ad type (editable)
  const lastAutoAdTypeRef = useRef<string>('');
  useEffect(() => {
    const c = groupedContracts.find(x => String(x.contract_id) === selectedContractId) as any;
    const adType = c?.adType || '';
    if (!adType) return;
    if (!adTypeOverride || adTypeOverride === lastAutoAdTypeRef.current) {
      setAdTypeOverride(adType);
      lastAutoAdTypeRef.current = adType;
    }
  }, [selectedContractId, groupedContracts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════ History (Undo / Redo) Implementations ═══════
  const restoreLayoutState = useCallback((stateStr: string) => {
    try {
      const state = JSON.parse(stateStr);
      if (state.textElements) setTextElements(state.textElements);
      if (state.imageStyle) { setImageStyleSynced(state.imageStyle); imageStyleUserModifiedRef.current = true; }
      if (state.glassPanel) setGlassPanel(state.glassPanel);
      if (state.locationStrip) setLocationStrip(state.locationStrip);
      if (state.bgType) setBgType(state.bgType);
      if (state.bgColor1) setBgColor1(state.bgColor1);
      if (state.bgColor2) setBgColor2(state.bgColor2);
      if (state.bgImageUrl) setBgImageUrl(state.bgImageUrl);
      if (state.blurAmount) setBlurAmount(state.blurAmount);
      if (state.canvasWidth) setCanvasWidth(state.canvasWidth);
      if (state.canvasHeight) setCanvasHeight(state.canvasHeight);
      if (state.layoutMode) setLayoutMode(state.layoutMode);
      if (state.coverTitle1) setCoverTitle1(state.coverTitle1);
      if (state.coverTitle2) setCoverTitle2(state.coverTitle2);
      if (state.coverBadge) setCoverBadge(state.coverBadge);
      if (state.coverKicker !== undefined) setCoverKicker(state.coverKicker);
      if (state.coverCampaignName !== undefined) setCoverCampaignName(state.coverCampaignName);
      if (state.coverTagline !== undefined) setCoverTagline(state.coverTagline);
      if (state.coverCopyright !== undefined) setCoverCopyright(state.coverCopyright);
      if (state.coverFooterRight !== undefined) setCoverFooterRight(state.coverFooterRight);
      if (state.coverShow && typeof state.coverShow === 'object') setCoverShow((p) => ({ ...p, ...state.coverShow }));
      if (state.coverTemplate) setCoverTemplate(state.coverTemplate);
      if (state.coverSwapSides !== undefined) setCoverSwapSides(state.coverSwapSides);
      if (state.coverTextCentered !== undefined) setCoverTextCentered(state.coverTextCentered);
      if (state.coverT4) setCoverT4(state.coverT4);
      if (state.coverFontSizes) setCoverFontSizes(state.coverFontSizes);
      if (state.coverT5Style) setCoverT5Style(state.coverT5Style);
      if (state.coverT5ColorMode !== undefined) setCoverT5ColorMode(state.coverT5ColorMode);
      if (state.coverT5FillBackground !== undefined) setCoverT5FillBackground(state.coverT5FillBackground);
      if (state.coverT5BgColorOnly !== undefined) setCoverT5BgColorOnly(state.coverT5BgColorOnly);
      if (state.coverT5SlatCount !== undefined) setCoverT5SlatCount(state.coverT5SlatCount);
      if (state.coverT5BgShatter !== undefined) setCoverT5BgShatter(state.coverT5BgShatter);
      if (state.coverAccentColor !== undefined) setCoverAccentColor(state.coverAccentColor);
      if (state.coverSecondaryColor !== undefined) setCoverSecondaryColor(state.coverSecondaryColor);
      if (state.coverGlowColor !== undefined) setCoverGlowColor(state.coverGlowColor);
      if (state.coverGlowIntensity) setCoverGlowIntensity(state.coverGlowIntensity);
      if (state.coverElementColors) setCoverElementColors(state.coverElementColors);
      if (state.coverThemeMode !== undefined) setCoverThemeMode(state.coverThemeMode);
      if (state.coverMixImages !== undefined) setCoverMixImages(state.coverMixImages);
      if (state.coverUseInstalledImages !== undefined) setCoverUseInstalledImages(state.coverUseInstalledImages);
      if (state.coverIncludeBackFace !== undefined) setCoverIncludeBackFace(state.coverIncludeBackFace);
      if (state.coverShuffleSeed !== undefined) setCoverShuffleSeed(state.coverShuffleSeed);
    } catch (e) {
      console.error('Failed to restore history state:', e);
    }
  }, []);

  const pushHistory = useCallback((newStateStr: string) => {
    setHistory(prev => {
      const updated = prev.slice(0, historyIndex + 1);
      if (updated[updated.length - 1] === newStateStr) return prev;
      const next = [...updated, newStateStr];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  const pushCurrentState = useCallback(() => {
    const stateStr = JSON.stringify({
      textElements,
      imageStyle,
      glassPanel,
      locationStrip,
      bgType,
      bgColor1,
      bgColor2,
      bgImageUrl,
      blurAmount,
      canvasWidth,
      canvasHeight,
      layoutMode,
      coverTitle1,
      coverTitle2,
      coverBadge,
      coverKicker,
      coverCampaignName,
      coverTagline,
      coverCopyright,
      coverFooterRight,
      coverShow,
      coverTemplate,
      coverSwapSides,
      coverTextCentered,
      coverT4,
      coverFontSizes,
      coverT5Style,
      coverT5ColorMode,
      coverT5FillBackground,
      coverT5BgColorOnly,
      coverT5SlatCount,
      coverT5BgShatter,
      coverAccentColor,
      coverSecondaryColor,
      coverGlowColor,
      coverGlowIntensity,
      coverElementColors,
      coverThemeMode,
      coverMixImages,
      coverUseInstalledImages,
      coverIncludeBackFace,
      coverShuffleSeed,
    });
    pushHistory(stateStr);
  }, [
    textElements,
    imageStyle,
    glassPanel,
    locationStrip,
    bgType,
    bgColor1,
    bgColor2,
    bgImageUrl,
    blurAmount,
    canvasWidth,
    canvasHeight,
    layoutMode,
    coverTitle1,
    coverTitle2,
    coverBadge,
    coverKicker,
    coverCampaignName,
    coverTagline,
    coverCopyright,
    coverFooterRight,
    coverShow,
    coverTemplate,
    coverSwapSides,
    coverTextCentered,
    coverT4,
    coverFontSizes,
    coverT5Style,
    coverT5ColorMode,
    coverT5FillBackground,
    coverT5BgColorOnly,
    coverT5SlatCount,
    coverT5BgShatter,
    coverAccentColor,
    coverSecondaryColor,
    coverGlowColor,
    coverGlowIntensity,
    coverElementColors,
    coverThemeMode,
    coverMixImages,
    coverUseInstalledImages,
    coverIncludeBackFace,
    coverShuffleSeed,
    pushHistory
  ]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      restoreLayoutState(history[nextIndex]);
      toast.info('تراجع (Undo)');
    }
  }, [history, historyIndex, restoreLayoutState]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      restoreLayoutState(history[nextIndex]);
      toast.info('إعادة (Redo)');
    }
  }, [history, historyIndex, restoreLayoutState]);

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      const initialState = JSON.stringify({
        textElements: DEFAULT_TEXT_ELEMENTS,
        imageStyle: DEFAULT_IMAGE_STYLE,
        glassPanel: DEFAULT_GLASS_PANEL,
        locationStrip: DEFAULT_LOCATION_STRIP,
        bgType: 'replica_blur',
        bgColor1: '#1a1a2e',
        bgColor2: '#0f0f1e',
        bgImageUrl: '',
        blurAmount: 30,
        canvasWidth: DEFAULT_CANVAS_WIDTH,
        canvasHeight: DEFAULT_CANVAS_HEIGHT,
        layoutMode: 'normal',
        coverTitle1: 'زبونك يهتم بمظهر',
        coverTitle2: 'علامتك التجارية',
        coverBadge: 'معاينة لوحات التركيب',
        coverKicker: 'حملتك الإعلانية',
        coverCampaignName: '',
        coverTagline: 'إعلانك بارز مع الفارس',
        coverCopyright: 'All artistic and intellectual property rights of the displayed works are fully reserved.',
        coverFooterRight: 'Built on experience',
        coverShow: { clientInfo: true, companyBrand: true, kicker: true, tagline: true, badge: false, copyright: true, footerRight: true, collage: true },
      });
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, []);

  // Listen to changes to push to history (debounced)
  useEffect(() => {
    if (isFirstMount.current) return;

    const stateStr = JSON.stringify({
      textElements,
      imageStyle,
      glassPanel,
      locationStrip,
      bgType,
      bgColor1,
      bgColor2,
      bgImageUrl,
      blurAmount,
      canvasWidth,
      canvasHeight,
      layoutMode,
      coverTitle1,
      coverTitle2,
      coverBadge,
      coverKicker,
      coverCampaignName,
      coverTagline,
      coverCopyright,
      coverFooterRight,
      coverShow,
    });

    const timer = setTimeout(() => {
      pushHistory(stateStr);
    }, 400);

    return () => clearTimeout(timer);
  }, [
    textElements,
    imageStyle,
    glassPanel,
    locationStrip,
    bgType,
    bgColor1,
    bgColor2,
    bgImageUrl,
    blurAmount,
    canvasWidth,
    canvasHeight,
    layoutMode,
    coverTitle1,
    coverTitle2,
    coverBadge,
    coverKicker,
    coverCampaignName,
    coverTagline,
    coverCopyright,
    coverFooterRight,
    coverShow,
    pushHistory
  ]);

  // ══════════════════════════════════════════
  //               DATA LOADING
  // ══════════════════════════════════════════

  useEffect(() => {
    loadTasks();
    loadTemplates();
    
    const savedInfo = localStorage.getItem('adhub_design_studio_company_info');
    if (savedInfo) {
      try {
        setCompanyInfo(JSON.parse(savedInfo));
      } catch (e) {
        console.error('Failed to parse saved company info', e);
      }
    }
  }, []);

  const loadTasks = async () => {
    try {
      setLoadingTasks(true);
      const { data, error } = await supabase
        .from('installation_tasks')
        .select(`
          id,
          contract_id,
          task_type,
          created_at,
          installation_teams!installation_tasks_team_id_fkey(team_name),
          Contract!installation_tasks_contract_id_fkey(
            Contract_Number,
            "Customer Name",
            "Ad Type",
            design_data
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const result = (data || []) as any[];
      setTasks(result as unknown as InstallationTask[]);
      tasksRef.current = result as unknown as InstallationTask[];

      // Fetch task_designs for all tasks to enable design images fallback
      const allTaskIds = result.map(t => t.id).filter(Boolean);
      const designsMap = new Map<string, { a?: string; b?: string; cutout?: string }>();
      if (allTaskIds.length > 0) {
        try {
          const { data: designs } = await supabase
            .from('task_designs')
            .select('task_id, design_face_a_url, design_face_b_url, cutout_image_url')
            .in('task_id', allTaskIds);
          (designs || []).forEach((d: any) => {
            if (!d.task_id) return;
            const existing = designsMap.get(d.task_id) || {};
            designsMap.set(d.task_id, {
              a: existing.a || d.design_face_a_url || undefined,
              b: existing.b || d.design_face_b_url || undefined,
              cutout: existing.cutout || d.cutout_image_url || undefined,
            });
          });
        } catch (e) {
          console.warn('Failed to load task_designs:', e);
        }
      }
      taskDesignsRef.current = designsMap;

      // Group tasks by contract_id
      const groups: Record<string, GroupedContract> = {};
      result.forEach(t => {
        const cId = String(t.contract_id);
        const teamName = t.installation_teams?.team_name;
        
        const contractInfo = t.Contract;
        const customerName = contractInfo?.['Customer Name'] || contractInfo?.customer_name || '';
        const adType = contractInfo?.['Ad Type'] || contractInfo?.ad_type || '';
        
        let designImage = '';
        if (contractInfo?.design_data) {
          try {
            const dd = typeof contractInfo.design_data === 'string'
              ? JSON.parse(contractInfo.design_data) : contractInfo.design_data;
            const arr = typeof dd === 'string' ? JSON.parse(dd) : dd;
            if (Array.isArray(arr) && arr.length > 0) {
              designImage = arr[0].designFaceA || arr[0].design_face_a_url || arr[0].designFaceB || arr[0].design_face_b_url || '';
            }
          } catch (e) {
            console.error('Failed to parse design_data for contract', cId, e);
          }
        }
        // Fallback to task_designs for this task
        if (!designImage) {
          const td = designsMap.get(t.id);
          if (td) designImage = td.a || td.b || td.cutout || '';
        }

        if (!groups[cId]) {
          groups[cId] = {
            contract_id: t.contract_id,
            taskIds: [t.id],
            teams: teamName ? [teamName] : [],
            created_at: t.created_at,
            customerName,
            adType,
            designImage
          };
        } else {
          groups[cId].taskIds.push(t.id);
          if (teamName && !groups[cId].teams.includes(teamName)) {
            groups[cId].teams.push(teamName);
          }
          if (customerName && !groups[cId].customerName) {
            groups[cId].customerName = customerName;
          }
          if (adType && !groups[cId].adType) {
            groups[cId].adType = adType;
          }
          if (designImage && !groups[cId].designImage) {
            groups[cId].designImage = designImage;
          }
        }
      });
      const groupedList = Object.values(groups).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setGroupedContracts(groupedList);

      // Aggregate installed-photos availability per contract
      try {
        if (allTaskIds.length > 0) {
          const { data: items } = await supabase
            .from('installation_task_items')
            .select('task_id, installed_image_url, installed_image_face_a_url, installed_image_face_b_url')
            .in('task_id', allTaskIds);
          const byTask = new Map<string, { total: number; withPhoto: number }>();
          (items || []).forEach((it: any) => {
            const tid = String(it.task_id);
            const has = !!(it.installed_image_url || it.installed_image_face_a_url || it.installed_image_face_b_url);
            const cur = byTask.get(tid) || { total: 0, withPhoto: 0 };
            cur.total += 1;
            if (has) cur.withPhoto += 1;
            byTask.set(tid, cur);
          });
          const enriched = groupedList.map(g => {
            let total = 0, withPhoto = 0;
            g.taskIds.forEach(tid => {
              const c = byTask.get(String(tid));
              if (c) { total += c.total; withPhoto += c.withPhoto; }
            });
            let status: 'all' | 'partial' | 'none' | 'unknown' = 'unknown';
            if (total > 0) {
              if (withPhoto === 0) status = 'none';
              else if (withPhoto >= total) status = 'all';
              else status = 'partial';
            }
            return { ...g, totalItems: total, photoItems: withPhoto, photoStatus: status };
          });
          setGroupedContracts(enriched);
        }
      } catch (e) {
        console.warn('Failed to compute photo availability:', e);
      }
    } catch (e) {
      console.error(e);
      toast.error('فشل في تحميل مهام التركيب');
    } finally {
      setLoadingTasks(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('design_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      const list = (data || []) as SavedTemplate[];
      setTemplates(list);
      // Auto-load last used template if available
      try {
        const lastId = localStorage.getItem('design_studio:last_template_id');
        if (lastId && list.some(t => t.id === lastId)) {
          setSelectedTemplateId(lastId);
          // Defer load to next tick so state is in place
          setTimeout(() => handleLoadTemplateRef.current?.(lastId), 0);
        }
      } catch {}
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  const loadItemDetails = useCallback(async (itemId: string, itemsArray?: TaskItem[]) => {
    try {
      const items = itemsArray || taskItemsRef.current;
      const item = items.find(i => i.id === itemId);
      if (!item) {
        console.warn('Item not found:', itemId, 'in', items.length, 'items');
        return;
      }

      // Get Billboard info
      const { data: billboardData } = await (supabase as any)
        .from('billboards')
        .select('*')
        .eq('ID', item.billboard_id as any)
        .single();

      const billboard = billboardData as any;

      const currentTasks = tasksRef.current;
      const task = currentTasks.find(t => t.id === item.task_id);
      let contract: any = null;
      if (task?.contract_id) {
        const { data: contractData } = await (supabase as any)
          .from('Contract')
          .select('*')
          .eq('Contract_Number', task.contract_id as any)
          .single();
        contract = contractData as any;
      }

      const ci = companyInfoRef.current;
      const details: ItemDetails = {
        customer_name: contract?.['Customer Name'] || contract?.customer_name || 'زبون عام',
        ad_type: contract?.['Ad Type'] || contract?.ad_type || billboard?.billboard_type || billboard?.Pricing_Category || 'إعلان لوحة',
        municipality: billboard?.Municipality || billboard?.City || 'غير محدد',
        region: billboard?.District || billboard?.Location || 'غير محدد',
        landmark: billboard?.Nearest_Landmark || billboard?.location || 'غير محدد',
        billboard_code: billboard?.Billboard_Name || `لوحة #${billboard?.ID}`,
        size: billboard?.Size || '6x3',
        installation_date: item.installation_date
          ? new Date(item.installation_date).toLocaleDateString('ar-LY')
          : new Date().toLocaleDateString('ar-LY'),
        // Strictly use the selected task's own images. Never fall back to
        // billboard.Image_URL / billboard.image because those carry the PREVIOUS
        // installation photo and would leak into re-installation tasks.
        installed_image: item.installed_image_url || item.design_face_a || item.design_face_b || '',
        installed_face_a: item.installed_image_face_a_url || item.installed_image_url || item.design_face_a || '',
        installed_face_b: item.installed_image_face_b_url || item.installed_image_url || item.design_face_b || '',
        company_name: ci.name,
        company_subtitle: ci.subtitle,
        campaign_label: 'اسـم الحـمـلـة الإعـلانـيـة',
        size_label: 'المقاس',
        phone: ci.phone,
        website: ci.website,
      };

      // Fallback: pull design images from task_designs map if still empty
      const td = taskDesignsRef.current.get(item.task_id);
      if (td) {
        if (!details.installed_face_a) details.installed_face_a = td.a || td.cutout || '';
        if (!details.installed_face_b) details.installed_face_b = td.b || td.cutout || '';
        if (!details.installed_image) details.installed_image = td.a || td.b || td.cutout || '';
      }

      setSelectedItemDetails(details);

      // Auto-pick best image source (preferring face_a as default)
      if (details.installed_face_a) {
        setImageSource('face_a');
      } else if (details.installed_image) {
        setImageSource('installed');
      } else if (details.installed_face_b) {
        setImageSource('face_b');
      }
    } catch (e) {
      console.error('Error loading item details:', e);
      toast.error('فشل في تحميل بيانات اللوحة');
    }
  }, []);

  const loadTaskItems = useCallback(async (taskIds: string[]) => {
    try {
      setLoadingItems(true);
      const { data: items, error } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', taskIds);

      if (error) throw error;
      const rawItems = (items || []) as TaskItem[];

      // Deduplicate items by billboard_id within the loaded task(s).
      // When a single task is passed (recommended), this only removes accidental
      // duplicates inside that task. Prefer the record that contains this task's
      // own installation/design images.
      const uniqueBillboardMap = new Map<string, TaskItem>();
      rawItems.forEach(item => {
        const key = String(item.billboard_id);
        const existing = uniqueBillboardMap.get(key);
        if (!existing) {
          uniqueBillboardMap.set(key, item);
        } else {
          const hasPhoto = item.installed_image_url || item.installed_image_face_a_url || item.installed_image_face_b_url || item.design_face_a || item.design_face_b;
          const existingHasPhoto = existing.installed_image_url || existing.installed_image_face_a_url || existing.installed_image_face_b_url || existing.design_face_a || existing.design_face_b;
          if (hasPhoto && !existingHasPhoto) {
            uniqueBillboardMap.set(key, item);
          }
        }
      });

      const result = Array.from(uniqueBillboardMap.values());
      setTaskItems(result);
      taskItemsRef.current = result;

      if (result.length > 0) {
        setSelectedItemId(result[0].id);
        // Immediately load details using the fresh items array (avoid stale closure)
        loadItemDetails(result[0].id, result);
      } else {
        setSelectedItemId('');
        setSelectedItemDetails(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('فشل في تحميل تفاصيل المهمة');
    } finally {
      setLoadingItems(false);
    }
  }, [loadItemDetails]);

  // Load task items when a contract is selected
  useEffect(() => {
    if (!selectedContractId) {
      setSelectedTaskId('');
      setTaskItems([]);
      taskItemsRef.current = [];
      setSelectedItemId('');
      setSelectedItemDetails(null);
      return;
    }
    const contract = groupedContracts.find(c => String(c.contract_id) === selectedContractId);
    if (contract && contract.taskIds.length > 0) {
      // Default to the most recent task (taskIds are appended in load order,
      // and loadTasks orders by created_at DESC, so the first entry is newest).
      const firstTaskId = contract.taskIds[0];
      setSelectedTaskId(prev => (prev && contract.taskIds.includes(prev) ? prev : firstTaskId));
    }
  }, [selectedContractId, groupedContracts]);

  // Load items strictly for the selected task (avoids leaking previous task images)
  useEffect(() => {
    if (!selectedTaskId) return;
    loadTaskItems([selectedTaskId]);
  }, [selectedTaskId, loadTaskItems]);

  // Load details when selected item changes (from dropdown switch)
  useEffect(() => {
    if (!selectedItemId) {
      setSelectedItemDetails(null);
      return;
    }
    // Use ref to get the latest taskItems
    const currentItems = taskItemsRef.current;
    if (currentItems.length > 0) {
      loadItemDetails(selectedItemId, currentItems);
    }
  }, [selectedItemId, loadItemDetails]);

  // Automatically fit image height when switching billboard images
  const prevImageUrlRef = useRef<string>('');
  useEffect(() => {
    const currentImageUrl = getCanvasImageUrl();
    if (currentImageUrl && currentImageUrl !== prevImageUrlRef.current) {
      prevImageUrlRef.current = currentImageUrl;
      // Skip auto-reset if user/template has customized imageStyle.
      if (imageStyleUserModifiedRef.current) return;
      const targetHeight = canvasHeight - (locationStrip.visible ? (locationStrip.height ?? 120) : 0);
      setImageStyleSynced(prev => ({
        ...prev,
        x: 0,
        y: 0,
        width: canvasWidth,
        height: targetHeight,
        objectFit: 'cover',
      }));
    }
  }, [selectedItemDetails, imageSource, canvasWidth, canvasHeight, locationStrip.visible, locationStrip.height]);

  const resolveCanvasImageUrl = useCallback(() => {
    if (!selectedItemDetails) return '';
    if (imageSource === 'installed') return selectedItemDetails.installed_image;
    if (imageSource === 'face_a') return selectedItemDetails.installed_face_a;
    if (imageSource === 'face_b') return selectedItemDetails.installed_face_b;
    return selectedItemDetails.installed_image || '';
  }, [selectedItemDetails, imageSource]);

  const applyExtractedCoverTheme = useCallback((palette: string[]) => {
    if (!palette.length) return false;
    const accent = pickAccentColor(palette) || palette[0];
    const secondary = pickSecondaryColor(palette, accent) || palette[1] || accent;
    const glow = pickGlowColor(palette) || accent;
    setCoverAccentColor(accent);
    setCoverSecondaryColor(secondary);
    setCoverGlowColor(glow);
    setCoverElementColors((prev) => ({
      ...prev,
      useAccentForAll: false,
      kicker: secondary,
      tagline: accent,
      badge: secondary,
      footerRight: secondary,
      brandName: accent,
    }));
    return true;
  }, []);

  // Extract dominant color palette from the current design image and apply it
  // whenever Auto mode is selected, even if the same image was already scanned.
  const lastPaletteUrlRef = useRef<string>('');
  const [coverPaletteRefreshKey, setCoverPaletteRefreshKey] = useState(0);
  useEffect(() => {
    const url = resolveCanvasImageUrl();
    if (!url) {
      lastPaletteUrlRef.current = '';
      setCoverPalette([]);
      return;
    }
    if (url === lastPaletteUrlRef.current && coverPalette.length && coverThemeMode === 'auto') {
      applyExtractedCoverTheme(coverPalette);
      return;
    }
    lastPaletteUrlRef.current = url;
    let cancelled = false;
    (async () => {
      try {
        const pal = await extractImagePalette(url, 8);
        if (cancelled) return;
        setCoverPalette(pal);
        if (coverThemeMode === 'auto' && pal.length) applyExtractedCoverTheme(pal);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [resolveCanvasImageUrl, coverThemeMode, coverPaletteRefreshKey]);

  // ══════════════════════════════════════════
  //              HELPERS
  // ══════════════════════════════════════════

  const fixSvgDataUrl = (url: string) => {
    if (!url || !url.startsWith('data:image/svg+xml')) return url;
    try {
      let svgContent = '';
      const isBase64 = url.includes('base64,');
      if (isBase64) {
        const base64Data = url.split('base64,')[1];
        svgContent = atob(base64Data);
      } else {
        const parts = url.split('utf8,');
        if (parts.length > 1) {
          svgContent = decodeURIComponent(parts[1]);
        } else {
          const commaParts = url.split(',');
          svgContent = decodeURIComponent(commaParts[1]);
        }
      }

      const widthMatch = svgContent.match(/\swidth=["']([^"']+)["']/);
      const heightMatch = svgContent.match(/\sheight=["']([^"']+)["']/);
      const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);

      // Always strip intrinsic width/height so the SVG scales to its container,
      // and ensure a viewBox + preserveAspectRatio exist for correct rendering in html2canvas.
      const w = widthMatch ? parseFloat(widthMatch[1]) : 100;
      const h = heightMatch ? parseFloat(heightMatch[1]) : 100;

      svgContent = svgContent.replace(/<svg([^>]*)>/, (_m, p1: string) => {
        let attrs = p1
          .replace(/\swidth=["'][^"']+["']/g, '')
          .replace(/\sheight=["'][^"']+["']/g, '')
          .replace(/\spreserveAspectRatio=["'][^"']+["']/g, '');
        if (!viewBoxMatch) attrs += ` viewBox="0 0 ${w} ${h}"`;
        attrs += ' preserveAspectRatio="xMidYMid meet" width="100%" height="100%"';
        return `<svg${attrs}>`;
      });

      if (isBase64) {
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
      } else {
        return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
      }
    } catch (err) {
      console.error('Error fixing SVG data URL:', err);
    }
    return url;
  };

  const getCanvasImageUrl = () => {
    return resolveCanvasImageUrl();
  };

  const getRGBAColor = (colorStr: string, opacity: number) => {
    if (!colorStr) return 'transparent';
    const trimmed = colorStr.trim();
    const alpha = (opacity === undefined || opacity === null || isNaN(opacity)) ? 1 : opacity;
    if (trimmed.startsWith('#')) {
      let cleanHex = trimmed.substring(1);
      if (cleanHex.length === 8) cleanHex = cleanHex.substring(0, 6);
      else if (cleanHex.length === 4) cleanHex = cleanHex.substring(0, 3);
      if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
      if (cleanHex.length === 6) {
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    } else {
      const rgbMatch = trimmed.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)$/i);
      if (rgbMatch) {
        return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
      }
    }
    return colorStr;
  };

  const getImageBackgroundSize = (fit?: string) => {
    if (fit === 'fill') return '100% 100%';
    if (fit === 'contain') return 'contain';
    return 'cover';
  };

  const waitForImagesToSettle = async (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    await Promise.all(images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
          return;
        }
      } catch {}
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 2000);
      });
    }));
  };

  const getElementText = (el: any) => {
    // Studio-only ad type override applies to ALL billboards
    if (el.textKey === 'ad_type' && adTypeOverride && adTypeOverride.trim() !== '') {
      return adTypeOverride;
    }
    // Composite: municipality + region with separator
    if (el.textKey === 'municipality_region' || el.id === 'municipality_region') {
      const sep = el.parts?.separator ?? ' - ';
      const m = selectedItemDetails?.municipality || 'مصراتة';
      const r = selectedItemDetails?.region || 'المنطقة';
      return `${m}${sep}${r}`;
    }
    if (el.customText !== undefined && el.customText !== null && el.customText !== '') return el.customText;
    if (!selectedItemDetails) {
      const placeholders: Record<string, string> = {
        company_name: companyInfo.name,
        company_subtitle: companyInfo.subtitle,
        customer_name: 'اسم العميل',
        ad_type: 'إعلانك بارز مع الفارس',
        campaign_label: 'اسـم الحـمـلـة الإعـلانـيـة',
        size_label: 'المقاس',
        size: '6x3',
        phone: companyInfo.phone,
        website: companyInfo.website,
        municipality: 'مصراتة',
        landmark: 'مقابل مدرسة الجزيرة للتعليم الأساسي',
      };
      return placeholders[el.textKey] || el.label;
    }
    return selectedItemDetails[el.textKey] || el.label;
  };

  // Billboard navigation (prev/next)
  const currentItemIndex = taskItems.findIndex(i => i.id === selectedItemId);

  // Render text content for an element. For composite parts (municipality_region)
  // returns separate <span> nodes so each part can have its own font weight & size.
  const renderTextContent = (el: any) => {
    if (el?.parts && (el.id === 'municipality_region' || el.textKey === 'municipality_region')) {
      const sep = el.parts.separator ?? ' - ';
      const m = selectedItemDetails?.municipality || 'مصراتة';
      const r = selectedItemDetails?.region || 'المنطقة';
      const mp = el.parts.municipality || {};
      const rp = el.parts.region || {};
      return (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: `${mp.fontSize ?? el.fontSize}px`, fontWeight: (mp.fontWeight ?? el.fontWeight) as any, color: mp.fontColor ?? undefined }}>{m}</span>
          <span style={{ fontSize: `${Math.max(mp.fontSize ?? el.fontSize, rp.fontSize ?? el.fontSize)}px`, fontWeight: 700, opacity: 0.8 }}>{sep}</span>
          <span style={{ fontSize: `${rp.fontSize ?? el.fontSize}px`, fontWeight: (rp.fontWeight ?? el.fontWeight) as any, color: rp.fontColor ?? undefined }}>{r}</span>
        </span>
      );
    }
    return getElementText(el);
  };

  const canGoPrev = currentItemIndex > 0;
  const canGoNext = currentItemIndex < taskItems.length - 1;

  const goToPrevItem = () => {
    if (canGoPrev) setSelectedItemId(taskItems[currentItemIndex - 1].id);
  };
  const goToNextItem = () => {
    if (canGoNext) setSelectedItemId(taskItems[currentItemIndex + 1].id);
  };

  // ══════════════════════════════════════════
  //              PRESETS
  // ══════════════════════════════════════════

  const handlePresetSize = (preset: string) => {
    if (preset === 'portrait') { setCanvasWidth(1500); setCanvasHeight(2000); }
    else if (preset === 'landscape') { setCanvasWidth(2000); setCanvasHeight(1500); }
    else if (preset === 'fhd') { setCanvasWidth(1920); setCanvasHeight(1080); }
    else if (preset === 'square') { setCanvasWidth(1500); setCanvasHeight(1500); }
    else if (preset === 'story') { setCanvasWidth(1080); setCanvasHeight(1920); }
  };

  // ══════════════════════════════════════════
  //             DRAG & DROP
  // ══════════════════════════════════════════

  // ══════════════════════════════════════════
  //             DRAG & DROP & SNAPPING
  // ══════════════════════════════════════════

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    // In lock mode, only allow dragging the main image
    if (lockMode && id !== 'image') return;

    e.preventDefault();
    e.stopPropagation();

    // Multi-selection: Shift or Ctrl toggles selection
    const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
    if (isMultiKey && id !== 'image' && id !== 'panel') {
      setSelectedLayerIds(prev => {
        if (prev.includes(id)) {
          const next = prev.filter(sid => sid !== id);
          const newActive = next[next.length - 1] || 'image';
          setSelectedLayerId(newActive);
          return next.length > 0 ? next : ['image'];
        } else {
          setSelectedLayerId(id);
          return [...prev, id];
        }
      });
      return; // Don't start drag on shift-click, just toggle selection
    }

    // Single selection
    setSelectedLayerId(id);
    setSelectedLayerIds([id]);

    let initialX = 0, initialY = 0;
    if (id === 'image') {
      initialX = imageStyleRef.current.x;
      initialY = imageStyleRef.current.y;
    } else if (id === 'panel') {
      initialX = glassPanel.x;
      initialY = glassPanel.y;
    } else {
      const idx = textElements.findIndex(el => el.id === id);
      if (idx !== -1) {
        initialX = textElements[idx].x;
        initialY = textElements[idx].y;
      }
    }

    const initialPositions = textElements.map(el => ({ id: el.id, x: el.x, y: el.y }));

    setDragState({
      activeId: id,
      startX: e.clientX,
      startY: e.clientY,
      initialX,
      initialY,
      initialPositions,
    });
  };


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.activeId) return;
      const deltaX = (e.clientX - dragState.startX) / zoom;
      const deltaY = (e.clientY - dragState.startY) / zoom;
      const newX = Math.round(dragState.initialX + deltaX);
      const newY = Math.round(dragState.initialY + deltaY);

      if (dragState.activeId === 'image') {
        let snapX = newX;
        let snapY = newY;
        const threshold = 20; // Magnetic snapping distance
        const guidesX: number[] = [];
        const guidesY: number[] = [];

        // Snap left to canvas left (0)
        if (Math.abs(newX) < threshold) {
          snapX = 0;
          guidesX.push(0);
        }
        // Snap top to canvas top (0)
        if (Math.abs(newY) < threshold) {
          snapY = 0;
          guidesY.push(0);
        }
        // Snap right to canvas right (canvasWidth)
        if (Math.abs(newX + imageStyle.width - canvasWidth) < threshold) {
          snapX = canvasWidth - imageStyle.width;
          guidesX.push(canvasWidth);
        }
        // Snap center X to canvas center
        if (Math.abs(newX + imageStyle.width / 2 - canvasWidth / 2) < threshold) {
          snapX = Math.round(canvasWidth / 2 - imageStyle.width / 2);
          guidesX.push(Math.round(canvasWidth / 2));
        }
        // Snap center Y to canvas center
        if (Math.abs(newY + imageStyle.height / 2 - canvasHeight / 2) < threshold) {
          snapY = Math.round(canvasHeight / 2 - imageStyle.height / 2);
          guidesY.push(Math.round(canvasHeight / 2));
        }
        // Snap bottom to top of glass panel (if panel is visible)
        if (glassPanel.visible && Math.abs(newY + imageStyle.height - glassPanel.y) < threshold) {
          snapY = glassPanel.y - imageStyle.height;
          guidesY.push(glassPanel.y);
        }
        // Snap bottom to canvas bottom (canvasHeight)
        if (Math.abs(newY + imageStyle.height - canvasHeight) < threshold) {
          snapY = canvasHeight - imageStyle.height;
          guidesY.push(canvasHeight);
        }

        setSnapGuides({ x: guidesX, y: guidesY });
        setImageStyleUser(prev => ({ ...prev, x: snapX, y: snapY }));
      } else if (dragState.activeId === 'panel') {
        setGlassPanel(prev => ({ ...prev, x: newX, y: newY }));
      } else {
        const id = dragState.activeId;
        const activeElement = textElements.find(el => el.id === id);
        if (!activeElement) return;

        // Parent offsets to convert local coordinates to canvas coordinates
        const parentX = activeElement.parentStrip === 'panel' ? glassPanel.x : 0;
        const parentY = activeElement.parentStrip === 'panel' ? glassPanel.y : (activeElement.parentStrip === 'location' ? (canvasHeight - locationStrip.height) : 0);

        // --- Snapping & Magnetic Snapping Logic ---
        let snapX = newX;
        let snapY = newY;
        const threshold = 15; // snapping distance in pixels
        const guidesX: number[] = [];
        const guidesY: number[] = [];

        // 1. Snap to Canvas horizontal center (750 by default)
        const elementCenterXInCanvas = parentX + newX;
        if (Math.abs(elementCenterXInCanvas - canvasWidth / 2) < threshold) {
          snapX = Math.round(canvasWidth / 2 - parentX);
          guidesX.push(Math.round(canvasWidth / 2));
        }

        // 2. Snap vertically to the center of parent strip or canvas
        if (activeElement.parentStrip === 'panel') {
          // Snap to glass panel vertical center
          const panelCenterY = glassPanel.height / 2;
          if (Math.abs(newY - panelCenterY) < threshold) {
            snapY = Math.round(panelCenterY);
            guidesY.push(Math.round(parentY + panelCenterY));
          }
        } else if (activeElement.parentStrip === 'location') {
          // Snap to location strip vertical center
          const stripCenterY = locationStrip.height / 2;
          if (Math.abs(newY - stripCenterY) < threshold) {
            snapY = Math.round(stripCenterY);
            guidesY.push(Math.round(parentY + stripCenterY));
          }
        } else {
          // Snap to canvas vertical center
          if (Math.abs(newY - canvasHeight / 2) < threshold) {
            snapY = Math.round(canvasHeight / 2);
            guidesY.push(Math.round(canvasHeight / 2));
          }
        }

        // 3. Snap to other elements' positions (in same coordinate space)
        textElements.forEach(other => {
          if (other.id === id || !other.visible) return;
          // If in same group, don't snap to each other
          if (activeElement.groupId && other.groupId === activeElement.groupId) return;

          // Snap X (align horizontally)
          if (Math.abs(newX - other.x) < threshold) {
            snapX = other.x;
            guidesX.push(Math.round(parentX + other.x));
          }
          // Snap Y (align vertically)
          if (Math.abs(newY - other.y) < threshold) {
            snapY = other.y;
            guidesY.push(Math.round(parentY + other.y));
          }
        });

        setSnapGuides({ x: guidesX, y: guidesY });

        const finalDeltaX = snapX - dragState.initialX;
        const finalDeltaY = snapY - dragState.initialY;

        // Multi-selection: move all selected elements together
        const currentSelectedIds = selectedLayerIds.filter(sid => sid !== 'image' && sid !== 'panel');
        if (currentSelectedIds.length > 1 && currentSelectedIds.includes(id)) {
          setTextElements(prev => prev.map(el => {
            if (currentSelectedIds.includes(el.id)) {
              const initPos = dragState.initialPositions?.find(ip => ip.id === el.id);
              if (initPos) {
                return { ...el, x: Math.round(initPos.x + finalDeltaX), y: Math.round(initPos.y + finalDeltaY) };
              }
            }
            return el;
          }));
        } else if (activeElement.groupId) {
          const gId = activeElement.groupId;
          setTextElements(prev => prev.map(el => {
            if (el.groupId === gId) {
              const initPos = dragState.initialPositions?.find(ip => ip.id === el.id);
              if (initPos) {
                return { ...el, x: Math.round(initPos.x + finalDeltaX), y: Math.round(initPos.y + finalDeltaY) };
              }
            }
            return el;
          }));
        } else {
          setTextElements(prev => prev.map(el => el.id === id ? { ...el, x: snapX, y: snapY } : el));
        }
      }
    };

    const handleMouseUp = () => {
      if (dragState.activeId) {
        setDragState({ activeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
        setSnapGuides({ x: [], y: [] });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom, canvasWidth, canvasHeight, textElements, selectedLayerIds, glassPanel, locationStrip]);


  const handleHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHandleDragState({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialX: imageStyleRef.current.x,
      initialY: imageStyleRef.current.y,
      initialWidth: imageStyleRef.current.width,
      initialHeight: imageStyleRef.current.height,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!handleDragState.handle) return;
      const deltaX = (e.clientX - handleDragState.startX) / zoom;
      const deltaY = (e.clientY - handleDragState.startY) / zoom;

      const { handle, initialX, initialY, initialWidth, initialHeight } = handleDragState;

      let newX = initialX;
      let newY = initialY;
      let newW = initialWidth;
      let newH = initialHeight;

      const minSize = 50;
      const isCorner = ['tl', 'tr', 'bl', 'br'].includes(handle);

      if (isCorner) {
        const aspect = initialWidth / initialHeight;
        if (handle === 'br') {
          newW = Math.max(minSize, initialWidth + deltaX);
          newH = newW / aspect;
        } else if (handle === 'tr') {
          newW = Math.max(minSize, initialWidth + deltaX);
          newH = newW / aspect;
          newY = initialY - (newH - initialHeight);
        } else if (handle === 'bl') {
          newW = Math.max(minSize, initialWidth - deltaX);
          newH = newW / aspect;
          newX = initialX - (newW - initialWidth);
        } else if (handle === 'tl') {
          newW = Math.max(minSize, initialWidth - deltaX);
          newH = newW / aspect;
          newX = initialX - (newW - initialWidth);
          newY = initialY - (newH - initialHeight);
        }
      } else {
        // X/W changes
        if (handle === 'r') {
          newW = Math.max(minSize, initialWidth + deltaX);
        } else if (handle === 'l') {
          const potentialW = initialWidth - deltaX;
          if (potentialW >= minSize) {
            newW = potentialW;
            newX = initialX + deltaX;
          }
        }

        // Y/H changes
        if (handle === 'b') {
          newH = Math.max(minSize, initialHeight + deltaY);
        } else if (handle === 't') {
          const potentialH = initialHeight - deltaY;
          if (potentialH >= minSize) {
            newH = potentialH;
            newY = initialY + deltaY;
          }
        }
      }

      // ── Magnetic snapping on resize ──
      const snapT = 20;
      const stripTop = locationStrip.visible ? (canvasHeight - locationStrip.height) : canvasHeight;
      const guidesX: number[] = [];
      const guidesY: number[] = [];
      // left edge
      if (Math.abs(newX) < snapT) { newX = 0; guidesX.push(0); }
      // top edge
      if (Math.abs(newY) < snapT) { newY = 0; guidesY.push(0); }
      // right edge
      const rightEdge = newX + newW;
      if (Math.abs(rightEdge - canvasWidth) < snapT) {
        if (handle === 'r' || handle === 'tr' || handle === 'br') newW = canvasWidth - newX;
        else newX = canvasWidth - newW;
        guidesX.push(canvasWidth);
      }
      // bottom edge → snap to top of location strip (or canvas bottom)
      const bottomEdge = newY + newH;
      if (Math.abs(bottomEdge - stripTop) < snapT) {
        if (handle === 'b' || handle === 'bl' || handle === 'br') newH = stripTop - newY;
        else newY = stripTop - newH;
        guidesY.push(stripTop);
      } else if (Math.abs(bottomEdge - canvasHeight) < snapT) {
        if (handle === 'b' || handle === 'bl' || handle === 'br') newH = canvasHeight - newY;
        else newY = canvasHeight - newH;
        guidesY.push(canvasHeight);
      }
      setSnapGuides({ x: guidesX, y: guidesY });

      setImageStyleUser(prev => ({
        ...prev,
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      }));
    };

    const handleMouseUp = () => {
      if (handleDragState.handle) {
        setHandleDragState({ handle: null, startX: 0, startY: 0, initialX: 0, initialY: 0, initialWidth: 0, initialHeight: 0 });
        setSnapGuides({ x: [], y: [] });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleDragState, zoom, canvasWidth, canvasHeight, locationStrip.visible, locationStrip.height]);

  // ══════════════════════════════════════════
  //     PANEL HEIGHT RESIZE HANDLES
  // ══════════════════════════════════════════

  const handlePanelHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPanelHandleDragState({
      handle,
      startY: e.clientY,
      initialY: glassPanel.y,
      initialHeight: glassPanel.height,
      initialTextElements: JSON.parse(JSON.stringify(textElements)),
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelHandleDragState.handle) return;
      const deltaY = (e.clientY - panelHandleDragState.startY) / zoom;
      const { handle, initialY, initialHeight, initialTextElements } = panelHandleDragState;

      const minHeight = 80;
      let newY = initialY;
      let newH = initialHeight;

      if (handle === 'b') {
        newH = Math.max(minHeight, initialHeight + deltaY);
      } else if (handle === 't') {
        const potentialH = initialHeight - deltaY;
        if (potentialH >= minHeight) {
          newH = potentialH;
          newY = initialY + deltaY;
        }
      }

      const ratio = newH / initialHeight;

      // Proportionally scale child elements
      setTextElements(initialTextElements.map(el => {
        if (el.parentStrip === 'panel') {
          const updated = { ...el, y: Math.round(el.y * ratio) };
          if (el.type === 'image' && el.height && el.width) {
            updated.height = Math.round(el.height * ratio);
            updated.width = Math.round(el.width * ratio);
          } else if (el.fontSize) {
            updated.fontSize = Math.max(8, Math.round(el.fontSize * ratio));
          }
          return updated;
        }
        return el;
      }));

      setGlassPanel(prev => ({
        ...prev,
        y: Math.round(newY),
        height: Math.round(newH),
      }));
    };

    const handleMouseUp = () => {
      if (panelHandleDragState.handle) {
        setPanelHandleDragState({ handle: null, startY: 0, initialY: 0, initialHeight: 0, initialTextElements: [] });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panelHandleDragState, zoom]);

  // ══════════════════════════════════════════
  //   DOUBLE-CLICK IMAGE ASPECT RATIO RESET
  // ══════════════════════════════════════════

  const handleImageDoubleClick = () => {
    setTransformActive(true);
    setSelectedLayerId('image');
    setSelectedLayerIds(['image']);
    const url = getCanvasImageUrl();
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        // Preserve user-chosen objectFit; only adjust height to natural ratio.
        setImageStyleUser(prev => ({ ...prev, height: Math.round(prev.width / ratio) }));
        toast.success('تم ضبط أبعاد الصورة وفق نسبتها الطبيعية');
      }
    };
    img.src = url;
  };

  // ══════════════════════════════════════════
  //   ALIGNMENT TOOLS FOR MULTI-SELECTION
  // ══════════════════════════════════════════

  const alignSelectedElements = (type: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle') => {
    const ids = selectedLayerIds.filter(sid => sid !== 'image' && sid !== 'panel');
    if (ids.length < 2) {
      toast.info('يجب تحديد عنصرين أو أكثر للمحاذاة');
      return;
    }

    const selectedEls = textElements.filter(el => ids.includes(el.id));
    if (selectedEls.length === 0) return;

    const xs = selectedEls.map(el => el.x);
    const ys = selectedEls.map(el => el.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const avgX = Math.round((minX + maxX) / 2);
    const avgY = Math.round((minY + maxY) / 2);

    setTextElements(prev => prev.map(el => {
      if (!ids.includes(el.id)) return el;
      switch (type) {
        case 'left': return { ...el, x: minX, alignment: 'left' as const };
        case 'right': return { ...el, x: maxX, alignment: 'right' as const };
        case 'center': return { ...el, x: avgX, alignment: 'center' as const };
        case 'top': return { ...el, y: minY };
        case 'bottom': return { ...el, y: maxY };
        case 'middle': return { ...el, y: avgY };
        default: return el;
      }
    }));
    toast.success(`تم تطبيق المحاذاة: ${type}`);
  };

  // ══════════════════════════════════════════
  //            KEYBOARD NUDGE & PHOTOSHOP SHORTCUTS
  // ══════════════════════════════════════════

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoom(z => Math.min(2, z + 0.05));
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          setZoom(z => Math.max(0.1, z - 0.05));
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          setZoom(0.38);
          return;
        }
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          setTransformActive(prev => !prev);
          return;
        }
      }

      if (!selectedLayerId) return;

      // In lock mode, only image can be nudged
      if (lockMode && selectedLayerId !== 'image') return;

      const step = e.shiftKey ? 10 : 1;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

      if (selectedLayerId === 'image') {
        setImageStyleUser(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      } else if (selectedLayerId === 'panel') {
        setGlassPanel(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      } else {
        const activeElement = textElements.find(el => el.id === selectedLayerId);
        if (activeElement && activeElement.groupId) {
          const gId = activeElement.groupId;
          setTextElements(prev => prev.map(el =>
            el.groupId === gId ? { ...el, x: Math.round(el.x + dx), y: Math.round(el.y + dy) } : el
          ));
        } else {
          setTextElements(prev => prev.map(el =>
            el.id === selectedLayerId ? { ...el, x: el.x + dx, y: el.y + dy } : el
          ));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, lockMode, textElements, handleUndo, handleRedo]);

  // ══════════════════════════════════════════
  //               ADD ELEMENTS
  // ══════════════════════════════════════════

  const handleAddText = () => {
    const newEl: CanvasElement = {
      id: `custom_text_${Date.now()}`,
      type: 'text',
      label: `نص مخصص #${textElements.length + 1}`,
      visible: true,
      x: 500,
      y: 500,
      customText: 'نص مخصص جديد',
      textKey: 'custom',
      fontSize: 24,
      fontColor: '#ffffff',
      fontWeight: '700',
      alignment: 'center',
      parentStrip: 'panel',
    };
    setTextElements(prev => [...prev, newEl]);
    setSelectedLayerId(newEl.id);
    toast.success('تم إضافة عنصر نص جديد');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      const newEl: CanvasElement = {
        id: `custom_image_${Date.now()}`,
        type: 'image',
        label: `شعار/صورة مخصصة #${textElements.length + 1}`,
        visible: true,
        x: 200,
        y: 200,
        url: base64Url,
        width: 150,
        height: 150,
        borderRadius: 0,
        textKey: '',
        fontSize: 12,
        fontColor: '',
        fontWeight: 'normal',
        alignment: 'center',
        parentStrip: 'panel',
      };
      setTextElements(prev => [...prev, newEl]);
      setSelectedLayerId(newEl.id);
      toast.success('تم إضافة الشعار/الصورة بنجاح! يمكنك سحبها وتحريكها الآن.');
    };
    reader.readAsDataURL(file);
  };

  const handleAddIcon = (iconName: string) => {
    const newEl: CanvasElement = {
      id: `custom_icon_${Date.now()}`,
      type: 'icon',
      label: `أيقونة ${iconName} #${textElements.length + 1}`,
      visible: true,
      x: 400,
      y: 400,
      iconName,
      iconColor: '#c9a84c',
      iconSize: 32,
      iconBackground: false,
      iconBgColor: '#ffffff',
      textKey: '',
      fontSize: 12,
      fontColor: '',
      fontWeight: 'normal',
      alignment: 'center',
      parentStrip: 'panel',
    };
    setTextElements(prev => [...prev, newEl]);
    setSelectedLayerId(newEl.id);
    toast.success(`تم إضافة أيقونة ${iconName}`);
  };

  // ══════════════════════════════════════════
  //               RESET
  // ══════════════════════════════════════════

  const handleResetLayout = () => {
    setCanvasWidth(DEFAULT_CANVAS_WIDTH);
    setCanvasHeight(DEFAULT_CANVAS_HEIGHT);
    setImageStyleSynced(DEFAULT_IMAGE_STYLE);
    imageStyleUserModifiedRef.current = false;
    setGlassPanel(DEFAULT_GLASS_PANEL);
    setLocationStrip(DEFAULT_LOCATION_STRIP);
    setTextElements(DEFAULT_TEXT_ELEMENTS);
    setBgType('replica_blur');
    setBlurAmount(30);
    setSelectedLayerId('image');
    setLockMode(false);
    setSnapGuides({ x: [], y: [] });
    toast.success('تمت إعادة تعيين التصميم للقالب الافتراضي');
  };

  // ══════════════════════════════════════════
  //              TEMPLATES
  // ══════════════════════════════════════════

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) { toast.error('الرجاء إدخال اسم للقالب'); return; }
    try {
      setSavingTemplate(true);
      const templateData = {
        name: newTemplateName,
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        bg_type: bgType,
        bg_color: bgType === 'solid' || bgType === 'gradient' ? `${bgColor1},${bgColor2}` : null,
        bg_image_url: bgImageUrl,
        blur_amount: blurAmount,
        glass_panel_style: {
          ...glassPanel,
          locationStrip,
          companyInfo,
          layoutMode,
          coverTitle1, coverTitle2, coverBadge,
          coverKicker, coverCampaignName, coverTagline,
          coverCopyright, coverFooterRight, coverShow,
          coverTemplate, coverSwapSides, coverTextCentered, coverShuffleSeed, coverT4, coverFontSizes, coverT5Style, coverT5ColorMode, coverT5FillBackground, coverT5BgColorOnly, coverT5SlatCount, coverT5BgShatter,
          coverAccentColor, coverSecondaryColor, coverGlowColor, coverGlowIntensity, coverElementColors, coverThemeMode,
          coverMixImages, coverUseInstalledImages, coverIncludeBackFace,
        },
        text_elements: textElements,
        image_style: imageStyle,
      };

      const { data, error } = await (supabase as any).from('design_templates').insert(templateData).select().single();
      if (error) throw error;
      toast.success('تم حفظ القالب بنجاح');
      setTemplates(prev => [...prev, data]);
      setSelectedTemplateId(data.id);
      try { localStorage.setItem('design_studio:last_template_id', data.id); } catch {}
      setNewTemplateName('');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast.error(`فشل حفظ القالب: ${errorMsg}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error('لا يوجد قالب محمل حالياً. قم بتحميل قالب أولاً أو احفظه كقالب جديد.');
      return;
    }
    try {
      setSavingTemplate(true);
      const templateData = {
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        bg_type: bgType,
        bg_color: bgType === 'solid' || bgType === 'gradient' ? `${bgColor1},${bgColor2}` : null,
        bg_image_url: bgImageUrl,
        blur_amount: blurAmount,
        glass_panel_style: {
          ...glassPanel,
          locationStrip,
          companyInfo,
          layoutMode,
          coverTitle1, coverTitle2, coverBadge,
          coverKicker, coverCampaignName, coverTagline,
          coverCopyright, coverFooterRight, coverShow,
          coverTemplate, coverSwapSides, coverTextCentered, coverShuffleSeed, coverT4, coverFontSizes, coverT5Style, coverT5ColorMode, coverT5FillBackground, coverT5BgColorOnly, coverT5SlatCount, coverT5BgShatter,
          coverAccentColor, coverSecondaryColor, coverGlowColor, coverGlowIntensity, coverElementColors, coverThemeMode,
          coverMixImages, coverUseInstalledImages, coverIncludeBackFace,
        },
        text_elements: textElements,
        image_style: imageStyle,
      };
      const { error } = await (supabase as any)
        .from('design_templates')
        .update(templateData)
        .eq('id', selectedTemplateId);
      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === selectedTemplateId ? { ...t, ...templateData } as SavedTemplate : t));
      try { localStorage.setItem('design_studio:last_template_id', selectedTemplateId); } catch {}
      toast.success('✅ تم تحديث القالب الحالي بنجاح!');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast.error(`فشل تحديث القالب: ${errorMsg}`);
    } finally {
      setSavingTemplate(false);
    }
  };


  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    try { localStorage.setItem('design_studio:last_template_id', templateId); } catch {}
    setSelectedTemplateId(templateId);
    setCanvasWidth(template.canvas_width);
    setCanvasHeight(template.canvas_height);
    setBgType(template.bg_type);
    if (template.bg_color) {
      const colors = template.bg_color.split(',');
      if (colors.length > 0) setBgColor1(colors[0]);
      if (colors.length > 1) setBgColor2(colors[1]);
    }
    setBgImageUrl(template.bg_image_url || '');
    setBlurAmount(template.blur_amount);
    const gps = template.glass_panel_style;
    if (gps) {
      setGlassPanel({
        visible: gps.visible ?? DEFAULT_GLASS_PANEL.visible,
        x: gps.x ?? DEFAULT_GLASS_PANEL.x, y: gps.y ?? DEFAULT_GLASS_PANEL.y,
        width: gps.width ?? DEFAULT_GLASS_PANEL.width, height: gps.height ?? DEFAULT_GLASS_PANEL.height,
        opacity: gps.opacity ?? DEFAULT_GLASS_PANEL.opacity, blur: gps.blur ?? DEFAULT_GLASS_PANEL.blur,
        borderRadius: gps.borderRadius ?? DEFAULT_GLASS_PANEL.borderRadius,
        borderWidth: gps.borderWidth ?? DEFAULT_GLASS_PANEL.borderWidth,
        borderColor: gps.borderColor ?? DEFAULT_GLASS_PANEL.borderColor,
        backgroundColor: gps.backgroundColor ?? DEFAULT_GLASS_PANEL.backgroundColor,
        shadow: gps.shadow ?? DEFAULT_GLASS_PANEL.shadow,
      } as any);
      if (gps.locationStrip) setLocationStrip(gps.locationStrip as any);
      if (gps.companyInfo) setCompanyInfo(gps.companyInfo);
      if (gps.layoutMode) setLayoutMode(gps.layoutMode);
      if (gps.coverTitle1 !== undefined) setCoverTitle1(gps.coverTitle1);
      if (gps.coverTitle2 !== undefined) setCoverTitle2(gps.coverTitle2);
      if (gps.coverBadge !== undefined) setCoverBadge(gps.coverBadge);
      if (gps.coverKicker !== undefined) setCoverKicker(gps.coverKicker);
      if (gps.coverCampaignName !== undefined) setCoverCampaignName(gps.coverCampaignName);
      if (gps.coverTagline !== undefined) setCoverTagline(gps.coverTagline);
      if (gps.coverCopyright !== undefined) setCoverCopyright(gps.coverCopyright);
      if (gps.coverFooterRight !== undefined) setCoverFooterRight(gps.coverFooterRight);
      if (gps.coverShow && typeof gps.coverShow === 'object') setCoverShow((p) => ({ ...p, ...gps.coverShow }));
      const gpsAny = gps as any;
      if (gpsAny.coverTemplate) setCoverTemplate(gpsAny.coverTemplate);
      if (typeof gpsAny.coverSwapSides === 'boolean') setCoverSwapSides(gpsAny.coverSwapSides);
      if (typeof gpsAny.coverTextCentered === 'boolean') setCoverTextCentered(gpsAny.coverTextCentered);
      if (gpsAny.coverShuffleSeed !== undefined) setCoverShuffleSeed(Number(gpsAny.coverShuffleSeed) || Date.now());
      if (gpsAny.coverT4 && typeof gpsAny.coverT4 === 'object') setCoverT4((p) => ({ ...p, ...gpsAny.coverT4 }));
      if (gpsAny.coverT5Style) setCoverT5Style(gpsAny.coverT5Style);
      if (typeof gpsAny.coverT5ColorMode === 'boolean') setCoverT5ColorMode(gpsAny.coverT5ColorMode);
      if (typeof gpsAny.coverT5FillBackground === 'boolean') setCoverT5FillBackground(gpsAny.coverT5FillBackground);
      if (typeof gpsAny.coverT5BgColorOnly === 'boolean') setCoverT5BgColorOnly(gpsAny.coverT5BgColorOnly);
      if (gpsAny.coverT5SlatCount !== undefined) setCoverT5SlatCount(Number(gpsAny.coverT5SlatCount) || 5);
      if (typeof gpsAny.coverT5BgShatter === 'boolean') setCoverT5BgShatter(gpsAny.coverT5BgShatter);
      if (typeof gpsAny.coverMixImages === 'boolean') setCoverMixImages(gpsAny.coverMixImages);
      if (typeof gpsAny.coverUseInstalledImages === 'boolean') setCoverUseInstalledImages(gpsAny.coverUseInstalledImages);
      if (typeof gpsAny.coverIncludeBackFace === 'boolean') setCoverIncludeBackFace(gpsAny.coverIncludeBackFace);
      if (gpsAny.coverFontSizes && typeof gpsAny.coverFontSizes === 'object') setCoverFontSizes((p) => ({ ...p, ...gpsAny.coverFontSizes }));
      if (typeof gpsAny.coverAccentColor === 'string') setCoverAccentColor(gpsAny.coverAccentColor);
      if (typeof gpsAny.coverSecondaryColor === 'string') setCoverSecondaryColor(gpsAny.coverSecondaryColor);
      if (typeof gpsAny.coverGlowColor === 'string') setCoverGlowColor(gpsAny.coverGlowColor);
      if (gpsAny.coverGlowIntensity && typeof gpsAny.coverGlowIntensity === 'object') setCoverGlowIntensity((p) => ({ ...p, ...gpsAny.coverGlowIntensity }));
      if (gpsAny.coverElementColors && typeof gpsAny.coverElementColors === 'object') setCoverElementColors((p) => ({ ...p, ...gpsAny.coverElementColors }));
      if (gpsAny.coverThemeMode === 'manual' || gpsAny.coverThemeMode === 'auto') setCoverThemeMode(gpsAny.coverThemeMode);
    }
    setImageStyleSynced(template.image_style as any);
    imageStyleUserModifiedRef.current = true;
    if (Array.isArray(template.text_elements)) {
      const loadedEls = template.text_elements as CanvasElement[];
      let merged = loadedEls.map(el => ({
        type: el.type || 'text',
        ...el
      })) as CanvasElement[];
      // Drop deprecated elements (split municipality/region replaced by composite municipality_region)
      merged = merged.filter(e => e.id !== 'municipality' && e.id !== 'region' && e.id !== 'brand_slogan');
      // Inject missing default elements so old templates stay usable
      DEFAULT_TEXT_ELEMENTS.forEach(def => {
        if (!merged.find(e => e.id === def.id)) merged.push({ ...def });
      });
      // Force client_name to the new fixed slogan if it still points to customer_name
      merged = merged.map(e => {
        if (e.id === 'client_name' && (!e.customText || e.customText === '' || e.textKey === 'customer_name')) {
          return { ...e, customText: 'إعلانك بارز مع الفارس' };
        }
        return e;
      });
      setTextElements(merged);
    }
    setSelectedTemplateId(templateId);
    toast.success(`تم تحميل القالب: ${template.name}`);
  };

  // Expose handleLoadTemplate to loadTemplates (which runs before this fn is in scope at module level)
  handleLoadTemplateRef.current = handleLoadTemplate;

  // ══════════════════════════════════════════
  //             QUICK THEMES
  // ══════════════════════════════════════════

  const handleApplyQuickTheme = (theme: string) => {
    if (theme === 'dark_gold') {
      setBgType('replica_blur'); setBlurAmount(30);
      setGlassPanel(prev => ({ ...prev, backgroundColor: '#1a1a2e', opacity: 0.92 }));
      setLocationStrip(prev => ({ ...prev, backgroundColor: '#c9a84c', textColor: '#1a1a2e' }));
      setTextElements(prev => prev.map(el => {
        if (el.id === 'client_name') return { ...el, fontColor: '#ffffff' };
        if (el.id === 'company_name' || el.id === 'ad_type' || el.id === 'website') return { ...el, fontColor: '#c9a84c' };
        if (el.id === 'municipality') return { ...el, fontColor: '#1a1a2e' };
        if (el.id === 'landmark') return { ...el, fontColor: '#2d2d44' };
        if (el.id === 'phone' || el.id === 'size') return { ...el, fontColor: '#ffffff' };
        return el;
      }));
      toast.success('تم تطبيق الثيم الذهبي الفاخر');
    } else if (theme === 'blue_corp') {
      setBgType('replica_blur'); setBlurAmount(25);
      setGlassPanel(prev => ({ ...prev, backgroundColor: '#0c1929', opacity: 0.92 }));
      setLocationStrip(prev => ({ ...prev, backgroundColor: '#3b82f6', textColor: '#ffffff' }));
      setTextElements(prev => prev.map(el => {
        if (el.id === 'client_name' || el.id === 'phone' || el.id === 'size') return { ...el, fontColor: '#ffffff' };
        if (el.id === 'company_name' || el.id === 'website') return { ...el, fontColor: '#60a5fa' };
        if (el.id === 'ad_type') return { ...el, fontColor: '#93c5fd' };
        if (el.id === 'municipality' || el.id === 'landmark') return { ...el, fontColor: '#ffffff' };
        return el;
      }));
      toast.success('تم تطبيق الثيم الأزرق');
    } else if (theme === 'emerald') {
      setBgType('replica_blur'); setBlurAmount(28);
      setGlassPanel(prev => ({ ...prev, backgroundColor: '#0f2419', opacity: 0.92 }));
      setLocationStrip(prev => ({ ...prev, backgroundColor: '#10b981', textColor: '#ffffff' }));
      setTextElements(prev => prev.map(el => {
        if (el.id === 'client_name' || el.id === 'phone' || el.id === 'size') return { ...el, fontColor: '#ffffff' };
        if (el.id === 'company_name' || el.id === 'website') return { ...el, fontColor: '#34d399' };
        if (el.id === 'ad_type') return { ...el, fontColor: '#6ee7b7' };
        if (el.id === 'municipality' || el.id === 'landmark') return { ...el, fontColor: '#ffffff' };
        return el;
      }));
      toast.success('تم تطبيق الثيم الزمردي');
    } else if (theme === 'light') {
      setBgType('solid'); setBgColor1('#f1f5f9');
      setGlassPanel(prev => ({ ...prev, backgroundColor: '#ffffff', opacity: 0.95 }));
      setLocationStrip(prev => ({ ...prev, backgroundColor: '#334155', textColor: '#ffffff' }));
      setTextElements(prev => prev.map(el => {
        if (el.id === 'client_name' || el.id === 'phone' || el.id === 'size') return { ...el, fontColor: '#0f172a' };
        if (el.id === 'company_name' || el.id === 'website') return { ...el, fontColor: '#334155' };
        if (el.id === 'ad_type' || el.id === 'company_subtitle' || el.id === 'campaign_label' || el.id === 'size_label') return { ...el, fontColor: '#64748b' };
        if (el.id === 'municipality' || el.id === 'landmark') return { ...el, fontColor: '#ffffff' };
        return el;
      }));
      toast.success('تم تطبيق الثيم الفاتح');
    }
  };

  // ══════════════════════════════════════════
  //            EXPORT / DOWNLOAD
  // ══════════════════════════════════════════

  const handleExportCard = async () => {
    const toastId = toast.loading('جاري تجهيز وتصدير البطاقة...');
    try {
      setIsExporting(true);
      if ((document as any).fonts) { try { await (document as any).fonts.ready; } catch {} }
      // Let React flush the state update so the selection highlights disappear and
      // the export layout and filter states are applied
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      let blob: Blob;
      if (layoutMode === 'cover') {
        blob = await renderCoverToBlob();
      } else {
        blob = await renderDesignToBlob();
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const prefix = layoutMode === 'cover' ? 'غلاف' : 'بطاقة';
      link.download = `${prefix}_${selectedItemDetails?.billboard_code || selectedContractId || 'تصميم'}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.dismiss(toastId);
      toast.success('تم تنزيل البطاقة بنجاح!');
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      toast.error(`حدث خطأ أثناء التصدير: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ══════════════════════════════════════════
  //   COVER EXPORT — captures the live cover template
  //   via SVG <foreignObject> → Canvas 2D (no html2canvas).
  //   The browser rasterises the DOM into an <img>, which we
  //   then draw onto a CanvasRenderingContext2D.
  // ══════════════════════════════════════════
  const renderCoverToBlob = async (): Promise<Blob> => {
    const el = document.getElementById('capture-canvas') as HTMLElement | null;
    if (!el) throw new Error('canvas غير متوفر');
    // wait two frames so async style/aspect updates settle
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if ((document as any).fonts?.ready) { try { await (document as any).fonts.ready; } catch {} }

    const SCALE = 2;
    const W = canvasWidth;
    const H = canvasHeight;

    // ─── Step 1: Build an off-screen host at NATURAL size and clone the
    // live preview into it. We never touch the live DOM, so React can't
    // reconcile our changes away, and html2canvas captures the element at
    // its true 1:1 size (no zoom/crop).
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-99999px';
    host.style.top = '0px';
    host.style.width = `${W}px`;
    host.style.height = `${H}px`;
    host.style.transform = 'none';
    host.style.zoom = '1';
    host.style.zIndex = '-1';
    host.style.pointerEvents = 'none';

    const clone = el.cloneNode(true) as HTMLElement;
    clone.id = '';
    clone.style.transform = 'none';
    clone.style.position = 'relative';
    clone.style.left = '0px';
    clone.style.top = '0px';
    clone.style.width = `${W}px`;
    clone.style.height = `${H}px`;
    clone.style.margin = '0';
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      // Pre-fetch every external <img> inside the clone and replace its
      // src with an inlined data: URL — guarantees canvas isn't tainted.
      const urlToDataUrl = new Map<string, string>();
      const toDataUrl = async (src: string): Promise<string | null> => {
        if (!src || src.startsWith('data:')) return src || null;
        if (urlToDataUrl.has(src)) return urlToDataUrl.get(src)!;
        try {
          const res = await fetch(src, { mode: 'cors' });
          if (!res.ok) throw new Error('bad status');
          const b = await res.blob();
          const du: string = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = reject;
            fr.readAsDataURL(b);
          });
          urlToDataUrl.set(src, du);
          return du;
        } catch {
          try {
            const im = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image();
              i.crossOrigin = 'anonymous';
              i.onload = () => resolve(i);
              i.onerror = reject;
              i.src = src;
            });
            const c = document.createElement('canvas');
            c.width = im.naturalWidth; c.height = im.naturalHeight;
            const cx = c.getContext('2d')!;
            cx.drawImage(im, 0, 0);
            const du = c.toDataURL('image/png');
            urlToDataUrl.set(src, du);
            return du;
          } catch { return null; }
        }
      };

      const cloneImgs = Array.from(clone.querySelectorAll('img'));
      await Promise.all(cloneImgs.map(async (img) => {
        const src = img.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) return;
        const dataUrl = await toDataUrl(src);
        img.removeAttribute('crossorigin');
        if (dataUrl) {
          img.setAttribute('src', dataUrl);
        } else {
          img.setAttribute('src', '');
          img.style.background = 'linear-gradient(135deg,#222,#444)';
        }
      }));

      // Inline external URLs inside inline style="background-image:url(...)"
      const bgEls = Array.from(clone.querySelectorAll<HTMLElement>('[style*="url("]'));
      await Promise.all(bgEls.map(async (node) => {
        const styleAttr = node.getAttribute('style') || '';
        const matches = Array.from(styleAttr.matchAll(/url\((['"]?)([^'")]+)\1\)/g));
        if (!matches.length) return;
        let newStyle = styleAttr;
        for (const m of matches) {
          const orig = m[2];
          if (orig.startsWith('data:')) continue;
          const du = await toDataUrl(orig);
          if (du) newStyle = newStyle.split(orig).join(du);
        }
        if (newStyle !== styleAttr) node.setAttribute('style', newStyle);
      }));

      // Wait for cloned images to actually load (they're new <img> elements
      // with data: URLs — html2canvas otherwise captures empty slots).
      await Promise.all(cloneImgs.map((img) => new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 3000);
      })));

      // Embed web fonts (Tajawal/Cairo/Manrope) into the clone so the
      // foreignObject rasterisation uses the real font and Arabic letters
      // shape correctly (otherwise the browser falls back to a font that
      // doesn't join Arabic glyphs — the "broken letters" bug).
      let fontEmbedCSS = '';
      try { fontEmbedCSS = await getFontEmbedCSS(clone); } catch {}
      // Ensure font readiness inside the host as well.
      try { await (document as any).fonts?.ready; } catch {}
      // Stable text rendering for the capture.
      (clone.style as any).fontKerning = 'normal';
      (clone.style as any).textRendering = 'geometricPrecision';

      // ─── Step 2: Capture the clone at its natural size. No window/width
      // overrides — html2canvas will use the element's real bounds.
      // Use html-to-image (SVG <foreignObject>) instead of html2canvas — it
      // preserves backdrop-filter blur and Arabic letter shaping because the
      // browser does the real rendering. html2canvas reimplements layout and
      // breaks both (square non-blurred boxes + disconnected Arabic chars).
      const blob = await htmlToImageBlob(clone, {
        width: W,
        height: H,
        pixelRatio: SCALE,
        cacheBust: true,
        backgroundColor: undefined,
        skipFonts: false,
        fontEmbedCSS,
        style: {
          transform: 'none',
          margin: '0',
        },
      });
      if (!blob) throw new Error('toBlob failed');
      return blob;
    } finally {
      try { document.body.removeChild(host); } catch {}
    }
  };

  // ══════════════════════════════════════════
  //   DIRECT CANVAS 2D RENDERER (export only)
  //   Draws the exact same data as the preview
  //   without relying on html2canvas/DOM cloning.
  // ══════════════════════════════════════════
  const renderDesignToBlob = async (): Promise<Blob> => {
    const W = canvasWidth;
    const H = canvasHeight;
    const SCALE = 2;
    // Read the latest image transform from a ref so that any drag/resize
    // that just completed is reflected in the export, not a stale closure.
    const iS = imageStyleRef.current;

    const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
      if (!src) return resolve(null);
      const tryLoad = (useCors: boolean) => {
        const img = new Image();
        if (useCors) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => useCors ? tryLoad(false) : resolve(null);
        img.src = src;
      };
      tryLoad(true);
    });

    const rgba = (color: string, alpha: number) => getRGBAColor(color, alpha);

    const drawObjectFit = (
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      dx: number, dy: number, dw: number, dh: number,
      fit: string = 'cover'
    ) => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      if (fit === 'fill') { ctx.drawImage(img, dx, dy, dw, dh); return; }
      const r = fit === 'contain' ? Math.min(dw / iw, dh / ih) : Math.max(dw / iw, dh / ih);
      const w = iw * r, h = ih * r;
      ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
    };

    const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    };

    // Output canvas
    const out = document.createElement('canvas');
    out.width = W * SCALE; out.height = H * SCALE;
    const ctx = out.getContext('2d')!;
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'top';

    // 1. Solid/gradient bg
    if (bgType === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, bgColor1); g.addColorStop(1, bgColor2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = bgColor1 || '#000';
    }
    ctx.fillRect(0, 0, W, H);

    const mainImgUrl = getCanvasImageUrl();
    const mainImg = mainImgUrl ? await loadImg(mainImgUrl) : null;

    // 2. Replica blur background
    if (bgType === 'replica_blur' && mainImg) {
      ctx.save();
      ctx.filter = `blur(${blurAmount}px) brightness(0.35) saturate(1.5)`;
      const pad = 0.15;
      drawObjectFit(ctx, mainImg, -W * pad / 2, -H * pad / 2, W * (1 + pad), H * (1 + pad), 'cover');
      ctx.restore();
    }
    if (bgType === 'image' && bgImageUrl) {
      const bgImg = await loadImg(bgImageUrl);
      if (bgImg) drawObjectFit(ctx, bgImg, 0, 0, W, H, 'cover');
    }

    // 3. Main image (also painted to a side canvas for blur cropping)
    const mainPainted = document.createElement('canvas');
    mainPainted.width = W; mainPainted.height = H;
    const mpctx = mainPainted.getContext('2d')!;
    if (mainImg) {
      drawObjectFit(mpctx, mainImg, iS.x, iS.y, iS.width, iS.height, (iS.objectFit as any) || 'cover');

      ctx.save();
      if (iS.borderRadius > 0) {
        roundRectPath(ctx, iS.x, iS.y, iS.width, iS.height, iS.borderRadius);
        ctx.clip();
      }
      drawObjectFit(ctx, mainImg, iS.x, iS.y, iS.width, iS.height, (iS.objectFit as any) || 'cover');
      ctx.restore();

      if (iS.borderWidth > 0) {
        ctx.strokeStyle = iS.borderColor;
        ctx.lineWidth = iS.borderWidth;
        ctx.strokeRect(iS.x, iS.y, iS.width, iS.height);
      }
    }

    // ── Helper to draw a strip (panel or location): blurred replica + tinted bg
    const drawStripBg = (sx: number, sy: number, sw: number, sh: number, blurPx: number, bgColor: string, opacity: number, br: number) => {
      ctx.save();
      if (br > 0) { roundRectPath(ctx, sx, sy, sw, sh, br); ctx.clip(); }
      if (blurPx > 0 && mainImg) {
        const tmp = document.createElement('canvas');
        tmp.width = Math.max(1, sw); tmp.height = Math.max(1, sh);
        const tctx = tmp.getContext('2d')!;
        tctx.filter = `blur(${blurPx}px)`;
        tctx.drawImage(
          mainPainted,
          Math.max(0, sx), Math.max(0, sy), Math.min(sw, W - sx), Math.min(sh, H - sy),
          0, 0, sw, sh
        );
        ctx.drawImage(tmp, sx, sy);
      }
      ctx.fillStyle = rgba(bgColor, opacity);
      ctx.fillRect(sx, sy, sw, sh);
      ctx.restore();
    };

    // Try to grab an SVG icon already rendered in the live preview for a given element id
    const grabLiveSvgDataUrl = (elementId: string): string | null => {
      try {
        const node = document.querySelector(`[data-element-id="${elementId}"] svg`);
        if (!node) return null;
        const xml = new XMLSerializer().serializeToString(node);
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(xml);
      } catch { return null; }
    };

    // Generic element renderer (used for both info-bar and location-strip children)
    const drawElement = async (el: CanvasElement, parentX: number, parentY: number, textColorOverride?: string) => {
      const alignment = el.alignment || 'right';
      const baseX = parentX + el.x;
      const baseY = parentY + el.y;

      if (el.type === 'image') {
        const url = (el.id === 'company_logo' && companyInfo.logoUrl) ? companyInfo.logoUrl : (el.url || '');
        const w = el.width || 100;
        const h = el.height || 100;
        let drawX = baseX;
        if (alignment === 'center') drawX = baseX - w / 2;
        else if (alignment === 'right') drawX = baseX - w;

        const img = url ? await loadImg(fixSvgDataUrl(url)) : null;
        if (img) {
          ctx.save();
          if (el.borderRadius && el.borderRadius > 0) { roundRectPath(ctx, drawX, baseY, w, h, el.borderRadius); ctx.clip(); }
          drawObjectFit(ctx, img, drawX, baseY, w, h, 'contain');
          ctx.restore();
        } else if (el.id === 'company_logo') {
          // Fallback: draw company name text in the logo area
          ctx.save();
          ctx.fillStyle = '#c9a84c';
          ctx.font = `700 ${Math.round(h * 0.22)}px 'Cairo', sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(companyInfo.name || 'Logo', drawX + w / 2, baseY + h * 0.4);
          ctx.font = `500 ${Math.round(h * 0.13)}px 'Cairo', sans-serif`;
          ctx.fillStyle = '#b0b0b0';
          ctx.fillText(companyInfo.subtitle || '', drawX + w / 2, baseY + h * 0.7);
          ctx.restore();
        }
        return;
      }

      if (el.type === 'icon') {
        const size = el.iconSize || 24;
        const box = size + 12;
        let drawX = baseX;
        if (alignment === 'center') drawX = baseX - box / 2;
        else if (alignment === 'right') drawX = baseX - box;
        if (el.iconBackground) {
          ctx.fillStyle = el.iconBgColor || '#ffffff';
          ctx.beginPath();
          ctx.arc(drawX + box / 2, baseY + box / 2, box / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        const svgUrl = grabLiveSvgDataUrl(el.id);
        if (svgUrl) {
          const img = await loadImg(svgUrl);
          if (img) ctx.drawImage(img, drawX + 6, baseY + 6, size, size);
        }
        return;
      }

      // Text element
      // Composite multi-part text (independent fontSize/weight per part)
      if (el.parts && (el.id === 'municipality_region' || el.textKey === 'municipality_region')) {
        const sep = el.parts.separator ?? ' - ';
        const m = selectedItemDetails?.municipality || 'مصراتة';
        const r = selectedItemDetails?.region || 'المنطقة';
        const mp = el.parts.municipality || {};
        const rp = el.parts.region || {};
        const fontFam0 = el.fontFamily || "'Cairo', sans-serif";
        const color0 = textColorOverride || el.fontColor || '#fff';
        // Preview uses direction:rtl which visually places municipality on the RIGHT
        // and region on the LEFT. To match this in the canvas (which draws left-to-right),
        // we draw region first, then separator, then municipality.
        const segments = [
          { text: r, fontSize: rp.fontSize ?? el.fontSize ?? 24, fontWeight: rp.fontWeight ?? el.fontWeight ?? '400', color: rp.fontColor ?? color0 },
          { text: sep, fontSize: Math.max(mp.fontSize ?? el.fontSize ?? 24, rp.fontSize ?? el.fontSize ?? 24), fontWeight: '700', color: color0 },
          { text: m, fontSize: mp.fontSize ?? el.fontSize ?? 24, fontWeight: mp.fontWeight ?? el.fontWeight ?? '400', color: mp.fontColor ?? color0 },
        ];
        ctx.save();
        ctx.textBaseline = 'alphabetic';
        const measure = (s: typeof segments[number]) => {
          ctx.font = `${s.fontWeight} ${s.fontSize}px ${fontFam0}`;
          return ctx.measureText(s.text).width;
        };
        const widths = segments.map(measure);
        const gap = 4;
        const totalW = widths[0] + gap + widths[1] + gap + widths[2];
        let groupRight: number;
        if (alignment === 'right') groupRight = baseX;
        else if (alignment === 'center') groupRight = baseX + totalW / 2;
        else groupRight = baseX + totalW;
        const maxFs = Math.max(segments[0].fontSize, segments[1].fontSize, segments[2].fontSize);
        const baselineY = baseY + 4 + maxFs * 0.85;
        // Draw left-to-right starting from groupRight - totalW
        let cursor = groupRight - totalW;
        segments.forEach((s, i) => {
          ctx.font = `${s.fontWeight} ${s.fontSize}px ${fontFam0}`;
          ctx.fillStyle = s.color;
          ctx.textAlign = 'left';
          ctx.fillText(s.text, cursor, baselineY);
          cursor += widths[i] + (i < segments.length - 1 ? gap : 0);
        });
        ctx.restore();
        return;
      }

      const text = String(getElementText(el) ?? '');
      const color = textColorOverride || el.fontColor || '#fff';
      const fontFam = el.fontFamily || "'Cairo', sans-serif";
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${el.fontWeight || '400'} ${el.fontSize || 18}px ${fontFam}`;
      ctx.textAlign = alignment === 'right' ? 'right' : alignment === 'center' ? 'center' : 'left';
      ctx.textBaseline = 'top';
      (ctx as any).direction = 'rtl';

      // Inline icon (drawn alongside the text on the leading side)
      const inlineIconBox = (el.icon && el.icon !== 'none') ? ((el.iconSize || el.fontSize || 18) + 8) : 0;
      const textMetrics = ctx.measureText(text);
      const textW = textMetrics.width;
      const gap = inlineIconBox ? 10 : 0;
      // In the preview, the wrapper has direction:rtl and renders [icon, text]
      // which visually places the ICON on the RIGHT and the TEXT to its LEFT.
      // Mirror that exact layout here regardless of alignment.
      const totalW = textW + gap + inlineIconBox;
      let groupRight: number;
      if (alignment === 'right') {
        groupRight = baseX;
      } else if (alignment === 'center') {
        groupRight = baseX + totalW / 2;
      } else {
        groupRight = baseX + totalW;
      }
      const groupLeft = groupRight - totalW;
      const iconLeft = groupRight - inlineIconBox; // icon on the right side of the group
      const textRight = inlineIconBox ? (iconLeft - gap) : groupRight;
      ctx.textAlign = 'right';
      ctx.fillText(text, textRight, baseY + 4);

      if (inlineIconBox && el.icon) {
        const iconColor = el.iconColor || color;
        if (el.iconBackground) {
          ctx.fillStyle = el.iconBgColor || '#ffffff';
          ctx.beginPath();
          ctx.arc(iconLeft + inlineIconBox / 2, baseY + 4 + inlineIconBox / 2, inlineIconBox / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        const svgUrl = grabLiveSvgDataUrl(el.id);
        if (svgUrl) {
          const img = await loadImg(svgUrl);
          if (img) {
            const iconSize = el.iconSize || el.fontSize || 18;
            ctx.drawImage(img, iconLeft + (inlineIconBox - iconSize) / 2, baseY + 4 + (inlineIconBox - iconSize) / 2, iconSize, iconSize);
          }
        } else {
          // Fallback: small dot
          ctx.fillStyle = iconColor;
          ctx.beginPath();
          ctx.arc(iconLeft + inlineIconBox / 2, baseY + 4 + inlineIconBox / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    // 4. Glass panel (info bar)
    if (glassPanel.visible) {
      drawStripBg(glassPanel.x, glassPanel.y, glassPanel.width, glassPanel.height, glassPanel.blur ?? 15, glassPanel.backgroundColor, glassPanel.opacity ?? 0.92, glassPanel.borderRadius || 0);
      // dividers
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      [0.28, 0.60, 0.78].forEach(f => {
        ctx.fillRect(glassPanel.x + glassPanel.width * f, glassPanel.y + glassPanel.height * 0.12, 1, glassPanel.height * 0.76);
      });
      for (const el of infoPanelTexts) {
        if (!el.visible) continue;
        await drawElement(el, glassPanel.x, glassPanel.y);
      }
    }

    // 5. Location strip
    if (locationStrip.visible) {
      const sh = locationStrip.height;
      const sx = 0, sy = H - sh, sw = W;
      drawStripBg(sx, sy, sw, sh, locationStrip.blur ?? 10, locationStrip.backgroundColor, locationStrip.opacity ?? 0.9, locationStrip.borderRadius ?? 0);

      // Pin icon on the right side (matches preview)
      ctx.save();
      ctx.translate(sw - 50 - 20, sy + sh / 2 - 20);
      ctx.fillStyle = locationStrip.textColor;
      const path = new Path2D('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z');
      ctx.save();
      ctx.scale(40 / 24, 40 / 24);
      ctx.fill(path);
      ctx.fillStyle = locationStrip.backgroundColor;
      ctx.beginPath();
      ctx.arc(12, 10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();

      for (const el of locationTexts) {
        if (!el.visible) continue;
        await drawElement(el, sx, sy, locationStrip.textColor);
      }
    }

    return await new Promise<Blob>((resolve, reject) => {
      out.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png', 1.0);
    });
  };

  // ══════════════════════════════════════════
  //              ALIGNMENT
  // ══════════════════════════════════════════

  const getAlignmentTransform = (alignment: 'left' | 'center' | 'right') => {
    if (alignment === 'right') return 'translateX(-100%)';
    if (alignment === 'center') return 'translateX(-50%)';
    return 'none';
  };

  // ══════════════════════════════════════════
  //              FILTER
  // ══════════════════════════════════════════

  const filteredContracts = groupedContracts.filter(c => {
    const q = taskSearch.toLowerCase();
    const matchesSearch = !q || (
      String(c.contract_id).includes(taskSearch) ||
      c.teams.some(team => team.toLowerCase().includes(q)) ||
      c.customerName?.toLowerCase().includes(q) ||
      c.adType?.toLowerCase().includes(q)
    );
    if (!matchesSearch) return false;
    if (photoFilter === 'all') return true;
    if (photoFilter === 'with_all') return c.photoStatus === 'all';
    if (photoFilter === 'partial') return c.photoStatus === 'partial';
    if (photoFilter === 'none') return c.photoStatus === 'none' || c.photoStatus === 'unknown';
    return true;
  });

  // ══════════════════════════════════════════
  //        TEXT GROUPS: info bar vs location
  // ══════════════════════════════════════════

  const infoPanelTexts = textElements.filter(el => el.parentStrip !== 'location' && !['municipality', 'region', 'landmark', 'municipality_region'].includes(el.id));
  const locationTexts = textElements.filter(el => el.parentStrip === 'location' || ['municipality', 'region', 'landmark', 'municipality_region'].includes(el.id));

  const canvasImageUrl = getCanvasImageUrl();

  
  // ============= SEEDED RANDOM AND COLLAGE HELPERS =============
  const mulberry32 = (a: number) => {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rng = mulberry32(coverShuffleSeed || 1);
  const rand = (min: number, max: number) => min + rng() * (max - min);
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const elColors = coverElementColors;

  const pickPhotos = (limit: number) => {
    const items = taskItems.flatMap((it: any) => {
      const designUrls = [
        it.design_image_url,
        it.design_url,
        it.design_face_a_url,
        it.design_face_a,
        ...(coverIncludeBackFace ? [it.design_face_b_url, it.design_face_b] : [])
      ].filter(Boolean);
      const installUrls = [
        it.installed_image_url,
        it.installed_image_face_a_url,
        it.installed_image_face_b_url,
      ].filter(Boolean);
      let urls: string[] = [];
      if (coverMixImages) {
        urls = [...designUrls, ...installUrls];
      } else if (coverUseInstalledImages) {
        urls = installUrls.length > 0 ? installUrls : designUrls;
      } else {
        urls = designUrls.length > 0 ? designUrls : installUrls;
      }
      return urls.map((u: string, i: number) => ({ id: `${it.id}-${i}`, url: u }));
    });
    const fallback = [
      { id: 'd1', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&auto=format&fit=crop' },
      { id: 'd2', url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=900&auto=format&fit=crop' },
      { id: 'd3', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop' },
      { id: 'd4', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&auto=format&fit=crop' },
      { id: 'd5', url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=900&auto=format&fit=crop' },
      { id: 'd6', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&auto=format&fit=crop' },
    ];
    const pool = items.length > 0 ? items : fallback;
    const seen = new Set<string>();
    const unique: { id: string; url: string }[] = [];
    for (const p of pool) {
      if (!seen.has(p.url)) { seen.add(p.url); unique.push(p); }
    }
    
    if (unique.length === 0) return [];
    
    let result: { id: string; url: string }[] = [];
    if (unique.length >= limit) {
      result = shuffle(unique).slice(0, limit);
    } else {
      let lastAddedUrl = '';
      while (result.length < limit) {
        const chunk = shuffle(unique);
        if (result.length > 0 && chunk[0].url === lastAddedUrl && chunk.length > 1) {
          const swapIdx = chunk.findIndex(item => item.url !== lastAddedUrl);
          if (swapIdx !== -1) {
            [chunk[0], chunk[swapIdx]] = [chunk[swapIdx], chunk[0]];
          }
        }
        for (const item of chunk) {
          if (result.length < limit) {
            if (result.length > 0 && item.url === lastAddedUrl && unique.length > 1) {
              const alt = unique.find(x => x.url !== lastAddedUrl);
              if (alt) {
                result.push(alt);
                lastAddedUrl = alt.url;
                continue;
              }
            }
            result.push(item);
            lastAddedUrl = item.url;
          }
        }
      }
    }
    return result;
  };

  const getTemplateCrops = (photosList: { id: string; url: string }[], colCount: number) => {
    const crops = [];
    const uniqueUrls = Array.from(new Set(photosList.map(p => p.url)));
    const isSingleDesign = uniqueUrls.length <= 1;

    // Fresh seeded generator specifically for crops to ensure identical
    // outputs for a given coverShuffleSeed.
    const cropRng = mulberry32(coverShuffleSeed + 999);

    for (let i = 0; i < colCount; i++) {
      if (isSingleDesign) {
        // Distribute the center sector of the crops from left to right,
        // and add some random jitter so that shuffling changes the crop.
        const sectorWidth = 90 / colCount;
        const minX = 5 + i * sectorWidth;
        const rX = cropRng();
        const rY = cropRng();
        const x = Math.min(95, Math.max(5, minX + rX * sectorWidth));
        const y = Math.min(95, Math.max(5, 15 + rY * 70));
        crops.push({ x, y });
      } else {
        // For multiple designs, stagger them and add small seeded jitters
        const x = colCount > 1 ? 5 + (i * 90) / (colCount - 1) : 50;
        const patternY = [15, 80, 48, 25, 70, 50];
        const y = colCount > 1 ? patternY[i % patternY.length] : 50;
        
        const jitterX = (cropRng() - 0.5) * 10; // +/- 5%
        const jitterY = (cropRng() - 0.5) * 10;
        crops.push({ 
          x: Math.min(95, Math.max(5, x + jitterX)), 
          y: Math.min(95, Math.max(5, y + jitterY)) 
        });
      }
    }
    return crops;
  };

  const BlurredImage = ({
    src,
    blur,
    className,
    style,
    transform,
    objectPosition,
    saturate = 1.0,
    brightness = 1.0,
    transformOrigin,
    zoom,
    cropX,
    cropY,
  }: {
    src: string;
    blur: number;
    className?: string;
    style?: React.CSSProperties;
    transform?: string;
    objectPosition?: string;
    saturate?: number;
    brightness?: number;
    transformOrigin?: string;
    zoom?: number;
    cropX?: number;
    cropY?: number;
  }) => {
    const filterId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

    // Layout-based Zoom & Shift to prevent browser painting crops
    let imgStyle: React.CSSProperties = {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: objectPosition || '50% 50%',
      transform: transform,
      transformOrigin: transformOrigin || '50% 50%',
    };

    if (zoom !== undefined && zoom > 1 && cropX !== undefined && cropY !== undefined) {
      const cX = cropX;
      const cY = cropY;
      
      const maxShiftX = -(zoom - 1) * 100;
      const calculatedLeft = 50 - cX * zoom;
      const finalLeft = Math.min(0, Math.max(maxShiftX, calculatedLeft));

      const maxShiftY = -(zoom - 1) * 100;
      const calculatedTop = 50 - cY * zoom;
      const finalTop = Math.min(0, Math.max(maxShiftY, calculatedTop));
      
      imgStyle = {
        ...imgStyle,
        left: `${finalLeft.toFixed(2)}%`,
        top: `${finalTop.toFixed(2)}%`,
        width: `${(zoom * 100).toFixed(2)}%`,
        height: `${(zoom * 100).toFixed(2)}%`,
        maxWidth: 'none',
        maxHeight: 'none',
        objectPosition: `${cX}% ${cY}%`,
      };
    } else if (cropX !== undefined && cropY !== undefined) {
      imgStyle = {
        ...imgStyle,
        objectPosition: `${cropX}% ${cropY}%`,
      };
    }

    const isAbsolute = className?.split(' ').includes('absolute') || className?.includes('absolute');
    const position = style?.position || (isAbsolute ? 'absolute' : 'relative');

    return (
      <div className={className} style={{ position, overflow: 'hidden', ...style }}>
        <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
          <defs>
            <filter id={`svg-blur-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={blur} />
            </filter>
          </defs>
        </svg>
        <img
          src={src}
          crossOrigin="anonymous"
          alt=""
          style={{
            ...imgStyle,
            filter: blur > 0 
              ? (isExporting 
                  ? `url(#svg-blur-${filterId}) saturate(${saturate}) brightness(${brightness})`
                  : `blur(${blur}px) saturate(${saturate}) brightness(${brightness})`)
              : `saturate(${saturate}) brightness(${brightness})`
          }}
        />
      </div>
    );
  };

  const WavyGlass = ({ 
    accent, 
    opacity = 1, 
    density = 'normal',
    blur,
  }: { 
    accent: string; 
    opacity?: number; 
    density?: 'normal' | 'ultra'; 
    blur?: number;
  }) => {
    const widthsNormal = [5.5, 7, 4.5, 8, 5, 6.5, 4, 7.5, 5, 6, 4.5, 8, 5, 6.5, 4, 7, 5.5, 6];
    const blursNormal  = [4,   1.5, 6, 0.8, 3,   5,   1.2, 4.5, 2, 5.5, 0.6, 4, 2.5, 6, 1, 3.5, 5, 2];
    const tintsNormal  = [0.20,0.10,0.24,0.06,0.14,0.22,0.08,0.18,0.11,0.21,0.05,0.17,0.12,0.23,0.07,0.15,0.20,0.13];
    const widthsUltra = [3, 5, 2.5, 6, 3.5, 4, 2.8, 5.5, 3, 4.5, 2.6, 7, 3.2, 4, 2.7, 5, 3, 6, 3.5, 4.5, 2.8, 5, 3, 4, 2.6, 5.5, 3, 4.5];
    const blursUltra  = [0.5, 3, 5, 0.8, 2.5, 4.5, 1, 6, 0.4, 3.5, 5.5, 1.2, 4, 0.6, 3, 5, 1.5, 4, 6, 0.8, 2.8, 4.5, 1.1, 5, 0.5, 3.2, 5.5, 1.4];
    const tintsUltra  = [0.22, 0.10, 0.26, 0.06, 0.16, 0.24, 0.08, 0.20, 0.12, 0.22, 0.05, 0.18, 0.14, 0.25, 0.07, 0.16, 0.22, 0.13, 0.27, 0.06, 0.15, 0.23, 0.09, 0.19, 0.11, 0.21, 0.07, 0.17];
    const widths = density === 'ultra' ? widthsUltra : widthsNormal;
    const blurs  = density === 'ultra' ? blursUltra  : blursNormal;
    const tints  = density === 'ultra' ? tintsUltra  : tintsNormal;
    let acc = 0;
    const scaleFactor = blur !== undefined ? Math.min(1, blur / 10) : 1;
    const cols = widths.map((w, i) => {
      const left = `${acc}%`;
      acc += w;
      const currentBlur = blurs[i] * scaleFactor;
      return { left, width: `${w}%`, blur: currentBlur, tint: tints[i] };
    });
    return (
      <div className="absolute inset-0 z-[10] pointer-events-none">
        {cols.map((g, idx) => (
          <div
            key={`glass-rib-${idx}`}
            className="absolute top-0 bottom-0"
            style={{
              left: g.left,
              width: g.width,
              backdropFilter: g.blur > 0 ? `blur(${g.blur}px) saturate(140%)` : 'none',
              WebkitBackdropFilter: g.blur > 0 ? `blur(${g.blur}px) saturate(140%)` : 'none',
              background: `linear-gradient(90deg, rgba(255,255,255,${0.03 + g.tint * 0.25}) 0%, rgba(255,255,255,0.005) 30%, rgba(0,0,0,0.01) 70%, rgba(0,0,0,${0.08 + g.tint * 0.45}) 100%)`,
              borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: 'inset 0 0 15px rgba(255,255,255,0.04), 0 0 25px rgba(255,255,255,0.05)',
            }}
          />
        ))}
      </div>
    );
  };

  const Header = ({ accent, brandRight = true, align = 'center', imagesSide }: { accent: string; brandRight?: boolean; align?: 'right' | 'center' | 'left'; imagesSide?: 'left' | 'right' }) => {
    const panelLogoEl = textElements.find(el => el.id === 'company_logo');
    const logoSrc = companyInfo.logoUrl || panelLogoEl?.url || '';
    const showLogo = coverShow.companyLogo && !!logoSrc;
    const showName = coverShow.companyName;
    const isT5 = coverTemplate === 'template5';
    const brandWidth = align === 'center' ? (imagesSide ? (isT5 ? '33%' : '50%') : '80%') : '60%';
    const brandMarginLeft = align === 'center'
      ? (imagesSide === 'left' ? (isT5 ? '64%' : '45%') : imagesSide === 'right' ? '3%' : 'auto')
      : align === 'right' ? 'auto' : '0';
    const brandMarginRight = align === 'center'
      ? (imagesSide === 'right' ? (isT5 ? '64%' : '45%') : imagesSide === 'left' ? '3%' : 'auto')
      : align === 'left' ? 'auto' : '0';
    
    // Position client info opposite to the portal in Template 5 to avoid overlapping the collage
    const clientSide = isT5 ? (imagesSide === 'right' ? 'left' : 'right') : (brandRight ? 'left' : 'right');

    return (
      <div className="absolute z-30" style={{ top: '64px', left: '64px', right: '64px' }}>
        {coverShow.clientInfo && (
          <div
            className="absolute top-0 flex flex-col gap-1 items-end text-right"
            style={{ 
              [clientSide]: 0, 
              direction: 'rtl', 
              fontFamily: "'Tajawal', 'Cairo', sans-serif",
              fontSize: isT5 ? '13px' : '18px'
            } as React.CSSProperties}
          >
            <div className="text-white/85 font-bold tracking-wide" style={{ fontSize: isT5 ? '14px' : 'inherit' }}>العميل: {selectedItemDetails?.customer_name || 'العميل'}</div>
            <div className="text-white/60 font-medium tracking-wide" style={{ fontSize: isT5 ? '12px' : 'inherit' }}>الموقع: {selectedItemDetails?.municipality || 'طرابلس'}{selectedItemDetails?.region ? `، ${selectedItemDetails.region}` : ''}</div>
          </div>
        )}
        {(showLogo || showName) && (
          <div
            style={{
              width: brandWidth,
              marginLeft: brandMarginLeft,
              marginRight: brandMarginRight,
              display: 'grid',
              placeItems: 'center',
              minHeight: `${isT5 ? Math.round(coverFontSizes.companyBrandLogo * 0.8) : coverFontSizes.companyBrandLogo}px`,
            }}
          >
            {showLogo && (
              <img
                src={logoSrc}
                className="object-contain"
                style={{ 
                  gridArea: '1 / 1', 
                  height: `${isT5 ? Math.round(coverFontSizes.companyBrandLogo * 0.8) : coverFontSizes.companyBrandLogo}px`, 
                  maxWidth: `${(isT5 ? Math.round(coverFontSizes.companyBrandLogo * 0.8) : coverFontSizes.companyBrandLogo) * 3.5}px` 
                }}
              />
            )}
            {showName && (
              <div className="text-center" style={{ gridArea: '1 / 1' }}>
                <div className="font-black font-sans leading-none" style={{ color: elColors.brandName || accent, fontSize: `${isT5 ? Math.round(coverFontSizes.companyBrandName * 0.8) : coverFontSizes.companyBrandName}px` }}>{companyInfo.name}</div>
                {companyInfo.subtitle && (
                  <div className="text-white/60 font-semibold tracking-wider uppercase" style={{ fontSize: `${Math.max(10, Math.round((isT5 ? Math.round(coverFontSizes.companyBrandName * 0.8) : coverFontSizes.companyBrandName) * 0.4))}px`, marginTop: `${Math.max(8, Math.round((isT5 ? Math.round(coverFontSizes.companyBrandName * 0.8) : coverFontSizes.companyBrandName) * 0.35))}px` }}>{companyInfo.subtitle}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const TextBlock = ({ accent, align, imagesSide }: { accent: string; align: 'right' | 'center' | 'left'; imagesSide?: 'left' | 'right' }) => {
    const isT5 = coverTemplate === 'template5';
    return (
      <div
        className={`flex flex-col ${align === 'right' ? 'items-end ml-auto' : align === 'left' ? 'items-start mr-auto' : 'items-center mx-auto'} justify-center my-auto z-30 relative`}
        dir="ltr"
        style={{
          width: align === 'center' ? (imagesSide ? (isT5 ? '33%' : '50%') : '80%') : (isT5 ? '38%' : '60%'),
          textAlign: align === 'center' ? 'center' : 'right',
          alignSelf: align === 'right'
            ? 'flex-end'
            : align === 'left'
            ? 'flex-start'
            : (imagesSide ? 'flex-start' : 'center'),
          marginLeft: align === 'center'
            ? (imagesSide === 'left' ? (isT5 ? '64%' : '45%') : imagesSide === 'right' ? '3%' : 'auto')
            : align === 'right' ? 'auto' : (isT5 ? '80px' : '0'),
          marginRight: align === 'center'
            ? (imagesSide === 'right' ? (isT5 ? '64%' : '45%') : imagesSide === 'left' ? '3%' : 'auto')
            : align === 'left' ? 'auto' : (isT5 ? '80px' : '0'),
          transform: isT5 ? 'translateY(-160px)' : 'none',
        }}
      >
        {coverShow.kicker && coverKicker && (
          <h2 dir="rtl" className="font-semibold tracking-wide" style={{ color: elColors.kicker || accent, fontSize: `${isT5 ? Math.round(coverFontSizes.kicker * 0.70) : coverFontSizes.kicker}px`, lineHeight: 1.3, marginBottom: `${Math.max(14, Math.round((isT5 ? coverFontSizes.kicker * 0.70 : coverFontSizes.kicker) * 0.7))}px`, textShadow: `0 2px 14px ${(elColors.kicker || accent)}80`, textAlign: align === 'center' ? 'center' : align === 'left' ? 'left' : 'right', width: '100%' }}>{coverKicker}</h2>
        )}
        <h1 dir="rtl" className="font-black" style={{ color: elColors.campaignName || '#ffffff', fontFamily: "'Tajawal', 'Cairo', sans-serif", fontSize: `${isT5 ? Math.round(coverFontSizes.campaignName * 0.68) : coverFontSizes.campaignName}px`, lineHeight: 1.18, paddingBottom: '0.05em', letterSpacing: 0, textShadow: `0 14px 32px rgba(0,0,0,0.7), 0 0 80px ${accent}33`, overflow: 'visible', textAlign: align === 'center' ? 'center' : align === 'left' ? 'left' : 'right', width: '100%' }}>{(adTypeOverride && adTypeOverride.trim()) || ((groupedContracts.find((x:any) => String(x.contract_id) === selectedContractId) as any)?.adType) || coverCampaignName || coverTitle2}</h1>
        {coverShow.tagline && coverTagline && (
          <div className="inline-flex items-center justify-center font-bold" style={{ color: '#1a1408', background: `linear-gradient(180deg, ${(elColors.tagline || accent)} 0%, ${(elColors.tagline || accent)}cc 100%)`, borderRadius: '9999px', padding: '14px 36px', fontSize: `${isT5 ? Math.round(coverFontSizes.tagline * 0.78) : coverFontSizes.tagline}px`, marginTop: `${(isT5 ? Math.round(coverFontSizes.campaignName * 0.68 * 0.50) : Math.max(65, Math.round(coverFontSizes.campaignName * 0.52)))}px`, boxShadow: `0 12px 30px ${(elColors.tagline || accent)}73, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.25)` }}>{coverTagline}</div>
        )}
        {coverShow.badge && coverBadge && (
          <div className="inline-flex items-center justify-center font-semibold tracking-wide" style={{ color: elColors.badge || accent, background: `${(elColors.badge || accent)}1f`, border: `1px solid ${(elColors.badge || accent)}99`, borderRadius: '9999px', padding: '10px 26px', fontSize: `${isT5 ? Math.round(coverFontSizes.badge * 0.78) : coverFontSizes.badge}px`, marginTop: `${(coverShow.tagline && coverTagline) ? (isT5 ? Math.round(coverFontSizes.badge * 0.78 * 1.3) : Math.max(30, Math.round(coverFontSizes.badge * 1.5))) : (isT5 ? Math.round(coverFontSizes.campaignName * 0.68 * 0.58) : Math.max(75, Math.round(coverFontSizes.campaignName * 0.60)))}px`, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>{coverBadge}</div>
        )}
      </div>
    );
  };

  const Footer = ({ accent, reverse = false }: { accent: string; reverse?: boolean }) => (
    (coverShow.copyright || coverShow.footerRight) ? (
      <div className={`absolute bottom-8 inset-x-16 flex ${reverse ? 'flex-row-reverse' : ''} justify-between items-end z-30 pointer-events-none`}>
        {coverShow.copyright ? (
          <div className="text-white/65 italic max-w-[55%] leading-tight" style={{ direction: 'ltr', fontFamily: "'Manrope', sans-serif", fontSize: `${coverFontSizes.copyright}px` }}>{coverCopyright}</div>
        ) : <div />}
        {coverShow.footerRight && (
          <div className="font-semibold tracking-wider" style={{ direction: 'ltr', fontFamily: "'Manrope', sans-serif", fontSize: `${coverFontSizes.footerRight}px`, color: elColors.footerRight || accent }}>{coverFooterRight}</div>
        )}
      </div>
    ) : null
  );

// ══════════════════════════════════════════
  //                RENDER
  // ══════════════════════════════════════════

  return (
    <div className="flex flex-col gap-4 w-full p-1 min-h-[calc(100vh-140px)] font-sans" dir="rtl">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700;900&family=Almarai:wght@300;400;700;800&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ──── Top Header Bar with Back Button ──── */}
      <div className="flex items-center justify-between bg-card/90 backdrop-blur-sm p-3 rounded-xl border border-border/40 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5 h-9 text-xs font-bold text-foreground">
            <ArrowRight className="h-4 w-4" />
            العودة للخلف
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-base font-bold text-foreground">استوديو التصميم (Design Studio)</h1>
        </div>
      </div>

      {/* ═══════════════ CONTRACT SELECTION MODAL ═══════════════ */}
      {showContractModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowContractModal(false); }}
        >
          <div
            className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold">اختيار مهمة التركيب</h2>
                  <p className="text-[11px] text-muted-foreground">{groupedContracts.length} عقد متاح — اختر عقداً لعرض تصميمه</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setShowContractModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-border/30">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالعقد، الزبون، نوع الإعلان، أو الفريق..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pr-10 h-10 text-sm bg-muted/40"
                  autoFocus
                />
              </div>
              {taskSearch && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  {filteredContracts.length} نتيجة من أصل {groupedContracts.length}
                </p>
              )}
              {/* Photo availability filter */}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <span className="text-[11px] text-muted-foreground ml-1">صور التركيب:</span>
                {([
                  { key: 'all', label: 'الكل' },
                  { key: 'with_all', label: 'متوفرة كاملة' },
                  { key: 'partial', label: 'متوفرة جزئياً' },
                  { key: 'none', label: 'غير متوفرة' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setPhotoFilter(opt.key)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                      photoFilter === opt.key
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-primary/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contracts Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingTasks ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm">جاري تحميل المهام...</span>
                </div>
              ) : filteredContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                  <Search className="h-10 w-10 opacity-30" />
                  <span className="text-sm">لا توجد نتائج مطابقة</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredContracts.map((c) => {
                    const tc = c as any;
                    const isSelected = String(c.contract_id) === selectedContractId;
                    return (
                      <button
                        key={c.contract_id}
                        onClick={() => {
                          setSelectedContractId(String(c.contract_id));
                          setShowContractModal(false);
                          setTaskSearch('');
                        }}
                        className={`group relative flex flex-col rounded-xl border text-right overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40 bg-primary/5 shadow-md'
                            : 'border-border/40 bg-card hover:border-primary/40'
                        }`}
                      >
                        {/* Design Thumbnail */}
                        <div className="w-full h-36 bg-muted/50 relative overflow-hidden">
                          {tc.designImage ? (
                            <img
                              src={tc.designImage}
                              crossOrigin="anonymous"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                              <ImageIcon className="h-10 w-10" />
                              <span className="text-[10px]">لا يوجد تصميم</span>
                            </div>
                          )}
                          {/* Ad type badge */}
                          {tc.adType && (
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full truncate max-w-[90%]">
                              {tc.adType}
                            </div>
                          )}
                          {/* Photo availability badge */}
                          {tc.photoStatus && tc.photoStatus !== 'unknown' && (
                            <div
                              className={`absolute bottom-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border ${
                                tc.photoStatus === 'all'
                                  ? 'bg-green-500/85 text-white border-green-300/50'
                                  : tc.photoStatus === 'partial'
                                  ? 'bg-amber-500/85 text-white border-amber-300/50'
                                  : 'bg-red-500/85 text-white border-red-300/50'
                              }`}
                              title="حالة صور التركيب"
                            >
                              📷 {tc.photoItems || 0}/{tc.totalItems || 0}
                              {tc.photoStatus === 'all' ? ' ✓' : tc.photoStatus === 'none' ? ' ✗' : ''}
                            </div>
                          )}
                          {/* Selected check */}
                          {isSelected && (
                            <div className="absolute top-2 left-2 bg-primary rounded-full p-0.5">
                              <Check className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-2.5 space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[10px] text-muted-foreground font-mono">#{c.contract_id}</span>
                            <span className="text-[10px] text-muted-foreground">{tc.taskIds?.length || 1} مهمة</span>
                          </div>
                          <div className="text-xs font-bold text-foreground leading-tight truncate">
                            {tc.customerName || 'زبون عام'}
                          </div>
                          {tc.teams?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {tc.teams.slice(0, 2).map((t: string) => (
                                <span key={t} className="text-[9px] bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
                                  {t}
                                </span>
                              ))}
                              {tc.teams.length > 2 && (
                                <span className="text-[9px] text-muted-foreground">+{tc.teams.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border/30 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {selectedContractId ? `✅ تم اختيار عقد #${selectedContractId}` : 'لم يتم اختيار عقد بعد'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setShowContractModal(false); setTaskSearch(''); }}>
                  إلغاء
                </Button>
                {selectedContractId && (
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => { setShowContractModal(false); setTaskSearch(''); }}>
                    <Check className="h-3.5 w-3.5" />
                    تأكيد الاختيار
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5">

      {/* ═══════════════ LEFT PANEL (RESTYLED WITH TABS) ═══════════════ */}
      <div className="w-full xl:w-[370px] shrink-0 flex flex-col gap-3 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">
        {/* ── Sticky template save toolbar (always visible) ── */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border border-border/40 rounded-2xl p-2 shadow-md flex items-center gap-2">
          <Button
            onClick={handleUpdateTemplate}
            disabled={savingTemplate || !selectedTemplateId}
            className="flex-1 h-9 gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md transition-all disabled:opacity-50"
            title={selectedTemplateId ? 'حفظ التعديلات في القالب الحالي' : 'حمّل قالباً أولاً'}
          >
            <Save className="h-4 w-4" />
            حفظ تحديثات القالب
          </Button>
          <div className="flex gap-1 flex-1">
            <Input
              placeholder="اسم قالب جديد..."
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="h-9 text-[11px] rounded-xl flex-1"
            />
            <Button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !newTemplateName.trim()}
              size="sm"
              className="h-9 px-2 gap-1 text-[11px] rounded-xl font-bold bg-primary hover:bg-primary/95"
              title="حفظ كقالب جديد"
            >
              <Plus className="h-3.5 w-3.5" />
              جديد
            </Button>
          </div>
        </div>

        <Tabs defaultValue="data" className="w-full flex flex-col gap-3">
          {/* Elegant tabs navigation */}
          <TabsList className="grid grid-cols-4 bg-muted/60 p-1.5 rounded-2xl border border-border/25 shadow-sm">
            <TabsTrigger value="data" className="text-xs font-bold py-2 rounded-xl transition-all data-[state=active]:bg-card data-[state=active]:shadow-sm">البيانات</TabsTrigger>
            <TabsTrigger value="design" className="text-xs font-bold py-2 rounded-xl transition-all data-[state=active]:bg-card data-[state=active]:shadow-sm">التنسيق</TabsTrigger>
            <TabsTrigger value="layers" className="text-xs font-bold py-2 rounded-xl transition-all data-[state=active]:bg-card data-[state=active]:shadow-sm">العناصر</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs font-bold py-2 rounded-xl transition-all data-[state=active]:bg-card data-[state=active]:shadow-sm">القوالب</TabsTrigger>
          </TabsList>

          {/* ════════ TAB 1: DATA & TASKS ════════ */}
          <TabsContent value="data" className="space-y-3 outline-none">
            {/* Task Selector */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  بيانات المهمة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                {/* Contract Selector */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">مهمة التركيب (العقد)</Label>
                  <Button
                    variant="outline"
                    className="w-full h-auto min-h-[60px] justify-start gap-3 px-3 py-2 text-right hover:bg-primary/5 hover:border-primary/40 transition-all rounded-xl border-border/60"
                    onClick={() => setShowContractModal(true)}
                  >
                    {selectedContractId ? (() => {
                      const c = groupedContracts.find(x => String(x.contract_id) === selectedContractId) as any;
                      return c ? (
                        <div className="flex items-center gap-3 w-full" dir="rtl">
                          {c.designImage ? (
                            <img src={c.designImage} crossOrigin="anonymous" className="h-10 w-10 rounded-lg object-cover border border-border/50 flex-shrink-0 shadow-sm" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 text-right">
                            <div className="text-xs font-bold text-foreground truncate">عقد #{c.contract_id} — {c.customerName || 'زبون'}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{c.adType || 'نوع إعلان غير محدد'} • {c.teams?.join(' + ') || 'بدون فريق'}</div>
                          </div>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        </div>
                      ) : null;
                    })() : (
                      <div className="flex items-center gap-2 text-muted-foreground w-full" dir="rtl">
                        <Search className="h-4 w-4" />
                        <span className="text-xs">{loadingTasks ? 'جاري تحميل المهام...' : 'اضغط لاختيار مهمة التركيب...'}</span>
                      </div>
                    )}
                  </Button>
                </div>

                {/* Task selector (only when contract has multiple tasks, e.g. re-installation) */}
                {selectedContractId && (() => {
                  const contract = groupedContracts.find(c => String(c.contract_id) === selectedContractId);
                  if (!contract || contract.taskIds.length < 2) return null;
                  const contractTasks = tasks.filter(t => contract.taskIds.includes(t.id));
                  const taskTypeLabel = (tt?: string) => {
                    const v = (tt || '').toLowerCase();
                    if (v.includes('re') || (tt || '').includes('إعادة')) return 'إعادة تركيب';
                    if (v.includes('remov') || (tt || '').includes('فك')) return 'فك';
                    if (v.includes('maint') || (tt || '').includes('صيانة')) return 'صيانة';
                    return 'تركيب';
                  };
                  return (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">المهمة ({contractTasks.length})</Label>
                      <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                        <SelectTrigger className="h-9 text-xs rounded-xl">
                          <SelectValue placeholder="اختر المهمة..." />
                        </SelectTrigger>
                        <SelectContent>
                          {contractTasks.map(t => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {taskTypeLabel(t.task_type)} — {t.created_at ? new Date(t.created_at).toLocaleDateString('ar-LY') : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {/* Billboard list navigation */}
                {selectedContractId && taskItems.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">اللوحة ({currentItemIndex + 1} / {taskItems.length})</Label>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={!canGoPrev} onClick={goToPrevItem}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                        <SelectTrigger className="h-9 text-xs flex-1 rounded-xl">
                          <SelectValue placeholder={loadingItems ? "تحميل..." : "اختر اللوحة..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {taskItems.map((item, idx) => (
                            <SelectItem key={item.id} value={item.id} className="text-xs">
                              لوحة {idx + 1} — معرف: {item.billboard_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={!canGoNext} onClick={goToNextItem}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Image source selector */}
                {selectedItemDetails && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">مصدر الصورة</Label>
                    <Select value={imageSource} onValueChange={(v) => setImageSource(v as 'installed' | 'face_a' | 'face_b')}>
                      <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {selectedItemDetails.installed_image && <SelectItem value="installed" className="text-xs">صورة التركيب</SelectItem>}
                        {selectedItemDetails.installed_face_a && <SelectItem value="face_a" className="text-xs">وجه أمامي</SelectItem>}
                        {selectedItemDetails.installed_face_b && <SelectItem value="face_b" className="text-xs">وجه خلفي</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Quick Info Display */}
                {selectedItemDetails && (
                  <div className="bg-muted/50 rounded-xl p-2.5 text-[11px] space-y-1.5 border border-border/30">
                    <div className="flex justify-between"><span className="text-muted-foreground">العميل:</span><span className="font-semibold">{selectedItemDetails.customer_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">اللوحة:</span><span className="font-semibold">{selectedItemDetails.billboard_code}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المقاس:</span><span className="font-semibold">{selectedItemDetails.size}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">البلدية:</span><span className="font-semibold">{selectedItemDetails.municipality}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Company Info */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  بيانات الشركة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">الاسم</Label>
                    <Input value={companyInfo.name} onChange={(e) => setCompanyInfo(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">الوصف</Label>
                    <Input value={companyInfo.subtitle} onChange={(e) => setCompanyInfo(p => ({ ...p, subtitle: e.target.value }))} className="h-8 text-xs rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />الهاتف</Label>
                    <Input value={companyInfo.phone} onChange={(e) => setCompanyInfo(p => ({ ...p, phone: e.target.value }))} className="h-8 text-xs rounded-lg" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />الموقع</Label>
                    <Input value={companyInfo.website} onChange={(e) => setCompanyInfo(p => ({ ...p, website: e.target.value }))} className="h-8 text-xs rounded-lg" dir="ltr" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">شعار الشركة (رابط)</Label>
                  <Input placeholder="https://..." value={companyInfo.logoUrl} onChange={(e) => setCompanyInfo(p => ({ ...p, logoUrl: e.target.value }))} className="h-8 text-[10px] rounded-lg" dir="ltr" />
                </div>
                <Button
                  onClick={() => {
                    localStorage.setItem('adhub_design_studio_company_info', JSON.stringify(companyInfo));
                    toast.success('تم حفظ بيانات الشركة بنجاح!');
                  }}
                  size="sm"
                  className="w-full mt-2 gap-1 text-xs rounded-xl"
                >
                  <Save className="h-3.5 w-3.5" />
                  حفظ بيانات الشركة
                </Button>
              </CardContent>
            </Card>

            {/* ── Studio-only: override ad type for ALL billboards ── */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-500" />
                  تخصيص نوع الإعلان (لكل اللوحات)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Label className="text-[11px] text-muted-foreground">
                  استبدل قيمة "نوع الإعلان" لجميع البطاقات في الاستوديو فقط (لا يؤثر على قاعدة البيانات).
                </Label>
                <Input
                  placeholder="مثال: حملة الفارس الذهبي 2026"
                  value={adTypeOverride}
                  onChange={(e) => setAdTypeOverride(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setAdTypeOverride(''); toast.success('تمت استعادة نوع الإعلان الأصلي لكل اللوحات'); }}
                    className="h-8 text-[11px] gap-1 rounded-lg flex-1"
                    disabled={!adTypeOverride}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    استعادة الأصلي
                  </Button>
                </div>
                {adTypeOverride && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    ✓ مفعل: سيظهر النص أعلاه بدلاً من نوع الإعلان لكل البطاقات.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ TAB 2: CANVAS & LAYOUT ════════ */}
          <TabsContent value="design" className="space-y-3 outline-none">
            {/* Design Mode Selector */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Layout className="h-4 w-4 text-primary" />
                  نمط التصميم (Layout Mode)
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 flex gap-2">
                <Button
                  variant={layoutMode === 'normal' ? 'default' : 'outline'}
                  className="flex-1 h-9 text-xs font-bold rounded-xl"
                  onClick={() => setLayoutMode('normal')}
                >
                  البطاقة الفردية
                </Button>
                <Button
                  variant={layoutMode === 'cover' ? 'default' : 'outline'}
                  className="flex-1 h-9 text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-xl"
                  onClick={() => setLayoutMode('cover')}
                >
                  صفحة الغلاف
                </Button>
              </CardContent>
            </Card>

            {/* Template Background settings */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  خلفية القالب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <Select value={bgType} onValueChange={(v) => setBgType(v as 'replica_blur' | 'solid' | 'gradient' | 'image')}>
                  <SelectTrigger className="h-8 text-[11px] rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replica_blur" className="text-xs">صورة مموهة (زجاجية)</SelectItem>
                    <SelectItem value="solid" className="text-xs">لون مصمت</SelectItem>
                    <SelectItem value="gradient" className="text-xs">تدرج لوني</SelectItem>
                    <SelectItem value="image" className="text-xs">صورة مخصصة</SelectItem>
                  </SelectContent>
                </Select>
                {bgType === 'replica_blur' && (
                  <div className="space-y-1">
                    <div className="flex justify-between"><Label className="text-[11px]">تمويه</Label><span className="font-mono text-[10px]">{blurAmount}px</span></div>
                    <Slider min={0} max={60} step={1} value={[blurAmount]} onValueChange={([v]) => setBlurAmount(v)} />
                  </div>
                )}
                {(bgType === 'solid' || bgType === 'gradient') && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">اللون</Label>
                      <div className="flex gap-1">
                        <Input type="color" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                        <Input value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="h-8 text-[10px] font-mono rounded-lg" />
                      </div>
                    </div>
                    {bgType === 'gradient' && (
                      <div className="space-y-1">
                        <Label className="text-[10px]">لون 2</Label>
                        <div className="flex gap-1">
                          <Input type="color" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                          <Input value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="h-8 text-[10px] font-mono rounded-lg" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {bgType === 'image' && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">رابط الصورة</Label>
                    <Input placeholder="https://..." value={bgImageUrl} onChange={(e) => setBgImageUrl(e.target.value)} className="h-8 text-[10px] rounded-lg" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location Strip styling */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-400" />
                  شريط الموقع السفلي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">إظهار شريط الموقع</Label>
                  <Switch checked={locationStrip.visible} onCheckedChange={(c) => setLocationStrip(p => ({ ...p, visible: c }))} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label className="text-[11px]">الارتفاع</Label><span className="font-mono text-[10px]">{locationStrip.height}px</span></div>
                  <Slider min={40} max={250} step={1} value={[locationStrip.height]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, height: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">لون الخلفية</Label>
                    <div className="flex gap-1">
                      <Input type="color" value={locationStrip.backgroundColor} onChange={(e) => setLocationStrip(p => ({ ...p, backgroundColor: e.target.value }))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                      <Input value={locationStrip.backgroundColor} onChange={(e) => setLocationStrip(p => ({ ...p, backgroundColor: e.target.value }))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">لون النص</Label>
                    <div className="flex gap-1">
                      <Input type="color" value={locationStrip.textColor} onChange={(e) => setLocationStrip(p => ({ ...p, textColor: e.target.value }))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                      <Input value={locationStrip.textColor} onChange={(e) => setLocationStrip(p => ({ ...p, textColor: e.target.value }))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label className="text-[11px]">الشفافية</Label><span className="font-mono text-[10px]">{Math.round((locationStrip.opacity ?? 0.9) * 100)}%</span></div>
                  <Slider min={0} max={1} step={0.05} value={[locationStrip.opacity ?? 0.9]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, opacity: v }))} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label className="text-[11px]">تمويه زجاجي (Blur)</Label><span className="font-mono text-[10px]">{locationStrip.blur ?? 10}px</span></div>
                  <Slider min={0} max={50} step={1} value={[locationStrip.blur ?? 10]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, blur: v }))} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label className="text-[11px]">انحناء الحواف</Label><span className="font-mono text-[10px]">{locationStrip.borderRadius ?? 0}px</span></div>
                  <Slider min={0} max={100} step={1} value={[locationStrip.borderRadius ?? 0]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, borderRadius: v }))} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label className="text-[11px]">سمك الحدود</Label><span className="font-mono text-[10px]">{locationStrip.borderWidth ?? 0}px</span></div>
                  <Slider min={0} max={20} step={1} value={[locationStrip.borderWidth ?? 0]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, borderWidth: v }))} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ TAB 3: ELEMENTS & LAYERS ════════ */}
          <TabsContent value="layers" className="space-y-3 outline-none">
            {/* Add New Elements */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-500" />
                  إضافة عنصر جديد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleAddText} variant="outline" size="sm" className="h-8 text-xs gap-1 rounded-lg">
                    <AlignLeft className="h-3.5 w-3.5 text-blue-500" />
                    إضافة نص
                  </Button>
                  <Label className="h-8 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg flex items-center justify-center cursor-pointer text-xs gap-1 transition-colors">
                    <ImageIcon className="h-3.5 w-3.5 text-emerald-500" />
                    رفع شعار / صورة
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">إضافة أيقونة</Label>
                  <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto p-1.5 bg-muted/35 border rounded-lg">
                    {Object.keys(iconMap).map(name => (
                      <Button
                        key={name}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAddIcon(name)}
                        className="h-7 w-7 rounded-md hover:bg-primary/20"
                        title={`إضافة ${name}`}
                      >
                        {renderLucideIcon(name, 'currentColor', 16)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Layer controls & Active selections */}
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl flex-1">
              <CardHeader className="pb-2 pt-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  خصائص العنصر المحدد
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleResetLayout} title="إعادة تعيين">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-xs pb-4">
                {layoutMode === 'cover' ? (
                  <div className="space-y-4 pt-1">
                    {/* Template selector */}
                    <div className="space-y-2 pb-3 border-b border-border/40">
                      <div className="text-[11px] font-bold text-primary">القالب</div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: 'template1', label: '1 — مموج عميق' },
                          { id: 'template2', label: '2 — كريستال' },
                          { id: 'template3', label: '3 — زجاج مموّج' },
                          { id: 'template4', label: '4 — بطاقات' },
                          { id: 'template5', label: '5 — البوابة الذهبية' },
                        ] as const).map((t) => (
                          <Button
                            key={t.id}
                            type="button"
                            variant={coverTemplate === t.id ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 text-[11px] rounded-lg"
                            onClick={() => handleSelectTemplate(t.id as any)}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] rounded-lg border-primary/40 text-primary hover:bg-primary/10 gap-1"
                          onClick={handleSaveDefaultTemplateSettings}
                          title="حفظ الإعدادات الحالية لتصبح الإعدادات الافتراضية عند فتح هذا القالب مستقبلاً"
                        >
                          حفظ كافتراضي
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] rounded-lg text-muted-foreground hover:text-destructive gap-1"
                          onClick={handleResetDefaultTemplateSettings}
                          title="استعادة الإعدادات الافتراضية الأصلية للمصمم"
                        >
                          استعادة الأصلي
                        </Button>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <Label className="text-[11px]">تبديل اتجاه القالب (صور ↔ نص)</Label>
                        <Switch checked={coverSwapSides} onCheckedChange={setCoverSwapSides} />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <Label className="text-[11px]">توسيط النص والعنوان</Label>
                        <Switch checked={coverTextCentered} onCheckedChange={setCoverTextCentered} />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/20">
                        <Label className="text-[11px]">عرض صور التركيب بدل التصميم</Label>
                        <Switch
                          checked={coverUseInstalledImages}
                          onCheckedChange={(v) => {
                            setCoverUseInstalledImages(v);
                            if (v) setCoverMixImages(false);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <Label className="text-[11px]">خلط صور التصميم والتركيب</Label>
                        <Switch
                          checked={coverMixImages}
                          onCheckedChange={(v) => {
                            setCoverMixImages(v);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <Label className="text-[11px]">جلب الوجه الخلفي للتصميم (إن وجد)</Label>
                        <Switch
                          checked={coverIncludeBackFace}
                          onCheckedChange={(v) => {
                            setCoverIncludeBackFace(v);
                          }}
                        />
                      </div>
                      {(coverTemplate === 'template4' || coverTemplate === 'template5' || coverTemplate === 'template1') && (
                        <div className="space-y-2 pt-2">
                          {coverTemplate === 'template1' ? (
                            <>
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px]">قوة تشتت الشرائح (الإزاحة)</Label>
                                <span className="text-[10px] text-muted-foreground font-mono">{Math.round(coverT4.cardHeight)}%</span>
                              </div>
                              <Slider min={0} max={100} step={1} value={[coverT4.cardHeight]} onValueChange={([v]) => setCoverT4(p => ({ ...p, cardHeight: v }))} />
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px]">ضبابية الزجاج فوق الصور</Label>
                                <span className="text-[10px] text-muted-foreground font-mono">{coverT4.fgBlur.toFixed(1)}px</span>
                              </div>
                              <Slider min={0} max={8} step={0.1} value={[coverT4.fgBlur]} onValueChange={([v]) => setCoverT4(p => ({ ...p, fgBlur: v }))} />
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px]">ضبابية تموج الضوء الخلفي</Label>
                                <span className="text-[10px] text-muted-foreground font-mono">{coverT4.bgBlur}px</span>
                              </div>
                              <Slider min={5} max={60} step={1} value={[coverT4.bgBlur]} onValueChange={([v]) => setCoverT4(p => ({ ...p, bgBlur: v }))} />
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px]">ارتفاع بطاقة الكريستال</Label>
                                <span className="text-[10px] text-muted-foreground font-mono">{coverT4.cardHeight.toFixed(2)}x</span>
                              </div>
                              <Slider min={0.7} max={2} step={0.05} value={[coverT4.cardHeight]} onValueChange={([v]) => setCoverT4(p => ({ ...p, cardHeight: v }))} />
                              
                              {coverTemplate === 'template4' && (
                                <>
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[11px]">ضبابية صورة البطاقة</Label>
                                    <span className="text-[10px] text-muted-foreground font-mono">{coverT4.fgBlur.toFixed(1)}px</span>
                                  </div>
                                  <Slider min={0} max={10} step={0.1} value={[coverT4.fgBlur]} onValueChange={([v]) => setCoverT4(p => ({ ...p, fgBlur: v }))} />

                                  <div className="flex items-center justify-between mt-3">
                                    <Label className="text-[11px]">مستوى تكبير الكروت (الزوم)</Label>
                                    <span className="text-[10px] text-muted-foreground font-mono">{(coverT4.zoom ?? 1.5).toFixed(1)}x</span>
                                  </div>
                                  <Slider min={1.0} max={3.0} step={0.1} value={[coverT4.zoom ?? 1.5]} onValueChange={([v]) => setCoverT4(p => ({ ...p, zoom: v }))} />
                                </>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px]">{coverTemplate === 'template5' ? 'ضبابية خلفية النافذة البوابة' : 'ضبابية خلفية البطاقة'}</Label>
                                <span className="text-[10px] text-muted-foreground font-mono">{coverT4.bgBlur}px</span>
                              </div>
                              <Slider min={0} max={60} step={1} value={[coverT4.bgBlur]} onValueChange={([v]) => setCoverT4(p => ({ ...p, bgBlur: v }))} />

                              {coverTemplate === 'template5' && (
                                <div className="space-y-3 pt-2 border-t border-border/20">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-primary">نمط البوابة الذهبية</Label>
                                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                                      {([
                                        { id: 'style1', label: 'البطاقات العائمة' },
                                        { id: 'style2', label: 'ألواح مموّجة' },
                                        { id: 'style3', label: 'معرض لا نهائي' },
                                        { id: 'style4', label: 'لوحات ثلاثية الأبعاد' },
                                        { id: 'style5', label: 'بوابة فقط (بدون كروت)' },
                                        { id: 'style6', label: 'كروت متناثرة (النمط القديم)' },
                                      ] as const).map((s) => (
                                        <Button
                                          key={s.id}
                                          type="button"
                                          variant={coverT5Style === s.id ? 'default' : 'outline'}
                                          size="sm"
                                          className="h-7 text-[10px] px-1.5 rounded-md font-bold"
                                          onClick={() => setCoverT5Style(s.id)}
                                        >
                                          {s.label}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between pt-1">
                                    <Label className="text-[11px] font-medium text-foreground">تطبيق مود الألوان الذهبي السينمائي</Label>
                                    <Switch checked={coverT5ColorMode} onCheckedChange={setCoverT5ColorMode} />
                                  </div>
                                  <div className="flex items-center justify-between pt-1">
                                    <Label className="text-[11px] font-medium text-foreground">تعبئة الصورة بالكامل (أقصى ارتفاع)</Label>
                                    <Switch checked={coverT5FillBackground} onCheckedChange={setCoverT5FillBackground} />
                                  </div>
                                  <div className="flex items-center justify-between pt-1">
                                    <Label className="text-[11px] font-medium text-foreground">خلفية ملونة سادة (بدون صور)</Label>
                                    <Switch checked={coverT5BgColorOnly} onCheckedChange={setCoverT5BgColorOnly} />
                                  </div>
                                  {!coverT5BgColorOnly && !coverT5FillBackground && (
                                    <div className="flex items-center justify-between pt-1">
                                      <Label className="text-[11px] font-medium text-foreground">تفتيت صورة الخلفية</Label>
                                      <Switch checked={coverT5BgShatter} onCheckedChange={setCoverT5BgShatter} />
                                    </div>
                                  )}
                                  {!coverT5BgColorOnly && (
                                    <div className="space-y-1 pt-1">
                                      <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
                                        <span>عدد شرائح الزجاج بالخلفية</span>
                                        <span className="text-[10px] text-primary">{coverT5SlatCount}</span>
                                      </div>
                                      <Slider min={2} max={12} step={1} value={[coverT5SlatCount]} onValueChange={([v]) => setCoverT5SlatCount(v)} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Accent color */}
                    <div className="space-y-2 pb-3 border-b border-border/40">
                      <div className="text-[11px] font-bold text-primary">لون الإبراز (Accent)</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={coverAccentColor}
                          onChange={(e) => setCoverAccentColor(e.target.value)}
                          className="h-8 w-12 rounded-md border border-border/60 bg-transparent cursor-pointer"
                        />
                        <Input
                          value={coverAccentColor}
                          onChange={(e) => setCoverAccentColor(e.target.value)}
                          className="h-8 text-[11px] font-mono rounded-lg flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['#d6ac40','#c0c0c0','#b87333','#3b9fd9','#8b5cf6','#c1272d'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCoverAccentColor(c)}
                            className="h-6 w-6 rounded-full border-2 border-border/40 hover:scale-110 transition-transform"
                            style={{ background: c, boxShadow: coverAccentColor === c ? `0 0 0 2px ${c}, 0 0 0 4px hsl(var(--background))` : 'none' }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Secondary color (controls kicker / badge / footer-right by default) */}
                    <div className="space-y-2 pb-3 border-b border-border/40">
                      <div className="text-[11px] font-bold text-primary">اللون الثاني (السطر العلوي والشارة والفوتر)</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={coverSecondaryColor}
                          onChange={(e) => setCoverSecondaryColor(e.target.value)}
                          className="h-8 w-12 rounded-md border border-border/60 bg-transparent cursor-pointer"
                        />
                        <Input
                          value={coverSecondaryColor}
                          onChange={(e) => setCoverSecondaryColor(e.target.value)}
                          className="h-8 text-[11px] font-mono rounded-lg flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['#ffffff','#f5e6c8','#d6ac40','#3b9fd9','#8b5cf6','#1a1408'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCoverSecondaryColor(c)}
                            className="h-6 w-6 rounded-full border-2 border-border/40 hover:scale-110 transition-transform"
                            style={{ background: c, boxShadow: coverSecondaryColor === c ? `0 0 0 2px ${c}, 0 0 0 4px hsl(var(--background))` : 'none' }}
                            title={c}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">يُستخدم تلقائياً للسطر العلوي والشارة والفوتر عند إيقاف "لون واحد للجميع".</div>
                    </div>
                    {/* Glow color behind main text — all templates */}
                    <div className="space-y-2 pb-3 border-b border-border/40">
                      <div className="text-[11px] font-bold text-primary">لون التوهج خلف النص</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={coverGlowColor}
                          onChange={(e) => setCoverGlowColor(e.target.value)}
                          className="h-8 w-12 rounded-md border border-border/60 bg-transparent cursor-pointer"
                        />
                        <Input
                          value={coverGlowColor}
                          onChange={(e) => setCoverGlowColor(e.target.value)}
                          className="h-8 text-[11px] font-mono rounded-lg flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['#000000','#1a1408','#0c2340','#2d1b4e','#5c2018','#d6ac40'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCoverGlowColor(c)}
                            className="h-6 w-6 rounded-full border-2 border-border/40 hover:scale-110 transition-transform"
                            style={{ background: c, boxShadow: coverGlowColor === c ? `0 0 0 2px ${c}, 0 0 0 4px hsl(var(--background))` : 'none' }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Glow / blur intensity sliders */}
                    <div className="space-y-2 pb-3 border-b border-border/40">
                      <div className="text-[11px] font-bold text-primary">شدة التوهج والضبابية خلف النص</div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px]">شدة التوهج (Opacity)</Label>
                        <span className="text-[10px] text-muted-foreground font-mono">{coverGlowIntensity.opacity.toFixed(2)}x</span>
                      </div>
                      <Slider min={0} max={1.5} step={0.05} value={[coverGlowIntensity.opacity]} onValueChange={([v]) => setCoverGlowIntensity(p => ({ ...p, opacity: v }))} />
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px]">شدة الضبابية (Blur)</Label>
                        <span className="text-[10px] text-muted-foreground font-mono">{coverGlowIntensity.blur}px</span>
                      </div>
                      <Slider min={0} max={200} step={2} value={[coverGlowIntensity.blur]} onValueChange={([v]) => setCoverGlowIntensity(p => ({ ...p, blur: v }))} />
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px]">انتشار التوهج (Spread)</Label>
                        <span className="text-[10px] text-muted-foreground font-mono">{coverGlowIntensity.spread}%</span>
                      </div>
                      <Slider min={30} max={120} step={1} value={[coverGlowIntensity.spread]} onValueChange={([v]) => setCoverGlowIntensity(p => ({ ...p, spread: v }))} />
                    </div>

                    {/* Theme mode: manual vs auto-from-design */}
                    <div className="space-y-2 pb-3 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-primary">ثيم الألوان</div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant={coverThemeMode === 'manual' ? 'default' : 'outline'} className="h-7 text-[10px] px-2" onClick={() => setCoverThemeMode('manual')}>يدوي</Button>
                          <Button size="sm" variant={coverThemeMode === 'auto' ? 'default' : 'outline'} className="h-7 text-[10px] px-2" onClick={() => { setCoverThemeMode('auto'); if (!applyExtractedCoverTheme(coverPalette)) setCoverPaletteRefreshKey((v) => v + 1); }}>تلقائي من التصميم</Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {coverPalette.length === 0 && (
                          <div className="text-[10px] text-muted-foreground">اختر تصميماً لاستخراج اللوحة اللونية</div>
                        )}
                        {coverPalette.map((c, i) => (
                          <button
                            key={`${c}-${i}`}
                            type="button"
                            onClick={() => { setCoverThemeMode('manual'); setCoverAccentColor(c); }}
                            className="h-7 w-7 rounded-md border-2 border-border/40 hover:scale-110 transition-transform"
                            style={{ background: c }}
                            title={`${c} — انقر لتعيين كلون إبراز`}
                          />
                        ))}
                        {coverPalette.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] px-2"
                            onClick={() => { lastPaletteUrlRef.current = ''; setCoverThemeMode('auto'); setCoverPaletteRefreshKey((v) => v + 1); }}
                          >
                            إعادة الاستخراج
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Per-element colors */}
                    <div className="space-y-2 pb-3 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-primary">ألوان العناصر</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={coverElementColors.useAccentForAll}
                            onCheckedChange={(v) => setCoverElementColors((p) => ({ ...p, useAccentForAll: v }))}
                          />
                          <Label className="text-[10px] text-muted-foreground">لون واحد للجميع</Label>
                        </div>
                      </div>
                      {!coverElementColors.useAccentForAll && (
                        <div className="space-y-2">
                          {([
                            ['kicker', 'السطر العلوي'],
                            ['campaignName', 'اسم الحملة'],
                            ['tagline', 'سطر الفارس (الحبّة)'],
                            ['badge', 'الشارة'],
                            ['footerRight', 'الفوتر يمين'],
                            ['brandName', 'اسم الشركة'],
                          ] as const).map(([key, label]) => (
                            <div key={key} className="flex items-center gap-2">
                              <Label className="text-[10px] flex-1 truncate">{label}</Label>
                              <input
                                type="color"
                                value={coverElementColors[key] || coverAccentColor}
                                onChange={(e) => setCoverElementColors((p) => ({ ...p, [key]: e.target.value }))}
                                className="h-7 w-10 rounded-md border border-border/60 bg-transparent cursor-pointer"
                              />
                              <Input
                                value={coverElementColors[key]}
                                placeholder="افتراضي (Accent)"
                                onChange={(e) => setCoverElementColors((p) => ({ ...p, [key]: e.target.value }))}
                                className="h-7 text-[10px] font-mono rounded-md w-20"
                              />
                              {coverPalette.length > 0 && (
                                <div className="flex items-center gap-0.5">
                                  {coverPalette.slice(0, 4).map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => setCoverElementColors((p) => ({ ...p, [key]: c }))}
                                      className="h-4 w-4 rounded-full border border-border/40 hover:scale-110 transition-transform"
                                      style={{ background: c }}
                                      title={c}
                                    />
                                  ))}
                                </div>
                              )}
                              {coverElementColors[key] && (
                                <button type="button" onClick={() => setCoverElementColors((p) => ({ ...p, [key]: '' }))} className="text-[10px] text-muted-foreground hover:text-foreground">×</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-primary">النصوص</div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">السطر العلوي الصغير</Label>
                        <Input value={coverKicker} onChange={(e) => setCoverKicker(e.target.value)} className="h-8 text-xs rounded-lg" placeholder="حملتك الإعلانية" />
                        <div className="flex items-center gap-2">
                          <Slider min={12} max={80} step={1} value={[coverFontSizes.kicker]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, kicker: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.kicker}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">اسم الحملة الإعلانية</Label>
                        <Input value={coverCampaignName} onChange={(e) => setCoverCampaignName(e.target.value)} className="h-8 text-xs font-bold rounded-lg" placeholder="يُعبّأ تلقائياً من نوع الإعلان" />
                        <div className="flex items-center gap-2">
                          <Slider min={40} max={220} step={2} value={[coverFontSizes.campaignName]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, campaignName: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.campaignName}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">سطر الفارس (الذهبي)</Label>
                        <Input value={coverTagline} onChange={(e) => setCoverTagline(e.target.value)} className="h-8 text-xs rounded-lg" placeholder="إعلانك بارز مع الفارس" />
                        <div className="flex items-center gap-2">
                          <Slider min={14} max={80} step={1} value={[coverFontSizes.tagline]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, tagline: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.tagline}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">شارة العرض (Pill)</Label>
                        <Input value={coverBadge} onChange={(e) => setCoverBadge(e.target.value)} className="h-8 text-xs rounded-lg" placeholder="معاينة لوحات التركيب" />
                        <div className="flex items-center gap-2">
                          <Slider min={12} max={48} step={1} value={[coverFontSizes.badge]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, badge: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.badge}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">حقوق الملكية (يسار سفلي)</Label>
                        <Input value={coverCopyright} onChange={(e) => setCoverCopyright(e.target.value)} className="h-8 text-[10px] rounded-lg" />
                        <div className="flex items-center gap-2">
                          <Slider min={8} max={36} step={1} value={[coverFontSizes.copyright]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, copyright: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.copyright}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">نص يمين سفلي</Label>
                        <Input value={coverFooterRight} onChange={(e) => setCoverFooterRight(e.target.value)} className="h-8 text-xs rounded-lg" placeholder="Built on experience" />
                        <div className="flex items-center gap-2">
                          <Slider min={10} max={48} step={1} value={[coverFontSizes.footerRight]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, footerRight: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.footerRight}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">ارتفاع شعار الشركة (أعلى يمين)</Label>
                        <div className="flex items-center gap-2">
                          <Slider min={24} max={220} step={2} value={[coverFontSizes.companyBrandLogo]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, companyBrandLogo: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.companyBrandLogo}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">حجم اسم الشركة (عند غياب الشعار)</Label>
                        <div className="flex items-center gap-2">
                          <Slider min={12} max={96} step={1} value={[coverFontSizes.companyBrandName]} onValueChange={([v]) => setCoverFontSizes(p => ({ ...p, companyBrandName: v }))} className="flex-1" />
                          <span className="font-mono text-[10px] w-10 text-left">{coverFontSizes.companyBrandName}px</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-[10px] rounded-lg mt-1"
                        onClick={() => setCoverFontSizes({ kicker: 32, campaignName: 128, tagline: 30, badge: 22, copyright: 14, footerRight: 22, companyBrandLogo: 64, companyBrandName: 30 })}
                      >
                        إعادة تعيين الأحجام
                      </Button>
                    </div>

                    <div className="space-y-2 border-t border-border/40 pt-3">
                      <div className="text-[11px] font-bold text-primary">إظهار / إخفاء العناصر</div>
                      {([
                        { key: 'clientInfo', label: 'بيانات العميل والموقع (أعلى يسار)' },
                        { key: 'companyLogo', label: 'شعار الشركة (وسط أعلى)' },
                        { key: 'companyName', label: 'اسم الشركة (وسط أعلى)' },
                        { key: 'kicker', label: 'السطر العلوي الصغير' },
                        { key: 'tagline', label: 'سطر "إعلانك بارز مع الفارس"' },
                        { key: 'badge', label: 'شارة العرض الوسطى' },
                        { key: 'collage', label: 'كولاج صور التركيب' },
                        { key: 'copyright', label: 'حقوق الملكية السفلية' },
                        { key: 'footerRight', label: 'نص "Built on experience"' },
                      ] as const).map(opt => (
                        <div key={opt.key} className="flex items-center justify-between gap-2 py-1">
                          <Label className="text-[11px] flex-1 cursor-pointer" htmlFor={`cs-${opt.key}`}>{opt.label}</Label>
                          <Switch
                            id={`cs-${opt.key}`}
                            checked={(coverShow as any)[opt.key]}
                            onCheckedChange={(v) => setCoverShow(p => ({ ...p, [opt.key]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <Select value={selectedLayerId} onValueChange={(v) => { setSelectedLayerId(v); setSelectedLayerIds([v]); }}>
                      <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image" className="text-xs">📸 الصورة الرئيسية</SelectItem>
                        <SelectItem value="panel" className="text-xs">📋 شريط المعلومات</SelectItem>
                        <SelectItem value="canvas_bg" className="text-xs">🎨 خلفية القالب</SelectItem>
                        <SelectItem value="location" className="text-xs">📍 شريط الموقع</SelectItem>
                        {textElements.map(el => (
                          <SelectItem key={el.id} value={el.id} className="text-xs">
                            {el.type === 'image' ? '🖼️' : el.type === 'icon' ? '⭐' : '✍️'} {el.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Multi-selection controls */}
                    {selectedLayerIds.filter(sid => sid !== 'image' && sid !== 'panel').length >= 2 && (
                      <div className="border border-primary/30 rounded-xl p-3 bg-primary/5 space-y-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-primary">
                          <Layers className="h-4 w-4" />
                          تحديد متعدد: {selectedLayerIds.filter(sid => sid !== 'image' && sid !== 'panel').length} عناصر
                        </div>
                        {/* Alignment Buttons */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">محاذاة أفقية</Label>
                          <div className="grid grid-cols-3 gap-1">
                            <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 flex-col py-1 rounded-lg" onClick={() => alignSelectedElements('left')}>
                              <AlignStartVertical className="h-3.5 w-3.5" />
                              يسار
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 flex-col py-1 rounded-lg" onClick={() => alignSelectedElements('center')}>
                              <AlignCenterVertical className="h-3.5 w-3.5" />
                              وسط
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 flex-col py-1 rounded-lg" onClick={() => alignSelectedElements('right')}>
                              <AlignEndVertical className="h-3.5 w-3.5" />
                              يمين
                            </Button>
                          </div>
                          <Label className="text-[10px] text-muted-foreground">محاذاة عمودية</Label>
                          <div className="grid grid-cols-3 gap-1">
                            <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 flex-col py-1 rounded-lg" onClick={() => alignSelectedElements('top')}>
                              <AlignStartHorizontal className="h-3.5 w-3.5" />
                              أعلى
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 flex-col py-1 rounded-lg" onClick={() => alignSelectedElements('middle')}>
                              <AlignCenterHorizontal className="h-3.5 w-3.5" />
                              منتصف
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 flex-col py-1 rounded-lg" onClick={() => alignSelectedElements('bottom')}>
                              <AlignEndHorizontal className="h-3.5 w-3.5" />
                              أسفل
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-[10px] gap-1 rounded-lg"
                            onClick={() => { setSelectedLayerIds(['image']); setSelectedLayerId('image'); }}
                          >
                            <X className="h-3 w-3" />
                            إلغاء التحديد
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-[10px] gap-1 rounded-lg"
                            onClick={() => {
                              const ids = selectedLayerIds.filter(sid => sid !== 'image' && sid !== 'panel');
                              setTextElements(prev => prev.filter(el => !ids.includes(el.id)));
                              setSelectedLayerIds(['image']);
                              setSelectedLayerId('image');
                              toast.success(`تم حذف ${ids.length} عناصر`);
                            }}
                          >
                            <Trash className="h-3 w-3" />
                            حذف الكل
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Single Element controls render */}
                    {(() => {
                      const el = textElements.find(item => item.id === selectedLayerId);
                      if (selectedLayerId === 'image') {
                        return (
                          <div className="space-y-3 border-t pt-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">عرض الصورة</Label>
                                <Input type="number" value={imageStyle.width} onChange={(e) => setImageStyleUser(p => ({ ...p, width: parseInt(e.target.value) || 100 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">ارتفاع الصورة</Label>
                                <Input type="number" value={imageStyle.height} onChange={(e) => setImageStyleUser(p => ({ ...p, height: parseInt(e.target.value) || 100 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[10px]">عرض الصورة (منزلق)</Label><span className="font-mono text-[9px]">{imageStyle.width}px</span></div>
                              <Slider min={10} max={2000} step={5} value={[imageStyle.width]} onValueChange={([v]) => setImageStyleUser(p => ({ ...p, width: v }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[10px]">ارتفاع الصورة (منزلق)</Label><span className="font-mono text-[9px]">{imageStyle.height}px</span></div>
                              <Slider min={10} max={2000} step={5} value={[imageStyle.height]} onValueChange={([v]) => setImageStyleUser(p => ({ ...p, height: v }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">المحور X</Label>
                                <Input type="number" value={imageStyle.x} onChange={(e) => setImageStyleUser(p => ({ ...p, x: parseInt(e.target.value) || 0 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">المحور Y</Label>
                                <Input type="number" value={imageStyle.y} onChange={(e) => setImageStyleUser(p => ({ ...p, y: parseInt(e.target.value) || 0 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">انحناء حواف الصورة</Label><span className="font-mono text-[10px]">{imageStyle.borderRadius}px</span></div>
                              <Slider min={0} max={100} step={1} value={[imageStyle.borderRadius]} onValueChange={([v]) => setImageStyleUser(p => ({ ...p, borderRadius: v }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">سمك إطار الصورة</Label><span className="font-mono text-[10px]">{imageStyle.borderWidth}px</span></div>
                              <Slider min={0} max={30} step={1} value={[imageStyle.borderWidth]} onValueChange={([v]) => setImageStyleUser(p => ({ ...p, borderWidth: v }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">لون إطار الصورة</Label>
                              <div className="flex gap-1">
                                <Input type="color" value={imageStyle.borderColor} onChange={(e) => setImageStyleUser(p => ({ ...p, borderColor: e.target.value }))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                <Input value={imageStyle.borderColor} onChange={(e) => setImageStyleUser(p => ({ ...p, borderColor: e.target.value }))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px]">تأثير الظل الخلفي</Label>
                              <Switch checked={imageStyle.shadow} onCheckedChange={(c) => setImageStyleUser(p => ({ ...p, shadow: c }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">ملء الصورة (Object Fit)</Label>
                              <Select value={imageStyle.objectFit || 'cover'} onValueChange={(v) => setImageStyleUser(p => ({ ...p, objectFit: v }))}>
                                <SelectTrigger className="h-8 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cover" className="text-xs">تغطية كاملة (Cover)</SelectItem>
                                  <SelectItem value="contain" className="text-xs">احتواء كامل (Contain)</SelectItem>
                                  <SelectItem value="fill" className="text-xs">تمطيط بالملء (Fill)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-1 h-8 text-xs font-bold rounded-lg border-primary/30"
                              onClick={() => setTransformActive(!transformActive)}
                            >
                              <Maximize2 className="h-3.5 w-3.5 text-primary" />
                              {transformActive ? 'إلغاء مقابض تحويل Photoshop' : 'تفعيل مقابض تحويل Photoshop'}
                            </Button>
                          </div>
                        );
                      }

                      if (selectedLayerId === 'panel') {
                        return (
                          <div className="space-y-3 border-t pt-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">عرض الشريط</Label>
                                <Input type="number" value={glassPanel.width} onChange={(e) => setGlassPanel(p => ({ ...p, width: parseInt(e.target.value) || 100 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">ارتفاع الشريط</Label>
                                <Input type="number" value={glassPanel.height} onChange={(e) => setGlassPanel(p => ({ ...p, height: parseInt(e.target.value) || 100 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[10px]">ارتفاع الشريط (منزلق)</Label><span className="font-mono text-[9px]">{glassPanel.height}px</span></div>
                              <Slider min={80} max={600} step={2} value={[glassPanel.height]} onValueChange={([v]) => {
                                const ratio = v / glassPanel.height;
                                setGlassPanel(p => ({ ...p, height: v }));
                                setTextElements(prev => prev.map(ei => {
                                  if (ei.parentStrip === 'panel') {
                                    const up = { ...ei, y: Math.round(ei.y * ratio) };
                                    if (ei.type === 'image' && ei.width && ei.height) {
                                      up.width = Math.round(ei.width * ratio);
                                      up.height = Math.round(ei.height * ratio);
                                    } else if (ei.fontSize) {
                                      up.fontSize = Math.round(ei.fontSize * ratio);
                                    }
                                    return up;
                                  }
                                  return ei;
                                }));
                              }} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">الموضع X</Label>
                                <Input type="number" value={glassPanel.x} onChange={(e) => setGlassPanel(p => ({ ...p, x: parseInt(e.target.value) || 0 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">الموضع Y</Label>
                                <Input type="number" value={glassPanel.y} onChange={(e) => setGlassPanel(p => ({ ...p, y: parseInt(e.target.value) || 0 }))} className="h-8 text-xs rounded-lg" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">شفافية الخلفية</Label><span className="font-mono text-[10px]">{Math.round((glassPanel.opacity ?? 0.92) * 100)}%</span></div>
                              <Slider min={0} max={1} step={0.05} value={[glassPanel.opacity ?? 0.92]} onValueChange={([v]) => setGlassPanel(p => ({ ...p, opacity: v }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">قوة التمويه (Blur)</Label><span className="font-mono text-[10px]">{glassPanel.blur ?? 15}px</span></div>
                              <Slider min={0} max={40} step={1} value={[glassPanel.blur ?? 15]} onValueChange={([v]) => setGlassPanel(p => ({ ...p, blur: v }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">انحناء زوايا الشريط</Label><span className="font-mono text-[10px]">{glassPanel.borderRadius}px</span></div>
                              <Slider min={0} max={100} step={1} value={[glassPanel.borderRadius]} onValueChange={([v]) => setGlassPanel(p => ({ ...p, borderRadius: v }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">لون الخلفية</Label>
                                <div className="flex gap-1">
                                  <Input type="color" value={glassPanel.backgroundColor} onChange={(e) => setGlassPanel(p => ({ ...p, backgroundColor: e.target.value }))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                  <Input value={glassPanel.backgroundColor} onChange={(e) => setGlassPanel(p => ({ ...p, backgroundColor: e.target.value }))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">لون الحدود</Label>
                                <div className="flex gap-1">
                                  <Input type="color" value={glassPanel.borderColor} onChange={(e) => setGlassPanel(p => ({ ...p, borderColor: e.target.value }))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                  <Input value={glassPanel.borderColor} onChange={(e) => setGlassPanel(p => ({ ...p, borderColor: e.target.value }))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">سمك إطار الشريط</Label><span className="font-mono text-[10px]">{glassPanel.borderWidth}px</span></div>
                              <Slider min={0} max={15} step={1} value={[glassPanel.borderWidth]} onValueChange={([v]) => setGlassPanel(p => ({ ...p, borderWidth: v }))} />
                            </div>
                          </div>
                        );
                      }

                      if (selectedLayerId === 'location') {
                        return (
                          <div className="space-y-3 border-t pt-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px]">إظهار شريط الموقع</Label>
                              <Switch checked={locationStrip.visible} onCheckedChange={(c) => setLocationStrip(p => ({ ...p, visible: c }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">الارتفاع</Label><span className="font-mono text-[10px]">{locationStrip.height}px</span></div>
                              <Slider min={40} max={250} step={1} value={[locationStrip.height]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, height: v }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">لون الخلفية</Label>
                                <div className="flex gap-1">
                                  <Input type="color" value={locationStrip.backgroundColor} onChange={(e) => setLocationStrip(p => ({ ...p, backgroundColor: e.target.value }))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                  <Input value={locationStrip.backgroundColor} onChange={(e) => setLocationStrip(p => ({ ...p, backgroundColor: e.target.value }))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">لون النص</Label>
                                <div className="flex gap-1">
                                  <Input type="color" value={locationStrip.textColor} onChange={(e) => setLocationStrip(p => ({ ...p, textColor: e.target.value }))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                  <Input value={locationStrip.textColor} onChange={(e) => setLocationStrip(p => ({ ...p, textColor: e.target.value }))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">الشفافية</Label><span className="font-mono text-[10px]">{Math.round((locationStrip.opacity ?? 0.9) * 100)}%</span></div>
                              <Slider min={0} max={1} step={0.05} value={[locationStrip.opacity ?? 0.9]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, opacity: v }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">تمويه زجاجي (Blur)</Label><span className="font-mono text-[10px]">{locationStrip.blur ?? 10}px</span></div>
                              <Slider min={0} max={50} step={1} value={[locationStrip.blur ?? 10]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, blur: v }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">انحناء الحواف</Label><span className="font-mono text-[10px]">{locationStrip.borderRadius ?? 0}px</span></div>
                              <Slider min={0} max={100} step={1} value={[locationStrip.borderRadius ?? 0]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, borderRadius: v }))} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between"><Label className="text-[11px]">سمك الحدود</Label><span className="font-mono text-[10px]">{locationStrip.borderWidth ?? 0}px</span></div>
                              <Slider min={0} max={20} step={1} value={[locationStrip.borderWidth ?? 0]} onValueChange={([v]) => setLocationStrip(p => ({ ...p, borderWidth: v }))} />
                            </div>
                          </div>
                        );
                      }

                      if (selectedLayerId === 'canvas_bg') {
                        return (
                          <div className="space-y-3 border-t pt-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">نوع الخلفية</Label>
                              <Select value={bgType} onValueChange={(v) => setBgType(v as 'replica_blur' | 'solid' | 'gradient' | 'image')}>
                                <SelectTrigger className="h-8 text-[11px] rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="replica_blur" className="text-xs">صورة مموهة (زجاجية)</SelectItem>
                                  <SelectItem value="solid" className="text-xs">لون مصمت</SelectItem>
                                  <SelectItem value="gradient" className="text-xs">تدرج لوني</SelectItem>
                                  <SelectItem value="image" className="text-xs">صورة مخصصة</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {bgType === 'replica_blur' && (
                              <div className="space-y-1">
                                <div className="flex justify-between"><Label className="text-[11px]">تمويه</Label><span className="font-mono text-[10px]">{blurAmount}px</span></div>
                                <Slider min={0} max={80} step={1} value={[blurAmount]} onValueChange={([v]) => setBlurAmount(v)} />
                              </div>
                            )}
                            {(bgType === 'solid' || bgType === 'gradient') && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px]">اللون</Label>
                                  <div className="flex gap-1">
                                    <Input type="color" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                    <Input value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                                  </div>
                                </div>
                                {bgType === 'gradient' && (
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">لون 2</Label>
                                    <div className="flex gap-1">
                                      <Input type="color" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                      <Input value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            {bgType === 'image' && (
                              <div className="space-y-1">
                                <Label className="text-[11px]">رابط الصورة</Label>
                                <Input placeholder="https://..." value={bgImageUrl} onChange={(e) => setBgImageUrl(e.target.value)} className="h-8 text-[10px] rounded-lg" />
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (!el) return null;

                      return (
                        <div className="space-y-3 border-t pt-3">
                          {/* Visibility Toggle */}
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px]">إظهار العنصر</Label>
                            <Switch checked={el.visible} onCheckedChange={(c) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, visible: c } : ei))} />
                          </div>

                          {/* Coordinates */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">الموضع X</Label>
                              <Input type="number" value={el.x} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, x: parseInt(e.target.value) || 0 } : ei))} className="h-8 text-xs rounded-lg" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">الموضع Y</Label>
                              <Input type="number" value={el.y} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, y: parseInt(e.target.value) || 0 } : ei))} className="h-8 text-xs rounded-lg" />
                            </div>
                          </div>

                          {/* Custom Text input */}
                          {el.type === 'text' && (
                            <div className="space-y-1">
                              <Label className="text-[10px]">محتوى النص</Label>
                              <Input value={el.customText ?? getElementText(el)} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, customText: e.target.value } : ei))} className="h-8 text-xs rounded-lg font-semibold" />
                            </div>
                          )}

                          {/* Custom Image input (URL) */}
                          {el.type === 'image' && (
                            <div className="space-y-1">
                              <Label className="text-[10px]">رابط الصورة</Label>
                              <Input value={el.url || ''} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, url: e.target.value } : ei))} className="h-8 text-[10px] rounded-lg" />
                            </div>
                          )}

                          {/* Text properties */}
                          {el.type === 'text' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px]">حجم الخط</Label>
                                  <Input type="number" value={el.fontSize} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, fontSize: parseInt(e.target.value) || 12 } : ei))} className="h-8 text-xs rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">نوع الخط (Family)</Label>
                                  <Select value={el.fontFamily || "'Cairo', sans-serif"} onValueChange={(v) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, fontFamily: v } : ei))}>
                                    <SelectTrigger className="h-8 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="'Cairo', sans-serif">Cairo (عربي متميز)</SelectItem>
                                      <SelectItem value="'Tajawal', sans-serif">Tajawal (عربي عصري)</SelectItem>
                                      <SelectItem value="'Almarai', sans-serif">Almarai (عربي دائري)</SelectItem>
                                      <SelectItem value="'Amiri', serif">Amiri (عربي كلاسيكي)</SelectItem>
                                      <SelectItem value="'Montserrat', sans-serif">Montserrat (أرقام غربية)</SelectItem>
                                      <SelectItem value="'Outfit', sans-serif">Outfit (أرقام حديثة)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between"><Label className="text-[10px]">حجم الخط (منزلق)</Label><span className="font-mono text-[9px]">{el.fontSize}px</span></div>
                                <Slider min={8} max={250} step={1} value={[el.fontSize]} onValueChange={([v]) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, fontSize: v } : ei))} />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px]">وزن الخط</Label>
                                  <Select value={el.fontWeight} onValueChange={(v) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, fontWeight: v } : ei))}>
                                    <SelectTrigger className="h-8 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="300">Light</SelectItem>
                                      <SelectItem value="400">Regular</SelectItem>
                                      <SelectItem value="600">SemiBold</SelectItem>
                                      <SelectItem value="700">Bold</SelectItem>
                                      <SelectItem value="900">Black</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">المحاذاة</Label>
                                  <Select value={el.alignment || 'center'} onValueChange={(v) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, alignment: v as any } : ei))}>
                                    <SelectTrigger className="h-8 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">يسار</SelectItem>
                                      <SelectItem value="center">وسط</SelectItem>
                                      <SelectItem value="right">يمين</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">لون الخط</Label>
                                <div className="flex gap-1">
                                  <Input type="color" value={el.fontColor} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, fontColor: e.target.value } : ei))} className="w-8 h-8 p-0 border cursor-pointer rounded-md shrink-0" />
                                  <Input value={el.fontColor} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, fontColor: e.target.value } : ei))} className="h-8 text-[10px] font-mono rounded-lg w-full" />
                                </div>
                              </div>
                              {/* Composite parts controls: municipality + region */}
                              {(el.id === 'municipality_region' || el.textKey === 'municipality_region') && (
                                <div className="border-t pt-2 space-y-2">
                                  <Label className="text-[10px] font-bold block">إعدادات الجزأين (البلدية + المنطقة)</Label>
                                  <div className="space-y-1">
                                    <Label className="text-[9px]">الفاصل بين الجزأين</Label>
                                    <Input value={el.parts?.separator ?? ' - '} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, parts: { ...(ei.parts || {}), separator: e.target.value } } : ei))} className="h-8 text-xs rounded-lg" />
                                  </div>
                                  {(['municipality', 'region'] as const).map((partKey) => {
                                    const labelMap = { municipality: 'البلدية', region: 'المنطقة' } as const;
                                    const p = (el.parts as any)?.[partKey] || {};
                                    const updPart = (patch: any) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, parts: { ...(ei.parts || {}), [partKey]: { ...((ei.parts as any)?.[partKey] || {}), ...patch } } } : ei));
                                    return (
                                      <div key={partKey} className="rounded-lg border border-border/40 p-2 space-y-2 bg-muted/30">
                                        <div className="text-[10px] font-bold text-primary">{labelMap[partKey]}</div>
                                        <div className="space-y-1">
                                          <div className="flex justify-between"><Label className="text-[9px]">حجم الخط</Label><span className="font-mono text-[9px]">{p.fontSize ?? el.fontSize}px</span></div>
                                          <Slider min={8} max={200} step={1} value={[p.fontSize ?? el.fontSize]} onValueChange={([v]) => updPart({ fontSize: v })} />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[9px]">وزن الخط</Label>
                                          <Select value={String(p.fontWeight ?? el.fontWeight)} onValueChange={(v) => updPart({ fontWeight: v })}>
                                            <SelectTrigger className="h-7 text-[10px] rounded-md"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="300">Light</SelectItem>
                                              <SelectItem value="400">Regular</SelectItem>
                                              <SelectItem value="600">SemiBold</SelectItem>
                                              <SelectItem value="700">Bold</SelectItem>
                                              <SelectItem value="900">Black</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[9px]">لون الخط (اختياري)</Label>
                                          <div className="flex gap-1">
                                            <Input type="color" value={p.fontColor || el.fontColor} onChange={(e) => updPart({ fontColor: e.target.value })} className="w-7 h-7 p-0 border cursor-pointer rounded-md shrink-0" />
                                            <Input value={p.fontColor || ''} placeholder="افتراضي" onChange={(e) => updPart({ fontColor: e.target.value })} className="h-7 text-[10px] font-mono rounded-lg w-full" />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Text Companion Icon Option */}
                              <div className="border-t pt-2 space-y-1.5">
                                <Label className="text-[10px] font-bold block">أيقونة مرافقة للنص</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[9px]">شكل الأيقونة</Label>
                                    <Select value={el.icon || 'none'} onValueChange={(v) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, icon: v } : ei))}>
                                      <SelectTrigger className="h-7 text-[10px] rounded-md"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">بدون أيقونة</SelectItem>
                                        {Object.keys(iconMap).map(name => (<SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between"><Label className="text-[9px]">حجم الأيقونة</Label><span className="font-mono text-[9px]">{el.iconSize || el.fontSize || 18}px</span></div>
                                    <Slider min={8} max={250} step={1} value={[el.iconSize || el.fontSize || 18]} onValueChange={([v]) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconSize: v } : ei))} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[9px]">لون الأيقونة</Label>
                                    <Input type="color" value={el.iconColor || el.fontColor || '#ffffff'} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconColor: e.target.value } : ei))} className="w-full h-7 p-0 border cursor-pointer rounded-md" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px]">لون خلفية الأيقونة</Label>
                                    <Input type="color" value={el.iconBgColor || '#c9a84c'} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconBgColor: e.target.value } : ei))} className="w-full h-7 p-0 border cursor-pointer rounded-md" />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-[9px]">خلفية دائرية للأيقونة</Label>
                                  <Switch checked={el.iconBackground || false} onCheckedChange={(c) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconBackground: c } : ei))} />
                                </div>
                              </div>
                            </>
                          )}

                          {/* Image properties */}
                          {el.type === 'image' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px]">عرض الصورة</Label>
                                  <Input type="number" value={el.width || 100} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, width: parseInt(e.target.value) || 50 } : ei))} className="h-8 text-xs rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">ارتفاع الصورة</Label>
                                  <Input type="number" value={el.height || 100} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, height: parseInt(e.target.value) || 50 } : ei))} className="h-8 text-xs rounded-lg" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between"><Label className="text-[10px]">عرض الصورة (منزلق)</Label><span className="font-mono text-[9px]">{el.width || 100}px</span></div>
                                <Slider min={10} max={1200} step={5} value={[el.width || 100]} onValueChange={([v]) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, width: v } : ei))} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between"><Label className="text-[10px]">ارتفاع الصورة (منزلق)</Label><span className="font-mono text-[9px]">{el.height || 100}px</span></div>
                                <Slider min={10} max={1200} step={5} value={[el.height || 100]} onValueChange={([v]) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, height: v } : ei))} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between"><Label className="text-[11px]">انحناء الحواف</Label><span className="font-mono text-[10px]">{el.borderRadius || 0}px</span></div>
                                <Slider min={0} max={100} step={1} value={[el.borderRadius || 0]} onValueChange={([v]) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, borderRadius: v } : ei))} />
                              </div>
                            </>
                          )}



                        {/* If Element is Icon */}
                        {el.type === 'icon' && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-[11px]">شكل الأيقونة</Label>
                              <Select value={el.iconName || 'phone'} onValueChange={(v) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconName: v } : ei))}>
                                <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.keys(iconMap).map(name => (
                                    <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <div className="flex justify-between"><Label className="text-[10px]">حجم الأيقونة</Label><span className="font-mono text-[9px]">{el.iconSize || 32}px</span></div>
                                <Slider min={8} max={250} step={1} value={[el.iconSize || 32]} onValueChange={([v]) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconSize: v } : ei))} />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px]">خلفية دائرية</Label>
                                <Switch checked={el.iconBackground || false} onCheckedChange={(c) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconBackground: c } : ei))} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">لون الأيقونة</Label>
                                <div className="flex gap-1">
                                  <Input type="color" value={el.iconColor || '#ffffff'} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconColor: e.target.value } : ei))} className="w-8 h-8 p-0 border cursor-pointer shrink-0" />
                                  <Input value={el.iconColor || '#ffffff'} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconColor: e.target.value } : ei))} className="h-8 text-[10px] font-mono w-full" />
                                </div>
                              </div>
                              {el.iconBackground && (
                                <div className="space-y-1">
                                  <Label className="text-[10px]">لون الخلفية</Label>
                                  <div className="flex gap-1">
                                    <Input type="color" value={el.iconBgColor || '#c9a84c'} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconBgColor: e.target.value } : ei))} className="w-8 h-8 p-0 border cursor-pointer shrink-0" />
                                    <Input value={el.iconBgColor || '#c9a84c'} onChange={(e) => setTextElements(prev => prev.map(ei => ei.id === el.id ? { ...ei, iconBgColor: e.target.value } : ei))} className="h-8 text-[10px] font-mono w-full" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                    {/* Delete Button for custom elements */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-2 gap-1.5 h-8 text-xs font-bold"
                      onClick={() => {
                        setTextElements(prev => prev.filter(ei => ei.id !== selectedLayerId));
                        setSelectedLayerId('image');
                        toast.success('تم حذف العنصر');
                      }}
                    >
                      <Trash className="h-3.5 w-3.5" />
                      حذف هذا العنصر
                    </Button>
                  </div>
                );
              })()}
                </>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          {/* ════════ TAB 4: TEMPLATES ════════ */}
          <TabsContent value="templates" className="space-y-3 outline-none">
            <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                  إدارة القوالب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                {/* Load Template */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">تحميل قالب محفوظ</Label>
                  <Select value={selectedTemplateId} onValueChange={handleLoadTemplate}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="اختر قالب للتحميل..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Update Current Template (if selected) */}
                {selectedTemplateId && (
                  <Button
                    onClick={handleUpdateTemplate}
                    disabled={savingTemplate}
                    className="w-full h-9 gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md transition-all"
                  >
                    <Save className="h-4 w-4" />
                    تحديث القالب الحالي
                  </Button>
                )}

                <div className="border-t border-border/30 pt-3 space-y-3">
                  {/* Save New Template */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">حفظ كقالب جديد</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="اسم القالب الجديد..."
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="h-9 text-xs rounded-xl flex-1"
                      />
                      <Button
                        onClick={handleSaveTemplate}
                        disabled={savingTemplate}
                        size="sm"
                        className="h-9 gap-1 text-xs rounded-xl font-bold bg-primary hover:bg-primary/95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        حفظ جديد
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

        {/* ═══════════════ RIGHT: CANVAS (Sticky so it follows scrolling down the side panel) ═══════════════ */}
        <div className="flex-1 flex flex-col gap-3 xl:sticky xl:top-4 self-start">

          {/* ── Toolbar ── */}
          <Card className="border-border/40 shadow-lg bg-card/90 backdrop-blur-sm">
            <CardContent className="py-2.5 px-4 flex flex-wrap items-center justify-between gap-3">

              {/* Size */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Select onValueChange={handlePresetSize}>
                  <SelectTrigger className="h-8 w-28 text-[11px] bg-muted/40">
                    <SelectValue placeholder="قوالب المقاس..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">عمودي (1500×2000)</SelectItem>
                    <SelectItem value="landscape">أفقي (2000×1500)</SelectItem>
                    <SelectItem value="fhd">شاشة FHD (1920×1080)</SelectItem>
                    <SelectItem value="square">مربع (1500×1500)</SelectItem>
                    <SelectItem value="story">ستوري (1080×1920)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(parseInt(e.target.value) || 1500)} className="h-8 w-14 text-center text-[11px]" />
                  <span className="text-muted-foreground">×</span>
                  <Input type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(parseInt(e.target.value) || 2000)} className="h-8 w-14 text-center text-[11px]" />
                </div>
              </div>

              {/* If cover mode, show Template options */}
              {layoutMode === 'cover' && (
                <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 rounded-2xl p-1 shrink-0 flex-wrap">
                  {([
                    { id: 'template1', label: '1' },
                    { id: 'template2', label: '2' },
                    { id: 'template3', label: '3' },
                    { id: 'template4', label: '4' },
                    { id: 'template5', label: '5' },
                  ] as const).map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      variant={coverTemplate === t.id ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs font-bold rounded-lg"
                      onClick={() => handleSelectTemplate(t.id as any)}
                      title={`قالب ${t.label}`}
                    >
                      {t.label}
                    </Button>
                  ))}
                  <div className="w-px h-5 bg-border/60 mx-0.5" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] rounded-full gap-1 whitespace-nowrap"
                    onClick={() => setCoverShuffleSeed(Date.now())}
                    title="خلط التصميم عشوائياً"
                  >
                    <Shuffle className="h-3 w-3" />
                    خلط
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] rounded-full gap-1 whitespace-nowrap"
                    onClick={() => {
                      const current = coverT4.zoom ?? 1.5;
                      let next = 1.5;
                      if (current === 1.5) next = 2.0;
                      else if (current === 2.0) next = 2.5;
                      else if (current === 2.5) next = 3.0;
                      else if (current === 3.0) next = 1.0;
                      else next = 1.5;
                      setCoverT4(p => ({ ...p, zoom: next }));
                    }}
                    title="التحكم بمستوى تكبير الكروت (الزوم)"
                  >
                    <ZoomIn className="h-3 w-3" />
                    زوم: {(coverT4.zoom ?? 1.5).toFixed(1)}x
                  </Button>
                  <div className="w-px h-5 bg-border/60 mx-0.5" />
                  <Button
                    type="button"
                    variant={coverUseInstalledImages && !coverMixImages ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-[11px] rounded-full gap-1 whitespace-nowrap"
                    onClick={() => {
                      setCoverUseInstalledImages(prev => !prev);
                      setCoverMixImages(false);
                    }}
                    title="جلب صور التركيب بدل صور التصميم"
                  >
                    صور التركيب
                  </Button>
                  <Button
                    type="button"
                    variant={coverMixImages ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-[11px] rounded-full gap-1 whitespace-nowrap"
                    onClick={() => {
                      setCoverMixImages(prev => !prev);
                    }}
                    title="خلط صور التصميم وصور التركيب معاً"
                  >
                    خلط الصور
                  </Button>
                  <div className="w-px h-5 bg-border/60 mx-0.5" />
                  <Button
                    type="button"
                    variant={coverSwapSides ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-[11px] rounded-full gap-1 whitespace-nowrap"
                    onClick={() => setCoverSwapSides(v => !v)}
                    title="عكس الاتجاه (يمين ↔ يسار)"
                  >
                    عكس
                  </Button>
                  <Button
                    type="button"
                    variant={coverTextCentered ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-[11px] rounded-full gap-1 whitespace-nowrap"
                    onClick={() => setCoverTextCentered(v => !v)}
                    title="توسيط النص"
                  >
                    توسيط
                  </Button>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLockMode(!lockMode)}
                  className={`h-8 px-2.5 gap-1.5 text-xs ${lockMode ? 'bg-amber-500/20 border-amber-500/50 text-amber-600' : ''}`}
                >
                  {lockMode ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {lockMode ? 'إلغاء قفل العناصر' : 'قفل العناصر'}
                </Button>

                <div className="flex items-center border rounded-md p-0.5 bg-muted/40">
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(2, z + 0.05))} className="h-7 w-7" title="تكبير">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] font-mono w-8 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.1, z - 0.05))} className="h-7 w-7" title="تصغير">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                <Button variant="outline" size="sm" onClick={() => setZoom(0.38)} className="h-8 px-2 text-xs">ملاءمة</Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Canvas Viewport ── */}
          <div className="flex-1 overflow-auto bg-muted/20 border border-border/40 rounded-2xl flex items-center justify-center p-6 min-h-[500px] relative">
            <div
              style={{
                width: `${canvasWidth * zoom}px`,
                height: `${canvasHeight * zoom}px`,
                transition: 'width 0.15s ease-out, height 0.15s ease-out',
                position: 'relative'
              }}
            >
              <div
                id="capture-canvas"
                className="relative shadow-2xl transition-all duration-300 bg-background"
                style={{
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                }}
              >
              {layoutMode === 'cover' ? (
                (() => {

// ============= TEMPLATE 1 — DEEP RIBBED GLASS WAVE =============
                    if (coverTemplate === 'template1') {
                      const accent = coverAccentColor;
                      const glow = coverGlowColor;
                      const gI = coverGlowIntensity;
                      const swap = coverSwapSides;
                      const textAlign: 'left' | 'right' | 'center' = coverTextCentered ? 'center' : (swap ? 'left' : 'right');
                      const imagesSide: 'left' | 'right' = swap ? 'right' : 'left';
                      const photos = pickPhotos(5);

                      // SVG wave path geometries (curves from side to side)
                      const w = canvasWidth;
                      const h = canvasHeight;
                      const pathD = swap
                        ? `M ${w * 1.15} ${h * 0.25} C ${w * 0.7} ${h * 0.85} ${w * 0.3} ${h * 0.15} ${-w * 0.15} ${h * 0.75}`
                        : `M ${-w * 0.15} ${h * 0.25} C ${w * 0.3} ${h * 0.85} ${w * 0.7} ${h * 0.15} ${w * 1.15} ${h * 0.75}`;

                      // Fallback glow color if user sets black (default) to ensure vibrant colors
                      const waveGlowColor = (!glow || glow === '#000000' || glow === 'black' || glow === '#000') ? accent : glow;

                      // Sliced columns layout parameters (V-arch structure)
                      const sliceCols = [0, 1, 2, 3, 4].map((i) => {
                        const waveVal = Math.sin((i / 4) * Math.PI); // 0 -> 1 -> 0
                        const scaleFactor = (coverT4.cardHeight ?? 45) / 50; // slider mapped to 0..2
                        const baseHeight = 78 + waveVal * 16;
                        const baseTop = 4 + (1 - waveVal) * 12;
                        
                        const staggerHeight = (baseHeight - 86) * scaleFactor;
                        const staggerTop = (baseTop - 10) * scaleFactor;
                        
                        const finalHeight = 86 + staggerHeight + rand(-1.5, 1.5) * scaleFactor;
                        const finalTop = 10 + staggerTop + rand(-1, 1) * scaleFactor;
                        
                        // Capped rotation Y (2deg to 4deg)
                        const baseRot = (2 - i) * 1.5;
                        const rotY = (swap ? -1 : 1) * baseRot * Math.min(1.2, Math.max(0.6, scaleFactor));
                        
                        return { height: finalHeight, top: finalTop, rotY };
                      });

                      // 16 glass ribs for full-screen cylindrical cover
                      const glassRibs = Array.from({ length: 16 }).map((_, idx) => {
                        const left = idx * 6.25;
                        const isOverImage = imagesSide === 'left' ? (idx < 8) : (idx >= 8);
                        const blur = isOverImage ? coverT4.fgBlur : (coverT4.fgBlur * 2.5 + 4);
                        const tint = 0.04 + Math.sin((idx / 15) * Math.PI) * 0.1;
                        return { left, blur, tint };
                      });

                      return (
                        <div className="w-full h-full relative flex flex-col select-none text-white overflow-hidden" 
                          style={{ 
                            ['--cover-accent' as any]: accent, 
                            background: `radial-gradient(ellipse 95% 85% at ${swap ? '20%' : '80%'} 50%, ${accent}22 0%, transparent 60%), 
                                         radial-gradient(ellipse 75% 65% at ${swap ? '80%' : '20%'} 50%, ${waveGlowColor}1a 0%, transparent 70%), 
                                         linear-gradient(180deg, #02040a 0%, #050e24 50%, #010205 100%)`, 
                            padding: '64px' 
                          }}
                        >
                          {/* Background Glow Wave SVG - Layered soft blurs */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
                            <defs>
                              <linearGradient id="wave-gradient-t1" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={accent} stopOpacity="0.1" />
                                <stop offset="25%" stopColor={accent} stopOpacity="0.8" />
                                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                                <stop offset="75%" stopColor={waveGlowColor} stopOpacity="0.8" />
                                <stop offset="100%" stopColor={waveGlowColor} stopOpacity="0.1" />
                              </linearGradient>
                              <filter id="blur-heavy-t1" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur} />
                              </filter>
                              <filter id="blur-medium-t1" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.5} />
                              </filter>
                              <filter id="blur-light-t1" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.15} />
                              </filter>
                            </defs>
                            {/* Layer 1: Wide ambient glow */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="url(#wave-gradient-t1)"
                              strokeWidth={h * 0.28}
                              strokeLinecap="round"
                              filter="url(#blur-heavy-t1)"
                              opacity="0.35"
                            />
                            {/* Layer 2: Core glow */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="url(#wave-gradient-t1)"
                              strokeWidth={h * 0.14}
                              strokeLinecap="round"
                              filter="url(#blur-medium-t1)"
                              opacity="0.65"
                            />
                            {/* Layer 3: Intense white center reflection */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={h * 0.03}
                              strokeLinecap="round"
                              filter="url(#blur-light-t1)"
                              opacity="0.85"
                            />
                          </svg>

                          {/* Extra ambient glow behind text block */}
                          <div className="absolute pointer-events-none z-[2]" 
                            style={{ 
                              [swap ? 'right' : 'left']: '45%', 
                              [swap ? 'left' : 'right']: '5%', 
                              top: '20%', 
                              height: '60%', 
                              background: `radial-gradient(ellipse ${gI.spread}% ${gI.spread * 0.9}% at 50% 50%, ${waveGlowColor}${alphaToHex(0.4 * gI.opacity)} 0%, transparent 85%)`, 
                              filter: `blur(${gI.blur}px)` 
                            } as React.CSSProperties} 
                          />

                          <Header accent={accent} brandRight={swap} align={textAlign} imagesSide={imagesSide} />
                          <TextBlock accent={accent} align={textAlign} imagesSide={imagesSide} />

                          {/* Image Slices Collage */}
                          {coverShow.collage && (
                            <div className="absolute top-0 bottom-0 z-[5] pointer-events-none" 
                              style={{ 
                                [imagesSide]: 0, 
                                width: '42%', 
                                display: 'flex', 
                                gap: '1.5%', 
                                perspective: '1800px' 
                              } as React.CSSProperties}
                            >
                              {(() => {
                                const crops = getTemplateCrops(photos, 5);
                                return [0, 1, 2, 3, 4].map((i) => {
                                  const photo = photos[i] || { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&auto=format&fit=crop' };
                                  const imgUrl = photo.url;
                                  const crop = crops[i];

                                const scaleFactor = (coverT4.cardHeight ?? 45) / 50;

                                // Seeded random parameters calculated dynamically per seed
                                const randomYOffset = rand(-40, 40) * scaleFactor;
                                const randomImgY = rand(-15, 15);
                                const randomImgScale = rand(1.0, 1.45); // Random Zoom-In / Zoom-Out!

                                // Add shuffle randomness to the crop focus point
                                const randomCropX = Math.min(95, Math.max(5, crop.x + rand(-12, 12)));
                                const randomCropY = Math.min(95, Math.max(5, crop.y + rand(-15, 15)));

                                return (
                                  <div
                                    key={`t1-slice-${i}`}
                                    className="relative transition-all duration-300"
                                    style={{
                                      width: '18.8%',
                                      height: '100%',
                                      top: '0%',
                                      transform: 'none',
                                      transformOrigin: 'center center',
                                      borderRadius: 0,
                                      overflow: 'hidden',
                                      background: 'rgba(255, 255, 255, 0.03)',
                                      borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
                                      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                                      boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.05), 0 0 45px rgba(0, 0, 0, 0.55)',
                                    }}
                                  >
                                    <img 
                                      src={imgUrl} 
                                      crossOrigin="anonymous" 
                                      alt="" 
                                      className="absolute w-full h-full" 
                                      style={{
                                        top: 0,
                                        left: 0,
                                        objectFit: 'cover',
                                        objectPosition: `${randomCropX}% ${randomCropY}%`,
                                        transform: `translateY(${randomImgY}%) scale(${randomImgScale})`,
                                        filter: 'saturate(1.08) contrast(1.04) brightness(1.02)',
                                      }}
                                    />
                                    {/* Glass sheen overlay */}
                                    <div className="absolute inset-0 pointer-events-none" 
                                      style={{ 
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 45%, rgba(255,255,255,0.04) 70%, transparent 100%)', 
                                        mixBlendMode: 'overlay' 
                                      }} 
                                    />
                                  </div>
                                );
                              })
                            })()}
                          </div>
                          )}

                          {/* Full-screen Deep Ribbed Glass Overlay (16 Ribs) */}
                          <div className="absolute inset-0 z-[10] pointer-events-none">
                            {glassRibs.map((g, idx) => (
                              <div
                                key={`t1-rib-${idx}`}
                                className="absolute top-0 bottom-0"
                                style={{
                                  left: `${g.left}%`,
                                  width: '6.25%',
                                  backdropFilter: `blur(${g.blur}px) saturate(140%)`,
                                  WebkitBackdropFilter: `blur(${g.blur}px) saturate(140%)`,
                                  background: `linear-gradient(90deg, 
                                    rgba(255,255,255,${0.03 + g.tint * 0.25}) 0%, 
                                    rgba(255,255,255,0.005) 30%, 
                                    rgba(0,0,0,0.01) 70%, 
                                    rgba(0,0,0,${0.08 + g.tint * 0.45}) 100%)`,
                                  borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
                                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                                  boxShadow: 'inset 0 0 15px rgba(255,255,255,0.04), 0 0 25px rgba(255,255,255,0.05)',
                                }}
                              />
                            ))}
                          </div>

                          <Footer accent={accent} reverse={!swap} />
                        </div>
                      );
                    }

                    // ============= TEMPLATE 2 — GOLD CRYSTAL =============
                    if (coverTemplate === 'template2') {
                      const accent = coverAccentColor;
                      const glow = coverGlowColor;
                      const gI = coverGlowIntensity;
                      const photos = pickPhotos(4);
                      const swap = coverSwapSides;
                      const imagesSide: 'left' | 'right' = swap ? 'right' : 'left';
                      const textAlign: 'left' | 'right' | 'center' = coverTextCentered ? 'center' : (swap ? 'left' : 'right');

                      const w = canvasWidth;
                      const h = canvasHeight;
                      const waveGlowColor = (!glow || glow === '#000000' || glow === 'black' || glow === '#000') ? accent : glow;

                      // Generate a randomized cubic bezier wave path that is unique on shuffle/refresh!
                      const randomCurveSeed = rand(0.1, 0.9);
                      const pathD = swap
                        ? `M ${w * 1.15} ${h * 0.2} C ${w * (0.8 - randomCurveSeed * 0.1)} ${h * (0.85 - randomCurveSeed * 0.2)} ${w * (0.4 + randomCurveSeed * 0.1)} ${h * (0.1 + randomCurveSeed * 0.15)} ${-w * 0.15} ${h * 0.7}`
                        : `M ${-w * 0.15} ${h * 0.2} C ${w * (0.2 + randomCurveSeed * 0.1)} ${h * (0.85 - randomCurveSeed * 0.2)} ${w * (0.6 - randomCurveSeed * 0.1)} ${h * (0.1 + randomCurveSeed * 0.15)} ${w * 1.15} ${h * 0.7}`;

                      // Generate stable random floating glows for background
                      const bgGlows = Array.from({ length: 3 }).map((_, idx) => {
                        const left = `${15 + idx * 25 + rand(-8, 8)}%`;
                        const top = `${25 + rand(-10, 35)}%`;
                        const size = rand(180, 320);
                        const opacity = rand(0.06, 0.18);
                        return { left, top, size, opacity };
                      });

                      // Randomize per-card position, width, rotation and depth for a unique look
                      const layout = photos.map((_, i) => {
                        const base = i * 26; // base horizontal step (%)
                        return {
                          left: `${base + rand(-3, 6)}%`,
                          top: `${rand(-4, 4)}%`,
                          width: `${rand(24, 34)}%`,
                          rotY: (swap ? 1 : -1) * rand(4, 18),
                          tz: Math.round(rand(-30, 50)),
                        };
                      });
                      const crops = shuffle(getTemplateCrops(photos, 4));
                      const imgFx2 = photos.map((_, i) => {
                        const crop = crops[i];
                        return {
                          scale: rand(1.0, 1.35),
                          ox: Math.min(95, Math.max(5, crop.x + rand(-10, 10))),
                          oy: Math.min(95, Math.max(5, crop.y + rand(-12, 12))),
                        };
                      });
                      return (
                        <div className="w-full h-full relative flex flex-col select-none text-white overflow-hidden" 
                          style={{ 
                            ['--cover-accent' as any]: accent, 
                            background: `radial-gradient(ellipse 95% 85% at ${swap ? '20%' : '80%'} 50%, ${accent}22 0%, transparent 60%), 
                                         radial-gradient(ellipse 75% 65% at ${swap ? '80%' : '20%'} 50%, ${waveGlowColor}1f 0%, transparent 70%), 
                                         linear-gradient(180deg, #030305 0%, #0c0d12 50%, #020203 100%)`, 
                            padding: '64px' 
                          }}
                        >
                          {/* Background Glow Wave SVG - Layered soft blurs matching theme colors (with randomized curve path) */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
                            <defs>
                              <linearGradient id="wave-gradient-t2" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={accent} stopOpacity="0.1" />
                                <stop offset="25%" stopColor={accent} stopOpacity="0.8" />
                                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                                <stop offset="75%" stopColor={waveGlowColor} stopOpacity="0.8" />
                                <stop offset="100%" stopColor={waveGlowColor} stopOpacity="0.1" />
                              </linearGradient>
                              <filter id="neon-blur-t2-heavy" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur} />
                              </filter>
                              <filter id="neon-blur-t2-medium" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.5} />
                              </filter>
                              <filter id="neon-blur-t2-light" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.15} />
                              </filter>
                            </defs>
                            {/* Layer 1: Wide ambient glow */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="url(#wave-gradient-t2)"
                              strokeWidth={h * 0.28}
                              strokeLinecap="round"
                              filter="url(#neon-blur-t2-heavy)"
                              opacity="0.35"
                            />
                            {/* Layer 2: Core glow */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="url(#wave-gradient-t2)"
                              strokeWidth={h * 0.14}
                              strokeLinecap="round"
                              filter="url(#neon-blur-t2-medium)"
                              opacity="0.65"
                            />
                            {/* Layer 3: Intense white center reflection */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={h * 0.03}
                              strokeLinecap="round"
                              filter="url(#neon-blur-t2-light)"
                              opacity="0.85"
                            />
                          </svg>

                          {/* Floating random ambient crystal glows */}
                          {bgGlows.map((g, idx) => (
                            <div 
                              key={`t2-bg-glow-${idx}`}
                              className="absolute rounded-full pointer-events-none filter blur-[80px]"
                              style={{
                                left: g.left,
                                top: g.top,
                                width: g.size,
                                height: g.size,
                                background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
                                opacity: g.opacity,
                                zIndex: 1
                              }}
                            />
                          ))}

                          {/* Ambient shadow gradient to guide text contrast */}
                          <div className="absolute top-0 bottom-0 pointer-events-none z-[2]" 
                            style={{ 
                              [swap ? 'right' : 'left']: 0, 
                              width: '55%', 
                              background: `radial-gradient(ellipse 70% 80% at ${swap ? '80%' : '20%'} 50%, rgba(3,3,5,0.7) 0%, transparent 80%)` 
                            } as React.CSSProperties} 
                          />
                          <div className="absolute pointer-events-none z-[7]" style={{ [swap ? 'right' : 'left']: '40%', [swap ? 'left' : 'right']: '6%', top: '18%', height: '64%', background: `radial-gradient(ellipse ${gI.spread}% ${gI.spread * 0.93}% at 50% 50%, ${glow}${alphaToHex(0.4 * gI.opacity)} 0%, ${glow}${alphaToHex(0.2 * gI.opacity)} 50%, transparent 85%)`, filter: `blur(${gI.blur}px)` } as React.CSSProperties} />
                          <div className="absolute pointer-events-none z-[8]" style={{ [swap ? 'right' : 'left']: '40%', [swap ? 'left' : 'right']: '6%', top: '22%', height: '56%', background: `radial-gradient(ellipse ${gI.spread * 0.93}% ${gI.spread * 0.86}% at 50% 50%, ${glow}${alphaToHex(1 * gI.opacity)} 0%, ${glow}${alphaToHex(0.9 * gI.opacity)} 30%, ${glow}${alphaToHex(0.6 * gI.opacity)} 55%, ${glow}${alphaToHex(0.25 * gI.opacity)} 75%, transparent 92%)`, filter: `blur(${Math.max(8, gI.blur * 0.67)}px)` } as React.CSSProperties} />
                          <Header accent={accent} brandRight={swap} align={textAlign} imagesSide={imagesSide} />
                          <TextBlock accent={accent} align={textAlign} imagesSide={imagesSide} />
                          {coverShow.collage && (
                            <div className="absolute top-0 bottom-0 z-10 pointer-events-none overflow-hidden" style={{ [imagesSide]: 0, width: '40%', perspective: '2000px' } as React.CSSProperties}>
                              <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
                                {photos.map((item, idx) => {
                                  const L = layout[idx] || layout[0];
                                  const fx = imgFx2[idx] || imgFx2[0];
                                  return (
                                    <div key={`t2-${idx}-${item.id || ''}`} className="absolute" style={{ left: L.left, top: L.top, width: L.width, height: '104%', transform: `rotateY(${L.rotY}deg) translateZ(${L.tz}px)`, transformOrigin: swap ? 'right center' : 'left center' }}>
                                      <div className="relative w-full h-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.14) 100%)', borderRadius: '16px', padding: '8px', border: '1.5px solid rgba(255,255,255,0.45)', boxShadow: `inset 0 2px 24px rgba(255,255,255,0.28), 0 40px 70px -20px rgba(0,0,0,0.65), 0 0 50px ${accent}30` }}>
                                        <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: '10px', background: '#0b0b0b' }}>
                                          <img src={item.url} crossOrigin="anonymous" alt="Design" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: `${fx.ox}% ${fx.oy}%`, transform: `scale(${fx.scale})`, filter: 'saturate(1.08) contrast(1.04)' }} />
                                          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(118deg, transparent 38%, rgba(255,255,255,0.25) 50%, transparent 62%)', mixBlendMode: 'screen' }} />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <WavyGlass accent={accent} opacity={0.5} />
                            </div>
                          )}
                          <Footer accent={accent} reverse={!swap} />
                        </div>
                      );
                    }

                    // ============= TEMPLATE 4 — SCATTERED POLAROID CARDS =============
                    if (coverTemplate === 'template4') {
                      const accent = coverAccentColor;
                      const gI = coverGlowIntensity;
                      const glow = coverGlowColor;
                      const swap = coverSwapSides;
                      // Two vertical side strips of tall polaroid cards (like reference image)
                      // 3 cards on the right strip, 3 on the left strip = 6 total
                      const photos = pickPhotos(6);
                      const crops = shuffle(getTemplateCrops(photos, 6));
                       const buildStrip = (side: 'right' | 'left') => {
                         // Distribute 3 cards vertically with strong jitter
                         return [0, 1, 2].map((i) => {
                           const baseTop = i * 33 + rand(-9, 9); // strong vertical jitter
                           const baseSide = rand(-4, 10); // edge offset incl. slight overhang
                           // mix of strong tilts (both directions) for chaotic scatter
                           const dir = rng() < 0.5 ? -1 : 1;
                           const rotBase = dir * rand(8, 32);
                           return {
                             side,
                             top: `${baseTop}%`,
                             offset: `${baseSide}%`,
                             width: Math.round(rand(360, 560)),
                             rot: rotBase,
                             rotY: (rng() < 0.5 ? -1 : 1) * rand(2, 10),
                             tz: Math.round(rand(-60, 120)),
                            zoom: rand(1.1, 1.8) * (coverT4.zoom ?? 1.3),
                            posX: rand(0, 100),
                            posY: rand(0, 100),
                           };
                         });
                       };
                      const rightStrip = buildStrip(swap ? 'left' : 'right');
                      const leftStrip = buildStrip(swap ? 'right' : 'left');
                      const allCards = [...rightStrip, ...leftStrip];

                      // SVG wave path geometries (curves from side to side)
                      const w = canvasWidth;
                      const h = canvasHeight;
                      const pathD = swap
                        ? `M ${w * 1.15} ${h * 0.25} C ${w * 0.7} ${h * 0.85} ${w * 0.3} ${h * 0.15} ${-w * 0.15} ${h * 0.75}`
                        : `M ${-w * 0.15} ${h * 0.25} C ${w * 0.3} ${h * 0.85} ${w * 0.7} ${h * 0.15} ${w * 1.15} ${h * 0.75}`;

                      const waveGlowColor = (!glow || glow === '#000000' || glow === 'black' || glow === '#000') ? accent : glow;

                      // 16 glass ribs for full-screen cylindrical cover
                      const imagesSide: 'left' | 'right' = swap ? 'right' : 'left';
                      const glassRibs = Array.from({ length: 16 }).map((_, idx) => {
                        const left = idx * 6.25;
                        const isOverImage = imagesSide === 'left' ? (idx < 8) : (idx >= 8);
                        const blur = isOverImage ? coverT4.fgBlur : (coverT4.fgBlur * 2.5 + 4);
                        const tint = 0.04 + Math.sin((idx / 15) * Math.PI) * 0.1;
                        return { left, blur, tint };
                      });

                      return (
                        <div className="w-full h-full relative flex flex-col select-none text-white overflow-hidden" 
                          style={{ 
                            ['--cover-accent' as any]: accent, 
                            background: `radial-gradient(ellipse 95% 85% at ${swap ? '20%' : '80%'} 50%, ${accent}22 0%, transparent 60%), 
                                         radial-gradient(ellipse 75% 65% at ${swap ? '80%' : '20%'} 50%, ${waveGlowColor}1a 0%, transparent 70%), 
                                         linear-gradient(180deg, #02040a 0%, #050e24 50%, #010205 100%)`, 
                            padding: '64px' 
                          }}
                        >
                          {/* Background Glow Wave SVG - Layered soft blurs */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
                            <defs>
                              <linearGradient id="wave-gradient-t4" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={accent} stopOpacity="0.1" />
                                <stop offset="25%" stopColor={accent} stopOpacity="0.8" />
                                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                                <stop offset="75%" stopColor={waveGlowColor} stopOpacity="0.8" />
                                <stop offset="100%" stopColor={waveGlowColor} stopOpacity="0.1" />
                              </linearGradient>
                              <filter id="blur-heavy-t4" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur} />
                              </filter>
                              <filter id="blur-medium-t4" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.5} />
                              </filter>
                              <filter id="blur-light-t4" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.15} />
                              </filter>
                            </defs>
                            {/* Layer 1: Wide ambient glow */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="url(#wave-gradient-t4)"
                              strokeWidth={h * 0.28}
                              strokeLinecap="round"
                              filter="url(#blur-heavy-t4)"
                              opacity="0.35"
                            />
                            {/* Layer 2: Core glow */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="url(#wave-gradient-t4)"
                              strokeWidth={h * 0.14}
                              strokeLinecap="round"
                              filter="url(#blur-medium-t4)"
                              opacity="0.65"
                            />
                            {/* Layer 3: Intense white center reflection */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={h * 0.03}
                              strokeLinecap="round"
                              filter="url(#blur-light-t4)"
                              opacity="0.85"
                            />
                          </svg>

                          {/* Side-strip polaroid cards — fill canvas height */}
                          {coverShow.collage && (
                            <div className="absolute inset-0 z-[2] pointer-events-none" style={{ perspective: '2200px' }}>
                              {allCards.map((s, idx) => {
                                const item = photos[idx] || photos[0];
                                if (!item) return null;
                                const positionStyle: React.CSSProperties = s.side === 'right'
                                  ? { right: s.offset, top: s.top }
                                  : { left: s.offset, top: s.top };
                                return (
                                  <div
                                    key={`t4-${idx}-${item.id || ''}`}
                                    data-polaroid="1"
                                    className="absolute"
                                    style={{
                                      ...positionStyle,
                                      width: s.width,
                                      maxWidth: '54%',
                                      transform: `rotate(${s.rot}deg) rotateY(${s.rotY}deg) translateZ(${s.tz}px)`,
                                      transformOrigin: 'center center',
                                      zIndex: Math.round(s.tz + 100),
                                    }}
                                  >
                                    <div className="relative w-full" style={{ background: '#fafafa', padding: '16px 16px 80px 16px', borderRadius: '4px', boxShadow: `0 40px 70px rgba(0,0,0,0.75), 0 12px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.08), 0 0 60px ${accent}40` }}>
                                      {/* Square inner — design at max width with frosted-glass fill */}
                                      <div className="relative w-full overflow-hidden" style={{ background: '#0b0b0b', aspectRatio: `1 / ${coverT4.cardHeight}` }}>
                                        {/* Crystal-glass base: full design as color base, no blur smear */}
                                        <BlurredImage 
                                          src={item.url} 
                                          blur={coverT4.bgBlur} 
                                          saturate={1.15} 
                                          brightness={0.85} 
                                          transform="scale(1.15)" 
                                          className="absolute inset-0 w-full h-full"
                                        />
                                        {/* Subtle radial vignette for depth without blur smear */}
                                        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.32) 100%)' }} />
                                        {/* Foreground design — fragmented zoom-in of a different region per crystal */}
                                        {(() => {
                                          const crop = crops[idx];
                                          const randomCropX = Math.min(95, Math.max(5, crop.x + rand(-10, 10)));
                                          const randomCropY = Math.min(95, Math.max(5, crop.y + rand(-10, 10)));
                                          return (
                                            <BlurredImage 
                                              src={item.url} 
                                              blur={coverT4.fgBlur} 
                                              saturate={1.05} 
                                              zoom={s.zoom}
                                              cropX={randomCropX}
                                              cropY={randomCropY}
                                              className="absolute inset-0 w-full h-full"
                                            />
                                          );
                                        })()}
                                        {/* Wavy crystal glass overlay — moved after the foreground design to blend glass refraction directly on top of the card design */}
                                        <div className="absolute inset-0 z-[5]">
                                          <WavyGlass accent={accent} opacity={0.75} density="ultra" blur={coverT4.fgBlur} />
                                        </div>
                                        {/* Crystal sheen overlay to break the surface */}
                                        <div
                                          className="absolute inset-0 pointer-events-none"
                                          style={{
                                            mixBlendMode: 'overlay',
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 35%, rgba(255,255,255,0.08) 60%, transparent 100%)',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Full-screen Deep Ribbed Glass Overlay (16 Ribs) */}
                          <div className="absolute inset-0 z-[10] pointer-events-none">
                            {glassRibs.map((g, idx) => (
                              <div
                                key={`t4-rib-${idx}`}
                                className="absolute top-0 bottom-0"
                                style={{
                                  left: `${g.left}%`,
                                  width: '6.25%',
                                  backdropFilter: `blur(${g.blur}px) saturate(140%)`,
                                  WebkitBackdropFilter: `blur(${g.blur}px) saturate(140%)`,
                                  background: `linear-gradient(90deg, 
                                    rgba(255,255,255,${0.03 + g.tint * 0.25}) 0%, 
                                    rgba(255,255,255,0.005) 30%, 
                                    rgba(0,0,0,0.01) 70%, 
                                    rgba(0,0,0,${0.08 + g.tint * 0.45}) 100%)`,
                                  borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
                                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                                  boxShadow: 'inset 0 0 15px rgba(255,255,255,0.04), 0 0 25px rgba(255,255,255,0.05)',
                                }}
                              />
                            ))}
                          </div>
                          {/* Edge darkening for overall contrast */}
                          <div className="absolute inset-0 z-[6] pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.6) 100%)' }} />
                          {/* Controllable glow behind main heading */}
                          <div
                            className="absolute pointer-events-none z-[8]"
                            style={{
                              left: '6%',
                              right: '6%',
                              top: '18%',
                              height: '64%',
                              background: `radial-gradient(ellipse ${gI.spread}% ${gI.spread * 0.9}% at 50% 50%, ${glow}${alphaToHex(0.95 * gI.opacity)} 0%, ${glow}${alphaToHex(0.8 * gI.opacity)} 30%, ${glow}${alphaToHex(0.5 * gI.opacity)} 55%, ${glow}${alphaToHex(0.2 * gI.opacity)} 78%, transparent 92%)`,
                              filter: `blur(${Math.max(8, gI.blur * 0.89)}px)`,
                            }}
                          />
                          <div className="absolute pointer-events-none z-[7]" style={{ left: '4%', right: '4%', top: '14%', height: '72%', background: `radial-gradient(ellipse ${gI.spread * 1.04}% ${gI.spread * 0.9}% at 50% 50%, ${glow}${alphaToHex(0.33 * gI.opacity)} 0%, ${glow}${alphaToHex(0.13 * gI.opacity)} 55%, transparent 88%)`, filter: `blur(${gI.blur * 1.22}px)` }} />
                          <Header accent={accent} align="center" />
                          <TextBlock accent={accent} align="center" />
                          <Footer accent={accent} />
                        </div>
                      );
                    }

                    // ============= TEMPLATE 5 — GOLDEN PORTAL =============
                    if (coverTemplate === 'template5') {
                      const accent = coverAccentColor;
                      const glow = coverGlowColor;
                      const gI = coverGlowIntensity;
                      const swap = coverSwapSides;
                      const imagesSide: 'left' | 'right' = swap ? 'left' : 'right';
                      const textAlign: 'left' | 'right' | 'center' = coverTextCentered ? 'center' : (swap ? 'right' : 'left');
                      const photos = pickPhotos(7);
                      
                      const cardsLayout = [
                        { left: '26%', top: '22%', width: '48%', height: '56%', rot: -3, zIndex: 10, zoom: 2.4, posX: 92, posY: 50, isTall: true },
                        { left: '5%', top: '5%', width: '44%', rot: -12, zIndex: 4, zoom: 2.0, posX: 33, posY: 45 },
                        { left: '52%', top: '2%', width: '45%', rot: 10, zIndex: 3, zoom: 1.8, posX: 50, posY: 45 },
                        { left: '-2%', top: '40%', width: '44%', rot: -8, zIndex: 5, zoom: 2.2, posX: 20, posY: 50 },
                        { left: '54%', top: '44%', width: '46%', rot: 15, zIndex: 2, zoom: 2.0, posX: 67, posY: 50 },
                        { left: '5%', top: '72%', width: '45%', rot: -14, zIndex: 6, zoom: 2.2, posX: 8, posY: 50 },
                        { left: '48%', top: '70%', width: '47%', rot: 12, zIndex: 7, zoom: 2.2, posX: 80, posY: 50 },
                      ];

                      // Pre-calculate stable cards properties so that both the collage and the reflection use identical values!
                      const stableCards = cardsLayout.map((s, idx) => {
                        // If fill background toggle is enabled, use only the first photo (primary design image) for all card slices.
                        // Otherwise, cycle through all photos in the pool.
                        const item = coverT5FillBackground ? photos[0] : photos[idx % photos.length];
                        const rotJitter = rand(-4, 4);
                        const posJitterX = rand(-3, 3);
                        const posJitterY = rand(-3, 3);
                        const rotYJitter = rand(-2, 2);
                        const tzJitter = rand(-10, 10);
                        
                        return {
                          ...s,
                          item,
                          rotJitter,
                          posJitterX,
                          posJitterY,
                          rotYJitter,
                          tzJitter,
                        };
                      });

                      const renderWindowSlats = (isReflection = false) => {
                        const bgCrops = getTemplateCrops(photos, coverT5SlatCount);
                        return (
                          <div className="absolute inset-0 flex pointer-events-none" style={{ opacity: isReflection ? 0.45 : 0.8 }}>
                            {/* Unified continuous blurred background of design images */}
                            <div className="absolute inset-0 flex z-0">
                              <div className="absolute inset-0 z-0 bg-black" />
                              <div 
                                className="absolute inset-0 z-10" 
                                style={{ 
                                  backgroundColor: accent, 
                                  opacity: 0.65, 
                                  mixBlendMode: 'color' as any 
                                }} 
                              />
                              <div 
                                className="absolute inset-0 z-20" 
                                style={{ 
                                  background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)`, 
                                  opacity: 0.7, 
                                  mixBlendMode: 'screen' as any 
                                }} 
                              />
                              
                              {coverT5BgColorOnly ? (
                                <div className="absolute inset-0 z-10" style={{ background: `radial-gradient(circle at 50% 50%, ${accent}dd 0%, #000 100%)` }} />
                              ) : (
                                !coverT5BgShatter || coverT5FillBackground ? (
                                  <div className="absolute inset-0 z-10 overflow-hidden">
                                     <BlurredImage 
                                       src={photos[0]?.url || ''} 
                                       blur={coverT4.bgBlur} 
                                       saturate={1.95} 
                                       brightness={0.78} 
                                       transform={`scale(1.2) ${isReflection ? 'scaleY(-1)' : ''}`} 
                                       className="w-full h-full"
                                     />
                                  </div>
                                ) : (
                                  Array.from({ length: coverT5SlatCount }).map((_, colIdx) => {
                                    const photo = photos[colIdx % photos.length];
                                    if (!photo) return null;
                                    return (
                                      <div key={`win-bg-photo-${colIdx}`} className="h-full flex-1 relative z-10">
                                         <BlurredImage 
                                           src={photo.url} 
                                           blur={coverT4.bgBlur} 
                                           saturate={1.95} 
                                           brightness={0.78} 
                                           zoom={1.6}
                                           cropX={bgCrops[colIdx]?.x ?? 50}
                                           cropY={50}
                                           transform={isReflection ? 'scaleY(-1)' : undefined} 
                                           className="w-full h-full"
                                         />
                                      </div>
                                    );
                                  })
                                )
                              )}
                            </div>
                            
                            {/* Transparent glass slat panels on top */}
                            <div className="absolute inset-0 flex z-10">
                              {coverT5BgColorOnly || coverT5FillBackground ? (
                                <div 
                                  key={`win-bg-slat-single${isReflection ? '-refl' : ''}`}
                                  className="h-full flex-1 relative"
                                  style={{
                                    boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)',
                                  }}
                                >
                                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)' }} />
                                </div>
                              ) : (
                                Array.from({ length: coverT5SlatCount }).map((_, colIdx) => (
                                  <div
                                    key={`win-bg-slat-${colIdx}${isReflection ? '-refl' : ''}`}
                                    className="h-full flex-1 relative"
                                    style={{
                                      borderRight: '1px solid rgba(255,255,255,0.08)',
                                      borderLeft: '1px solid rgba(0,0,0,0.2)',
                                      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.45)',
                                    }}
                                  >
                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 30%, rgba(0,0,0,0.15) 100%)' }} />
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Wavy Glass Columns applied inside the background slats */}
                            <div className="absolute inset-0 z-20">
                              <WavyGlass accent={accent} opacity={0.65} density="ultra" blur={coverT4.bgBlur} />
                            </div>
                          </div>
                        );
                      };

                      const renderCollageItems = (isReflection = false) => {
                        const imgFilter = coverT5ColorMode 
                          ? 'contrast(1.18) brightness(0.85) sepia(0.35) saturate(1.4) hue-rotate(-8deg)'
                          : 'saturate(1.1) contrast(1.05)';

                        const getCardPos = (origLeft: string, origTop: string, origWidth: string, origHeight: string) => {
                          const scale = coverT4.cardHeight ?? 1.0;
                          const hNum = parseFloat(origHeight);
                          const tNum = parseFloat(origTop);
                          const newH = hNum * scale;
                          const newT = tNum + (hNum / 2) * (1 - scale);
                          return {
                            left: origLeft,
                            top: `${newT}%`,
                            width: origWidth,
                            height: `${newH}%`
                          };
                        };

                        const cardStyle = (left: string, top: string, width: string, height: string, transform: string, zIndex: number) => {
                          return {
                            left,
                            top,
                            width,
                            height,
                            transform,
                            transformOrigin: 'center center',
                            zIndex,
                            borderRadius: '24px',
                            border: '2.5px solid rgba(255, 255, 255, 0.18)',
                            outline: `1.5px solid ${accent}aa`,
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                            backdropFilter: isReflection ? 'none' : 'blur(20px)',
                            WebkitBackdropFilter: isReflection ? 'none' : 'blur(20px)',
                            filter: isReflection ? 'blur(12px) brightness(0.6)' : 'none',
                            boxShadow: isReflection ? 'none' : `0 45px 95px rgba(0,0,0,0.9), inset 0 0 25px ${accent}45, inset 0 1px 2px rgba(255,255,255,0.55), 0 0 45px ${accent}25`,
                          };
                        };

                        // ----------------------------------------------------
                        // Style 5: Background Only (No Cards)
                        // ----------------------------------------------------
                        if (coverT5Style === 'style5') {
                          return null;
                        }

                        // ----------------------------------------------------
                        // Style 1: Floating Glass Cards
                        // ----------------------------------------------------
                        if (coverT5Style === 'style1') {
                          const crops = getTemplateCrops(photos, 3);
                          const mainUrl = photos[0]?.url || '';
                          const leftUrl = (photos[1 % photos.length] || photos[0])?.url || '';
                          const rightUrl = (photos[2 % photos.length] || photos[0])?.url || '';

                          return (
                            <>
                              {/* Left Back Card */}
                              {leftUrl && (
                                <div 
                                  className="absolute"
                                  style={{
                                    ...getCardPos('3%', '20%', '28%', '56%'),
                                    zIndex: 35,
                                    perspective: '1000px',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      ...cardStyle('0px', '0px', '100%', '100%', `rotateY(${isReflection ? -16 : 16}deg) translateZ(20px) rotate(${isReflection ? 5 : -5}deg)`, 35)
                                    }}
                                  >
                                    <div className="absolute inset-0 rounded-[22px] overflow-hidden">
                                      <img 
                                        src={leftUrl} 
                                        crossOrigin="anonymous" 
                                        alt="" 
                                        className="w-full h-full object-cover" 
                                        style={{ 
                                          filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`,
                                          objectPosition: `${crops[1].x}% ${crops[1].y}%`,
                                          transform: 'scale(1.95)',
                                          transformOrigin: `${crops[1].x}% ${crops[1].y}%`
                                        }} 
                                      />
                                      {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(135,100,30,0.1) 100%)', mixBlendMode: 'color' }} />}
                                      <div className="absolute inset-0 z-[5]">
                                        <WavyGlass accent={accent} opacity={0.6} density="ultra" />
                                      </div>
                                      <div className="absolute inset-0 z-[6] pointer-events-none" style={{ mixBlendMode: 'overlay', background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(255,255,255,0.03) 100%)' }} />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Right Back Card */}
                              {rightUrl && (
                                <div 
                                  className="absolute"
                                  style={{
                                    ...getCardPos('69%', '24%', '28%', '56%'),
                                    zIndex: 34,
                                    perspective: '1000px',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      ...cardStyle('0px', '0px', '100%', '100%', `rotateY(${isReflection ? 16 : -16}deg) translateZ(-10px) rotate(${isReflection ? -4 : 4}deg)`, 34)
                                    }}
                                  >
                                    <div className="absolute inset-0 rounded-[22px] overflow-hidden">
                                      <img 
                                        src={rightUrl} 
                                        crossOrigin="anonymous" 
                                        alt="" 
                                        className="w-full h-full object-cover" 
                                        style={{ 
                                          filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`,
                                          objectPosition: `${crops[2].x}% ${crops[2].y}%`,
                                          transform: 'scale(2.2)',
                                          transformOrigin: `${crops[2].x}% ${crops[2].y}%`
                                        }} 
                                      />
                                      {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(135,100,30,0.1) 100%)', mixBlendMode: 'color' }} />}
                                      <div className="absolute inset-0 z-[5]">
                                        <WavyGlass accent={accent} opacity={0.6} density="ultra" />
                                      </div>
                                      <div className="absolute inset-0 z-[6] pointer-events-none" style={{ mixBlendMode: 'overlay', background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(255,255,255,0.03) 100%)' }} />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Center Main Card */}
                              {mainUrl && (
                                <div 
                                  className="absolute"
                                  style={{
                                    ...getCardPos('26%', '12%', '48%', '76%'),
                                    zIndex: 50,
                                    perspective: '1000px',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      ...cardStyle('0px', '0px', '100%', '100%', `rotateY(${isReflection ? 8 : -8}deg) translateZ(80px) rotate(${isReflection ? 1 : -1}deg)`, 50),
                                      borderWidth: '3.5px',
                                      borderColor: 'rgba(255, 255, 255, 0.25)',
                                      outlineColor: `${accent}ff`,
                                      boxShadow: isReflection ? 'none' : `0 50px 110px rgba(0,0,0,0.92), inset 0 0 30px ${accent}60, inset 0 1px 2px rgba(255,255,255,0.6), 0 0 60px ${accent}45`,
                                    }}
                                  >
                                    <div className="absolute inset-0 rounded-[22px] overflow-hidden">
                                      <img 
                                        src={mainUrl} 
                                        crossOrigin="anonymous" 
                                        alt="" 
                                        className="w-full h-full object-cover" 
                                        style={{ 
                                          filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`,
                                          objectPosition: `${crops[0].x}% ${crops[0].y}%`,
                                          transform: 'scale(1.15)',
                                          transformOrigin: `${crops[0].x}% ${crops[0].y}%`
                                        }} 
                                      />
                                      {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(135,100,30,0.15) 100%)', mixBlendMode: 'color' }} />}
                                      <div className="absolute inset-0 z-[5]">
                                        <WavyGlass accent={accent} opacity={0.8} density="ultra" />
                                      </div>
                                      <div className="absolute inset-0 z-[6] pointer-events-none" style={{ mixBlendMode: 'overlay', background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%, rgba(255,255,255,0.05) 100%)' }} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        }

                        // ----------------------------------------------------
                        // Style 2: Deep Ribbed Glass Panels
                        // ----------------------------------------------------
                        if (coverT5Style === 'style2') {
                          const mainUrl = photos[0]?.url || '';
                          if (!mainUrl) return null;
                          const panelCount = 8;
                          const panelWidth = 100 / panelCount;

                          return (
                            <div
                              className="absolute overflow-hidden"
                              style={{
                                ...getCardPos('23%', '12%', '54%', '76%'),
                                zIndex: 50,
                                borderRadius: '20px',
                                border: `3.5px solid ${accent}ee`,
                                outline: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(0, 0, 0, 0.35)',
                                backdropFilter: isReflection ? 'none' : 'blur(4px)',
                                WebkitBackdropFilter: isReflection ? 'none' : 'blur(4px)',
                                boxShadow: isReflection ? 'none' : `0 45px 95px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.25), 0 0 60px ${accent}40`,
                                transform: `rotateY(${isReflection ? 6 : -6}deg) translateZ(40px)`,
                                transformStyle: 'preserve-3d',
                              }}
                            >
                              <div className="absolute inset-0 flex">
                                {Array.from({ length: panelCount }).map((_, i) => (
                                  <div
                                    key={`t5-ribbed-${i}${isReflection ? '-refl' : ''}`}
                                    className="h-full relative overflow-hidden"
                                    style={{
                                      width: `${panelWidth}%`,
                                      borderRight: i < panelCount - 1 ? '1.5px solid rgba(255, 255, 255, 0.22)' : 'none',
                                      borderLeft: i > 0 ? '1.5px solid rgba(0, 0, 0, 0.45)' : 'none',
                                      boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
                                    }}
                                  >
                                    <img
                                      src={mainUrl}
                                      crossOrigin="anonymous"
                                      alt=""
                                      style={{
                                        position: 'absolute',
                                        left: `-${i * 100}%`,
                                        top: 0,
                                        width: `${100 * panelCount}%`,
                                        height: '100%',
                                        maxWidth: 'none',
                                        objectFit: 'cover',
                                        filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`
                                      }}
                                    />
                                    {coverT5ColorMode && (
                                      <div 
                                        className="absolute inset-0 pointer-events-none z-[4]" 
                                        style={{ 
                                          background: 'linear-gradient(135deg, rgba(212,175,55,0.22) 0%, rgba(135,100,30,0.12) 100%)', 
                                          mixBlendMode: 'color' 
                                        }} 
                                      />
                                    )}
                                    <div 
                                      className="absolute inset-0 z-10 pointer-events-none"
                                      style={{
                                        backdropFilter: 'blur(3px)',
                                        WebkitBackdropFilter: 'blur(3px)',
                                        background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 30%, rgba(0,0,0,0.08) 70%, rgba(0,0,0,0.25) 100%)',
                                      }}
                                    />
                                    <div className="absolute inset-0 z-20 pointer-events-none" style={{ mixBlendMode: 'overlay', background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, rgba(255,255,255,0.02) 100%)' }} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // ----------------------------------------------------
                        // Style 3: Infinite Gallery Tunnel
                        // ----------------------------------------------------
                        if (coverT5Style === 'style3') {
                          const mainUrl = photos[0]?.url || '';
                          if (!mainUrl) return null;

                          return (
                            <>
                              {Array.from({ length: 5 }).map((_, i) => {
                                const idx = 4 - i;
                                const scale = 1.0 - idx * 0.125;
                                const tz = 100 - idx * 85;
                                const opacity = Math.max(0.15, 1.0 - idx * 0.18);
                                const blur = idx * 2.5;
                                const borderGlow = idx === 0 ? `${accent}dd` : `${accent}${Math.floor((0.8 - idx * 0.18) * 255).toString(16).padStart(2, '0')}`;
                                
                                return (
                                  <div
                                    key={`t5-tunnel-${idx}${isReflection ? '-refl' : ''}`}
                                    className="absolute"
                                    style={{
                                      ...getCardPos('27%', '12%', '46%', '76%'),
                                      zIndex: 50 - idx,
                                      opacity: opacity,
                                      transform: `translateZ(${tz}px) scale(${scale})`,
                                      transformStyle: 'preserve-3d',
                                      borderRadius: '24px',
                                      border: `${idx === 0 ? '3px' : '1.5px'} solid ${borderGlow}`,
                                      background: 'rgba(0, 0, 0, 0.2)',
                                      backdropFilter: isReflection ? 'none' : `blur(${16 - idx * 2.5}px)`,
                                      WebkitBackdropFilter: isReflection ? 'none' : `blur(${16 - idx * 2.5}px)`,
                                      filter: isReflection ? `blur(12px) brightness(${0.6 - idx * 0.08})` : `blur(${blur}px)`,
                                      boxShadow: isReflection ? 'none' : (idx === 0 
                                        ? `0 40px 90px rgba(0,0,0,0.95), 0 0 40px rgba(212, 175, 55, 0.35)` 
                                        : `0 0 ${20 + idx * 10}px ${accent}20`),
                                    }}
                                  >
                                    <div className="absolute inset-0 rounded-[22px] overflow-hidden">
                                      <img src={mainUrl} crossOrigin="anonymous" alt="" className="w-full h-full object-cover" style={{ filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}` }} />
                                      {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.22) 0%, rgba(135,100,30,0.12) 100%)', mixBlendMode: 'color' }} />}
                                      <div className="absolute inset-0 z-[5]">
                                        <WavyGlass accent={accent} opacity={0.75 - idx * 0.1} density="ultra" />
                                      </div>
                                      <div className="absolute inset-0 z-[6] pointer-events-none" style={{ mixBlendMode: 'overlay', background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(255,255,255,0.03) 100%)' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          );
                        }

                        // ----------------------------------------------------
                        // Style 4: 3D Billboard Showcase
                        // ----------------------------------------------------
                        if (coverT5Style === 'style4') {
                          const crops = getTemplateCrops(photos, 3);
                          const mainUrl = photos[0]?.url || '';
                          const leftUrl = (photos[1 % photos.length] || photos[0])?.url || '';
                          const rightUrl = (photos[2 % photos.length] || photos[0])?.url || '';

                          return (
                            <>
                              {/* Background Left Poster */}
                              {leftUrl && (
                                <div
                                  className="absolute"
                                  style={{
                                    ...getCardPos('3%', '24%', '22%', '52%'),
                                    zIndex: 35,
                                    opacity: 0.75,
                                    borderRadius: '12px',
                                    border: '1.5px solid rgba(255,255,255,0.15)',
                                    outline: `1px solid ${accent}40`,
                                    background: 'rgba(255,255,255,0.02)',
                                    transform: `rotateY(${isReflection ? -25 : 25}deg) translateZ(-40px)`,
                                    transformOrigin: 'center center',
                                    overflow: 'hidden',
                                    filter: isReflection ? 'blur(15px) brightness(0.5)' : 'none',
                                    boxShadow: isReflection ? 'none' : '0 20px 45px rgba(0,0,0,0.8)',
                                  }}
                                >
                                  <img 
                                    src={leftUrl} 
                                    crossOrigin="anonymous" 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                    style={{ 
                                      filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`,
                                      objectPosition: `${crops[1].x}% ${crops[1].y}%`,
                                      transform: 'scale(1.8)',
                                      transformOrigin: `${crops[1].x}% ${crops[1].y}%`
                                    }} 
                                  />
                                  {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(135,100,30,0.08) 100%)', mixBlendMode: 'color' }} />}
                                </div>
                              )}

                              {/* Background Right Poster */}
                              {rightUrl && (
                                <div
                                  className="absolute"
                                  style={{
                                    ...getCardPos('75%', '28%', '22%', '52%'),
                                    zIndex: 34,
                                    opacity: 0.7,
                                    borderRadius: '12px',
                                    border: '1.5px solid rgba(255,255,255,0.15)',
                                    outline: `1px solid ${accent}40`,
                                    background: 'rgba(255,255,255,0.02)',
                                    transform: `rotateY(${isReflection ? 25 : -25}deg) translateZ(-50px)`,
                                    transformOrigin: 'center center',
                                    overflow: 'hidden',
                                    filter: isReflection ? 'blur(15px) brightness(0.5)' : 'none',
                                    boxShadow: isReflection ? 'none' : '0 20px 45px rgba(0,0,0,0.8)',
                                  }}
                                >
                                  <img 
                                    src={rightUrl} 
                                    crossOrigin="anonymous" 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                    style={{ 
                                      filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`,
                                      objectPosition: `${crops[2].x}% ${crops[2].y}%`,
                                      transform: 'scale(2.1)',
                                      transformOrigin: `${crops[2].x}% ${crops[2].y}%`
                                    }} 
                                  />
                                  {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(135,100,30,0.08) 100%)', mixBlendMode: 'color' }} />}
                                </div>
                              )}

                              {/* Main Center 3D Billboard */}
                              {mainUrl && (
                                <div
                                  className="absolute"
                                  style={{
                                    ...getCardPos('26%', '10%', '48%', '76%'),
                                    zIndex: 50,
                                    borderRadius: '16px',
                                    border: `3.5px solid ${accent}ee`,
                                    outline: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    backdropFilter: isReflection ? 'none' : 'blur(12px)',
                                    WebkitBackdropFilter: isReflection ? 'none' : 'blur(12px)',
                                    transform: `rotateY(${isReflection ? -10 : 10}deg) translateZ(80px)`,
                                    transformStyle: 'preserve-3d',
                                    transformOrigin: 'center center',
                                    filter: isReflection ? 'blur(10px) brightness(0.6)' : 'none',
                                    boxShadow: isReflection ? 'none' : `0 45px 85px rgba(0,0,0,0.92), 0 0 50px ${accent}45, inset 0 0 20px rgba(0,0,0,0.6)`,
                                  }}
                                >
                                  <div className="absolute inset-0 rounded-[12px] overflow-hidden">
                                    <img 
                                      src={mainUrl} 
                                      crossOrigin="anonymous" 
                                      alt="" 
                                      className="w-full h-full object-cover" 
                                      style={{ 
                                        filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`,
                                        objectPosition: `${crops[0].x}% ${crops[0].y}%`,
                                        transform: 'scale(1.15)',
                                        transformOrigin: `${crops[0].x}% ${crops[0].y}%`
                                      }} 
                                    />
                                    {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(135,100,30,0.15) 100%)', mixBlendMode: 'color' }} />}
                                    <div className="absolute inset-0 z-[5]">
                                      <WavyGlass accent={accent} opacity={0.65} density="ultra" />
                                    </div>
                                    <div className="absolute inset-0 z-[6] pointer-events-none" style={{ mixBlendMode: 'overlay', background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 35%, rgba(255,255,255,0.05) 70%, transparent 100%)' }} />
                                  </div>
                                  
                                  {!isReflection && (
                                    <div 
                                      className="absolute pointer-events-none"
                                      style={{
                                        left: '25%',
                                        bottom: '-32px',
                                        width: '50%',
                                        height: '32px',
                                        background: 'linear-gradient(180deg, #1b1c20 0%, #0d0e10 100%)',
                                        border: '1.5px solid rgba(255,255,255,0.1)',
                                        borderTop: 'none',
                                        borderRadius: '0 0 8px 8px',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
                                        transform: 'translateZ(-10px) rotateX(15deg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <div style={{ width: '40%', height: '4px', background: accent, opacity: 0.8, borderRadius: '2px', boxShadow: `0 0 10px ${accent}` }} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        }

                        // ----------------------------------------------------
                        // Style 6: Scattered Cards (Old Layout Inside Window)
                        // ----------------------------------------------------
                        if (coverT5Style === 'style6') {
                          const crops = shuffle(getTemplateCrops(photos, 6));
                          const style6Layout = [
                            { left: '4%', top: '6%', width: '46%', height: '24%', rot: -14, zIndex: 35, zoom: 2.0, posX: 15, posY: 20 },
                            { left: '48%', top: '12%', width: '48%', height: '26%', rot: 10, zIndex: 34, zoom: 1.8, posX: 85, posY: 15 },
                            { left: '2%', top: '34%', width: '48%', height: '25%', rot: -8, zIndex: 37, zoom: 2.2, posX: 30, posY: 55 },
                            { left: '50%', top: '42%', width: '46%', height: '28%', rot: 12, zIndex: 36, zoom: 1.9, posX: 70, posY: 45 },
                            { left: '6%', top: '66%', width: '46%', height: '25%', rot: -10, zIndex: 38, zoom: 2.1, posX: 40, posY: 75 },
                            { left: '46%', top: '72%', width: '48%', height: '26%', rot: 8, zIndex: 39, zoom: 1.7, posX: 60, posY: 85 },
                          ];

                          return (
                            <>
                              {style6Layout.map((s, idx) => {
                                const item = photos[idx % photos.length];
                                if (!item) return null;
                                const imgUrl = item.url;
                                const pos = getCardPos(s.left, s.top, s.width, s.height);
                                return (
                                  <div
                                    key={`t5-style6-${idx}${isReflection ? '-refl' : ''}`}
                                    className="absolute"
                                    style={{
                                      ...pos,
                                      zIndex: s.zIndex,
                                      perspective: '1000px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        ...cardStyle(
                                          '0px', 
                                          '0px', 
                                          '100%', 
                                          '100%', 
                                          `rotateY(${isReflection ? -s.rot : s.rot}deg) rotate(${isReflection ? -s.rot * 0.4 : s.rot * 0.4}deg)`, 
                                          s.zIndex
                                        )
                                      }}
                                    >
                                      <div className="absolute inset-0 rounded-[22px] overflow-hidden">
                                        <img 
                                          src={imgUrl} 
                                          crossOrigin="anonymous" 
                                          alt="" 
                                          className="w-full h-full object-cover" 
                                          style={{ 
                                            filter: `${imgFilter} ${isReflection ? 'blur(6px) brightness(0.6)' : ''}`,
                                            objectPosition: `${crops[idx].x}% ${crops[idx].y}%`,
                                            transform: `scale(${s.zoom})`,
                                            transformOrigin: `${crops[idx].x}% ${crops[idx].y}%`
                                          }} 
                                        />
                                        {coverT5ColorMode && <div className="absolute inset-0 pointer-events-none z-[4]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(135,100,30,0.1) 100%)', mixBlendMode: 'color' }} />}
                                        <div className="absolute inset-0 z-[5]">
                                          <WavyGlass accent={accent} opacity={0.6} density="ultra" />
                                        </div>
                                        <div className="absolute inset-0 z-[6] pointer-events-none" style={{ mixBlendMode: 'overlay', background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(255,255,255,0.03) 100%)' }} />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          );
                        }

                        // Fallback in case style is invalid (should not happen)
                        return null;
                      };

                      return (
                        <div className="w-full h-full relative flex flex-col select-none text-white overflow-hidden" style={{ ['--cover-accent' as any]: accent, padding: '64px' }}>
                          <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundImage: `url('/cover-bg-portal.png')`, backgroundSize: 'cover', backgroundPosition: 'center', width: '100%', height: '100%', transform: swap ? 'scaleX(-1)' : 'none', transformOrigin: 'center center' }} />
                          {/* Color tint overlays to unify room mood with theme accent color (color + multiply mode) */}
                          <div className="absolute inset-0 z-[26] pointer-events-none" style={{ backgroundColor: accent, opacity: 0.28, mixBlendMode: 'color', transform: swap ? 'scaleX(-1)' : 'none', transformOrigin: 'center center' }} />
                          <div className="absolute inset-0 z-[26] pointer-events-none" style={{ backgroundColor: accent, opacity: 0.12, mixBlendMode: 'multiply', transform: swap ? 'scaleX(-1)' : 'none', transformOrigin: 'center center' }} />
                          
                          {/* Repositioned text background glows to left side */}
                          <div className="absolute pointer-events-none z-[7]" style={{ [swap ? 'left' : 'right']: '55%', [swap ? 'right' : 'left']: '4%', top: '18%', height: '64%', background: `radial-gradient(ellipse ${gI.spread}% ${gI.spread * 0.93}% at 50% 50%, ${glow}${alphaToHex(0.4 * gI.opacity)} 0%, ${glow}${alphaToHex(0.2 * gI.opacity)} 50%, transparent 85%)`, filter: `blur(${gI.blur}px)` } as React.CSSProperties} />
                          <div className="absolute pointer-events-none z-[8]" style={{ [swap ? 'left' : 'right']: '55%', [swap ? 'right' : 'left']: '4%', top: '22%', height: '56%', background: `radial-gradient(ellipse ${gI.spread * 0.93}% ${gI.spread * 0.86}% at 50% 50%, ${glow}${alphaToHex(1 * gI.opacity)} 0%, ${glow}${alphaToHex(0.9 * gI.opacity)} 30%, ${glow}${alphaToHex(0.6 * gI.opacity)} 55%, ${glow}${alphaToHex(0.25 * gI.opacity)} 75%, transparent 92%)`, filter: `blur(${Math.max(8, gI.blur * 0.67)}px)` } as React.CSSProperties} />
                          
                          <Header accent={accent} brandRight={swap} align={textAlign} imagesSide={imagesSide} />
                          <TextBlock accent={accent} align={textAlign} imagesSide={imagesSide} />
 
                           {coverShow.collage && (
                            <>
                              {/* Main collage inside the window using custom Photoshop mask */}
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  zIndex: 10,
                                  WebkitMaskImage: coverPortalMaskWindowUrl ? `url(${coverPortalMaskWindowUrl})` : 'none',
                                  WebkitMaskSize: 'cover',
                                  WebkitMaskPosition: 'center',
                                  maskImage: coverPortalMaskWindowUrl ? `url(${coverPortalMaskWindowUrl})` : 'none',
                                  maskSize: 'cover',
                                  maskPosition: 'center',
                                  transform: swap ? 'scaleX(-1)' : 'none',
                                  transformOrigin: 'center center',
                                  // Clip to exclude reflection and chair (always x: 531px..1500px, y: 0px..1551px in local space, mirrored dynamically)
                                  clipPath: swap 
                                    ? 'polygon(0px 0px, 969px 0px, 969px 1551px, 0px 1551px)' 
                                    : 'polygon(531px 0px, 1500px 0px, 1500px 1551px, 531px 1551px)',
                                }}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '140px',
                                    left: '630px',
                                    width: '760px',
                                    height: '1420px',
                                    background: `radial-gradient(circle at 50% 50%, ${accent}cc 0%, ${accent}25 50%, #040302 100%)`, // Deep warm core glow
                                    borderRadius: '8px',
                                    overflow: 'hidden', // Contain all overlays
                                  }}
                                >
                                  <div className="relative w-full h-full" style={{ perspective: '1500px' }}>
                                    {renderWindowSlats(false)}
                                    
                                    {/* Starfield overlay (sharp stars behind cards, in front of slats) */}
                                    <div className="absolute inset-0 pointer-events-none z-10 opacity-75" style={{
                                      backgroundImage: `
                                        radial-gradient(1.2px 1.2px at 30px 40px, #fff, transparent),
                                        radial-gradient(2px 2px at 170px 90px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 90px 290px, #fff, transparent),
                                        radial-gradient(2.5px 2.5px at 320px 150px, #fff, transparent),
                                        radial-gradient(1.8px 1.8px at 390px 380px, ${accent}, transparent),
                                        radial-gradient(1.2px 1.2px at 490px 100px, #fff, transparent),
                                        radial-gradient(2.2px 2.2px at 620px 330px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 680px 480px, #fff, transparent),
                                        radial-gradient(1.8px 1.8px at 740px 220px, ${accent}, transparent),
                                        radial-gradient(1.2px 1.2px at 60px 650px, #fff, transparent),
                                        radial-gradient(2.5px 2.5px at 200px 790px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 350px 880px, #fff, transparent),
                                        radial-gradient(1.8px 1.8px at 520px 1050px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 650px 1200px, #fff, transparent),
                                        radial-gradient(2.5px 2.5px at 240px 1350px, ${accent}, transparent),
                                        radial-gradient(1.8px 1.8px at 450px 1450px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 180px 1500px, #fff, transparent),
                                        radial-gradient(2.8px 2.8px at 710px 920px, #fff, transparent)
                                      `,
                                      backgroundSize: '400px 600px',
                                      mixBlendMode: 'screen',
                                    }} />

                                    {/* Cosmic cloud SVG overlay for organic nebula dust detail */}
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-30 mix-blend-color-dodge">
                                      <filter id="cosmic-dust">
                                        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise" />
                                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.4 0" />
                                      </filter>
                                      <rect width="100%" height="100%" filter="url(#cosmic-dust)" fill={accent} />
                                    </svg>

                                    {/* Deep inner shadow frame overlay (z-20) to force shadow on top of background & slats */}
                                    <div className="absolute inset-0 pointer-events-none z-20" style={{
                                      boxShadow: `inset 0 0 120px rgba(0,0,0,0.98), inset 0 0 50px ${accent}40`,
                                      borderRadius: '8px',
                                      border: `2.5px solid ${accent}50`, // Glowing golden frame rim
                                    }} />

                                    {renderCollageItems(false)}
                                  </div>
                                </div>
                              </div>
 
                              {/* Floor reflection of the collage using custom Photoshop mask */}
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  zIndex: 9,
                                  WebkitMaskImage: coverPortalMaskReflectionUrl ? `url(${coverPortalMaskReflectionUrl})` : 'none',
                                  WebkitMaskSize: 'cover',
                                  WebkitMaskPosition: 'center',
                                  maskImage: coverPortalMaskReflectionUrl ? `url(${coverPortalMaskReflectionUrl})` : 'none',
                                  maskSize: 'cover',
                                  maskPosition: 'center',
                                  transform: swap ? 'scaleX(-1)' : 'none',
                                  transformOrigin: 'center center',
                                  // Clip to reflection area (always x: 531px..1500px, y: 1551px..2000px in local space, mirrored dynamically)
                                  clipPath: swap 
                                    ? 'polygon(0px 1551px, 969px 1551px, 969px 2000px, 0px 2000px)' 
                                    : 'polygon(531px 1551px, 1500px 1551px, 1500px 2000px, 531px 2000px)',
                                  opacity: 0.28,
                                  filter: 'blur(2px) brightness(0.85)',
                                }}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '140px', // Matches collage top exactly
                                    left: '630px',
                                    width: '760px',
                                    height: '1420px', // Matches collage height exactly
                                    transform: 'scaleY(-1)',
                                    transformOrigin: 'center 1411px', // Flips about the floor line (y = 1551px / local 1411px) downwards
                                    background: `radial-gradient(circle at 50% 50%, ${accent}cc 0%, ${accent}25 50%, #040302 100%)`,
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div className="relative w-full h-full" style={{ perspective: '1500px' }}>
                                    {renderWindowSlats(true)}
                                    
                                    {/* Starfield overlay inside reflection */}
                                    <div className="absolute inset-0 pointer-events-none z-10 opacity-70" style={{
                                      backgroundImage: `
                                        radial-gradient(1.2px 1.2px at 30px 40px, #fff, transparent),
                                        radial-gradient(2px 2px at 170px 90px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 90px 290px, #fff, transparent),
                                        radial-gradient(2.5px 2.5px at 320px 150px, #fff, transparent),
                                        radial-gradient(1.8px 1.8px at 390px 380px, ${accent}, transparent),
                                        radial-gradient(1.2px 1.2px at 490px 100px, #fff, transparent),
                                        radial-gradient(2.2px 2.2px at 620px 330px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 680px 480px, #fff, transparent),
                                        radial-gradient(1.8px 1.8px at 740px 220px, ${accent}, transparent),
                                        radial-gradient(1.2px 1.2px at 60px 650px, #fff, transparent),
                                        radial-gradient(2.5px 2.5px at 200px 790px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 350px 880px, #fff, transparent),
                                        radial-gradient(1.8px 1.8px at 520px 1050px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 650px 1200px, #fff, transparent),
                                        radial-gradient(2.5px 2.5px at 240px 1350px, ${accent}, transparent),
                                        radial-gradient(1.8px 1.8px at 450px 1450px, #fff, transparent),
                                        radial-gradient(1.2px 1.2px at 180px 1500px, #fff, transparent),
                                        radial-gradient(2.8px 2.8px at 710px 920px, #fff, transparent)
                                      `,
                                      backgroundSize: '400px 600px',
                                      mixBlendMode: 'screen',
                                    }} />

                                    {/* Cosmic cloud SVG overlay inside reflection */}
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-30 mix-blend-color-dodge">
                                      <filter id="cosmic-dust-refl">
                                        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise" />
                                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.4 0" />
                                      </filter>
                                      <rect width="100%" height="100%" filter="url(#cosmic-dust-refl)" fill={accent} />
                                    </svg>

                                    {/* Deep inner shadow frame overlay inside reflection (z-20) */}
                                    <div className="absolute inset-0 pointer-events-none z-20" style={{
                                      boxShadow: `inset 0 0 120px rgba(0,0,0,0.98), inset 0 0 50px ${accent}40`,
                                      borderRadius: '8px',
                                      border: `2.5px solid ${accent}50`, // Glowing golden frame rim
                                    }} />

                                    {renderCollageItems(true)}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Chair depth overlay to let text/tagline sit behind the chair silhouette (extended to 2000px for reflection) */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              zIndex: 25, // above TextBlock and Tagline!
                              backgroundImage: "url('/cover-bg-portal.png')",
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              WebkitMaskImage: coverPortalMaskChairUrl ? `url(${coverPortalMaskChairUrl})` : 'none',
                              WebkitMaskSize: 'cover',
                              WebkitMaskPosition: 'center',
                              maskImage: coverPortalMaskChairUrl ? `url(${coverPortalMaskChairUrl})` : 'none',
                              maskSize: 'cover',
                              maskPosition: 'center',
                              transform: swap ? 'scaleX(-1)' : 'none',
                              transformOrigin: 'center center',
                              // Clip to chair area (always x: 0px..580px, y: 1200px..2000px in local space, mirrored dynamically)
                              clipPath: swap 
                                ? 'polygon(920px 1200px, 1500px 1200px, 1500px 2000px, 920px 2000px)' 
                                : 'polygon(0px 1200px, 580px 1200px, 580px 2000px, 0px 2000px)',
                            }}
                          />

                          <Footer accent={accent} reverse={!swap} />
                        </div>
                      );
                    }

                    // ============= TEMPLATE 3 — LIQUID GLASS ACCORDION =============
                    {
                      const accent = coverAccentColor;
                      const glow = coverGlowColor;
                      const gI = coverGlowIntensity;
                      const swap = coverSwapSides;
                      const imagesSide: 'left' | 'right' = swap ? 'right' : 'left';
                      const textAlign: 'left' | 'right' | 'center' = coverTextCentered ? 'center' : (swap ? 'left' : 'right');
                      
                      const photos = pickPhotos(5); // 5 vertical glass rod columns
                      const colCount = 5;
                      const crops = getTemplateCrops(photos, colCount);

                      // Generate randomized offsets and crop parameters per column
                      const imgFx3 = Array.from({ length: colCount }).map((_, i) => {
                        const waveOffset = rand(-40, 40); // strong vertical stagger stagger
                        const crop = crops[i];
                        const randomCropX = Math.min(95, Math.max(5, crop.x + rand(-15, 15)));
                        const randomCropY = Math.min(95, Math.max(5, crop.y + rand(-20, 20)));
                        const scale = rand(1.18, 1.55); // random zoom/scale per column
                        return { waveOffset, randomCropX, randomCropY, scale };
                      });

                      const w = canvasWidth;
                      const h = canvasHeight;
                      const pathWave = swap
                        ? `M ${w * 1.15} ${h * 0.25} C ${w * 0.7} ${h * 0.85} ${w * 0.3} ${h * 0.15} ${-w * 0.15} ${h * 0.75}`
                        : `M ${-w * 0.15} ${h * 0.25} C ${w * 0.3} ${h * 0.85} ${w * 0.7} ${h * 0.15} ${w * 1.15} ${h * 0.75}`;

                      const waveGlowColor = (!glow || glow === '#000000' || glow === 'black' || glow === '#000') ? accent : glow;

                      return (
                        <div className="w-full h-full relative flex flex-col select-none text-white overflow-hidden" 
                          style={{ 
                            ['--cover-accent' as any]: accent, 
                            background: `radial-gradient(ellipse 95% 85% at ${swap ? '20%' : '80%'} 50%, ${accent}26 0%, transparent 60%), 
                                         radial-gradient(ellipse 75% 65% at ${swap ? '80%' : '20%'} 50%, ${waveGlowColor}1f 0%, transparent 70%), 
                                         linear-gradient(180deg, #030305 0%, #0c0d12 50%, #020203 100%)`, 
                            padding: '64px' 
                          }}
                        >
                          {/* Background Glow Wave SVG - Layered soft blurs matching theme colors (no hardcoded purple/blue) */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
                            <defs>
                              <linearGradient id="wave-gradient-t3" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={accent} stopOpacity="0.1" />
                                <stop offset="25%" stopColor={accent} stopOpacity="0.8" />
                                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                                <stop offset="75%" stopColor={waveGlowColor} stopOpacity="0.8" />
                                <stop offset="100%" stopColor={waveGlowColor} stopOpacity="0.1" />
                              </linearGradient>
                              <filter id="neon-blur-t3-heavy" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur} />
                              </filter>
                              <filter id="neon-blur-t3-medium" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.5} />
                              </filter>
                              <filter id="neon-blur-t3-light" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation={coverT4.bgBlur * 0.15} />
                              </filter>
                            </defs>
                            {/* Layer 1: Wide ambient glow */}
                            <path
                              d={pathWave}
                              fill="none"
                              stroke="url(#wave-gradient-t3)"
                              strokeWidth={h * 0.28}
                              strokeLinecap="round"
                              filter="url(#neon-blur-t3-heavy)"
                              opacity="0.35"
                            />
                            {/* Layer 2: Core glow */}
                            <path
                              d={pathWave}
                              fill="none"
                              stroke="url(#wave-gradient-t3)"
                              strokeWidth={h * 0.14}
                              strokeLinecap="round"
                              filter="url(#neon-blur-t3-medium)"
                              opacity="0.65"
                            />
                            {/* Layer 3: Intense white center reflection */}
                            <path
                              d={pathWave}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={h * 0.03}
                              strokeLinecap="round"
                              filter="url(#neon-blur-t3-light)"
                              opacity="0.85"
                            />
                          </svg>

                          {/* Dark Liquid Metal Gloss Reflective Ridges (Reference Image 4) */}
                          <div className="absolute inset-0 pointer-events-none z-[2] opacity-20 mix-blend-color-dodge" 
                            style={{ 
                              background: `
                                linear-gradient(135deg, 
                                  transparent 0%, 
                                  rgba(255,255,255,0.01) 30%, 
                                  rgba(255,255,255,0.15) 32%, 
                                  rgba(255,255,255,0.02) 34%, 
                                  transparent 36%, 
                                  transparent 60%, 
                                  rgba(255,255,255,0.12) 62%, 
                                  rgba(255,255,255,0.01) 64%, 
                                  transparent 100%)
                              `
                            }} 
                          />
                          <div className="absolute inset-0 pointer-events-none z-[3] opacity-30 mix-blend-overlay"
                            style={{
                              backgroundImage: `linear-gradient(220deg, rgba(0,0,0,0.8) 0%, rgba(255,255,255,0.1) 35%, rgba(0,0,0,0.85) 65%, rgba(255,255,255,0.05) 100%)`
                            }}
                          />

                          {/* Background shadow overlay to smoothly transition to the text block */}
                          <div className="absolute top-0 bottom-0 pointer-events-none z-[4]" 
                            style={{ 
                              [swap ? 'right' : 'left']: '38%', 
                              width: '15%', 
                              background: `linear-gradient(to ${swap ? 'right' : 'left'}, transparent 0%, rgba(3,3,5,0.95) 75%, rgba(3,3,5,1) 100%)` 
                            } as React.CSSProperties} 
                          />

                          {/* Main Title Glow Intensity Overlay */}
                          <div className="absolute pointer-events-none z-[7]" 
                            style={{ 
                              [swap ? 'right' : 'left']: '40%', 
                              [swap ? 'left' : 'right']: '6%', 
                              top: '18%', 
                              height: '64%', 
                              background: `radial-gradient(ellipse ${gI.spread}% ${gI.spread * 0.93}% at 50% 50%, ${glow}${alphaToHex(0.4 * gI.opacity)} 0%, ${glow}${alphaToHex(0.2 * gI.opacity)} 50%, transparent 85%)`, 
                              filter: `blur(${gI.blur}px)` 
                            } as React.CSSProperties} 
                          />
                          <div className="absolute pointer-events-none z-[8]" 
                            style={{ 
                              [swap ? 'right' : 'left']: '40%', 
                              [swap ? 'left' : 'right']: '6%', 
                              top: '22%', 
                              height: '56%', 
                              background: `radial-gradient(ellipse ${gI.spread * 0.93}% ${gI.spread * 0.86}% at 50% 50%, ${glow}${alphaToHex(1 * gI.opacity)} 0%, ${glow}${alphaToHex(0.9 * gI.opacity)} 30%, ${glow}${alphaToHex(0.6 * gI.opacity)} 55%, ${glow}${alphaToHex(0.25 * gI.opacity)} 75%, transparent 92%)`, 
                              filter: `blur(${Math.max(8, gI.blur * 0.67)}px)` 
                            } as React.CSSProperties} 
                          />

                          {/* Collage Slices - 3D Glass Cylindrical Rod Accordion Wall */}
                          {coverShow.collage && (
                            <div className="absolute top-0 bottom-0 z-10 pointer-events-none overflow-hidden" 
                              style={{ 
                                [imagesSide]: 0, 
                                width: '42%',
                                boxShadow: `0 0 80px rgba(0,0,0,0.85), ${imagesSide === 'left' ? '20px' : '-20px'} 0 40px rgba(0,0,0,0.6)`
                              } as React.CSSProperties}
                            >
                              <div className="absolute inset-x-0 h-full flex">
                                {imgFx3.map((fx, idx) => {
                                  // Pick different design image per slice to avoid "single body" look
                                  const photo = photos[idx % photos.length] || photos[0];
                                  if (!photo) return null;

                                  return (
                                    <div 
                                      key={`t3-col-${idx}`} 
                                      className="relative h-[112%] overflow-hidden transition-all duration-300" 
                                      style={{ 
                                        width: `${100 / colCount}%`,
                                        top: '-6%',
                                        transform: `translateY(${fx.waveOffset}px)`,
                                        borderLeft: idx > 0 ? '1.5px solid rgba(255, 255, 255, 0.45)' : 'none',
                                        borderRight: idx < colCount - 1 ? '1.2px solid rgba(0, 0, 0, 0.35)' : 'none',
                                        boxShadow: '0 25px 45px rgba(0, 0, 0, 0.55), inset 0 0 15px rgba(0, 0, 0, 0.25)'
                                      }}
                                    >
                                      {/* Crisp Design Image with random crops and offsets */}
                                      <img 
                                        src={photo.url} 
                                        crossOrigin="anonymous" 
                                        alt="Design" 
                                        className="absolute inset-0 w-full h-full" 
                                        style={{ 
                                          objectFit: 'cover',
                                          objectPosition: `${fx.randomCropX}% ${fx.randomCropY}%`,
                                          transform: `scale(${fx.scale})`,
                                          filter: 'saturate(1.08) contrast(1.04) brightness(1.02)'
                                        }} 
                                      />
                                      {/* 3D Cylindrical Glass Rod Highlight/Shadow Overlay */}
                                      <div className="absolute inset-0 pointer-events-none" 
                                        style={{ 
                                          background: `linear-gradient(90deg, 
                                            rgba(255, 255, 255, 0.28) 0%, 
                                            rgba(255, 255, 255, 0.48) 8%, 
                                            rgba(255, 255, 255, 0.12) 22%, 
                                            transparent 50%, 
                                            rgba(0, 0, 0, 0.15) 80%, 
                                            rgba(0, 0, 0, 0.45) 100%)`
                                        }} 
                                      />
                                      {/* Vertical glossy sheen line */}
                                      <div className="absolute inset-y-0 left-[8%] w-[1.5px] pointer-events-none" 
                                        style={{ 
                                          background: 'rgba(255, 255, 255, 0.65)',
                                          boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)'
                                        }} 
                                      />
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Glowing Cyber Grid Halftone Pattern overlay on Slices (Reference Image 2) */}
                              <div className="absolute inset-0 pointer-events-none z-[12] mix-blend-overlay opacity-35" 
                                style={{ 
                                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1.5px, transparent 1.5px)', 
                                  backgroundSize: '16px 16px' 
                                }} 
                              />

                              {/* Glass Sheen overlay */}
                              <WavyGlass accent={accent} opacity={0.55} density="normal" />
                            </div>
                          )}

                          <Header accent={accent} brandRight={true} align={textAlign} imagesSide={imagesSide} />
                          <TextBlock accent={accent} align={textAlign} imagesSide={imagesSide} />
                          <Footer accent={accent} />
                        </div>
                      );
                    }
                  })()
                ) : (
                  <>
                    {/* ── Blurred replica BG (glass effect from installation image) ── */}
                    {bgType === 'replica_blur' && canvasImageUrl && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: '-80px',
                          width: 'calc(100% + 160px)',
                          height: 'calc(100% + 160px)',
                          backgroundImage: `url('${canvasImageUrl}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: `blur(${blurAmount}px) brightness(0.35) saturate(1.5)`,
                          zIndex: 0,
                          transform: 'scale(1.15)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* ── Custom BG image ── */}
                    {bgType === 'image' && bgImageUrl && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          backgroundImage: `url('${bgImageUrl}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          zIndex: 0,
                          pointerEvents: 'none'
                        }}
                      />
                    )}

                    {/* ── Main image ── */}
                    {canvasImageUrl && (
                      <div
                        onMouseDown={(e) => handleMouseDown(e, 'image')}
                        onDoubleClick={handleImageDoubleClick}
                        style={{
                          position: 'absolute',
                          left: `${imageStyle.x}px`,
                          top: `${imageStyle.y}px`,
                          width: `${imageStyle.width}px`,
                          height: `${imageStyle.height}px`,
                          borderRadius: `${imageStyle.borderRadius}px`,
                          border: imageStyle.borderWidth > 0 ? `${imageStyle.borderWidth}px solid ${imageStyle.borderColor}` : 'none',
                          boxShadow: imageStyle.shadow ? '0 25px 50px -12px rgba(0,0,0,0.7)' : 'none',
                          zIndex: 5,
                          cursor: dragState.activeId === 'image' ? 'grabbing' : 'grab',
                          overflow: 'hidden',
                        }}
                        className={`transition-shadow duration-150 ${!isExporting && selectedLayerId === 'image' ? 'ring-4 ring-primary/60 ring-offset-2 ring-offset-transparent' : ''}`}
                      >
                        <img
                          src={canvasImageUrl}
                          crossOrigin="anonymous"
                          alt=""
                          draggable={false}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: (imageStyle.objectFit as any) || 'cover',
                            objectPosition: 'center',
                            display: 'block',
                            pointerEvents: 'none',
                            userSelect: 'none',
                          }}
                        />
                      </div>
                    )}

                    {/* ── Photoshop-like Transform Bounding Box ── */}
                    {transformActive && selectedLayerId === 'image' && (
                      <div
                        data-export-hidden="true"
                        style={{
                          position: 'absolute',
                          left: `${imageStyle.x}px`,
                          top: `${imageStyle.y}px`,
                          width: `${imageStyle.width}px`,
                          height: `${imageStyle.height}px`,
                          border: '2px solid #c9a84c',
                          zIndex: 90,
                          pointerEvents: 'auto',
                        }}
                        onMouseDown={(e) => handleMouseDown(e, 'image')}
                      >
                        {/* Dashed inner border */}
                        <div style={{ position: 'absolute', inset: '2px', border: '1px dashed #ffffff', opacity: 0.8, pointerEvents: 'none' }} />

                        {/* Bounding box handles */}
                        {(() => {
                          const handleSize = Math.max(8, Math.round(10 / zoom));
                          const handleOffset = -Math.round(handleSize / 2);
                          const handleBaseStyle = {
                            position: 'absolute' as const,
                            width: `${handleSize}px`,
                            height: `${handleSize}px`,
                            backgroundColor: '#ffffff',
                            border: '2px solid #c9a84c',
                            borderRadius: '2px',
                          };

                          return (
                            <>
                              {/* Corner Handles */}
                              <div
                                style={{ ...handleBaseStyle, left: `${handleOffset}px`, top: `${handleOffset}px`, cursor: 'nwse-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 'tl')}
                              />
                              <div
                                style={{ ...handleBaseStyle, right: `${handleOffset}px`, top: `${handleOffset}px`, cursor: 'nesw-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 'tr')}
                              />
                              <div
                                style={{ ...handleBaseStyle, left: `${handleOffset}px`, bottom: `${handleOffset}px`, cursor: 'nesw-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 'bl')}
                              />
                              <div
                                style={{ ...handleBaseStyle, right: `${handleOffset}px`, bottom: `${handleOffset}px`, cursor: 'nwse-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 'br')}
                              />
                              {/* Edge Center Handles */}
                              <div
                                style={{ ...handleBaseStyle, left: '50%', transform: 'translateX(-50%)', top: `${handleOffset}px`, cursor: 'ns-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 't')}
                              />
                              <div
                                style={{ ...handleBaseStyle, left: '50%', transform: 'translateX(-50%)', bottom: `${handleOffset}px`, cursor: 'ns-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 'b')}
                              />
                              <div
                                style={{ ...handleBaseStyle, top: '50%', transform: 'translateY(-50%)', left: `${handleOffset}px`, cursor: 'ew-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 'l')}
                              />
                              <div
                                style={{ ...handleBaseStyle, top: '50%', transform: 'translateY(-50%)', right: `${handleOffset}px`, cursor: 'ew-resize' }}
                                onMouseDown={(e) => handleHandleMouseDown(e, 'r')}
                              />
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── Panel Transform Bounding Box (double-click on panel) ── */}
                    {panelTransformActive && selectedLayerId === 'panel' && glassPanel.visible && (
                      <div
                        data-export-hidden="true"
                        style={{
                          position: 'absolute',
                          left: `${glassPanel.x}px`,
                          top: `${glassPanel.y}px`,
                          width: `${glassPanel.width}px`,
                          height: `${glassPanel.height}px`,
                          border: '2px solid #38bdf8',
                          zIndex: 95,
                          pointerEvents: 'none',
                        }}
                      >
                        <div style={{ position: 'absolute', inset: '2px', border: '1px dashed #ffffff', opacity: 0.6, pointerEvents: 'none' }} />
                        {/* Top handle - resize height upward */}
                        {(() => {
                          const hs = Math.max(10, Math.round(12 / zoom));
                          const ho = -Math.round(hs / 2);
                          const hStyle = {
                            position: 'absolute' as const,
                            width: `${hs}px`,
                            height: `${hs}px`,
                            backgroundColor: '#38bdf8',
                            border: '2px solid #ffffff',
                            borderRadius: '2px',
                            pointerEvents: 'auto' as const,
                            cursor: 'ns-resize',
                          };
                          return (
                            <>
                              <div
                                style={{ ...hStyle, left: '50%', transform: 'translateX(-50%)', top: `${ho}px` }}
                                onMouseDown={(e) => handlePanelHandleMouseDown(e, 't')}
                              />
                              <div
                                style={{ ...hStyle, left: '50%', transform: 'translateX(-50%)', bottom: `${ho}px` }}
                                onMouseDown={(e) => handlePanelHandleMouseDown(e, 'b')}
                              />
                              {/* Left / Right edge handles (drag to move) */}
                              <div
                                style={{ ...hStyle, top: '50%', transform: 'translateY(-50%)', left: `${ho}px`, cursor: 'ew-resize' }}
                                onMouseDown={(e) => handleMouseDown(e, 'panel')}
                              />
                              <div
                                style={{ ...hStyle, top: '50%', transform: 'translateY(-50%)', right: `${ho}px`, cursor: 'ew-resize' }}
                                onMouseDown={(e) => handleMouseDown(e, 'panel')}
                              />
                              {/* Label */}
                              <div style={{ position: 'absolute', top: '-28px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#38bdf8', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                                شريط المعلومات — اسحب المقابض لتغيير الارتفاع
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── No image placeholder ── */}
                    {!canvasImageUrl && (
                      <div style={{
                        position: 'absolute',
                        left: `${imageStyle.x}px`,
                        top: `${imageStyle.y}px`,
                        width: `${imageStyle.width}px`,
                        height: `${imageStyle.height}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 5,
                        borderRadius: `${imageStyle.borderRadius}px`,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '2px dashed rgba(255,255,255,0.1)',
                      }}>
                        <div style={{ textAlign: 'center', color: '#ffffff40', fontSize: '24px' }}>
                          <ImageIcon style={{ width: 60, height: 60, margin: '0 auto 12px', opacity: 0.3 }} />
                          <div>اختر مهمة تركيب لعرض الصورة</div>
                        </div>
                      </div>
                    )}

                    {/* Snap Guidelines */}
                    {dragState.activeId && snapGuides.x.map((gx, idx) => (
                      <div
                        data-export-hidden="true"
                        key={`guide-x-${idx}`}
                        style={{
                          position: 'absolute',
                          left: `${gx}px`,
                          top: 0,
                          width: '1px',
                          height: '100%',
                          borderLeft: '2px dashed #c9a84c',
                          zIndex: 99,
                          pointerEvents: 'none',
                        }}
                      />
                    ))}
                    {dragState.activeId && snapGuides.y.map((gy, idx) => (
                      <div
                        data-export-hidden="true"
                        key={`guide-y-${idx}`}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: `${gy}px`,
                          width: '100%',
                          height: '1px',
                          borderTop: '2px dashed #c9a84c',
                          zIndex: 99,
                          pointerEvents: 'none',
                        }}
                      />
                    ))}

                    {/* ── Info Bar ── */}
                    {glassPanel.visible && (
                      <div
                        onMouseDown={(e) => handleMouseDown(e, 'panel')}
                        onDoubleClick={() => { setPanelTransformActive(true); setSelectedLayerId('panel'); setSelectedLayerIds(['panel']); }}
                        style={{
                          position: 'absolute',
                          left: `${glassPanel.x}px`,
                          top: `${glassPanel.y}px`,
                          width: `${glassPanel.width}px`,
                          height: `${glassPanel.height}px`,
                          backgroundColor: 'transparent',
                          backdropFilter: 'none',
                          WebkitBackdropFilter: 'none',
                          border: glassPanel.borderWidth > 0 ? `${glassPanel.borderWidth}px solid ${glassPanel.borderColor}` : 'none',
                          borderRadius: `${glassPanel.borderRadius}px`,
                          zIndex: 10,
                          cursor: lockMode ? 'default' : (dragState.activeId === 'panel' ? 'grabbing' : 'grab'),
                          pointerEvents: lockMode ? 'none' : 'auto',
                        }}
                        className={`transition-shadow duration-150 ${!isExporting && !lockMode && selectedLayerId === 'panel' ? 'ring-4 ring-sky-400/60 ring-offset-2 ring-offset-transparent' : ''}`}
                      >
                        {/* Blurred background replica to simulate backdrop-filter (works in Chrome + html2canvas export) */}
                        {(glassPanel.blur ?? 15) > 0 && canvasImageUrl && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            overflow: 'hidden',
                            borderRadius: 'inherit',
                            pointerEvents: 'none',
                            zIndex: 0,
                          }}>
                            <img
                              src={canvasImageUrl}
                              crossOrigin="anonymous"
                              alt=""
                              draggable={false}
                              style={{
                                position: 'absolute',
                                left: `${imageStyle.x - glassPanel.x}px`,
                                top: `${imageStyle.y - glassPanel.y}px`,
                                width: `${imageStyle.width}px`,
                                height: `${imageStyle.height}px`,
                                objectFit: (imageStyle.objectFit as any) || 'cover',
                                objectPosition: 'center',
                                filter: `blur(${glassPanel.blur ?? 15}px)`,
                                transform: 'scale(1.05)',
                                pointerEvents: 'none',
                                userSelect: 'none',
                                display: 'block',
                              }}
                            />
                          </div>
                        )}

                        <div style={{ position: 'absolute', inset: 0, backgroundColor: getRGBAColor(glassPanel.backgroundColor, glassPanel.opacity ?? 0.92), borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1 }} />

                        {/* Divider lines (logo-campaign at 28%, campaign-size at 60%, size-contact at 78%) */}
                        <div style={{ position: 'absolute', left: '28%', top: '12%', height: '76%', width: '1px', backgroundColor: '#ffffff15', zIndex: 3 }} />
                        <div style={{ position: 'absolute', left: '60%', top: '12%', height: '76%', width: '1px', backgroundColor: '#ffffff15', zIndex: 3 }} />
                        <div style={{ position: 'absolute', left: '78%', top: '12%', height: '76%', width: '1px', backgroundColor: '#ffffff15', zIndex: 3 }} />

                        {/* Canvas elements inside info bar */}
                        {infoPanelTexts.map((el) => {
                          if (!el.visible) return null;
                          return (
                            <div
                              key={el.id}
                              data-element-id={el.id}
                              data-alignment={el.alignment || 'right'}
                              onMouseDown={(e) => handleMouseDown(e, el.id)}
                              style={{
                                position: 'absolute',
                                left: `${el.x}px`,
                                top: `${el.y}px`,
                                width: el.type === 'image' && el.width ? `${el.width}px` : 'max-content',
                                minWidth: el.type === 'image' && el.width ? `${el.width}px` : 'max-content',
                                height: el.type === 'image' && el.height ? `${el.height}px` : 'auto',
                                transform: getAlignmentTransform(el.alignment || 'right'),
                                cursor: lockMode ? 'default' : (dragState.activeId === el.id ? 'grabbing' : 'grab'),
                                pointerEvents: lockMode ? 'none' : 'auto',
                                zIndex: 20,
                                boxSizing: el.type === 'image' ? 'content-box' : 'border-box',
                              }}
                              className={`transition-shadow p-1 rounded ${
                                isExporting ? '' :
                                !lockMode && selectedLayerId === el.id
                                  ? 'ring-2 ring-primary bg-primary/10 shadow-lg'
                                  : !lockMode && selectedLayerIds.includes(el.id)
                                  ? 'ring-2 ring-amber-400/70 bg-amber-400/10'
                                  : ''
                              }`}
                            >
                              {el.type === 'image' ? (
                                <img
                                    src={fixSvgDataUrl(el.id === 'company_logo' && companyInfo.logoUrl ? companyInfo.logoUrl : (el.url || ''))}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: `${el.borderRadius || 0}px`,
                                    objectFit: 'contain',
                                    pointerEvents: 'none',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    flexShrink: 0,
                                    display: 'block',
                                  }}
                                />
                              ) : el.type === 'icon' ? (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: `${(el.iconSize || 24) + 12}px`,
                                  height: `${(el.iconSize || 24) + 12}px`,
                                  borderRadius: el.iconBackground ? '50%' : '0%',
                                  backgroundColor: el.iconBackground ? (el.iconBgColor || '#ffffff') : 'transparent',
                                }}>
                                  {renderLucideIcon(el.iconName || 'phone', el.iconColor || '#ffffff', el.iconSize || 24)}
                                </div>
                              ) : (
                                // Text element
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  fontSize: `${el.fontSize}px`,
                                  color: el.fontColor,
                                  fontWeight: el.fontWeight,
                                  textAlign: el.alignment,
                                  whiteSpace: 'nowrap',
                                  direction: 'rtl',
                                  lineHeight: 1.4,
                                  fontFamily: el.fontFamily || 'inherit',
                                }}>
                                  {el.icon && el.icon !== 'none' && (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: `${(el.iconSize || el.fontSize || 24) + 8}px`,
                                      height: `${(el.iconSize || el.fontSize || 24) + 8}px`,
                                      borderRadius: el.iconBackground ? '50%' : '0%',
                                      backgroundColor: el.iconBackground ? (el.iconBgColor || '#ffffff') : 'transparent',
                                      flexShrink: 0,
                                    }}>
                                      {renderLucideIcon(el.icon, el.iconColor || el.fontColor || '#ffffff', el.iconSize || el.fontSize || 18)}
                                    </div>
                                  )}
                                  <span>{renderTextContent(el)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Location strip ── */}
                    {locationStrip.visible && (
                      <div
                        data-location-strip="true"
                        style={{
                          position: 'absolute',
                          left: 0, bottom: 0,
                          width: '100%',
                          height: `${locationStrip.height}px`,
                          backgroundColor: 'transparent',
                          backdropFilter: 'none',
                          WebkitBackdropFilter: 'none',
                          border: (locationStrip.borderWidth ?? 0) > 0 ? `${locationStrip.borderWidth}px solid ${locationStrip.borderColor || '#ffffff20'}` : 'none',
                          borderRadius: `${locationStrip.borderRadius ?? 0}px`,
                          zIndex: 15,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '16px',
                          direction: 'rtl',
                        }}
                        onMouseDown={(e) => {
                          if (lockMode) return;
                          e.stopPropagation();
                          setSelectedLayerId('location');
                          setSelectedLayerIds(['location']);
                        }}
                        className={`transition-shadow duration-150 ${
                          !isExporting && !lockMode && selectedLayerId === 'location'
                            ? 'ring-4 ring-sky-400/60 ring-offset-2 ring-offset-transparent'
                            : ''
                        }`}
                      >
                        {/* Blurred background replica to simulate backdrop-filter (works in Chrome + html2canvas export) */}
                        {(locationStrip.blur ?? 10) > 0 && canvasImageUrl && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            overflow: 'hidden',
                            borderRadius: 'inherit',
                            pointerEvents: 'none',
                            zIndex: 0,
                          }}>
                            <img
                              src={canvasImageUrl}
                              crossOrigin="anonymous"
                              alt=""
                              draggable={false}
                              style={{
                                position: 'absolute',
                                left: `${imageStyle.x}px`,
                                top: `${imageStyle.y - (canvasHeight - (locationStrip.height ?? 120))}px`,
                                width: `${imageStyle.width}px`,
                                height: `${imageStyle.height}px`,
                                objectFit: (imageStyle.objectFit as any) || 'cover',
                                objectPosition: 'center',
                                filter: `blur(${locationStrip.blur ?? 10}px)`,
                                transform: 'scale(1.05)',
                                pointerEvents: 'none',
                                userSelect: 'none',
                                display: 'block',
                              }}
                            />
                          </div>
                        )}

                        <div style={{ position: 'absolute', inset: 0, backgroundColor: getRGBAColor(locationStrip.backgroundColor, locationStrip.opacity ?? 0.9), borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1 }} />

                        {/* Pin icon */}
                        <div style={{ position: 'absolute', right: 50, top: '50%', transform: 'translateY(-50%)', zIndex: 3 }}>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill={locationStrip.textColor} stroke="none">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" fill={locationStrip.backgroundColor} />
                          </svg>
                        </div>

                        {locationTexts.map((el) => {
                          if (!el.visible) return null;
                          return (
                            <div
                              key={el.id}
                              data-element-id={el.id}
                              data-alignment={el.alignment || 'right'}
                              onMouseDown={(e) => handleMouseDown(e, el.id)}
                              style={{
                                position: 'absolute',
                                left: `${el.x}px`,
                                top: `${el.y}px`,
                                width: el.type === 'image' && el.width ? `${el.width}px` : 'max-content',
                                minWidth: el.type === 'image' && el.width ? `${el.width}px` : 'max-content',
                                height: el.type === 'image' && el.height ? `${el.height}px` : 'auto',
                                transform: getAlignmentTransform(el.alignment || 'right'),
                                cursor: lockMode ? 'default' : (dragState.activeId === el.id ? 'grabbing' : 'grab'),
                                pointerEvents: lockMode ? 'none' : 'auto',
                                zIndex: 20,
                                boxSizing: el.type === 'image' ? 'content-box' : 'border-box',
                              }}
                              className={`transition-shadow p-1 rounded ${!isExporting && !lockMode && selectedLayerId === el.id ? 'ring-2 ring-primary bg-black/10' : ''}`}
                            >
                              {el.type === 'image' ? (
                                <img
                                  src={fixSvgDataUrl(el.url || '')}
                                  crossOrigin="anonymous"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: `${el.borderRadius || 0}px`,
                                    objectFit: 'contain',
                                    pointerEvents: 'none',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    flexShrink: 0,
                                    display: 'block',
                                  }}
                                />
                              ) : el.type === 'icon' ? (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: `${(el.iconSize || 24) + 12}px`,
                                  height: `${(el.iconSize || 24) + 12}px`,
                                  borderRadius: el.iconBackground ? '50%' : '0%',
                                  backgroundColor: el.iconBackground ? (el.iconBgColor || '#ffffff') : 'transparent',
                                }}>
                                  {renderLucideIcon(el.iconName || 'phone', el.iconColor || '#ffffff', el.iconSize || 24)}
                                </div>
                              ) : (
                                // Text element
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  fontSize: `${el.fontSize}px`,
                                  color: locationStrip.textColor,
                                  fontFamily: el.fontFamily || 'inherit',
                                  fontWeight: el.fontWeight,
                                  textAlign: el.alignment,
                                  whiteSpace: 'nowrap',
                                  direction: 'rtl',
                                  lineHeight: 1.4,
                                }}>
                                  {el.icon && el.icon !== 'none' && (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: `${(el.iconSize || el.fontSize || 24) + 8}px`,
                                      height: `${(el.iconSize || el.fontSize || 24) + 8}px`,
                                      borderRadius: el.iconBackground ? '50%' : '0%',
                                      backgroundColor: el.iconBackground ? (el.iconBgColor || '#ffffff') : 'transparent',
                                      flexShrink: 0,
                                    }}>
                                      {renderLucideIcon(el.icon, el.iconColor || locationStrip.textColor || '#ffffff', el.iconSize || el.fontSize || 18)}
                                    </div>
                                  )}
                                  <span>{renderTextContent(el)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

              </div>
            </div>
          </div>

          {/* ── Central Quick Dashboard Controls (Positioned Below Preview) ── */}
          {showQuickControls ? (
            <div className="w-full max-w-4xl mx-auto px-2">
              <Card className="border-border/40 shadow-xl bg-card/90 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl relative">
                {/* Collapse button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowQuickControls(false)}
                  className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/95 shadow-md flex items-center justify-center border border-border/20"
                  title="إخفاء اللوحة"
                >
                  <X className="h-3 w-3" />
                </Button>
                {/* Group 1: Zoom In / Out */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-bold">الزووم:</span>
                  <div className="flex items-center border rounded-xl p-0.5 bg-muted/40 border-border/50">
                    <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.1, z - 0.05))} className="h-7 w-7 rounded-lg" title="تصغير">
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs font-bold font-mono px-2 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                    <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(2, z + 0.05))} className="h-7 w-7 rounded-lg" title="تكبير">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setZoom(0.38)} className="h-7 px-1.5 text-[10px] rounded-lg font-bold" title="إعادة تعيين الزوم">
                      38%
                    </Button>
                  </div>
                </div>

                <div className="h-5 w-px bg-border/60" />

                {/* Group 2: Photo / Item Navigation */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-bold">اللوحة:</span>
                  <div className="flex items-center gap-1 bg-muted/40 border border-border/50 rounded-xl p-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={!canGoPrev} onClick={goToPrevItem} title="السابق">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs font-bold px-2 select-none text-foreground">
                      {currentItemIndex + 1} / {taskItems.length || 1}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={!canGoNext} onClick={goToNextItem} title="التالي">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="h-5 w-px bg-border/60" />

                {/* Group 3: Face Switcher */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-bold">الوجه:</span>
                  <div className="flex bg-muted/40 border border-border/50 rounded-xl p-0.5 gap-0.5">
                    <Button
                      variant={imageSource === 'face_a' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 text-[10px] px-2.5 font-bold rounded-lg"
                      onClick={() => setImageSource('face_a')}
                      disabled={selectedItemDetails ? !selectedItemDetails.installed_face_a : false}
                    >
                      الأمامي
                    </Button>
                    <Button
                      variant={imageSource === 'face_b' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 text-[10px] px-2.5 font-bold rounded-lg"
                      onClick={() => setImageSource('face_b')}
                      disabled={selectedItemDetails ? !selectedItemDetails.installed_face_b : false}
                    >
                      الخلفي
                    </Button>
                  </div>
                </div>

                <div className="h-5 w-px bg-border/60" />

                {/* Group 4: Download & Upload */}
                <div className="flex items-center gap-1.5">
                  <Label
                    className="flex items-center justify-center gap-1 h-8 px-2.5 border border-border/60 hover:bg-accent/40 rounded-xl cursor-pointer text-[10px] font-bold transition-all"
                  >
                    <Upload className="h-3 w-3" />
                    <span>رفع صورة</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </Label>

                  <Button
                    onClick={handleExportCard}
                    size="sm"
                    className="h-8 gap-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg text-[10px]"
                  >
                    <Download className="h-3 w-3" />
                    تحميل الصورة
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex justify-center w-full py-1">
              <Button
                onClick={() => setShowQuickControls(true)}
                className="shadow-xl bg-card/95 hover:bg-accent border border-border/50 text-foreground gap-1.5 px-4 py-2.5 rounded-full font-bold text-[11px] backdrop-blur-md transition-all hover:scale-105"
              >
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>إظهار لوحة التحكم السريعة</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
