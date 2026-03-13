import React, { useState } from 'react';
import { useResolvedImage } from '@/utils/imageResolver';
import { cn } from '@/lib/utils';

interface CachedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  fallback?: React.ReactNode;
  showLoader?: boolean;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src: originalSrc,
  className,
  alt = '',
  fallback,
  showLoader = false,
  onError,
  onLoad,
  ...props
}) => {
  const { src: resolvedSrc, isLoading } = useResolvedImage(originalSrc);
  const [hasError, setHasError] = useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError?.(e);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(false);
    onLoad?.(e);
  };

  if (isLoading && showLoader) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!resolvedSrc || hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <span className="text-muted-foreground text-xs">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};
