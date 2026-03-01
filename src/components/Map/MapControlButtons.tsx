import { memo } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  Radio, 
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MapControlButtonsProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleLayers: () => void;
  isTracking: boolean;
  onToggleTracking: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onShowHelp?: () => void;
  onCenterOnUser?: () => void;
  className?: string;
  isMobile?: boolean;
}

const MapControlButtons = memo(function MapControlButtons({
  isFullscreen,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onToggleLayers,
  isTracking,
  onToggleTracking,
  isRecording,
  onToggleRecording,
  onCenterOnUser,
  className = '',
  isMobile = false
}: MapControlButtonsProps) {
  // أحجام كبيرة وثابتة للهاتف لسهولة اللمس - مثل المستودع المرجعي
  const buttonSize = isMobile ? 'w-11 h-11' : 'w-10 h-10';
  const iconSize = isMobile ? 'w-5 h-5' : 'w-4 h-4';
  const controlButtonClass = `${buttonSize} rounded-lg bg-background/95 hover:bg-background border-2 border-border/60 hover:border-primary/60 text-foreground hover:text-primary transition-all duration-200 shadow-md active:scale-95 backdrop-blur-md`;

  const buttons = [
    // Fullscreen
    {
      key: 'fullscreen',
      onClick: onToggleFullscreen,
      icon: isFullscreen ? <Minimize2 className={iconSize} /> : <Maximize2 className={iconSize} />,
      tooltip: isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة',
      active: false,
      hideOnMobile: false
    },
    // Zoom In
    {
      key: 'zoomIn',
      onClick: onZoomIn,
      icon: <ZoomIn className={iconSize} />,
      tooltip: 'تكبير',
      active: false,
      hideOnMobile: false
    },
    // Zoom Out
    {
      key: 'zoomOut',
      onClick: onZoomOut,
      icon: <ZoomOut className={iconSize} />,
      tooltip: 'تصغير',
      active: false,
      hideOnMobile: false
    },
    // Layers
    {
      key: 'layers',
      onClick: onToggleLayers,
      icon: <Layers className={iconSize} />,
      tooltip: 'الطبقات',
      active: false,
      hideOnMobile: false
    },
    // Live Tracking
    {
      key: 'tracking',
      onClick: onToggleTracking,
      icon: <Radio className={`${iconSize} ${isTracking ? 'animate-pulse' : ''}`} />,
      tooltip: isTracking ? 'إيقاف التتبع' : 'التتبع المباشر',
      active: isTracking,
      activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500',
      hideOnMobile: false
    },
    // Center on User
    ...(onCenterOnUser ? [{
      key: 'center',
      onClick: onCenterOnUser,
      icon: <Target className={iconSize} />,
      tooltip: 'موقعي',
      active: false,
      hideOnMobile: false
    }] : [])
  ];
  // فلترة الأزرار للهاتف
  const visibleButtons = isMobile 
    ? buttons.filter(b => !b.hideOnMobile)
    : buttons;

  // إظهار جميع الأزرار مباشرة دون طي (ثابتة) - مثل المستودع المرجعي
  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {visibleButtons.map((button) => (
          <Tooltip key={button.key}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={`${controlButtonClass} ${button.active && button.activeClass ? button.activeClass : ''}`}
                onClick={button.onClick}
              >
                {button.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-card border-border text-foreground">
              <p className="font-medium text-xs">{button.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
});

export default MapControlButtons;