import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, Settings, Image, Type, ZoomIn, ZoomOut, Eye, 
  Search, ChevronLeft, ChevronRight, FileText, Printer, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

import { useBillboardPrintSettings, ELEMENT_LABELS } from '@/hooks/useBillboardPrintSettings';
import { PrintPreview } from '@/components/billboard-print/PrintPreview';
import { ElementsEditorList } from '@/components/billboard-print/ElementEditor';
import { ProfileManager } from '@/components/billboard-print/ProfileManager';
import { GlobalSettingsEditor } from '@/components/billboard-print/GlobalSettingsEditor';
import { supabase } from '@/integrations/supabase/client';

interface InstallationTask {
  id: string;
  contract_id: number | null;
  status: string;
  created_at: string;
  customer_name?: string;
  ad_type?: string;
  team_name?: string;
}

interface BillboardData {
  ID: number;
  Billboard_Name: string | null;
  Size: string | null;
  Faces_Count: number | null;
  Municipality: string | null;
  District: string | null;
  Nearest_Landmark: string | null;
  Image_URL: string | null;
  GPS_Coordinates: string | null;
  GPS_Link: string | null;
  has_cutout: boolean | null;
  design_face_a: string | null;
  design_face_b: string | null;
  cutout_image_url?: string | null;
  installed_image_url?: string | null;
  installed_image_face_a_url?: string | null;
  installed_image_face_b_url?: string | null;
  installation_date?: string | null;
}

// بيانات لوحة تجريبية للمعاينة
const SAMPLE_BILLBOARD: BillboardData = {
  ID: 1,
  Billboard_Name: 'لوحة تجريبية - شارع الملك فهد',
  Size: '3x4',
  Faces_Count: 2,
  Municipality: 'أمانة جدة',
  District: 'حي الروضة',
  Nearest_Landmark: 'بجوار مركز الملك فهد',
  Image_URL: '/placeholder.svg',
  GPS_Coordinates: '21.5433,39.1728',
  GPS_Link: 'https://maps.google.com/?q=21.5433,39.1728',
  has_cutout: true,
  design_face_a: '/placeholder.svg',
  design_face_b: '/placeholder.svg',
  cutout_image_url: '/placeholder.svg',
  installed_image_url: '/placeholder.svg',
  installed_image_face_a_url: '/placeholder.svg',
  installed_image_face_b_url: '/placeholder.svg',
  installation_date: new Date().toISOString(),
};

