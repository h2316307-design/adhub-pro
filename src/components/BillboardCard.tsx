import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Calendar, Building, Eye, User, FileText, Clock, Camera, ChevronDown, ChevronUp, History, CheckCircle2, XCircle } from 'lucide-react';
import { Billboard } from '@/types';
import { formatGregorianDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BillboardHistoryDialog } from './billboards/BillboardHistoryDialog';

interface BillboardGridCardProps {
  billboard: Billboard & {
    contract?: {
      id: string;
      customer_name: string;
      ad_type: string;
      start_date: string;
      end_date: string;
      rent_cost: number;
    };
  };
  onBooking?: (billboard: Billboard) => void;
  onViewDetails?: (billboard: Billboard) => void;
  showBookingActions?: boolean;
}

export const BillboardGridCard: React.FC<BillboardGridCardProps> = ({
  billboard,
  onBooking,
  onViewDetails,
  showBookingActions = true
}) => {
  const { isAdmin } = useAuth();
  
  // State للأقسام المطوية
  const [designsOpen, setDesignsOpen] = useState(false);
  const [installationOpen, setInstallationOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  
  // State للبيانات
  const [latestTask, setLatestTask] = useState<any>(null);
  const [latestHistory, setLatestHistory] = useState<any>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  
  // جلب آخر مهمة تركيب وآخر سجل تاريخي للوحة
  useEffect(() => {
    const loadBillboardData = async () => {
      if (!billboard.ID) {
        console.warn('Billboard ID is missing');
        return;
      }
      
      setLoadingTask(true);
      try {
        console.log('🔍 Loading task for billboard ID:', billboard.ID);
        
        // جلب آخر مهمة تركيب
        const { data: taskData, error: taskError } = await supabase
          .from('installation_task_items' as any)
          .select(`
            id,
            billboard_id,
            task_id,
            status,
            selected_design_id,
            design_face_a,
            design_face_b,
            installation_date,
            completed_at,
            notes,
            installed_image_face_a_url,
            installed_image_face_b_url,
            created_at,
            task:installation_tasks(
              id,
              status,
              created_at,
              team_id,
              contract_id,
              team:installation_teams(
                id,
                team_name
              )
            ),
            selected_design:task_designs(
              id,
              design_name,
              design_face_a_url,
              design_face_b_url
            )
          `)
          .eq('billboard_id', billboard.ID)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (taskError) {
          console.error('❌ Supabase error loading task:', taskError);
        } else if (taskData) {
          console.log('✅ Task data loaded successfully for billboard', billboard.ID, ':', taskData);
          setLatestTask(taskData);
        } else {
          console.log('⚠️ No task data found for billboard:', billboard.ID);
        }
        
        // جلب آخر سجل تاريخي
        const { data: historyData } = await supabase
          .from('billboard_history' as any)
          .select('*')
          .eq('billboard_id', billboard.ID)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (historyData) {
          setLatestHistory(historyData);
        }
      } catch (error) {
        console.error('❌ Error loading billboard data:', error);
      } finally {
        setLoadingTask(false);
      }
    };

    if (billboard.ID) {
      loadBillboardData();
    }
  }, [billboard.ID]);
  
  // استخدام بيانات العقد المرتبط أو البيانات المباشرة في اللوحة
  const contractInfo = billboard.contract;
  const customerName = contractInfo?.customer_name || billboard.Customer_Name || '';
  const adType = contractInfo?.ad_type || '';
  const startDate = contractInfo?.start_date || billboard.Rent_Start_Date || '';
  const endDate = contractInfo?.end_date || billboard.Rent_End_Date || '';
  const contractId = contractInfo?.id || billboard.Contract_Number || '';

  // تحديد حالة اللوحة
  const hasActiveContract = !!(contractInfo || billboard.Contract_Number);
  const isAvailable = !hasActiveContract || billboard.Status === 'متاح' || billboard.Status === 'available';
  const isMaintenance = billboard.Status === 'صيانة' || billboard.Status === 'maintenance';
  
  let statusLabel = 'متاح';
  let statusClass = 'bg-green-500 hover:bg-green-600';
  
  if (isMaintenance) {
    statusLabel = 'صيانة';
    statusClass = 'bg-amber-500 hover:bg-amber-600';
  } else if (hasActiveContract && !isAvailable) {
    statusLabel = 'محجوز';
    statusClass = 'bg-red-500 hover:bg-red-600';
  }

  // حساب الأيام المتبقية
  const getDaysRemaining = () => {
    if (!endDate) return null;

    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      const diffTime = endDateObj.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays > 0 ? diffDays : 0;
    } catch {
      return null;
    }
  };

  const daysRemaining = getDaysRemaining();
  const isNearExpiry = daysRemaining !== null && daysRemaining <= 20 && daysRemaining > 0;

  // Determine if billboard is shared (partnership)
  const isShared = Boolean(
    (billboard as any).is_partnership ||
    (billboard as any).Is_Partnership ||
    (billboard as any).shared ||
    (billboard as any).isShared
  );

  const initialLocal = (billboard as any).image_name ? `/image/${(billboard as any).image_name}` : ((billboard.Image_URL && billboard.Image_URL.startsWith('/')) ? billboard.Image_URL : ((billboard.Image_URL && !billboard.Image_URL.startsWith('http')) ? `/image/${billboard.Image_URL}` : ''));
  const remoteUrl = (billboard as any).Image_URL && (billboard as any).Image_URL.startsWith('http') ? (billboard as any).Image_URL : '';
  const [imgSrc, setImgSrc] = React.useState<string>(initialLocal || remoteUrl || '');

  // ✅ دالة لفتح موقع اللوحة على خرائط جوجل
  const handleOpenGps = () => {
    // دعم أسماء الحقول المختلفة
    const coords = 
      billboard.GPS_Coordinates ||
      (billboard as any).gps_coordinates ||
      (billboard as any)['GPS Coordinates'] ||
      null;

    if (!coords) {
      toast.error('لا توجد إحداثيات جغرافية متوفرة لهذه اللوحة');
      return;
    }

    const coordStr = String(coords).trim().replace(/\s+/g, ' ');
    const latLngRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
    const match = coordStr.match(latLngRegex);

    if (!match) {
      toast.error('تنسيق الإحداثيات غير صحيح. مثال صحيح: 24.7136,46.6753');
      return;
    }

    const lat = match[1];
    const lng = match[3];
    const googleMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  // ✅ تحديد ما إذا كان الزر نشطًا
  const hasGpsCoords = !!(
    billboard.GPS_Coordinates ||
    (billboard as any).gps_coordinates ||
    (billboard as any)['GPS Coordinates']
  );

  // ✅ دالة لوضع علامة على اللوحة أنها تحتاج إعادة تصوير
  const handleMarkForRephotography = async () => {
    try {
      const currentStatus = (billboard as any).needs_rephotography || false;
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('billboards')
        // @ts-ignore - needs_rephotography field exists in database
        .update({ needs_rephotography: newStatus })
        .eq('ID', billboard.ID);

      if (error) throw error;

      toast.success(newStatus ? 'تم إضافة اللوحة لقائمة إعادة التصوير' : 'تم إزالة اللوحة من قائمة إعادة التصوير');
      
      // تحديث الحالة المحلية
      (billboard as any).needs_rephotography = newStatus;
      
      // إعادة تحميل الصفحة لتحديث البيانات
      window.location.reload();
    } catch (error) {
      console.error('Error updating rephotography status:', error);
      toast.error('فشل في تحديث حالة إعادة التصوير');
    }
  };

  const needsRephotography = (billboard as any).needs_rephotography || false;

  return (
    <>
    <Card className="overflow-hidden rounded-2xl bg-gradient-card border-0 shadow-card hover:shadow-luxury transition-smooth">
      <div className="relative">
        {/* صورة اللوحة */}
        <div className="aspect-video bg-muted relative overflow-hidden">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={billboard.Billboard_Name}
              className="w-full h-full object-cover"
              onError={() => {
                if (remoteUrl && imgSrc !== remoteUrl) {
                  setImgSrc(remoteUrl);
                } else {
                  setImgSrc('');
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
              <Building className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

          {/* حجم اللوحة */}
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-primary/90 text-primary-foreground">
              {billboard.Size}
            </Badge>
          </div>

          {/* حالة اللوحة */}
          <div className="absolute top-3 left-3">
            <Badge
              variant={isAvailable ? "default" : "destructive"}
              className={statusClass}
            >
              {statusLabel}
            </Badge>
          </div>

          {/* تحذير القريبة من الانتهاء */}
          {isNearExpiry && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="outline" className="bg-yellow-500/90 text-yellow-900 border-yellow-600">
                <Calendar className="h-3 w-3 mr-1" />
                {daysRemaining} يوم متبقي
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          {/* معرف اللوحة */}
          <div className="mb-3">
            <h3 className="font-extrabold text-2xl md:text-3xl text-foreground tracking-tight">
              {billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}
            </h3>
          </div>

          {/* الموقع */}
          <div className="space-y-2 mb-4">
            {(billboard.Nearest_Landmark || billboard.District || billboard.Municipality) && (
              <div className="flex items-center text-lg text-foreground font-semibold">
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{billboard.Nearest_Landmark || billboard.District || billboard.Municipality}</span>
              </div>
            )}

            {(billboard.District || billboard.Municipality) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {billboard.District && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{billboard.District}</span>
                )}
                {billboard.Municipality && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{billboard.Municipality}</span>
                )}
              </div>
            )}
          </div>

          {/* معلومات إضافية */}
          <div className="mb-4 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">عدد الأوجه:</span>{' '}
              <span className="font-medium">{billboard.Faces_Count || '1'}</span>
            </div>
            {isShared && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">شراكة:</span>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked readOnly className="accent-primary w-4 h-4" />
                  <span className="text-xs text-foreground">مشتركة</span>
                </label>
              </div>
            )}
          </div>

          {/* معلومات العقد المحسنة */}
          {hasActiveContract && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">معلومات العقد</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-2">
                {customerName && (
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">العميل:</span>
                      <span className="font-medium text-foreground">{customerName}</span>
                    </div>
                  </div>
                )}
                
                {contractId && (
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">رقم العقد:</span>
                      <Badge variant="outline" className="text-xs w-fit">{contractId}</Badge>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-2">
                {adType && (
                  <div className="flex items-center gap-2 text-xs">
                    <Building className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">نوع الإعلان:</span>
                      <Badge variant="outline" className="text-xs w-fit font-medium">{adType}</Badge>
                    </div>
                  </div>
                )}

                {daysRemaining !== null && (
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">متبقي:</span>
                      <Badge 
                        variant={isNearExpiry ? "destructive" : "secondary"} 
                        className="text-xs w-fit"
                      >
                        {daysRemaining} يوم
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {startDate && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-green-600 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">يبدأ:</span>
                      <span className="font-medium text-foreground">{formatGregorianDate(startDate, 'ar-LY')}</span>
                    </div>
                  </div>
                )}
                
                {endDate && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-red-600 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">ينتهي:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{formatGregorianDate(endDate, 'ar-LY')}</span>
                        {isNearExpiry && (
                          <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                            قريب الانتهاء
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {contractInfo?.rent_cost && (
                <div className="mt-2 pt-2 border-t border-muted">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">قيمة الإيجار:</span>
                    <span className="font-bold text-primary">{contractInfo.rent_cost.toLocaleString()} د.ل</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* معلومات العقد للمدير فقط (للوحة غير نشطة لكن بها بيانات عقد قديمة) */}
          {isAdmin && !hasActiveContract && (contractId || endDate || customerName) && (
            <div className="mb-4 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                {contractId && (
                  <Badge variant="outline">رقم العقد: {contractId}</Badge>
                )}
                {endDate && (
                  <Badge variant="secondary">ينتهي: {formatGregorianDate(endDate, 'ar-LY')}</Badge>
                )}
                {customerName && (
                  <Badge variant="outline">{customerName}</Badge>
                )}
              </div>
            </div>
          )}

          {/* أقسام قابلة للطي: التصاميم وصور التركيب */}
          <div className="space-y-2 mb-4">
            {/* قسم التصاميم */}
            {(latestTask?.selected_design || latestTask?.design_face_a || latestTask?.design_face_b || latestHistory?.design_face_a_url || latestHistory?.design_face_b_url || (billboard as any).design_face_a || (billboard as any).design_face_b) && (
              <Collapsible open={designsOpen} onOpenChange={setDesignsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-sm border-border hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      التصاميم المحفوظة
                      {latestTask?.selected_design?.design_name && (
                        <Badge variant="secondary" className="text-xs">
                          {latestTask.selected_design.design_name}
                        </Badge>
                      )}
                    </span>
                    {designsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {/* التصاميم من آخر مهمة تركيب */}
                  {latestTask?.selected_design && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">
                        التصميم المحدد: {latestTask.selected_design.design_name}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {latestTask.selected_design.design_face_a_url && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">الوجه الأمامي (A)</div>
                            <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/30">
                              <img 
                                src={latestTask.selected_design.design_face_a_url} 
                                alt="تصميم الوجه الأمامي" 
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => window.open(latestTask.selected_design.design_face_a_url, '_blank')}
                              />
                            </div>
                          </div>
                        )}
                        {latestTask.selected_design.design_face_b_url && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">الوجه الخلفي (B)</div>
                            <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/30">
                              <img 
                                src={latestTask.selected_design.design_face_b_url} 
                                alt="تصميم الوجه الخلفي" 
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => window.open(latestTask.selected_design.design_face_b_url, '_blank')}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* التصاميم القديمة من الـ task items */}
                  {(latestTask?.design_face_a || latestTask?.design_face_b) && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">تصاميم سابقة</div>
                      {latestTask.design_face_a && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">تصميم الوجه الأمامي (A)</div>
                          <a
                            href={latestTask.design_face_a}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                      {latestTask.design_face_b && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">تصميم الوجه الخلفي (B)</div>
                          <a
                            href={latestTask.design_face_b}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* التصاميم من السجل التاريخي */}
                  {(latestHistory?.design_face_a_url || latestHistory?.design_face_b_url) && !latestTask && (
                    <div className="space-y-2">
                      {latestHistory.design_face_a_url && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">تصميم الوجه الأمامي (A)</div>
                          <a
                            href={latestHistory.design_face_a_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                      {latestHistory.design_face_b_url && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">تصميم الوجه الخلفي (B)</div>
                          <a
                            href={latestHistory.design_face_b_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* التصاميم من بيانات اللوحة مباشرة (fallback) */}
                  {!latestTask && !latestHistory && ((billboard as any).design_face_a || (billboard as any).design_face_b) && (
                    <div className="space-y-2">
                      {(billboard as any).design_face_a && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">تصميم الوجه الأمامي (A)</div>
                          <a
                            href={(billboard as any).design_face_a}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                      {(billboard as any).design_face_b && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">تصميم الوجه الخلفي (B)</div>
                          <a
                            href={(billboard as any).design_face_b}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* قسم صور التركيب */}
            {(latestTask || latestHistory) && (
              <Collapsible open={installationOpen} onOpenChange={setInstallationOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-sm border-border hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${
                        (latestTask?.status === 'completed' || latestHistory?.installation_status === 'completed') 
                          ? 'text-green-500' 
                          : 'text-amber-500'
                      }`} />
                      صور التركيب
                      {(latestTask?.status === 'completed' || latestHistory?.installation_status === 'completed') 
                        ? ' (مكتمل)' 
                        : ' (قيد التنفيذ)'}
                    </span>
                    {installationOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {(latestTask?.status === 'completed' || latestHistory?.installation_status === 'completed') ? (
                    <>
                      {(latestHistory?.installed_image_face_a || latestTask?.installed_image_face_a_url) && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            صورة الوجه الأمامي بعد التركيب
                          </div>
                          <a
                            href={latestHistory?.installed_image_face_a || latestTask?.installed_image_face_a_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                      {(latestHistory?.installed_image_face_b || latestTask?.installed_image_face_b_url) && (
                        <div className="p-2 bg-muted/30 rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            صورة الوجه الخلفي بعد التركيب
                          </div>
                          <a
                            href={latestHistory?.installed_image_face_b || latestTask?.installed_image_face_b_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            معاينة
                          </a>
                        </div>
                      )}
                      {(latestHistory?.installation_date || latestTask?.installation_date) && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 p-2">
                          <Calendar className="h-3 w-3" />
                          تاريخ التركيب: {formatGregorianDate(latestHistory?.installation_date || latestTask?.installation_date)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-2 text-sm text-amber-600 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      لم يتم إكمال التركيب بعد
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* زر عرض تاريخ اللوحة - متاح للجميع */}
          <Button
            onClick={() => setHistoryDialogOpen(true)}
            variant="outline"
            size="sm"
            className="w-full mb-4 border-primary text-primary hover:bg-primary/10"
          >
            <History className="ml-2 h-4 w-4" />
            عرض تاريخ اللوحة
          </Button>

          {/* أزرار الإجراءات */}
          {showBookingActions && (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="flex-1 min-w-[100px]"
                  variant={isAvailable ? "default" : "secondary"}
                  onClick={() => onBooking?.(billboard)}
                >
                  {isAvailable ? 'حجز سريع' : 'تفريغ'}
                </Button>
                
                {/* ✅ زر الإحداثيات */}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleOpenGps}
                  disabled={!hasGpsCoords}
                  title={hasGpsCoords ? "عرض الموقع على خرائط جوجل" : "لا توجد إحداثيات"}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onViewDetails?.(billboard)}
                  title="عرض التفاصيل"
                >
                  <Eye className="h-4 w-4" />
                </Button>

                {/* ✅ زر إعادة التصوير */}
                {isAdmin && (
                  <Button 
                    size="sm" 
                    variant={needsRephotography ? "destructive" : "outline"}
                    onClick={handleMarkForRephotography}
                    title={needsRephotography ? "إزالة من قائمة إعادة التصوير" : "إضافة لقائمة إعادة التصوير"}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {/* ✅ زر تاريخ اللوحة - صف منفصل وواضح */}
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setHistoryDialogOpen(true)}
                className="w-full border-primary/50 text-primary hover:bg-primary/10 hover:border-primary"
                title="عرض تاريخ عقود اللوحة"
              >
                <History className="ml-2 h-4 w-4" />
                عرض تاريخ اللوحة
              </Button>
            </div>
          )}
        </CardContent>
      </div>
    </Card>

    {/* نافذة تاريخ اللوحة */}
    <BillboardHistoryDialog
      open={historyDialogOpen}
      onOpenChange={setHistoryDialogOpen}
      billboardId={billboard.ID}
      billboardName={billboard.Billboard_Name || `لوحة ${billboard.ID}`}
    />
    </>
  );
};
