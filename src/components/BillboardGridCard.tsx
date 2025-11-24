import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Calendar, Building, Eye, User, FileText, Clock, Camera, ChevronDown, ChevronUp, CheckCircle2, XCircle, History } from 'lucide-react';
import { Billboard } from '@/types';
import { formatGregorianDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { BillboardImage } from './BillboardImage';
import { BillboardHistoryDialog } from './billboards/BillboardHistoryDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardGridCardProps {
  billboard: Billboard & {
    contract?: {
      id: string;
      customer_name: string;
      ad_type: string;
      "Ad Type": string;
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
  const [installationStatusOpen, setInstallationStatusOpen] = useState(false);
  const [latestTask, setLatestTask] = useState<any>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  console.log('🔍 BillboardGridCard - isAdmin:', isAdmin, 'Billboard:', billboard.Billboard_Name);

  useEffect(() => {
    const loadTaskData = async () => {
      if (!billboard.ID) {
        console.warn('Billboard ID is missing');
        return;
      }
      
      setLoadingTask(true);
      try {
        console.log('🔍 Loading task for billboard ID:', billboard.ID);
        
        // First get the task item
        const { data: taskItem, error: taskError } = await supabase
          .from('installation_task_items')
          .select('*')
          .eq('billboard_id', billboard.ID)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (taskError) {
          console.error('❌ Supabase error loading task:', taskError);
          return;
        }
        
        if (!taskItem) {
          console.log('⚠️ No task data found for billboard:', billboard.ID);
          setLatestTask(null);
          return;
        }

        // Get the design if selected_design_id exists
        let designData = null;
        if (taskItem.selected_design_id) {
          const { data: design } = await supabase
            .from('task_designs')
            .select('*')
            .eq('id', taskItem.selected_design_id)
            .single();
          designData = design;
        }

        // Get the task details
        let taskDetails = null;
        if (taskItem.task_id) {
          const { data: task } = await supabase
            .from('installation_tasks')
            .select(`
              *,
              team:installation_teams(*)
            `)
            .eq('id', taskItem.task_id)
            .single();
          taskDetails = task;
        }

        const enrichedTask = {
          ...taskItem,
          selected_design: designData,
          task: taskDetails
        };

        console.log('✅ Task data loaded successfully for billboard', billboard.ID, ':', enrichedTask);
        setLatestTask(enrichedTask);
      } catch (error) {
        console.error('❌ Error loading task:', error);
      } finally {
        setLoadingTask(false);
      }
    };
    
    if (isAdmin && billboard.ID) {
      loadTaskData();
    }
  }, [billboard.ID, isAdmin]);
  
  // استخدام بيانات العقد المرتبط أو البيانات المباشرة في اللوحة
  const contractInfo = billboard.contract;
  const customerName = contractInfo?.customer_name || billboard.Customer_Name || (billboard as any).clientName || '';
  
  // ✅ FIXED: تحسين استدعاء نوع الإعلان مع جميع الاحتمالات الممكنة
  const getAdType = () => {
    // من بيانات العقد أولاً
    if (contractInfo) {
      const contractAdType = contractInfo["Ad Type"] || 
                           contractInfo.ad_type || '';
      if (contractAdType && contractAdType.trim()) {
        return contractAdType.trim();
      }
    }
    
    // من بيانات اللوحة مباشرة
    const billboardAdType = billboard.Ad_Type || 
                           (billboard as any).adType || 
                           (billboard as any).ad_type || '';
    
    if (billboardAdType && billboardAdType.trim()) {
      return billboardAdType.trim();
    }
    
    // من بيانات العقود المدمجة في اللوحة
    if ((billboard as any).contracts && Array.isArray((billboard as any).contracts) && (billboard as any).contracts.length > 0) {
      const contract = (billboard as any).contracts[0];
      const contractAdType = contract["Ad Type"] || 
                           contract.ad_type || '';
      if (contractAdType && contractAdType.trim()) {
        return contractAdType.trim();
      }
    }
    
    return '';
  };
  
  const adType = getAdType();
  
  const startDate = contractInfo?.start_date || billboard.Rent_Start_Date || '';
  const endDate = contractInfo?.end_date || billboard.Rent_End_Date || '';
  const contractId = (billboard as any).Contract_Number || (billboard as any).contractNumber || contractInfo?.id || '';

  // تحديد حالة اللوحة مع فحص تاريخ انتهاء العقد
  const isContractExpired = () => {
    if (!endDate) return false;
    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      return endDateObj < today;
    } catch {
      return false;
    }
  };

  const contractExpired = isContractExpired();
  const hasActiveContract = !!(contractInfo || billboard.Contract_Number) && !contractExpired;
  const rawStatus = (billboard as any).Status ?? (billboard as any).status ?? '';
  const statusNorm = String(rawStatus).trim();
  const maintStatus = String(((billboard as any).maintenance_status ?? '')).trim();

  // تحديد نوع الحالة بدقة
  const isNotInstalled = maintStatus === 'لم يتم التركيب';
  const needsRemoval = maintStatus === 'تحتاج ازالة لغرض التطوير';
  const isRemoved = statusNorm === 'إزالة' || statusNorm.toLowerCase() === 'ازالة';
  const isDamaged = maintStatus === 'متضررة اللوحة';
  const isMaintenance = statusNorm === 'صيانة' || statusNorm === 'maintenance' || maintStatus === 'maintenance' || maintStatus === 'repair_needed' || maintStatus === 'out_of_service';
  
  const isAvailable = (!hasActiveContract || statusNorm === 'متاح' || statusNorm.toLowerCase() === 'available' || contractExpired) && !isRemoved && !isNotInstalled && !needsRemoval && !isMaintenance && !isDamaged;
  
  let statusLabel = 'متاح';
  let statusClass = 'bg-green-500 hover:bg-green-600';
  
  if (isNotInstalled) {
    statusLabel = 'لم يتم التركيب';
    statusClass = 'bg-gray-500 hover:bg-gray-600';
  } else if (needsRemoval) {
    statusLabel = 'تحتاج إزالة';
    statusClass = 'bg-orange-500 hover:bg-orange-600';
  } else if (isRemoved) {
    statusLabel = 'إزالة';
    statusClass = 'bg-gray-500 hover:bg-gray-600';
  } else if (isDamaged) {
    statusLabel = 'متضررة';
    statusClass = 'bg-red-500 hover:bg-red-600';
  } else if (isMaintenance) {
    statusLabel = 'صيانة';
    statusClass = 'bg-amber-500 hover:bg-amber-600';
  } else if (hasActiveContract && !isAvailable && !contractExpired) {
    statusLabel = 'محجوز';
    statusClass = 'bg-red-500 hover:bg-red-600';
  }

  // حساب الأيام المتبقية
  const getDaysRemaining = () => {
    if (!endDate || contractExpired) return null;

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

  const [previewOpen, setPreviewOpen] = React.useState(false);

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

  // Helper function to get face count display name
  const getFaceCountDisplay = () => {
    const facesCount = billboard.Faces_Count || (billboard as any).faces_count || (billboard as any).faces || (billboard as any).Number_of_Faces || (billboard as any).Faces || '';
    
    // If it's a number, convert to descriptive text
    switch (String(facesCount)) {
      case '1':
        return 'وجه واحد';
      case '2':
        return 'وجهين';
      case '3':
        return 'ثلاثة أوجه';
      case '4':
        return 'أربعة أوجه';
      default:
        return facesCount || 'غير محدد';
    }
  };

  // Helper function to get billboard type display
  const getBillboardTypeDisplay = () => {
    return (billboard as any).billboard_type || (billboard as any).Billboard_Type || 'غير محدد';
  };

  // Helper function to get level display
  const getLevelDisplay = () => {
    return billboard.Level || (billboard as any).level || 'غير محدد';
  };

  // Determine if billboard is shared (partnership)
  const isShared = Boolean(
    (billboard as any).is_partnership ||
    (billboard as any).Is_Partnership ||
    (billboard as any).shared ||
    (billboard as any).isShared
  );

  return (
    <>
      <Card className="overflow-hidden rounded-2xl bg-card border-border shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="relative">
        {/* صورة اللوحة */}
        <div className="aspect-video bg-muted relative overflow-hidden">
          <BillboardImage
            billboard={billboard}
            alt={billboard.Billboard_Name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setPreviewOpen(true)}
          />

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
          {isNearExpiry && !contractExpired && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="outline" className="bg-yellow-500/90 text-yellow-900 border-yellow-600">
                <Calendar className="h-3 w-3 mr-1" />
                {daysRemaining} يوم متبقي
              </Badge>
            </div>
          )}

          {/* تحذير العقد المنتهي */}
          {contractExpired && (contractId || endDate) && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="outline" className="bg-destructive/90 text-destructive-foreground border-destructive">
                <Calendar className="h-3 w-3 mr-1" />
                العقد منتهي
              </Badge>
            </div>
          )}

          {/* اسم الشركة الصديقة */}
          {(billboard as any).friend_companies?.name && (
            <div className="absolute bottom-3 left-3">
              <Badge variant="outline" className="bg-secondary/90 text-secondary-foreground border-secondary">
                <Building className="h-3 w-3 mr-1" />
                {(billboard as any).friend_companies.name}
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
            {/* أقرب نقطة دالة */}
            {(billboard.Nearest_Landmark || billboard.District || billboard.Municipality) && (
              <div className="flex items-center text-lg text-foreground font-semibold">
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{billboard.Nearest_Landmark || billboard.District || billboard.Municipality}</span>
              </div>
            )}

            {/* المنطقة + البلدية */}
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

          {/* معلومات إضافية محسنة */}
          <div className="mb-4 text-sm space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">عدد الأوجه:</span>
                <Badge variant="outline" className="text-xs font-medium">
                  {getFaceCountDisplay()}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">نوع اللوحة:</span>
                <Badge variant="outline" className="text-xs font-medium">
                  {getBillboardTypeDisplay()}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">المستوى:</span>
                <Badge variant="outline" className="text-xs font-medium">
                  {getLevelDisplay()}
                </Badge>
              </div>

              {isShared && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">شراكة:</span>
                  <label className="inline-flex items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked readOnly className="accent-primary w-4 h-4" />
                    <span>مشتركة</span>
                  </label>
                </div>
              )}
              
              {(billboard as any).friend_companies?.name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الشركة الصديقة:</span>
                  <Badge variant="outline" className="text-xs font-medium">
                    {(billboard as any).friend_companies.name}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* معلومات العقد المحسنة - فقط للعقود النشطة وغير المنتهية */}
          {hasActiveContract && !contractExpired && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">معلومات العقد</span>
              </div>
              
              {/* الصف الأول: اسم العميل ورقم العقد */}
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

              {/* الصف الثاني: نوع الإعلان والأيام المتبقية */}
              <div className="grid grid-cols-2 gap-4 mb-2">
                {/* ✅ FIXED: عرض نوع الإعلان مع التحقق من وجوده */}
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

              {/* الصف الثالث: تاريخ البداية والنهاية */}
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

              {/* قيمة الإيجار */}
              {contractInfo?.rent_cost && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">قيمة الإيجار:</span>
                    <span className="font-bold text-primary">{contractInfo.rent_cost.toLocaleString()} د.ل</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ��علومات العقد المنتهي للمدير فقط - باستخدام ألوان النظام */}
          {isAdmin && contractExpired && (contractId || endDate || customerName) && (
            <div className="mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-destructive" />
                <span className="font-semibold text-sm text-destructive">عقد منتهي</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {contractId && (
                  <Badge variant="outline" className="text-destructive border-destructive/30">رقم العقد: {contractId}</Badge>
                )}
                {endDate && (
                  <Badge variant="secondary" className="bg-destructive/20 text-destructive">انتهى: {formatGregorianDate(endDate, 'ar-LY')}</Badge>
                )}
                {customerName && (
                  <Badge variant="outline" className="text-destructive border-destructive/30">{customerName}</Badge>
                )}
                {/* ✅ ADDED: عرض نوع الإعلان في العقود المنتهية أيضاً */}
                {adType && (
                  <Badge variant="outline" className="text-destructive border-destructive/30">نوع الإعلان: {adType}</Badge>
                )}
              </div>
            </div>
          )}

          {/* قسم حالة التركيب في الواقع */}
          {isAdmin && (
            <Collapsible open={installationStatusOpen} onOpenChange={setInstallationStatusOpen} className="mt-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span className="font-semibold text-sm">حالة التركيب في الواقع</span>
                </div>
                {installationStatusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-4 p-3 bg-background rounded-lg border">
                  {loadingTask ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">جاري التحميل...</div>
                  ) : latestTask ? (
                    <>
                      {/* حالة ومعلومات المهمة */}
                      <div className="space-y-3 pb-3 border-b">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">حالة التركيب:</span>
                          {latestTask.status === 'completed' ? (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                              مكتمل
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 ml-1" />
                              معلق
                            </Badge>
                          )}
                        </div>

                        {latestTask.installation_date && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">تاريخ التركيب:</span>
                            <span className="font-medium">{formatGregorianDate(latestTask.installation_date)}</span>
                          </div>
                        )}

                        {latestTask.task?.team?.team_name && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">الفريق:</span>
                            <Badge variant="outline">{latestTask.task.team.team_name}</Badge>
                          </div>
                        )}

                        {latestTask.notes && (
                          <div className="text-sm">
                            <span className="text-muted-foreground block mb-1">ملاحظات:</span>
                            <p className="text-xs p-2 bg-muted/50 rounded">{latestTask.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* التصاميم المختارة */}
                      {(latestTask.selected_design || latestTask.design_face_a || latestTask.design_face_b) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">التصاميم المختارة</h4>
                            {latestTask.selected_design?.design_name && (
                              <Badge variant="secondary" className="text-xs">
                                {latestTask.selected_design.design_name}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(latestTask.design_face_a || latestTask.selected_design?.design_face_a_url) && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium">الوجه الأمامي</p>
                                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/20 shadow-sm">
                                  <img 
                                    src={latestTask.design_face_a || latestTask.selected_design?.design_face_a_url} 
                                    alt="التصميم الأمامي" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "/placeholder.svg";
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            {(latestTask.design_face_b || latestTask.selected_design?.design_face_b_url) && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium">الوجه الخلفي</p>
                                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/20 shadow-sm">
                                  <img 
                                    src={latestTask.design_face_b || latestTask.selected_design?.design_face_b_url} 
                                    alt="التصميم الخلفي" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "/placeholder.svg";
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* صور التركيب الفعلية */}
                      {(latestTask.installed_image_face_a_url || latestTask.installed_image_face_b_url) && (
                        <div className="space-y-2 pt-3 border-t">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Camera className="h-4 w-4 text-green-500" />
                            صور التركيب الفعلية
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {latestTask.installed_image_face_a_url && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium">الوجه الأمامي</p>
                                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-green-500/30 shadow-sm">
                                  <img 
                                    src={latestTask.installed_image_face_a_url} 
                                    alt="صورة التركيب الأمامي" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "/placeholder.svg";
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            {latestTask.installed_image_face_b_url && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium">الوجه الخلفي</p>
                                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-green-500/30 shadow-sm">
                                  <img 
                                    src={latestTask.installed_image_face_b_url} 
                                    alt="صورة التركيب الخلفي" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "/placeholder.svg";
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </>
                  ) : (
                    <div className="text-center py-8">
                      <XCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">لا توجد بيانات تركيب</p>
                      <p className="text-xs text-muted-foreground mt-1">لم يتم إضافة هذه اللوحة إلى أي مهمة تركيب</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* زر تاريخ اللوحة - أسفل قسم التركيب */}
          {isAdmin && (
            <div className="mt-3">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setHistoryOpen(true)}
                className="w-full"
              >
                <History className="h-4 w-4 ml-2" />
                عرض تاريخ اللوحة الكامل
              </Button>
            </div>
          )}

          {/* أزرار الإجراءات */}
          {showBookingActions && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                variant={isAvailable ? "default" : "secondary"}
                onClick={() => onBooking?.(billboard)}
              >
                {isAvailable ? 'حجز سريع' : 'تفريغ'}
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  if (billboard.GPS_Coordinates) {
                    // تحويل الإحداثيات إلى رابط Google Maps
                    const mapsUrl = `https://www.google.com/maps/@${billboard.GPS_Coordinates}`;
                    window.open(mapsUrl, '_blank');
                  }
                }}
                disabled={!billboard.GPS_Coordinates}
              >
                <MapPin className="h-4 w-4" />
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onViewDetails?.(billboard)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </div>
    </Card>

    {/* Image Preview Dialog */}
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-4xl p-0">
        <BillboardImage 
          billboard={billboard} 
          alt={billboard.Billboard_Name} 
          className="w-full h-auto object-contain" 
        />
      </DialogContent>
    </Dialog>

    {/* Dialog تاريخ اللوحة */}
    <BillboardHistoryDialog
      open={historyOpen}
      onOpenChange={setHistoryOpen}
      billboardId={billboard.ID}
      billboardName={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
    />
  </>
  );
};
