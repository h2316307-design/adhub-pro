import { BillboardCardFrame, CardStatusBadge } from '@/components/billboards/card/BillboardCardFrame';
import { BillboardFaceMedia } from '@/components/billboards/card/BillboardFaceMedia';
import { InstallationFaceSelector } from './InstallationFaceSelector';
import { getAvailableFacesCount, getInstallationFaceIndices } from '@/lib/installationFaces';
import { saveInstallationFaceSelection } from '@/services/installationFaceSelection';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { BoardMediaEditor } from './BoardMediaEditor';
import { Camera, CheckCircle2, Clock, ImageIcon, Settings2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export function TaskBoardCard({ item, billboard, taskType, contractId, design, selected, printActive, paused, replacement, onSelect, onPhoto, onManage, onPreview, onRefresh, taskDesigns = [], adType, editRequest, horizontal = false }: {
  item: any; billboard: any; taskType?: string; contractId?: number; design?: any; selected: boolean;
  printActive: boolean; paused?: boolean; replacement?: boolean; onSelect: (checked: boolean) => void;
  onPhoto: () => void; onManage: () => void; onPreview: (url: string) => void;
  onRefresh?: () => void; taskDesigns?: any[]; adType?: string; editRequest?: {mode: 'design' | 'photos'; nonce: number};
  horizontal?: boolean;
}) {
  const [editorMode, setEditorMode] = useState<'design' | 'photos' | null>(null);
  useEffect(() => { if (editRequest) setEditorMode(editRequest.mode); }, [editRequest]);
  const done = item.status === 'completed';
  const image = done ? item.installed_image_face_a_url || item.installed_image_url || billboard?.Image_URL : billboard?.Image_URL;
  const selectedFaces = getInstallationFaceIndices(item, billboard, taskType);
  const maxFaces = getAvailableFacesCount(billboard);
  const [savingFaces, setSavingFaces] = useState(false);
  const designPreviews = selectedFaces.map(face => ({ face, url: face === 1 ? (item.design_face_a || design?.design_face_a_url) : face === 2 ? (item.design_face_b || design?.design_face_b_url) : null }));
  const changeFaces = async (selection: number[]) => {
    setSavingFaces(true);
    try {
      await saveInstallationFaceSelection({ id: item.id, taskId: item.task_id, maxFaces }, selection);
      toast.success('تم حفظ أوجه التركيب وتحديث التكاليف'); onRefresh?.();
    } catch (error: any) { toast.error(error.message || 'تعذر حفظ أوجه التركيب'); }
    finally { setSavingFaces(false); }
  };
  const name = billboard?.Billboard_Name || `لوحة #${item.billboard_id}`;
  const landmark = String(billboard?.Nearest_Landmark || billboard?.Nearest_landmark || billboard?.location || '').trim();
  const district = String(billboard?.District || billboard?.district || billboard?.Area || billboard?.area || '').trim();
  const municipality = String(billboard?.Municipality || billboard?.municipality || billboard?.Municipality_Name || '').trim();
  return <BillboardCardFrame horizontal={horizontal} code={name} size={billboard?.Size} tone={selected ? 'selected' : 'default'} title={landmark || name}
    district={district} municipality={municipality} city={billboard?.City} headerExtra={contractId ? <span className="ms-auto text-[11px] text-muted-foreground">عقد #{contractId}</span> : undefined}
    headerActions={<><Checkbox checked={selected} onCheckedChange={value => onSelect(value === true)} aria-label={`تحديد ${name}`} /><Button size="icon" variant="ghost" className="h-10 w-10 cursor-pointer" onClick={onManage} aria-label="إدارة اللوحة"><Settings2 className="h-4 w-4" /><span className="sr-only">إدارة اللوحة</span></Button></>}
    image={<button type="button" className="h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => image && onPreview(image)} aria-label={`عرض صورة ${name}`} disabled={!image}>
      {image ? <img src={image} alt={name} className="h-full w-full object-cover" loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }} /> : <span className="flex h-full items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></span>}
    </button>}
    statusBadges={<CardStatusBadge kind={done ? 'available' : 'warning'} icon={done ? CheckCircle2 : Clock} label={done ? 'مكتملة' : 'بانتظار التركيب'} />}>
    <div className="flex flex-col gap-1 text-[11px]">
      <span className="text-muted-foreground"><span className="font-semibold">أقرب نقطة دالة:</span> {landmark || 'غير محددة'}</span>
    </div>
    {(printActive || paused || replacement) && <div className="flex flex-wrap gap-2 text-[11px]">{printActive && <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">مع الطباعة</span>}{paused && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-600">موقوفة</span>}{replacement && <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">بديلة</span>}</div>}
    <InstallationFaceSelector maxFaces={maxFaces} selectedFaces={selectedFaces} disabled={savingFaces || !onRefresh} onChange={changeFaces} />
    {editorMode && onRefresh ? <BoardMediaEditor key={`${item.id}-${editorMode}`} mode={editorMode} item={item} billboard={billboard} taskType={taskType} designs={taskDesigns} contractId={contractId} adType={adType} onRefresh={onRefresh} onClose={() => setEditorMode(null)} /> : <>
      {design?.design_name && <p className="text-xs text-muted-foreground">{design.design_name}</p>}
      <BillboardFaceMedia faces={designPreviews.map(({ face, url }) => ({ face, design: url }))} showInstalled={false} onPreview={onPreview} />
      <footer className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
        <Button size="sm" variant="outline" onClick={() => onRefresh ? setEditorMode('design') : onManage()} className="h-10 gap-1.5 text-xs"><Layers className="h-4 w-4" />تعديل التصميم</Button>
        <Button size="sm" onClick={() => onRefresh ? setEditorMode('photos') : onPhoto()} className="h-10 gap-1.5 text-xs"><Camera className="h-4 w-4" />{done ? 'صور التركيب' : 'إضافة صورة'}</Button>
      </footer>
    </>}
  </BillboardCardFrame>;
}