export default function BillboardPrintSettingsNew() {
  const [searchParams] = useSearchParams();
  const taskIdFromUrl = searchParams.get('task');
  const contractIdFromUrl = searchParams.get('contract');

  const {
    profiles,
    activeProfile,
    settings,
    hasUnsavedChanges,
    isLoadingProfiles,
    loadProfile,
    updateElement,
    updateSetting,
    resetToDefault,
    saveProfile,
    createProfile,
    deleteProfile,
    setDefaultProfile,
    updateProfileInfo,
    isSaving,
    isCreating,
    isDeleting,
  } = useBillboardPrintSettings();

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(0.4);
  const [previewTarget, setPreviewTarget] = useState<'customer' | 'team'>('team');
  const [hideBackground, setHideBackground] = useState(false);
  const [activeTab, setActiveTab] = useState('elements');
  
  // Contract/Task selection states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<InstallationTask | null>(null);
  const [selectedBillboardIndex, setSelectedBillboardIndex] = useState(0);
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  const [searchMode, setSearchMode] = useState<'tasks' | 'contracts'>('tasks');

  // جلب العقود مباشرة
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-print-new'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", billboard_ids')
        .order('Contract_Number', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // جلب مهام التركيب
  const { data: installationTasks = [] } = useQuery({
    queryKey: ['installation-tasks-for-print-new'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!tasks) return [];

      const contractIds = [...new Set(tasks.map(t => t.contract_id).filter(Boolean))];
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type"')
        .in('Contract_Number', contractIds);

      const teamIds = [...new Set(tasks.map(t => t.team_id).filter(Boolean))];
      const { data: teams } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .in('id', teamIds);

      return tasks.map(task => {
        const contract = contracts?.find(c => c.Contract_Number === task.contract_id);
        const team = teams?.find(t => t.id === task.team_id);
        return {
          ...task,
          customer_name: contract?.['Customer Name'] || '',
          ad_type: contract?.['Ad Type'] || '',
          team_name: team?.team_name || '',
        };
      }) as InstallationTask[];
    },
  });

  // جلب تفاصيل المهمة المختارة
  const { data: taskDetails, isLoading: isLoadingTaskDetails } = useQuery({
    queryKey: ['task-details-new', selectedTask?.id, selectedTask?.contract_id],
    queryFn: async () => {
      if (!selectedTask?.contract_id) return null;
      
      // جلب بيانات العقد
      const { data: contract } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', selectedTask.contract_id)
        .single();

      if (!contract) return null;

      // جلب اللوحات المرتبطة
      let billboardIds: number[] = [];
      try {
        billboardIds = JSON.parse(contract.billboard_ids || '[]');
      } catch { billboardIds = []; }

      if (billboardIds.length === 0) return null;

      const { data: billboards } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);

      // جلب تفاصيل المهمة للتصاميم والصور (فقط إذا كان مهمة تركيب حقيقية)
      let taskBillboards: any[] = [];
      const isRealTask = selectedTask.id && !selectedTask.id.startsWith('contract-');
      if (isRealTask) {
        const { data } = await supabase
          .from('installation_task_billboards' as any)
          .select('*')
          .eq('task_id', selectedTask.id);
        taskBillboards = (data as any[]) || [];
      }

      // دمج البيانات
      const mergedBillboards = (billboards || []).map(bb => {
        const taskBb = taskBillboards.find((tb: any) => tb.billboard_id === bb.ID);
        return {
          ...bb,
          design_face_a: taskBb?.design_face_a_url || bb.design_face_a,
          design_face_b: taskBb?.design_face_b_url || bb.design_face_b,
          installed_image_face_a_url: taskBb?.installed_image_face_a_url,
          installed_image_face_b_url: taskBb?.installed_image_face_b_url,
          cutout_image_url: taskBb?.cutout_image_url,
        } as BillboardData;
      });

      return {
        contract,
        billboards: mergedBillboards,
        customerName: contract['Customer Name'] || '',
        adType: contract['Ad Type'] || '',
      };
    },
    enabled: !!selectedTask?.contract_id,
  });

  // اختيار تلقائي من URL
  useEffect(() => {
    if (taskIdFromUrl && installationTasks.length > 0) {
      const task = installationTasks.find(t => t.id === taskIdFromUrl);
      if (task) {
        setSelectedTask(task);
        setShowTaskDialog(false);
      }
    } else if (contractIdFromUrl && installationTasks.length > 0) {
      const task = installationTasks.find(t => t.contract_id === parseInt(contractIdFromUrl));
      if (task) {
        setSelectedTask(task);
        setShowTaskDialog(false);
      }
    }
  }, [taskIdFromUrl, contractIdFromUrl, installationTasks]);

  // تحديد اللوحات عند تحميل التفاصيل
  useEffect(() => {
    if (taskDetails?.billboards) {
      setSelectedBillboardIds(taskDetails.billboards.map(b => b.ID));
      setSelectedBillboardIndex(0);
    }
  }, [taskDetails]);

  // الفلترة
  const filteredTasks = installationTasks.filter(task => {
    if (!taskSearchQuery) return true;
    const search = taskSearchQuery.toLowerCase();
    return (
      task.customer_name?.toLowerCase().includes(search) ||
      task.contract_id?.toString().includes(search) ||
      task.team_name?.toLowerCase().includes(search)
    );
  });

  const filteredContracts = contracts.filter(contract => {
    if (!taskSearchQuery) return true;
    const search = taskSearchQuery.toLowerCase();
    return (
      contract['Customer Name']?.toLowerCase().includes(search) ||
      contract.Contract_Number?.toString().includes(search)
    );
  });

  // اللوحة الحالية للمعاينة
  const currentBillboard = taskDetails?.billboards?.[selectedBillboardIndex] || SAMPLE_BILLBOARD;
  const totalBillboards = taskDetails?.billboards?.length || 1;

  // دالة إنشاء QR
  const generateQRCode = async (link: string): Promise<string> => {
    try {
      const QRCode = await import('qrcode');
      return await QRCode.toDataURL(link, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
    } catch {
      return '';
    }
  };

  // طباعة الكل باستخدام البروفايل
  const handleBulkPrint = async () => {
    if (!taskDetails?.billboards || selectedBillboardIds.length === 0) {
      toast.error('لا توجد لوحات محددة للطباعة');
      return;
    }

    const billboardsToPrint = taskDetails.billboards.filter(b => selectedBillboardIds.includes(b.ID));
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل فتح نافذة الطباعة');
      return;
    }

    // استخدام إعدادات البروفايل
    const elements = settings.elements;
    const bgUrl = hideBackground ? '' : settings.background_url;
    const bgWidth = settings.background_width;
    const bgHeight = settings.background_height;

    // بناء HTML للطباعة
    let pagesHTML = '';
    for (const billboard of billboardsToPrint) {
      const qrLink = billboard.GPS_Link || (billboard.GPS_Coordinates ? `https://www.google.com/maps?q=${encodeURIComponent(billboard.GPS_Coordinates)}` : '');
      const qrUrl = qrLink ? await generateQRCode(qrLink) : '';
      
      // بناء عناصر الصفحة من الإعدادات
      let elementsHTML = '';
      
      Object.entries(elements).forEach(([key, el]: [string, any]) => {
        if (!el.visible) return;
        if (previewTarget === 'customer' && key === 'printType') return;
        
        let style = `position: absolute; font-size: ${el.fontSize || '14px'}; font-weight: ${el.fontWeight || '400'}; color: ${el.color || '#000'};`;
        if (el.width) style += ` width: ${el.width};`;
        if (el.height) style += ` height: ${el.height};`;
        if (el.top) style += ` top: ${el.top};`;
        if (el.left) style += ` left: ${el.left};`;
        if (el.right) style += ` right: ${el.right};`;
        if (el.textAlign) style += ` text-align: ${el.textAlign};`;
        
        let content = '';
        switch (key) {
          case 'contractNumber':
            content = `عقد رقم: ${selectedTask?.contract_id || ''}`;
            break;
          case 'billboardName':
            content = billboard.Billboard_Name || '';
            break;
          case 'size':
            content = billboard.Size || '';
            break;
          case 'facesCount':
            content = `عدد الأوجه: ${billboard.Faces_Count || 1}`;
            break;
          case 'locationInfo':
            content = `${billboard.Municipality || ''} - ${billboard.District || ''}`;
            break;
          case 'landmarkInfo':
            content = billboard.Nearest_Landmark || '';
            break;
          case 'printType':
            content = previewTarget === 'team' ? 'نسخة الفريق' : 'نسخة العميل';
            break;
          case 'image':
            if (billboard.Image_URL) {
              const borderStyle = `border: ${el.borderWidth || '2px'} solid ${el.borderColor || '#000'};`;
              content = `<img src="${billboard.Image_URL}" style="max-width: 100%; max-height: 100%; object-fit: ${el.objectFit || 'contain'}; ${borderStyle}" />`;
            }
            break;
          case 'qrCode':
            if (qrUrl) content = `<img src="${qrUrl}" style="width: 100%; height: 100%;" />`;
            break;
          case 'designs':
            if (billboard.design_face_a || billboard.design_face_b) {
              content = `<div style="display: flex; gap: ${el.gap || '10px'}; height: 100%;">
                ${billboard.design_face_a ? `<div style="flex:1;"><img src="${billboard.design_face_a}" style="max-width:100%; max-height:100%; object-fit:contain;" /></div>` : ''}
                ${billboard.design_face_b ? `<div style="flex:1;"><img src="${billboard.design_face_b}" style="max-width:100%; max-height:100%; object-fit:contain;" /></div>` : ''}
              </div>`;
            }
            break;
          case 'installationDate':
            content = billboard.installation_date ? `تاريخ التركيب: ${new Date(billboard.installation_date).toLocaleDateString('en-GB')}` : '';
            break;
        }
        
        if (content) {
          elementsHTML += `<div style="${style}">${content}</div>`;
        }
      });

      pagesHTML += `
        <div class="print-page" style="page-break-after: always; width: ${bgWidth}; height: ${bgHeight}; position: relative; ${bgUrl ? `background-image: url('${bgUrl}'); background-size: cover; background-position: center;` : 'background: white;'}">
          ${elementsHTML}
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>طباعة ${selectedBillboardIds.length} لوحات</title>
        <style>
          @page { size: A4; margin: 0; }
          body { margin: 0; font-family: 'Doran', Arial, sans-serif; }
          .print-page { box-sizing: border-box; }
          @media print { .print-page { page-break-after: always; } }
          @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: normal; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: bold; }
        </style>
      </head>
      <body>${pagesHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
    toast.success(`جاري طباعة ${selectedBillboardIds.length} لوحات`);
  };

  const toggleBillboardSelection = (id: number) => {
    setSelectedBillboardIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllBillboards = () => {
    if (taskDetails?.billboards) {
      setSelectedBillboardIds(taskDetails.billboards.map(b => b.ID));
    }
  };

  const deselectAllBillboards = () => {
    setSelectedBillboardIds([]);
  };

  if (isLoadingProfiles) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">إعدادات طباعة اللوحات</h1>
                <p className="text-xs text-muted-foreground">
                  {activeProfile ? `البروفايل: ${activeProfile.profile_name}` : 'لا يوجد بروفايل'}
                  {hasUnsavedChanges && <span className="text-amber-500 mr-2">• غير محفوظ</span>}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* أزرار التكبير والتصغير */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPreviewScale(Math.max(0.2, previewScale - 0.1))}
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-xs w-12 text-center">{Math.round(previewScale * 100)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPreviewScale(Math.min(1, previewScale + 0.1))}
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>

              {/* تبديل نوع المعاينة */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button
                  variant={previewTarget === 'team' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPreviewTarget('team')}
                >
                  فريق
                </Button>
                <Button
                  variant={previewTarget === 'customer' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPreviewTarget('customer')}
                >
                  عميل
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sidebar - الإعدادات */}
          <div className="lg:col-span-1 space-y-4">
            {/* اختيار العقد/المهمة */}
            <Card>
              <CardHeader className="p-3 border-b">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  اختيار العقد للتجربة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-right">
                      <Search className="h-4 w-4 ml-2" />
                      {selectedTask ? (
                        <span className="truncate">
                          عقد #{selectedTask.contract_id} - {selectedTask.customer_name}
                        </span>
                      ) : (
                        'اختر عقد أو مهمة...'
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>اختيار عقد للتجربة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* تبديل بين المهام والعقود */}
                      <div className="flex gap-2 border-b pb-3">
                        <Button
                          variant={searchMode === 'tasks' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSearchMode('tasks')}
                        >
                          مهام التركيب
                        </Button>
                        <Button
                          variant={searchMode === 'contracts' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSearchMode('contracts')}
                        >
                          العقود
                        </Button>
                      </div>

                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="بحث بالعميل أو رقم العقد..."
                          value={taskSearchQuery}
                          onChange={(e) => setTaskSearchQuery(e.target.value)}
                          className="pr-10"
                        />
                      </div>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2">
                          {searchMode === 'tasks' ? (
                            <>
                              {filteredTasks.map((task) => (
                                <button
                                  key={task.id}
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setShowTaskDialog(false);
                                    setSelectedBillboardIndex(0);
                                  }}
                                  className={`w-full text-right p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                                    selectedTask?.id === task.id ? 'border-primary bg-primary/5' : 'border-border'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                      {task.status}
                                    </span>
                                    <span className="font-medium">عقد #{task.contract_id}</span>
                                  </div>
                                  <p className="text-sm mt-1">{task.customer_name || 'بدون عميل'}</p>
                                  {task.team_name && (
                                    <p className="text-xs text-muted-foreground">{task.team_name}</p>
                                  )}
                                </button>
                              ))}
                              {filteredTasks.length === 0 && (
                                <p className="text-center text-muted-foreground py-8">
                                  لا توجد مهام تركيب
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              {filteredContracts.map((contract) => (
                                <button
                                  key={contract.Contract_Number}
                                  onClick={() => {
                                    // إنشاء مهمة وهمية للعقد
                                    setSelectedTask({
                                      id: `contract-${contract.Contract_Number}`,
                                      contract_id: contract.Contract_Number,
                                      status: 'contract',
                                      created_at: contract['Contract Date'] || new Date().toISOString(),
                                      customer_name: contract['Customer Name'] || '',
                                      ad_type: contract['Ad Type'] || '',
                                      team_name: '',
                                    });
                                    setShowTaskDialog(false);
                                    setSelectedBillboardIndex(0);
                                  }}
                                  className={`w-full text-right p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                                    selectedTask?.contract_id === contract.Contract_Number ? 'border-primary bg-primary/5' : 'border-border'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                      عقد
                                    </span>
                                    <span className="font-medium">عقد #{contract.Contract_Number}</span>
                                  </div>
                                  <p className="text-sm mt-1">{contract['Customer Name'] || 'بدون عميل'}</p>
                                  <p className="text-xs text-muted-foreground">{contract['Ad Type'] || ''}</p>
                                </button>
                              ))}
                              {filteredContracts.length === 0 && (
                                <p className="text-center text-muted-foreground py-8">
                                  لا توجد عقود
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* حالة التحميل */}
                {selectedTask && isLoadingTaskDetails && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="mr-2 text-sm text-muted-foreground">جاري تحميل اللوحات...</span>
                  </div>
                )}

                {/* التنقل بين اللوحات */}
                {taskDetails?.billboards && taskDetails.billboards.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedBillboardIndex(Math.max(0, selectedBillboardIndex - 1))}
                        disabled={selectedBillboardIndex === 0}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        لوحة {selectedBillboardIndex + 1} من {totalBillboards}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedBillboardIndex(Math.min(totalBillboards - 1, selectedBillboardIndex + 1))}
                        disabled={selectedBillboardIndex === totalBillboards - 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* تحديد اللوحات للطباعة */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={selectAllBillboards}
                        >
                          <CheckSquare className="h-3 w-3 ml-1" />
                          الكل
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={deselectAllBillboards}
                        >
                          إلغاء
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          ({selectedBillboardIds.length} محدد)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="h-7"
                        onClick={handleBulkPrint}
                        disabled={selectedBillboardIds.length === 0}
                      >
                        <Printer className="h-3 w-3 ml-1" />
                        طباعة
                      </Button>
                    </div>

                    {/* قائمة اللوحات */}
                    <ScrollArea className="h-[120px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {taskDetails.billboards.map((bb, idx) => (
                          <div
                            key={bb.ID}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                              selectedBillboardIndex === idx ? 'bg-primary/10' : ''
                            }`}
                            onClick={() => setSelectedBillboardIndex(idx)}
                          >
                            <Checkbox
                              checked={selectedBillboardIds.includes(bb.ID)}
                              onCheckedChange={() => toggleBillboardSelection(bb.ID)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs truncate flex-1">
                              {bb.Billboard_Name || `لوحة ${bb.ID}`}
                            </span>
                            <span className="text-xs text-muted-foreground">{bb.Size}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* مدير البروفايلات */}
            <ProfileManager
              profiles={profiles}
              activeProfile={activeProfile}
              hasUnsavedChanges={hasUnsavedChanges}
              onLoadProfile={loadProfile}
              onSaveProfile={saveProfile}
              onCreateProfile={createProfile}
              onDeleteProfile={deleteProfile}
              onSetDefault={setDefaultProfile}
              onUpdateInfo={updateProfileInfo}
              isSaving={isSaving}
              isCreating={isCreating}
            />

            {/* التبويبات */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="elements" className="text-xs">
                  <Type className="h-3 w-3 ml-1" />
                  العناصر
                </TabsTrigger>
                <TabsTrigger value="global" className="text-xs">
                  <Image className="h-3 w-3 ml-1" />
                  عام
                </TabsTrigger>
              </TabsList>

              <TabsContent value="elements" className="mt-4">
                <ElementsEditorList
                  elements={settings.elements}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  onUpdateElement={updateElement}
                />
              </TabsContent>

              <TabsContent value="global" className="mt-4">
                <GlobalSettingsEditor
                  settings={settings}
                  onUpdateSetting={updateSetting}
                  onResetToDefault={resetToDefault}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-2">
            <Card className="sticky top-20">
              <CardHeader className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    معاينة الطباعة
                    {selectedTask && (
                      <span className="text-xs font-normal text-muted-foreground">
                        - عقد #{selectedTask.contract_id}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">إخفاء الخلفية</Label>
                    <input
                      type="checkbox"
                      checked={hideBackground}
                      onChange={(e) => setHideBackground(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <PrintPreview
                  settings={settings}
                  billboard={currentBillboard}
                  contractNumber={selectedTask?.contract_id || 12345}
                  customerName={taskDetails?.customerName || 'شركة تجريبية'}
                  adType={taskDetails?.adType || 'عقد إعلان'}
                  previewTarget={previewTarget}
                  scale={previewScale}
                  selectedElement={selectedElement}
                  onElementClick={setSelectedElement}
                  hideBackground={hideBackground}
                />

                {/* Zoom Slider */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">التكبير:</span>
                  <Slider
                    value={[previewScale * 100]}
                    onValueChange={([val]) => setPreviewScale(val / 100)}
                    min={20}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs w-12 text-left">{Math.round(previewScale * 100)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
