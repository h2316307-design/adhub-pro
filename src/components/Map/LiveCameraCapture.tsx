import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, MapPin, Compass, Loader2, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface LiveCaptureMeta {
  lat: number;
  lng: number;
  capturedAt: string;
  direction: number | null;
}

interface LiveCameraCaptureProps {
  onCapture: (file: File, meta: LiveCaptureMeta) => void;
  onClose: () => void;
}

interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number;
}

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** Live camera capture: photos are taken with the phone's GPS and compass, since canvas frames carry no EXIF */
export default function LiveCameraCapture({ onCapture, onClose }: LiveCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const gpsRef = useRef<GpsFix | null>(null);
  const headingRef = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [needsCompassPermission, setNeedsCompassPermission] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('المتصفح لا يدعم الكاميرا. يتطلب الاتصال المشفر (HTTPS).');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        if (!cancelled) setCameraError('تعذر فتح الكاميرا. اسمح للموقع بالوصول إليها ثم أعد المحاولة.');
      }
    };
    startCamera();

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          gpsRef.current = fix;
          setGps(fix);
        },
        () => setGps(null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    }

    const onOrientation = (e: Event) => {
      const o = e as OrientationEventWithCompass;
      const h = typeof o.webkitCompassHeading === 'number'
        ? o.webkitCompassHeading
        : o.alpha !== null ? (360 - o.alpha) % 360 : null;
      if (h !== null) {
        headingRef.current = h;
        setHeading(Math.round(h));
      }
    };
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);

    // iOS needs an explicit permission for the compass, requested from a user tap
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setNeedsCompassPermission(true);
    }

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      window.removeEventListener('deviceorientationabsolute', onOrientation);
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }, []);

  const enableCompass = async () => {
    try {
      const result = await (DeviceOrientationEvent as any).requestPermission();
      if (result !== 'granted') toast.error('لم يُسمح بالوصول إلى البوصلة');
    } catch {
      toast.error('تعذر تفعيل البوصلة');
    } finally {
      setNeedsCompassPermission(false);
    }
  };

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const fix = gpsRef.current;
    if (!video || video.videoWidth === 0) return;
    if (!fix) {
      toast.error('بانتظار تحديد الموقع (GPS) قبل الالتقاط');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      toast.error('تعذر التقاط الصورة');
      return;
    }

    const file = new File([blob], `live_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file, {
      lat: fix.lat,
      lng: fix.lng,
      capturedAt: new Date().toISOString(),
      direction: headingRef.current,
    });
    setCount(c => c + 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }, [onCapture]);

  const gpsGood = gps !== null && gps.accuracy <= 30;

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex flex-col">
      {/* Top bar: GPS and compass status */}
      <div className="flex items-center justify-between gap-2 p-3 bg-black/70 text-white text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`flex items-center gap-1 ${gps ? (gpsGood ? 'text-green-400' : 'text-amber-400') : 'text-red-400'}`}>
            <MapPin className="w-3.5 h-3.5" />
            {gps ? `±${Math.round(gps.accuracy)}م` : 'بانتظار GPS'}
          </span>
          <span className={`flex items-center gap-1 ${heading !== null ? 'text-blue-300' : 'text-white/50'}`}>
            <Compass className="w-3.5 h-3.5" />
            {heading !== null ? `${heading}°` : 'بدون بوصلة'}
          </span>
          {count > 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <Check className="w-3.5 h-3.5" /> {count} صورة
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="إغلاق الكاميرا">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-sm">{cameraError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            {/* Center guide to frame the billboard */}
            <div className="pointer-events-none absolute inset-8 border border-white/20 rounded-2xl" />
          </>
        )}
        <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flash ? 'opacity-70' : 'opacity-0'}`} />
      </div>

      {/* Bottom controls */}
      <div className="p-5 bg-black/70 flex flex-col items-center gap-3">
        {needsCompassPermission && (
          <button onClick={enableCompass} className="text-xs text-blue-300 underline">
            تفعيل البوصلة لتسجيل اتجاه الصورة
          </button>
        )}
        <button
          onClick={capture}
          disabled={!ready || !!cameraError}
          aria-label="التقاط"
          className="w-20 h-20 p-1 rounded-full border-4 border-white disabled:opacity-40 active:scale-95 transition-transform"
        >
          <span className="flex items-center justify-center w-full h-full rounded-full bg-amber-500 hover:bg-amber-600">
            <Camera className="w-7 h-7 text-white" />
          </span>
        </button>
        <p className="text-[11px] text-white/60">
          {gpsGood ? 'جاهز — اضغط للالتقاط' : 'الالتقاط ممكن، لكن الأفضل انتظار دقة 30م أو أقل'}
        </p>
      </div>
    </div>
  );
}
