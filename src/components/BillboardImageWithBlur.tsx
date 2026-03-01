import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface BillboardImageWithBlurProps {
  billboard: any;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

export const BillboardImageWithBlur: React.FC<BillboardImageWithBlurProps> = ({ 
  billboard, 
  className = '', 
  alt = 'صورة اللوحة',
  onClick
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Extract image sources
  const imageName = billboard?.image_name || billboard?.Image_Name;
  const imageUrl = billboard?.Image_URL || billboard?.image || billboard?.billboard_image;

  // Check if imageUrl is actually a URL or just a filename
  const isValidUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('https') || imageUrl.startsWith('blob:'));

  // PRIMARY: External URL (only if it's a real URL)
  const externalUrl = isValidUrl ? imageUrl : null;

  // SECONDARY: Local paths - try multiple combinations
  const localPaths: string[] = [];

  // Try image_name field first
  if (imageName) {
    const cleanImageName = imageName.replace(/^\/image\//, '');
    localPaths.push(`/image/${cleanImageName}`);
  }

  // Try imageUrl as filename if it's not a URL
  if (imageUrl && !isValidUrl) {
    const cleanImageUrl = imageUrl.replace(/^\/image\//, '');
    localPaths.push(`/image/${cleanImageUrl}`);
  }

  // Try billboard name as fallback
  if (billboard?.Billboard_Name || billboard?.name) {
    const billboardName = billboard?.Billboard_Name || billboard?.name;
    localPaths.push(`/image/${billboardName}.jpg`);
    localPaths.push(`/image/${billboardName}.png`);
  }

  // FINAL: Placeholder
  const placeholderSrc = '/placeholder.svg';

  // Get all sources in priority order
  const getSources = () => {
    const sources: string[] = [];
    
    // 1. External URL (if valid)
    if (externalUrl) {
      sources.push(externalUrl);
    }
    
    // 2. Local paths (remove duplicates)
    const uniquePaths = [...new Set(localPaths)];
    uniquePaths.forEach(path => {
      sources.push(path);
    });
    
    // 3. Placeholder
    sources.push(placeholderSrc);
    
    return sources;
  };

  // Initialize with first available source
  useEffect(() => {
    const sources = getSources();
    setHasError(false);
    setLoadAttempt(0);
    setIsLoaded(false);
    if (sources.length > 0) {
      setCurrentSrc(sources[0]);
    }
  }, [externalUrl, imageName, imageUrl]);

  const handleImageError = () => {
    const sources = getSources();
    const nextAttempt = loadAttempt + 1;

    if (nextAttempt < sources.length) {
      setLoadAttempt(nextAttempt);
      setCurrentSrc(sources[nextAttempt]);
    } else {
      setHasError(true);
    }
  };

  const handleImageLoad = () => {
    setHasError(false);
    setIsLoaded(true);
  };

  if (!currentSrc) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <span className="text-muted-foreground text-sm">لا توجد صورة</span>
      </div>
    );
  }

  const isPlaceholder = currentSrc === placeholderSrc || hasError;

  return (
    <div 
      className={cn("relative overflow-hidden", className)}
      onClick={onClick}
    >
      {/* Blurred background layer */}
      {!isPlaceholder && (
        <div className="absolute inset-0">
          <img
            src={currentSrc}
            alt=""
            className="w-full h-full object-cover scale-110 blur-lg"
            loading="lazy"
            aria-hidden="true"
          />
          {/* Dark overlay for better contrast */}
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      
      {/* Main image layer - object-contain to show full image */}
      <img
        src={currentSrc}
        alt={alt}
        className={cn(
          "relative w-full h-full transition-opacity duration-300",
          isPlaceholder ? "object-cover" : "object-contain",
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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
