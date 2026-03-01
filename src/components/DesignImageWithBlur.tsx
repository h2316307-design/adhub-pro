import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DesignImageWithBlurProps {
  src: string;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

export const DesignImageWithBlur: React.FC<DesignImageWithBlurProps> = ({ 
  src, 
  className = '', 
  alt = 'التصميم',
  onClick
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  const handleImageError = () => {
    setHasError(true);
  };

  const handleImageLoad = () => {
    setHasError(false);
    setIsLoaded(true);
  };

  if (!src || hasError) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <span className="text-muted-foreground text-sm">لا يوجد تصميم</span>
      </div>
    );
  }

  return (
    <div 
      className={cn("relative overflow-hidden", className)}
      onClick={onClick}
    >
      {/* Blurred background layer - تحسين الضبابية */}
      <div className="absolute inset-0">
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover scale-150 blur-2xl opacity-60"
          loading="lazy"
          aria-hidden="true"
        />
        {/* Dark overlay for better contrast */}
        <div className="absolute inset-0 bg-black/50" />
      </div>
      
      {/* Main image layer - object-contain to show full image */}
      <img
        src={src}
        alt={alt}
        className={cn(
          "relative w-full h-full transition-opacity duration-300 object-contain",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
        style={{ 
          objectPosition: 'center',
          zIndex: 1
        }}
      />

      {/* Loading state */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-0">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
