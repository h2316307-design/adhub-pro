import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Download, Loader2, Image as ImageIcon, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import JSZip from 'jszip';

interface BillboardPhoto {
  id: number;
  name: string;
  imageUrl: string;
  city: string | null;
  municipality: string | null;
  size: string | null;
  status: string | null;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function getExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function getImageSource(url: string): { label: string; color: string } | null {
  if (url.includes('googleusercontent.com') || url.includes('drive.google.com')) return { label: 'Google', color: 'bg-blue-500' };
  if (url.includes('supabase')) return { label: 'Supabase', color: 'bg-emerald-500' };
  if (url.includes('cloudinary')) return { label: 'Cloudinary', color: 'bg-purple-500' };
  if (url.includes('imgur')) return { label: 'Imgur', color: 'bg-green-500' };
  if (url.includes('ibb.co')) return { label: 'ImgBB', color: 'bg-teal-500' };
  if (url.includes('iili.io')) return { label: 'Iili', color: 'bg-cyan-500' };
  if (url.includes('postimg')) return { label: 'PostImg', color: 'bg-orange-500' };
  if (url.includes('facebook') || url.includes('fbcdn')) return { label: 'Facebook', color: 'bg-blue-600' };
  if (url.startsWith('/')) return { label: 'محلي', color: 'bg-gray-500' };
  if (url.startsWith('http')) return { label: 'رابط', color: 'bg-slate-500' };
  return null;
}

export default function BillboardPhotosGallery() {
  const [photos, setPhotos] = useState<BillboardPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

  async function fetchPhotos() {
    setLoading(true);
    try {
      // Fetch billboards and size order in parallel
      const fetchBillboards = async () => {
        let allData: any[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('billboards')
            .select('"ID", "Billboard_Name", "Image_URL", "City", "Municipality", "Size", "Status"')
            .not('Image_URL', 'is', null)
            .neq('Image_URL', '')
            .range(from, from + batchSize - 1);
          if (error) { console.error(error); break; }
          if (!data || data.length === 0) break;
          allData = [...allData, ...data];
          if (data.length < batchSize) break;
          from += batchSize;
        }
        return allData;
      };

      const [allData, sizesRes] = await Promise.all([
        fetchBillboards(),
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
      ]);

      // Build size order map
      const sizeOrderMap = new Map<string, number>();
      (sizesRes.data || []).forEach((s: any, idx: number) => {
        sizeOrderMap.set(s.name, s.sort_order ?? (idx + 1));
      });

      const mapped = allData.map((b: any) => ({
        id: b.ID,
        name: b.Billboard_Name || `لوحة ${b.ID}`,
        imageUrl: b.Image_URL,
        city: b.City,
        municipality: b.Municipality,
        size: b.Size,
        status: b.Status,
      }));

      // Sort by size order, then by ID
      mapped.sort((a, b) => {
        const orderA = sizeOrderMap.get(a.size || '') ?? 999;
        const orderB = sizeOrderMap.get(b.size || '') ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      });

      setPhotos(mapped);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحميل الصور');
    } finally {
      setLoading(false);
    }
  }

  const cities = useMemo(() => [...new Set(photos.map(p => p.city).filter(Boolean))].sort() as string[], [photos]);
  const municipalities = useMemo(() => {
    const filtered = cityFilter !== 'all' ? photos.filter(p => p.city === cityFilter) : photos;
    return [...new Set(filtered.map(p => p.municipality).filter(Boolean))].sort() as string[];
  }, [photos, cityFilter]);

  const filteredPhotos = useMemo(() => {
    let result = photos;
    if (cityFilter !== 'all') result = result.filter(p => p.city === cityFilter);
    if (municipalityFilter !== 'all') result = result.filter(p => p.municipality === municipalityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.id.toString().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.municipality?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [photos, cityFilter, municipalityFilter, searchQuery]);

  async function downloadAllAsZip() {
    if (filteredPhotos.length === 0) { toast.error('لا توجد صور للتحميل'); return; }
    setDownloading(true);
    setDownloadProgress({ current: 0, total: filteredPhotos.length });

    try {
      const zip = new JSZip();
      let processed = 0;

      // Process in parallel batches of 5
      const batchSize = 5;
      for (let i = 0; i < filteredPhotos.length; i += batchSize) {
        const batch = filteredPhotos.slice(i, i + batchSize);
        await Promise.all(batch.map(async (photo) => {
          try {
            const response = await fetch(photo.imageUrl);
            if (!response.ok) return;
            const blob = await response.blob();
            const fileName = `${sanitizeFileName(photo.name)}${getExtension(photo.imageUrl)}`;
            zip.file(fileName, blob);
          } catch { /* skip failed */ }
          processed++;
          setDownloadProgress({ current: processed, total: filteredPhotos.length });
        }));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `صور_اللوحات_${filteredPhotos.length}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`تم تحميل ${filteredPhotos.length} صورة بنجاح`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إنشاء الملف');
    } finally {
      setDownloading(false);
    }
  }

  const lightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-4">
        <div className="max-w-[1800px] mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">معرض صور اللوحات</h1>
              <span className="text-sm text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                {filteredPhotos.length} صورة
              </span>
            </div>
            <Button
              onClick={downloadAllAsZip}
              disabled={downloading || filteredPhotos.length === 0}
              className="gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {downloadProgress.current}/{downloadProgress.total}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  تحميل الكل ({filteredPhotos.length})
                </>
              )}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم اللوحة أو المدينة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={cityFilter} onValueChange={v => { setCityFilter(v); setMunicipalityFilter('all'); }}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder="المدينة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المدن</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="البلدية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل البلديات</SelectItem>
                {municipalities.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[1800px] mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ImageIcon className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">لا توجد صور</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {filteredPhotos.map((photo, idx) => (
              <PhotoCard key={photo.id} photo={photo} onClick={() => setLightboxIndex(idx)} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 bg-black/95 border-none flex flex-col">
          {lightboxPhoto && (
            <>
              <div className="flex items-center justify-between p-3 text-white/90">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{lightboxPhoto.name}</span>
                  {lightboxPhoto.size && <span className="text-xs text-white/50">| {lightboxPhoto.size}</span>}
                  {lightboxPhoto.city && <span className="text-xs text-white/50">| {lightboxPhoto.city}</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-white/50">
                  {lightboxIndex! + 1} / {filteredPhotos.length}
                </div>
              </div>
              <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <img
                  src={lightboxPhoto.imageUrl}
                  alt={lightboxPhoto.name}
                  className="max-w-full max-h-full object-contain"
                />
                {lightboxIndex! > 0 && (
                  <button onClick={() => setLightboxIndex(i => i! - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-colors">
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {lightboxIndex! < filteredPhotos.length - 1 && (
                  <button onClick={() => setLightboxIndex(i => i! + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-colors">
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotoCard({ photo, onClick }: { photo: BillboardPhoto; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted/30 border border-border/30 hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={photo.imageUrl}
        alt={photo.name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Source badge */}
      {loaded && (() => {
        const source = getImageSource(photo.imageUrl);
        return source ? (
          <span className={`absolute top-1.5 right-1.5 ${source.color} text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 leading-none`}>
            {source.label}
          </span>
        ) : null;
      })()}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
        <p className="text-[11px] font-semibold text-white truncate">{photo.name}</p>
        {photo.size && <p className="text-[9px] text-white/60 truncate">{photo.size}</p>}
      </div>
    </button>
  );
}
