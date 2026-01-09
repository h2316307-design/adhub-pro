import { lazy, startTransition, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Globe } from "lucide-react";
import type { Billboard } from "@/types";
import { MapSkeleton } from "@/components/Map/MapSkeleton";

const GoogleAdminMap = lazy(() => import("@/components/InteractiveMap"));
const OpenStreetMap = lazy(() => import("@/components/Map/OpenStreetBillboardsMap"));

type MapProvider = "google" | "osm";

interface AdminBillboardsMapProps {
  billboards: Billboard[];
  onImageView: (imageUrl: string) => void;
  className?: string;
}

export default function AdminBillboardsMap({ billboards, onImageView, className }: AdminBillboardsMapProps) {
  const [provider, setProvider] = useState<MapProvider>(() => {
    const saved = localStorage.getItem("admin_map_provider");
    return saved === "osm" ? "osm" : "google";
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    localStorage.setItem("admin_map_provider", provider);
    setReady(false);
  }, [provider]);

  const ProviderIcon = useMemo(() => (provider === "google" ? MapIcon : Globe), [provider]);

  return (
    <div className={"relative overflow-hidden rounded-lg border border-border " + (className ?? "")}
      dir="rtl"
    >
      {/* Provider toggle */}
      <div className="absolute top-4 left-4 z-[1100] flex gap-2 pointer-events-auto">
        <Button
          size="sm"
          variant={provider === "google" ? "default" : "outline"}
          onClick={() => startTransition(() => setProvider("google"))}
          className="shadow-lg"
        >
          <MapIcon className="h-4 w-4 ml-2" />
          خرائط قوقل
        </Button>
        <Button
          size="sm"
          variant={provider === "osm" ? "default" : "outline"}
          onClick={() => startTransition(() => setProvider("osm"))}
          className="shadow-lg"
        >
          <Globe className="h-4 w-4 ml-2" />
          OpenStreetMap
        </Button>
      </div>

      {/* Map content with fade-in */}
      <div className="relative">
        <div className={"transition-opacity duration-500 will-change-[opacity] " + (ready ? "opacity-100" : "opacity-0")}
          aria-hidden={!ready}
        >
          <Suspense fallback={<MapSkeleton className="h-[600px]" />}>
            {provider === "google" ? (
              <GoogleAdminMap
                billboards={billboards}
                onImageView={onImageView}
                onReady={() => setReady(true)}
              />
            ) : (
              <OpenStreetMap
                billboards={billboards}
                className="w-full h-[600px]"
                onReady={() => setReady(true)}
              />
            )}
          </Suspense>
        </div>

        {!ready && <MapSkeleton className="h-[600px]" />}
      </div>

      {/* Assistive label */}
      <div className="sr-only">مزوّد الخريطة الحالي: {provider === "google" ? "خرائط قوقل" : "OpenStreetMap"}</div>
    </div>
  );
}
