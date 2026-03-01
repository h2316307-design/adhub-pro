import { useState, useCallback } from 'react';
import { useImageGallery, type GalleryTask, type GalleryFilter } from '@/hooks/useImageGallery';
import { exportTasksAsZip, downloadBlob } from '@/utils/galleryZipExport';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Search, Download, Archive, ArchiveRestore, Image as ImageIcon, 
  FolderDown, Eye, EyeOff, CheckSquare, Loader2, Images, Paintbrush, Hammer,
  ChevronLeft, ChevronRight, X, ZoomIn
} from 'lucide-react';

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
import { toast } from 'sonner';

export default function ImageGallery() {
  const { tasks, loading, filter, setFilter, searchQuery, setSearchQuery, toggleArchive } = useImageGallery();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [lightbox, setLightbox] = useState<{ images: { url: string; label: string }[]; index: number } | null>(null);

  const toggleSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.taskId)));
    }
  };

  const handleExport = useCallback(async (mode: 'all' | 'designs_only') => {
    const tasksToExport = selectedTasks.size > 0 
      ? tasks.filter(t => selectedTasks.has(t.taskId))
      : tasks;
    
    if (!tasksToExport.length) {
      toast.error('لا توجد مهام للتصدير');
      return;
    }

    setExporting(true);
    setExportProgress({ current: 0, total: 0 });

    try {
      const blob = await exportTasksAsZip(tasksToExport, mode, (current, total) => {
        setExportProgress({ current, total });
      });

      const filename = mode === 'designs_only' 
        ? `التصاميم_${new Date().toLocaleDateString('ar-LY')}.zip`
        : `معرض_الصور_${new Date().toLocaleDateString('ar-LY')}.zip`;

      downloadBlob(blob, filename);
      toast.success(`تم تنزيل ${filename}`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setExporting(false);
    }
  }, [selectedTasks, tasks]);

  const handleArchiveSelected = async () => {
    for (const taskId of selectedTasks) {
      await toggleArchive(taskId);
    }
    setSelectedTasks(new Set());
    toast.success('تم تحديث الأرشيف');
  };

  const filterTabs: { value: GalleryFilter; label: string; icon: any }[] = [
    { value: 'all', label: 'الكل', icon: Images },
    { value: 'designs', label: 'التصاميم', icon: Paintbrush },
    { value: 'installations', label: 'صور التركيب', icon: Hammer },
    { value: 'completed', label: 'المكتملة', icon: CheckSquare },
    { value: 'archived', label: 'الأرشيف', icon: Archive },
  ];

  const openLightbox = (images: { url: string; label: string }[], index: number) => {
    setLightbox({ images, index });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
          <Loader2 className="h-8 w-8 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-muted-foreground text-sm animate-pulse">جاري تحميل المعرض...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 md:px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">معرض الصور</h1>
                <p className="text-xs text-muted-foreground">
                  {tasks.length} مهمة • اعرض وحمّل صور التصاميم والتركيب
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedTasks.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleArchiveSelected} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  {filter === 'archived' ? <ArchiveRestore className="h-4 w-4 ml-1" /> : <Archive className="h-4 w-4 ml-1" />}
                  {filter === 'archived' ? 'إلغاء الأرشفة' : 'أرشفة'}
                  <Badge className="mr-1 bg-amber-500/20 text-amber-400 border-0">{selectedTasks.size}</Badge>
                </Button>
              )}
              <Button 
                variant="outline" size="sm" 
                onClick={() => handleExport('designs_only')}
                disabled={exporting}
                className="border-primary/30 hover:bg-primary/10"
              >
                <Paintbrush className="h-4 w-4 ml-1" />
                تنزيل التصاميم فقط
              </Button>
              <Button 
                size="sm" 
                onClick={() => handleExport('all')}
                disabled={exporting}
                className="bg-primary hover:bg-primary/90"
              >
                <FolderDown className="h-4 w-4 ml-1" />
                تنزيل الكل ZIP
              </Button>
            </div>
          </div>

          {/* Export progress */}
          {exporting && (
            <div className="mt-3 flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <Progress value={exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0} className="flex-1" />
              <span className="text-xs text-muted-foreground font-mono">
                {exportProgress.current}/{exportProgress.total}
              </span>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center mt-4">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as GalleryFilter)} className="flex-1">
              <TabsList className="bg-muted/50 p-1 h-auto">
                {filterTabs.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex gap-2 items-center">
              <div className="relative w-full md:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالعميل، نوع الإعلان، رقم العقد..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pr-9 bg-muted/30 border-border/50 text-sm"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={selectAll} className="shrink-0 text-xs">
                <CheckSquare className="h-4 w-4 ml-1" />
                {selectedTasks.size === tasks.length ? 'إلغاء' : 'تحديد الكل'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 py-6">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground font-medium">لا توجد صور مطابقة للفلتر المحدد</p>
            <p className="text-xs text-muted-foreground/60 mt-1">جرّب تغيير الفلتر أو البحث</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tasks.map(task => (
              <TaskGalleryCard
                key={task.taskId}
                task={task}
                selected={selectedTasks.has(task.taskId)}
                onToggleSelect={() => toggleSelection(task.taskId)}
                onArchive={() => toggleArchive(task.taskId)}
                onImageClick={openLightbox}
                onExportTask={async (mode) => {
                  setExporting(true);
                  try {
                    const blob = await exportTasksAsZip([task], mode, (c, t) => setExportProgress({ current: c, total: t }));
                    downloadBlob(blob, `${task.customerName} - ${task.adType}.zip`);
                    toast.success('تم التنزيل');
                  } catch { toast.error('خطأ في التنزيل'); }
                  finally { setExporting(false); }
                }}
                filter={filter}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox with navigation */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden">
          {lightbox && (
            <div className="relative flex items-center justify-center min-h-[60vh]">
              <img 
                src={lightbox.images[lightbox.index].url} 
                alt={lightbox.images[lightbox.index].label} 
                className="max-w-full max-h-[85vh] object-contain" 
              />
              
              {/* Navigation */}
              {lightbox.images.length > 1 && (
                <>
                  <button
                    onClick={() => setLightbox(prev => prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : null)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setLightbox(prev => prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* Label & counter */}
              <div className="absolute bottom-4 inset-x-0 flex justify-center">
                <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
                  <span className="text-white/90 text-sm">{lightbox.images[lightbox.index].label}</span>
                  {lightbox.images.length > 1 && (
                    <span className="text-white/50 text-xs">{lightbox.index + 1} / {lightbox.images.length}</span>
                  )}
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-4 left-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Task Card Component ----
function TaskGalleryCard({ 
  task, selected, onToggleSelect, onArchive, onImageClick, onExportTask, filter 
}: {
  task: GalleryTask;
  selected: boolean;
  onToggleSelect: () => void;
  onArchive: () => void;
  onImageClick: (images: { url: string; label: string }[], index: number) => void;
  onExportTask: (mode: 'all' | 'designs_only') => void;
  filter: GalleryFilter;
}) {
  const [expanded, setExpanded] = useState(false);

  const designImages: { url: string; label: string }[] = [];
  const installImages: { url: string; label: string }[] = [];

  task.designs.forEach(d => {
    if (d.faceAUrl) designImages.push({ url: d.faceAUrl, label: `${d.designName} - وجه أ` });
    if (d.faceBUrl) designImages.push({ url: d.faceBUrl, label: `${d.designName} - وجه ب` });
    if (d.cutoutUrl) designImages.push({ url: d.cutoutUrl, label: `${d.designName} - مجسم` });
  });

  task.items.forEach(item => {
    // Find matching design name for this item
    const matchedDesign = task.designs.find(d => 
      (item.designFaceA && (d.faceAUrl === item.designFaceA || d.faceBUrl === item.designFaceA)) ||
      (item.designFaceB && (d.faceAUrl === item.designFaceB || d.faceBUrl === item.designFaceB))
    );
    const designLabel = matchedDesign?.designName || '';

    if (item.designFaceA && !designImages.find(d => d.url === item.designFaceA)) {
      designImages.push({ url: item.designFaceA, label: `${item.billboardName} - تصميم أ` });
    }
    if (item.designFaceB && !designImages.find(d => d.url === item.designFaceB)) {
      designImages.push({ url: item.designFaceB, label: `${item.billboardName} - تصميم ب` });
    }
    const adTypeLabel = task.adType ? ` | ${task.adType}` : '';
    const installDesignSuffix = designLabel ? ` (${designLabel})` : '';
    if (item.installedFaceA) installImages.push({ url: item.installedFaceA, label: `${item.billboardName} - تركيب أ${installDesignSuffix}${adTypeLabel}` });
    if (item.installedFaceB) installImages.push({ url: item.installedFaceB, label: `${item.billboardName} - تركيب ب${installDesignSuffix}${adTypeLabel}` });
  });

  const allImages = [...designImages, ...installImages];
  const showDesigns = filter === 'all' || filter === 'designs' || filter === 'completed' || filter === 'archived';
  const showInstall = filter === 'all' || filter === 'installations' || filter === 'completed' || filter === 'archived';

  const visibleDesigns = expanded ? designImages : designImages.slice(0, 6);
  const visibleInstall = expanded ? installImages : installImages.slice(0, 6);
  const hasMore = (designImages.length > 6 || installImages.length > 6);

  const statusConfig = {
    completed: { label: 'مكتمل', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    in_progress: { label: 'جاري', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    pending: { label: 'معلق', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  };

  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className={`
      rounded-xl border transition-all duration-200
      ${selected ? 'border-primary/60 bg-primary/5 shadow-lg shadow-primary/5' : 'border-border/40 bg-card hover:border-border/80'}
      ${task.isArchived ? 'opacity-60' : ''}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="pt-0.5">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="border-border/60" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground text-sm">{task.customerName}</h3>
              <span className="text-muted-foreground/60">—</span>
              <span className="text-sm text-muted-foreground">{task.adType}</span>
              <Badge variant="outline" className="text-[10px] font-mono border-border/40 bg-muted/30">عقد {task.contractId}</Badge>
              <Badge className={`text-[10px] border ${status.className}`}>{status.label}</Badge>
              {task.isArchived && <Badge variant="secondary" className="text-[10px]">مؤرشف</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
              فريق: <span className="text-primary/80">{task.teamName}</span>
              {' • '}{task.items.length} لوحة
              {' • '}{designImages.length} تصميم
              {' • '}{installImages.length} صورة تركيب
            </p>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onExportTask('all')} title="تنزيل ZIP">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onArchive} title={task.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}>
            {task.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Images */}
      <div className="px-4 pb-4 space-y-4">
        {/* Designs */}
        {showDesigns && designImages.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Paintbrush className="h-3 w-3 text-primary/70" />
              <span className="text-xs font-medium text-muted-foreground">التصاميم ({designImages.length})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
              {visibleDesigns.map((img, i) => (
                <GalleryThumbnail key={`d-${i}`} url={img.url} label={img.label} onClick={() => onImageClick(designImages, i)} />
              ))}
            </div>
          </div>
        )}

        {/* Installations */}
        {showInstall && installImages.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Hammer className="h-3 w-3 text-emerald-500/70" />
              <span className="text-xs font-medium text-muted-foreground">صور التركيب ({installImages.length})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
              {visibleInstall.map((img, i) => (
                <GalleryThumbnail key={`i-${i}`} url={img.url} label={img.label} onClick={() => onImageClick(installImages, i)} />
              ))}
            </div>
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/30"
          >
            {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {expanded ? 'إخفاء' : `عرض كل الصور (${designImages.length + installImages.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Thumbnail ----
function GalleryThumbnail({ url, label, onClick }: { url: string; label: string; onClick: () => void }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error) {
    return (
      <div className="aspect-[4/3] rounded-lg bg-muted/50 flex items-center justify-center border border-border/20">
        <ImageIcon className="h-5 w-5 text-muted-foreground/20" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted/30 border border-border/20 hover:border-primary/40 transition-all duration-200 cursor-pointer"
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 border-2 border-muted-foreground/20 border-t-primary/60 rounded-full animate-spin" />
        </div>
      )}
      <img
        src={url}
        alt={label}
        className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {/* Source badge */}
      {loaded && (() => {
        const source = getImageSource(url);
        return source ? (
          <span className={`absolute top-1 right-1 ${source.color} text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 leading-none`}>
            {source.label}
          </span>
        ) : null;
      })()}
      {/* Zoom overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
        <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
      </div>
      {/* Label */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
        <p className="text-[9px] text-white/90 leading-tight truncate">{label}</p>
      </div>
    </button>
  );
}
