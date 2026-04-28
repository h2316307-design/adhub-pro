import { memo } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
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
  isTracking?: boolean;
  onToggleTracking?: () => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
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
  onCenterOnUser,
  isSimpleTracking = false,
  onToggleSimpleTracking,
  className = '',
  isMobile = false
}: MapControlButtonsProps) {
  const buttonSize = isMobile ? 'w-9 h-9' : isFullscreen ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize = isMobile ? 'w-4 h-4' : isFullscreen ? 'w-6 h-6' : 'w-5 h-5';
  const controlButtonClass = `${buttonSize} rounded-xl bg-background/95 hover:bg-background border border-border/50 hover:border-primary/60 text-foreground hover:text-primary transition-all duration-200 shadow-md active:scale-90 backdrop-blur-lg`;

  const buttons = [
    {
      key: 'fullscreen',
      onClick: onToggleFullscreen,
      icon: isFullscreen ? <Minimize2 className={iconSize} /> : <Maximize2 className={iconSize} />,
      tooltip: isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة',
      activeClass: '',
    },
    {
      key: 'zoomIn',
      onClick: onZoomIn,
      icon: <ZoomIn className={iconSize} />,
      tooltip: 'تكبير',
      activeClass: '',
    },
    {
      key: 'zoomOut',
      onClick: onZoomOut,
      icon: <ZoomOut className={iconSize} />,
      tooltip: 'تصغير',
      activeClass: '',
    },
    {
      key: 'layers',
      onClick: onToggleLayers,
      icon: <Layers className={iconSize} />,
      tooltip: 'الطبقات',
      activeClass: '',
    },
    // Center on user (one-time)
    ...(onCenterOnUser ? [{
      key: 'center',
      onClick: onCenterOnUser,
      icon: <Target className={iconSize} />,
      tooltip: 'موقعي',
      activeClass: '',
    }] : []),
    // Live tracking toggle
    ...(onToggleSimpleTracking ? [{
      key: 'liveTrack',
      onClick: onToggleSimpleTracking,
      icon: <Navigation className={`${iconSize} ${isSimpleTracking ? '' : ''}`} />,
      tooltip: isSimpleTracking ? 'إيقاف التتبع' : 'تتبع مباشر',
      activeClass: isSimpleTracking ? 'bg-blue-500 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)] animate-pulse' : '',
    }] : []),
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex flex-col gap-1 ${className}`}>
        {buttons.map((button) => (
          <Tooltip key={button.key}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={`${controlButtonClass} ${button.activeClass}`}
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
