import { memo } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  Radio, 
  Target,
  Navigation
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
  isSimpleTracking?: boolean;
  onToggleSimpleTracking?: () => void;
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
  isSimpleTracking = false,
  onToggleSimpleTracking,
  className = '',
  isMobile = false
}: MapControlButtonsProps) {
  // أحجام كبيرة للهاتف وملء الشاشة لسهولة اللمس
  const buttonSize = isMobile || isFullscreen ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize = isMobile || isFullscreen ? 'w-6 h-6' : 'w-[18px] h-[18px]';
  const controlButtonClass = `${buttonSize} rounded-xl bg-background/95 hover:bg-background border-2 border-border/60 hover:border-primary/60 text-foreground hover:text-primary transition-all duration-200 shadow-lg active:scale-95 backdrop-blur-md`;

  const buttons = [
    // Fullscreen
    {
      key: 'fullscreen',
      onClick: onToggleFullscreen,
      icon: isFullscreen ? <Minimize2 className={iconSize} /> : <Maximize2 className={iconSize} />,
      tooltip: isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة',
      active: false,
    },
    // Zoom In
    {
      key: 'zoomIn',
      onClick: onZoomIn,
      icon: <ZoomIn className={iconSize} />,
      tooltip: 'تكبير',
      active: false,
    },
    // Zoom Out
    {
      key: 'zoomOut',
      onClick: onZoomOut,
      icon: <ZoomOut className={iconSize} />,
      tooltip: 'تصغير',
      active: false,
    },
    // Layers
    {
      key: 'layers',
      onClick: onToggleLayers,
      icon: <Layers className={iconSize} />,
      tooltip: 'الطبقات',
      active: false,
    },
    // Live Tracking (full mode)
    {
      key: 'tracking',
      onClick: onToggleTracking,
      icon: <Radio className={`${iconSize} ${isTracking ? 'animate-pulse' : ''}`} />,
      tooltip: isTracking ? 'إيقاف التتبع' : 'التتبع المباشر',
      active: isTracking,
      activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500',
    },
    // Simple Tracking (just follow my location)
    ...(onToggleSimpleTracking ? [{
      key: 'simpleTrack',
      onClick: onToggleSimpleTracking,
      icon: <Navigation className={`${iconSize} ${isSimpleTracking ? 'animate-pulse' : ''}`} />,
      tooltip: isSimpleTracking ? 'إيقاف تتبع موقعي' : 'تتبع موقعي',
      active: isSimpleTracking,
      activeClass: 'bg-blue-500/20 border-blue-500/50 text-blue-500',
    }] : []),
    // Center on User
    ...(onCenterOnUser ? [{
      key: 'center',
      onClick: onCenterOnUser,
      icon: <Target className={iconSize} />,
      tooltip: 'موقعي',
      active: false,
    }] : [])
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {buttons.map((button) => (
          <Tooltip key={button.key}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={`${controlButtonClass} ${button.active && (button as any).activeClass ? (button as any).activeClass : ''}`}
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
