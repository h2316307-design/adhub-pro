import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UnitSliderField } from '@/components/print/UnitSliderField';
import { toast } from 'sonner';
import { Save, Loader2, RotateCcw, Eye, Upload, Settings, Move, Type, Image, Printer, FileText, Search, Layers, ImageOff, LayoutGrid, Square, Users, Wrench, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

interface ElementSettings {
  visible: boolean;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  textAlign?: string;
  borderWidth?: string;
  borderColor?: string;
  borderRadius?: string;
  borderRadiusTopLeft?: string;
  borderRadiusTopRight?: string;
  borderRadiusBottomLeft?: string;
  borderRadiusBottomRight?: string;
  gap?: string;
  rotation?: string;
  label?: string;
}

interface PrintSettings {
  id: string;
  setting_key: string;
  background_url: string;
  background_width: string;
  background_height: string;
  elements: Record<string, ElementSettings>;
  primary_font: string;
  secondary_font: string;
  custom_css: string | null;
}

interface InstallationTask {
  id: string;
  contract_id: number;
  team_id?: string;
  status: string;
  created_at: string;
  customer_name?: string;
  ad_type?: string;
  team_name?: string;
  contract?: {
    Contract_Number: number;
    'Customer Name': string;
    'Ad Type': string;
  };
  billboards?: Array<{
    ID: number;
    Billboard_Name: string;
    Size: string;
    Faces_Count: number;
    Municipality: string;
    District: string;
    Nearest_Landmark: string;
    Image_URL: string;
    GPS_Coordinates: string | null;
    GPS_Link: string | null;
    has_cutout: boolean;
    design_face_a: string | null;
    design_face_b: string | null;
    cutout_image_url?: string | null;
  }>;
}

// Print modes with their Arabic labels
const PRINT_MODES = {
  default: 'الافتراضي',
  with_cutout: 'مع مجسمات',
  without_cutout: 'بدون مجسمات',
  with_design: 'مع تصميم مرفق',
  without_design: 'بدون تصميم',
  two_faces: 'وجهين (أمامي وخلفي)',
  two_faces_with_designs: 'وجهين مع التصاميم',
};

const DEFAULT_ELEMENTS: Record<string, ElementSettings> = {
  contractNumber: { visible: true, top: '40mm', right: '12mm', fontSize: '14px', fontWeight: '700', color: '#000' },
  adType: { visible: true, top: '40mm', right: '35mm', fontSize: '14px', fontWeight: '700', color: '#000', label: 'نوع الإعلان:' },
  billboardName: { visible: true, top: '200px', left: '16%', fontSize: '20px', fontWeight: '700', color: '#111', width: '450px', textAlign: 'center' },
  size: { visible: true, top: '184px', left: '63%', fontSize: '35px', fontWeight: '900', color: '#000', width: '300px', textAlign: 'center' },
  facesCount: { visible: true, top: '220px', left: '63%', fontSize: '14px', color: '#000', width: '300px', textAlign: 'center' },
  image: { visible: true, top: '340px', left: '0', width: '650px', height: '350px', borderWidth: '4px', borderColor: '#000', borderRadius: '0 0 10px 10px', rotation: '0' },
  locationInfo: { visible: true, top: '229mm', left: '0', fontSize: '21px', fontWeight: '700', width: '150mm', color: '#000' },
  landmarkInfo: { visible: true, top: '239mm', left: '0', fontSize: '21px', fontWeight: '500', width: '150mm', color: '#000' },
  qrCode: { visible: true, top: '970px', left: '245px', width: '100px', height: '100px', rotation: '0' },
  designs: { visible: true, top: '700px', left: '75px', width: '640px', height: '200px', gap: '38px', rotation: '0' },
  installationDate: { visible: true, top: '42.869mm', right: '116mm', fontSize: '11px', fontWeight: '400', color: '#000' },
  printType: { visible: true, top: '170px', right: '83px', fontSize: '18px', color: '#d4af37', fontWeight: '900' },
  cutoutImage: { visible: true, top: '600px', left: '75px', width: '200px', height: '200px', borderWidth: '2px', borderColor: '#000', rotation: '0' },
  faceAImage: { visible: true, top: '700px', left: '75px', width: '260px', height: '159px', borderWidth: '3px', borderColor: '#ccc', rotation: '0' },
  faceBImage: { visible: true, top: '700px', left: '380px', width: '260px', height: '159px', borderWidth: '3px', borderColor: '#ccc', rotation: '0' },
};

const ELEMENT_LABELS: Record<string, string> = {
  contractNumber: 'رقم العقد',
  adType: 'نوع الإعلان',
  billboardName: 'اسم اللوحة',
  size: 'المقاس',
  facesCount: 'عدد الأوجه',
  image: 'صورة اللوحة',
  locationInfo: 'البلدية والمنطقة',
  landmarkInfo: 'أقرب معلم',
  qrCode: 'كود QR',
  designs: 'التصاميم',
  installationDate: 'تاريخ التركيب',
  printType: 'نوع الطباعة (فريق التركيب)',
  cutoutImage: 'صورة المجسم',
  faceAImage: 'صورة الوجه الأمامي',
  faceBImage: 'صورة الوجه الخلفي',
};

export default function BillboardPrintSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(0.4);
  const [currentMode, setCurrentMode] = useState<string>('default');
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<InstallationTask | null>(null);
  const [selectedBillboardIndex, setSelectedBillboardIndex] = useState(0);
  const [previewTarget, setPreviewTarget] = useState<'customer' | 'team'>('team'); // customer or installation team
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);

  // Fetch settings for current mode
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['billboard-print-settings', currentMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_settings')
        .select('*')
        .eq('setting_key', currentMode)
        .single();
      
      if (error) {
        // If mode doesn't exist, create it from default
        if (error.code === 'PGRST116') {
          const { data: defaultData } = await supabase
            .from('billboard_print_settings')
            .select('*')
            .eq('setting_key', 'default')
            .single();
          
          if (defaultData) {
            const { data: newData } = await supabase
              .from('billboard_print_settings')
              .insert({
                setting_key: currentMode,
                background_url: defaultData.background_url,
                background_width: defaultData.background_width,
                background_height: defaultData.background_height,
                elements: defaultData.elements,
                primary_font: defaultData.primary_font,
                secondary_font: defaultData.secondary_font,
              })
              .select()
              .single();
            return newData;
          }
        }
        throw error;
      }
      return data;
    },
  });

  // Fetch installation tasks for selection with contract details
  const { data: installationTasks } = useQuery({
    queryKey: ['installation-tasks-for-print'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!tasks) return [];

      // Fetch contract details for each task
      const contractIds = [...new Set(tasks.map(t => t.contract_id).filter(Boolean))];
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type"')
        .in('Contract_Number', contractIds);

      // Fetch team names
      const teamIds = [...new Set(tasks.map(t => t.team_id).filter(Boolean))];
      const { data: teams } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .in('id', teamIds);

      // Merge contract and team data with tasks
      return tasks.map(task => {
        const contract = contracts?.find(c => c.Contract_Number === task.contract_id);
        const team = teams?.find(t => t.id === task.team_id);
        return {
          ...task,
          customer_name: contract?.['Customer Name'] || '',
          ad_type: contract?.['Ad Type'] || '',
          team_name: team?.team_name || '',
        };
      });
    },
  });

  // Fetch contract and billboards for selected task
  const { data: taskDetails } = useQuery({
    queryKey: ['task-details', selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return null;
      
      const { data: contract } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", design_data')
        .eq('Contract_Number', selectedTask.contract_id)
        .single();
      
      // Fetch billboards linked to this contract
      const { data: billboards } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Faces_Count, Municipality, District, Nearest_Landmark, Image_URL, GPS_Coordinates, GPS_Link, has_cutout, design_face_a, design_face_b')
        .eq('Contract_Number', selectedTask.contract_id);

      // Fetch designs from print_task_items via print_tasks for this contract
      const { data: printTasks } = await supabase
        .from('print_tasks')
        .select('id')
        .eq('contract_id', selectedTask.contract_id);

      let printTaskDesigns: Record<string, { design_face_a?: string; design_face_b?: string; cutout_image_url?: string }> = {};
      
      if (printTasks && printTasks.length > 0) {
        const taskIds = printTasks.map(t => t.id);
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b, cutout_image_url')
          .in('task_id', taskIds);
        
        if (printItems) {
          // Merge designs from multiple rows for the same billboard
          printItems.forEach((item: any) => {
            if (item.billboard_id) {
              const key = item.billboard_id.toString();
              if (!printTaskDesigns[key]) {
                printTaskDesigns[key] = {};
              }
              // Merge - don't overwrite existing values with empty ones
              if (item.design_face_a) {
                printTaskDesigns[key].design_face_a = item.design_face_a;
              }
              if (item.design_face_b) {
                printTaskDesigns[key].design_face_b = item.design_face_b;
              }
              if (item.cutout_image_url) {
                printTaskDesigns[key].cutout_image_url = item.cutout_image_url;
              }
            }
          });
        }
      }

      // Also fetch designs from installation_task_items (some contracts have designs only there)
      const { data: installationItems } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b')
        .eq('task_id', selectedTask.id);
      
      let installationDesigns: Record<string, { design_face_a?: string; design_face_b?: string }> = {};
      if (installationItems) {
        installationItems.forEach((item: any) => {
          if (item.billboard_id) {
            const key = item.billboard_id.toString();
            if (!installationDesigns[key]) {
              installationDesigns[key] = {};
            }
            if (item.design_face_a) {
              installationDesigns[key].design_face_a = item.design_face_a;
            }
            if (item.design_face_b) {
              installationDesigns[key].design_face_b = item.design_face_b;
            }
          }
        });
      }

      // Parse design_data from contract as fallback
      let contractDesignMap: Record<string, { designFaceA?: string; designFaceB?: string }> = {};
      if (contract?.design_data) {
        try {
          const designData = typeof contract.design_data === 'string' 
            ? JSON.parse(contract.design_data) 
            : contract.design_data;
          if (Array.isArray(designData)) {
            designData.forEach((item: any) => {
              if (item.billboardId) {
                contractDesignMap[item.billboardId.toString()] = {
                  designFaceA: item.designFaceA || '',
                  designFaceB: item.designFaceB || '',
                };
              }
            });
          }
        } catch (e) {
          console.error('Error parsing design_data:', e);
        }
      }

      // Merge all design sources with billboards (priority: installation_task_items > print_task_items > contract.design_data > billboard fields)
      const enrichedBillboards = billboards?.map(bb => {
        const installDesign = installationDesigns[bb.ID.toString()];
        const printDesign = printTaskDesigns[bb.ID.toString()];
        const contractDesign = contractDesignMap[bb.ID.toString()];
        return {
          ...bb,
          design_face_a: installDesign?.design_face_a || printDesign?.design_face_a || contractDesign?.designFaceA || bb.design_face_a || null,
          design_face_b: installDesign?.design_face_b || printDesign?.design_face_b || contractDesign?.designFaceB || bb.design_face_b || null,
          cutout_image_url: printDesign?.cutout_image_url || null,
        };
      });

      return { contract, billboards: enrichedBillboards };
    },
    enabled: !!selectedTask,
  });

  // Generate QR code when billboard changes
  useEffect(() => {
    const generateQR = async () => {
      const billboard = taskDetails?.billboards?.[selectedBillboardIndex];

      const mapLink = (() => {
        if (billboard?.GPS_Link) return billboard.GPS_Link;
        if (billboard?.GPS_Coordinates) {
          const coords = billboard.GPS_Coordinates.trim();
          return `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
        }
        if (billboard?.ID) return `https://fares.sa/billboard/${billboard.ID}`;
        return 'https://www.google.com/maps?q=24.7136,46.6753';
      })();

      try {
        const url = await QRCode.toDataURL(mapLink, {
          width: 260,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('QR generation error:', err);
        setQrCodeUrl('');
      }
    };

    generateQR();
  }, [selectedBillboardIndex, taskDetails]);

  useEffect(() => {
    if (data) {
      const elements = typeof data.elements === 'string' 
        ? JSON.parse(data.elements) 
        : (data.elements || DEFAULT_ELEMENTS);
      
      // Merge with default elements to ensure new elements exist
      const mergedElements = { ...DEFAULT_ELEMENTS, ...elements };
      
      setSettings({
        ...data,
        elements: mergedElements,
      } as PrintSettings);
    }
  }, [data]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: Partial<PrintSettings>) => {
      const { error } = await supabase
        .from('billboard_print_settings')
        .update({
          background_url: newSettings.background_url,
          background_width: newSettings.background_width,
          background_height: newSettings.background_height,
          elements: newSettings.elements as any,
          primary_font: newSettings.primary_font,
          secondary_font: newSettings.secondary_font,
          custom_css: newSettings.custom_css,
        })
        .eq('setting_key', currentMode);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-settings'] });
    },
    onError: (error: any) => {
      toast.error(`فشل حفظ الإعدادات: ${error.message}`);
    },
  });

  // Apply to all modes mutation
  const applyToAllMutation = useMutation({
    mutationFn: async (newSettings: Partial<PrintSettings>) => {
      const modes = Object.keys(PRINT_MODES);
      const updates = modes.map(mode => 
        supabase
          .from('billboard_print_settings')
          .update({
            background_url: newSettings.background_url,
            background_width: newSettings.background_width,
            background_height: newSettings.background_height,
            elements: newSettings.elements as any,
            primary_font: newSettings.primary_font,
            secondary_font: newSettings.secondary_font,
            custom_css: newSettings.custom_css,
          })
          .eq('setting_key', mode)
      );
      
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`فشل تحديث ${errors.length} من الأوضاع`);
      }
    },
    onSuccess: () => {
      toast.success('تم تطبيق الإعدادات على جميع الأوضاع بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-settings'] });
    },
    onError: (error: any) => {
      toast.error(`فشل تطبيق الإعدادات: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (settings) {
      saveMutation.mutate(settings);
    }
  };

  const handleApplyToAll = () => {
    if (settings) {
      applyToAllMutation.mutate(settings);
    }
  };

  const handleReset = () => {
    setSettings(prev => prev ? { ...prev, elements: DEFAULT_ELEMENTS } : null);
    toast.info('تم إعادة تعيين الإعدادات للقيم الافتراضية');
  };

  const updateElement = (key: string, field: keyof ElementSettings, value: any) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: {
          ...prev.elements,
          [key]: {
            ...prev.elements[key],
            [field]: value,
          },
        },
      };
    });
  };

  const handleModeChange = (mode: string) => {
    setCurrentMode(mode);
  };

  const handlePrintPreview = () => {
    if (!previewRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('تم حظر النافذة المنبثقة. يرجى السماح بها.');
      return;
    }

    const content = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>معاينة الطباعة</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: ${settings?.primary_font || 'Doran'}, Arial, sans-serif;
          }
          .print-page {
            width: 210mm;
            height: 297mm;
            position: relative;
            overflow: hidden;
            page-break-after: always;
          }
          .print-page img.background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="print-page">
          <img class="background" src="${settings?.background_url || '/ipg.svg'}" />
          ${generatePreviewContent()}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const generatePreviewContent = () => {
    if (!settings) return '';
    
    const billboard = taskDetails?.billboards?.[selectedBillboardIndex];
    const contract = taskDetails?.contract;
    
    // Get visible elements for current mode
    const allowedElements = getVisibleElements();
    
    let html = '';
    
    Object.entries(settings.elements).forEach(([key, element]) => {
      // Skip if element is not visible OR not in allowed elements for current mode
      if (!element.visible || !allowedElements.includes(key)) return;
      
      // Helper to get border radius
      const getBorderRadius = () => {
        if (element.borderRadiusTopLeft || element.borderRadiusTopRight || 
            element.borderRadiusBottomLeft || element.borderRadiusBottomRight) {
          return `${element.borderRadiusTopRight || '0px'} ${element.borderRadiusTopLeft || '0px'} ${element.borderRadiusBottomLeft || '0px'} ${element.borderRadiusBottomRight || '0px'}`;
        }
        return element.borderRadius || '0';
      };
      
      let style = `position: absolute; font-size: ${element.fontSize || '14px'}; font-weight: ${element.fontWeight || '400'}; color: ${element.color || '#000'}; direction: rtl; unicode-bidi: embed;`;
      if (element.fontFamily && element.fontFamily !== 'inherit') style += ` font-family: ${element.fontFamily};`;
      if (element.width) style += ` width: ${element.width};`;
      if (element.height) style += ` height: ${element.height};`;
      if (element.textAlign) style += ` text-align: ${element.textAlign};`;
      if (element.top) style += ` top: ${element.top};`;
      if (element.left) style += ` left: ${element.left};`;
      if (element.right) style += ` right: ${element.right};`;
      if (element.bottom) style += ` bottom: ${element.bottom};`;
      
      // Handle transform (center + rotation)
      const transforms: string[] = [];
      if (element.left?.includes('%') && element.textAlign === 'center') {
        transforms.push('translateX(-50%)');
      }
      if (element.rotation && element.rotation !== '0') {
        transforms.push(`rotate(${element.rotation}deg)`);
      }
      if (transforms.length > 0) {
        style += ` transform: ${transforms.join(' ')};`;
      }
      
      let content = '';
      const borderRadius = getBorderRadius();
      const minWidthStyle = element.minWidth ? `min-width: ${element.minWidth};` : '';
      
      switch (key) {
        case 'contractNumber':
          content = billboard ? `عقد رقم: ${contract?.Contract_Number || '---'}` : 'عقد رقم: 1234';
          break;
        case 'adType':
          const adLabel = element.label || 'نوع الإعلان:';
          const adValue = taskDetails?.contract?.['Ad Type'] || 'إعلان تجاري';
          content = `${adLabel} ${adValue}`;
          break;
        case 'billboardName':
          content = billboard?.Billboard_Name || 'اسم اللوحة';
          break;
        case 'size':
          content = billboard?.Size || '3x4';
          break;
        case 'facesCount':
          content = billboard ? `عدد الأوجه: ${billboard.Faces_Count || 1}` : 'عدد الأوجه: 2';
          break;
        case 'locationInfo':
          content = billboard ? `${billboard.Municipality || ''} - ${billboard.District || ''}` : 'البلدية - المنطقة';
          break;
        case 'landmarkInfo':
          content = billboard?.Nearest_Landmark || 'أقرب معلم';
          break;
        case 'installationDate':
          const dateStr = new Date().toLocaleDateString('en-GB');
          content = `تاريخ التركيب: ${dateStr}`;
          break;
        case 'printType':
          content = previewTarget === 'team' 
            ? (selectedTask?.team_name || 'فريق التركيب') 
            : 'نسخة العميل';
          break;
        case 'image':
          const imgUrl = billboard?.Image_URL || '/placeholder.svg';
          const borderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
          content = `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${borderStyle} ${minWidthStyle}" />`;
          break;
        case 'qrCode':
          if (qrCodeUrl) {
            content = `<img src="${qrCodeUrl}" style="width: 100%; height: 100%; object-fit: contain; ${minWidthStyle}" />`;
          }
          break;
        case 'designs':
          const designA = billboard?.design_face_a;
          const designB = billboard?.design_face_b;
          const designBorderStyle = `border: ${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}; border-radius: ${borderRadius};`;
          content = `
            <div style="display: flex; gap: ${element.gap || '12px'}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designA ? `<img src="${designA}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${designBorderStyle} ${minWidthStyle}" />` : '<span>تصميم A</span>'}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designB ? `<img src="${designB}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${designBorderStyle} ${minWidthStyle}" />` : '<span>تصميم B</span>'}
              </div>
            </div>
          `;
          break;
        case 'cutoutImage':
          const cutoutUrl = billboard?.cutout_image_url;
          if (cutoutUrl) {
            const cutoutBorderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
            content = `<img src="${cutoutUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${cutoutBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        case 'faceAImage':
          const faceAUrl = billboard?.design_face_a;
          if (faceAUrl) {
            const faceABorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            content = `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${faceABorderStyle} ${minWidthStyle}" />`;
          }
          break;
        case 'faceBImage':
          const faceBUrl = billboard?.design_face_b;
          if (faceBUrl) {
            const faceBBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            content = `<img src="${faceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${faceBBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        default:
          content = ELEMENT_LABELS[key] || key;
      }
      
      html += `<div style="${style}">${content}</div>`;
    });
    
    return html;
  };

  const selectTask = (task: any) => {
    setSelectedTask(task);
    setSelectedBillboardIndex(0);
    setShowTaskDialog(false);
  };

  // Get visible elements based on current mode and preview target
  const getVisibleElements = () => {
    // Base elements that show for both customer and team
    const baseElements = ['contractNumber', 'adType', 'billboardName', 'size', 'facesCount', 'image', 'locationInfo', 'landmarkInfo', 'qrCode'];
    
    // Team-specific elements
    const teamElements = ['installationDate', 'printType'];
    
    // Start with base + team elements if target is team
    let elements = previewTarget === 'team' ? [...baseElements, ...teamElements] : baseElements;
    
    switch (currentMode) {
      case 'with_cutout':
        return [...elements, 'cutoutImage'];
      case 'without_cutout':
        return elements;
      case 'with_design':
        return [...elements, 'designs'];
      case 'without_design':
        return elements.filter(e => e !== 'designs');
      case 'two_faces':
        return [...elements, 'faceAImage', 'faceBImage'];
      case 'two_faces_with_designs':
        return [...elements, 'designs', 'faceAImage', 'faceBImage'];
      default:
        return [...elements, 'designs'];
    }
  };

  const visibleElements = getVisibleElements();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const currentBillboard = taskDetails?.billboards?.[selectedBillboardIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Printer className="h-8 w-8" />
            إعدادات طباعة اللوحات المنفصلة
          </h1>
          <p className="text-muted-foreground">تخصيص مواقع وأحجام عناصر طباعة اللوحات</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 ml-2" />
                جلب مهمة تركيب
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>اختيار مهمة تركيب للمعاينة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم العقد أو اسم العميل أو نوع الإعلان..."
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {installationTasks
                      ?.filter(t => {
                        if (!taskSearchQuery) return true;
                        const search = taskSearchQuery.toLowerCase();
                        return (
                          t.contract_id?.toString().includes(search) ||
                          t.customer_name?.toLowerCase().includes(search) ||
                          t.ad_type?.toLowerCase().includes(search)
                        );
                      })
                      .map(task => (
                        <Card 
                          key={task.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => selectTask(task)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="font-bold">عقد رقم: {task.contract_id}</p>
                                {task.customer_name && (
                                  <p className="text-sm text-foreground">{task.customer_name}</p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {task.ad_type && (
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{task.ad_type}</span>
                                  )}
                                  <span>الحالة: {task.status}</span>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(task.created_at).toLocaleDateString('ar-SA')}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handlePrintPreview}>
            <Eye className="h-4 w-4 ml-2" />
            طباعة المعاينة
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
            حفظ الإعدادات
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleApplyToAll} 
            disabled={applyToAllMutation.isPending}
          >
            {applyToAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <LayoutGrid className="h-4 w-4 ml-2" />}
            تطبيق على جميع الأوضاع
          </Button>
        </div>
      </div>

      {/* Mode Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            وضع الطباعة
          </CardTitle>
          <CardDescription>كل وضع له إعدادات منفصلة محفوظة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRINT_MODES).map(([key, label]) => (
              <Button
                key={key}
                variant={currentMode === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange(key)}
                className="gap-2"
              >
                {key === 'with_cutout' && <Layers className="h-4 w-4" />}
                {key === 'without_cutout' && <Square className="h-4 w-4" />}
                {key === 'with_design' && <Image className="h-4 w-4" />}
                {key === 'without_design' && <ImageOff className="h-4 w-4" />}
                {key === 'two_faces' && <LayoutGrid className="h-4 w-4" />}
                {key === 'two_faces_with_designs' && <Layers className="h-4 w-4" />}
                {key === 'default' && <Settings className="h-4 w-4" />}
                {label}
              </Button>
            ))}
          </div>
          
          {/* Preview Target Selector */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <Label className="font-medium">نوع المعاينة:</Label>
            <div className="flex gap-2">
              <Button
                variant={previewTarget === 'customer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewTarget('customer')}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                للزبون
              </Button>
              <Button
                variant={previewTarget === 'team' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewTarget('team')}
                className="gap-2"
              >
                <Wrench className="h-4 w-4" />
                لفريق التركيب
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Task Info */}
      {selectedTask && taskDetails && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-bold">عقد رقم: {taskDetails.contract?.Contract_Number}</p>
                <p className="text-sm text-muted-foreground">العميل: {taskDetails.contract?.['Customer Name']}</p>
              </div>
              {taskDetails.billboards && taskDetails.billboards.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label>اللوحة:</Label>
                  <Select
                    value={selectedBillboardIndex.toString()}
                    onValueChange={(v) => setSelectedBillboardIndex(parseInt(v))}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskDetails.billboards.map((bb, idx) => (
                        <SelectItem key={bb.ID} value={idx.toString()}>
                          {bb.Billboard_Name || `لوحة ${bb.ID}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
                إلغاء التحديد
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-4">
          <Tabs defaultValue="elements">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="elements">العناصر</TabsTrigger>
              <TabsTrigger value="background">الخلفية</TabsTrigger>
              <TabsTrigger value="fonts">الخطوط</TabsTrigger>
            </TabsList>

            <TabsContent value="elements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    عناصر الطباعة
                  </CardTitle>
                  <CardDescription>اختر عنصراً لتعديل إعداداته - وضع: {PRINT_MODES[currentMode as keyof typeof PRINT_MODES]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {Object.entries(ELEMENT_LABELS)
                        .filter(([key]) => visibleElements.includes(key))
                        .map(([key, label]) => (
                        <Card 
                          key={key}
                          className={`cursor-pointer transition-all ${selectedElement === key ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                          onClick={() => setSelectedElement(key)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={settings?.elements[key]?.visible ?? true}
                                  onCheckedChange={(checked) => updateElement(key, 'visible', checked)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="font-medium">{label}</span>
                              </div>
                              <Move className="h-4 w-4 text-muted-foreground" />
                            </div>

                            {selectedElement === key && settings?.elements[key] && (
                              <div className="mt-4 space-y-4 border-t pt-4">
                                {/* Position with Sliders */}
                                <UnitSliderField
                                  label="من الأعلى (top)"
                                  value={settings.elements[key].top}
                                  defaultUnit="px"
                                  min={0}
                                  max={1200}
                                  step={1}
                                  onValueChange={(v) => updateElement(key, 'top', v)}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                  <UnitSliderField
                                    label="من اليسار (left)"
                                    value={settings.elements[key].left}
                                    defaultUnit="px"
                                    min={0}
                                    max={800}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'left', v)}
                                  />
                                  <UnitSliderField
                                    label="من اليمين (right)"
                                    value={settings.elements[key].right}
                                    defaultUnit="px"
                                    min={0}
                                    max={800}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'right', v)}
                                  />
                                </div>

                                {/* Size with Sliders */}
                                <div className="grid grid-cols-2 gap-4">
                                  <UnitSliderField
                                    label="العرض"
                                    value={settings.elements[key].width}
                                    defaultUnit="px"
                                    min={0}
                                    max={800}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'width', v)}
                                  />
                                  <UnitSliderField
                                    label="الارتفاع"
                                    value={settings.elements[key].height}
                                    defaultUnit="px"
                                    min={0}
                                    max={600}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'height', v)}
                                  />
                                </div>

                                {/* Min Width for images - only show for image elements */}
                                {['image', 'designs', 'cutoutImage', 'faceAImage', 'faceBImage', 'qrCode'].includes(key) && (
                                  <UnitSliderField
                                    label="أقل عرض للصورة"
                                    value={settings.elements[key].minWidth || '50px'}
                                    defaultUnit="px"
                                    min={20}
                                    max={400}
                                    step={5}
                                    onValueChange={(v) => updateElement(key, 'minWidth', v)}
                                  />
                                )}

                                {/* Typography with Slider for font size */}
                                <div className="grid grid-cols-2 gap-4">
                                  <UnitSliderField
                                    label="حجم الخط"
                                    value={settings.elements[key].fontSize}
                                    defaultUnit="px"
                                    min={8}
                                    max={60}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'fontSize', v)}
                                  />
                                  <div className="space-y-2">
                                    <Label className="text-xs">وزن الخط</Label>
                                    <Select
                                      value={settings.elements[key].fontWeight || '400'}
                                      onValueChange={(v) => updateElement(key, 'fontWeight', v)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="300">خفيف</SelectItem>
                                        <SelectItem value="400">عادي</SelectItem>
                                        <SelectItem value="500">متوسط</SelectItem>
                                        <SelectItem value="600">سميك</SelectItem>
                                        <SelectItem value="700">عريض</SelectItem>
                                        <SelectItem value="bold">عريض جداً</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Font Family */}
                                <div className="space-y-2">
                                  <Label className="text-xs">نوع الخط</Label>
                                  <Select
                                    value={settings.elements[key].fontFamily || 'inherit'}
                                    onValueChange={(v) => updateElement(key, 'fontFamily', v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="inherit">الافتراضي</SelectItem>
                                      <SelectItem value="Doran">Doran</SelectItem>
                                      <SelectItem value="Manrope">Manrope</SelectItem>
                                      <SelectItem value="Cairo">Cairo</SelectItem>
                                      <SelectItem value="Tajawal">Tajawal</SelectItem>
                                      <SelectItem value="Arial">Arial</SelectItem>
                                      <SelectItem value="Tahoma">Tahoma</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Label for adType element */}
                                {key === 'adType' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs">عنوان العنصر (label)</Label>
                                    <Input
                                      value={settings.elements[key].label || 'نوع الإعلان:'}
                                      onChange={(e) => updateElement(key, 'label', e.target.value)}
                                      placeholder="نوع الإعلان:"
                                    />
                                  </div>
                                )}

                                {/* Color */}
                                <div className="space-y-2">
                                  <Label className="text-xs">اللون</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      value={settings.elements[key].color || '#000000'}
                                      onChange={(e) => updateElement(key, 'color', e.target.value)}
                                      className="w-12 h-10 p-1"
                                    />
                                    <Input
                                      value={settings.elements[key].color || ''}
                                      onChange={(e) => updateElement(key, 'color', e.target.value)}
                                      placeholder="#000000"
                                      className="flex-1"
                                    />
                                  </div>
                                </div>

                                {/* Text Align */}
                                <div className="space-y-2">
                                  <Label className="text-xs">محاذاة النص</Label>
                                  <Select
                                    value={settings.elements[key].textAlign || 'center'}
                                    onValueChange={(v) => updateElement(key, 'textAlign', v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="right">يمين</SelectItem>
                                      <SelectItem value="center">وسط</SelectItem>
                                      <SelectItem value="left">يسار</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Border (for image elements) */}
                                {['image', 'cutoutImage', 'faceAImage', 'faceBImage', 'designs'].includes(key) && (
                                  <>
                                    <div className="grid grid-cols-2 gap-4">
                                      <UnitSliderField
                                        label="عرض الإطار"
                                        value={settings.elements[key].borderWidth}
                                        defaultUnit="px"
                                        min={0}
                                        max={20}
                                        step={1}
                                        onValueChange={(v) => updateElement(key, 'borderWidth', v)}
                                      />
                                      <div className="space-y-2">
                                        <Label className="text-xs">لون الإطار</Label>
                                        <div className="flex gap-2">
                                          <Input
                                            type="color"
                                            value={settings.elements[key].borderColor || '#000000'}
                                            onChange={(e) => updateElement(key, 'borderColor', e.target.value)}
                                            className="w-12 h-10 p-1"
                                          />
                                          <Input
                                            value={settings.elements[key].borderColor || ''}
                                            onChange={(e) => updateElement(key, 'borderColor', e.target.value)}
                                            className="flex-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Border Radius Controls */}
                                    <div className="space-y-3 border-t pt-3">
                                      <Label className="text-xs font-medium">استدارة الحواف</Label>
                                      <UnitSliderField
                                        label="جميع الزوايا"
                                        value={settings.elements[key].borderRadius}
                                        defaultUnit="px"
                                        min={0}
                                        max={50}
                                        step={1}
                                        onValueChange={(v) => {
                                          updateElement(key, 'borderRadius', v);
                                          updateElement(key, 'borderRadiusTopLeft', v);
                                          updateElement(key, 'borderRadiusTopRight', v);
                                          updateElement(key, 'borderRadiusBottomLeft', v);
                                          updateElement(key, 'borderRadiusBottomRight', v);
                                        }}
                                      />
                                      <div className="grid grid-cols-2 gap-3">
                                        <UnitSliderField
                                          label="أعلى يمين"
                                          value={settings.elements[key].borderRadiusTopRight}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusTopRight', v)}
                                        />
                                        <UnitSliderField
                                          label="أعلى يسار"
                                          value={settings.elements[key].borderRadiusTopLeft}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusTopLeft', v)}
                                        />
                                        <UnitSliderField
                                          label="أسفل يمين"
                                          value={settings.elements[key].borderRadiusBottomRight}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusBottomRight', v)}
                                        />
                                        <UnitSliderField
                                          label="أسفل يسار"
                                          value={settings.elements[key].borderRadiusBottomLeft}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusBottomLeft', v)}
                                        />
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Gap for designs element */}
                                {key === 'designs' && (
                                  <UnitSliderField
                                    label="المسافة بين التصاميم"
                                    value={settings.elements[key].gap}
                                    defaultUnit="px"
                                    min={0}
                                    max={100}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'gap', v)}
                                  />
                                )}

                                {/* Rotation for image elements */}
                                {['image', 'cutoutImage', 'faceAImage', 'faceBImage', 'designs', 'qrCode'].includes(key) && (
                                  <div className="space-y-2">
                                    <Label className="text-xs">الدوران (درجة)</Label>
                                    <div className="flex items-center gap-4">
                                      <Slider
                                        value={[parseInt(settings.elements[key].rotation || '0')]}
                                        onValueChange={([v]) => updateElement(key, 'rotation', v.toString())}
                                        min={-180}
                                        max={180}
                                        step={1}
                                        className="flex-1"
                                      />
                                      <Input
                                        type="number"
                                        value={settings.elements[key].rotation || '0'}
                                        onChange={(e) => updateElement(key, 'rotation', e.target.value)}
                                        className="w-20"
                                      />
                                      <span className="text-xs text-muted-foreground">°</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="background" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    إعدادات الخلفية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>رابط صورة الخلفية</Label>
                    <Input
                      value={settings?.background_url || ''}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, background_url: e.target.value } : prev)}
                      placeholder="/ipg.svg"
                    />
                    <p className="text-xs text-muted-foreground">
                      يمكنك استخدام رابط صورة SVG أو PNG. الخلفية الافتراضية: /ipg.svg
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>عرض الخلفية</Label>
                      <Input
                        value={settings?.background_width || '210mm'}
                        onChange={(e) => setSettings(prev => prev ? { ...prev, background_width: e.target.value } : prev)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ارتفاع الخلفية</Label>
                      <Input
                        value={settings?.background_height || '297mm'}
                        onChange={(e) => setSettings(prev => prev ? { ...prev, background_height: e.target.value } : prev)}
                      />
                    </div>
                  </div>

                  {settings?.background_url && (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <Label className="mb-2 block">معاينة الخلفية</Label>
                      <div className="aspect-[210/297] max-h-[300px] bg-white rounded border overflow-hidden">
                        <img 
                          src={settings.background_url} 
                          alt="Background preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fonts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Type className="h-5 w-5" />
                    إعدادات الخطوط
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>الخط الرئيسي</Label>
                    <Select
                      value={settings?.primary_font || 'Doran'}
                      onValueChange={(v) => setSettings(prev => prev ? { ...prev, primary_font: v } : prev)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Doran">Doran</SelectItem>
                        <SelectItem value="Manrope">Manrope</SelectItem>
                        <SelectItem value="Cairo">Cairo</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الخط الثانوي</Label>
                    <Select
                      value={settings?.secondary_font || 'Manrope'}
                      onValueChange={(v) => setSettings(prev => prev ? { ...prev, secondary_font: v } : prev)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Doran">Doran</SelectItem>
                        <SelectItem value="Manrope">Manrope</SelectItem>
                        <SelectItem value="Cairo">Cairo</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <Card className="sticky top-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                المعاينة - {PRINT_MODES[currentMode as keyof typeof PRINT_MODES]}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs">التكبير:</Label>
                <Slider
                  value={[previewScale * 100]}
                  onValueChange={([v]) => setPreviewScale(v / 100)}
                  min={20}
                  max={100}
                  step={5}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground w-10">{Math.round(previewScale * 100)}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div 
                ref={previewRef}
                className="bg-white border rounded-lg overflow-hidden mx-auto"
                style={{
                  width: `${210 * previewScale}mm`,
                  height: `${297 * previewScale}mm`,
                  position: 'relative',
                }}
              >
                {/* Background */}
                <img
                  src={settings?.background_url || '/ipg.svg'}
                  alt="Background"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* Elements Preview */}
                {settings && Object.entries(settings.elements)
                  .filter(([key]) => visibleElements.includes(key))
                  .map(([key, element]) => {
                  if (!element.visible) return null;
                  
                  // Helper to get border radius
                  const getBorderRadius = () => {
                    if (element.borderRadiusTopLeft || element.borderRadiusTopRight || 
                        element.borderRadiusBottomLeft || element.borderRadiusBottomRight) {
                      return `${element.borderRadiusTopRight || '0px'} ${element.borderRadiusTopLeft || '0px'} ${element.borderRadiusBottomLeft || '0px'} ${element.borderRadiusBottomRight || '0px'}`;
                    }
                    return element.borderRadius || '0';
                  };
                  
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    fontSize: `calc(${element.fontSize || '14px'} * ${previewScale})`,
                    fontWeight: element.fontWeight || '400',
                    fontFamily: element.fontFamily && element.fontFamily !== 'inherit' ? element.fontFamily : undefined,
                    color: element.color || '#000',
                    width: element.width ? `calc(${element.width} * ${previewScale})` : undefined,
                    height: element.height ? `calc(${element.height} * ${previewScale})` : undefined,
                    textAlign: (element.textAlign as any) || 'right',
                    direction: 'rtl',
                    unicodeBidi: 'embed',
                    border: selectedElement === key ? '2px dashed #3b82f6' : undefined,
                    backgroundColor: selectedElement === key ? 'rgba(59, 130, 246, 0.1)' : undefined,
                    cursor: 'pointer',
                    zIndex: 10,
                  };

                  // Position
                  if (element.top) style.top = `calc(${element.top} * ${previewScale})`;
                  if (element.left) style.left = element.left.includes('%') ? element.left : `calc(${element.left} * ${previewScale})`;
                  if (element.right) style.right = `calc(${element.right} * ${previewScale})`;
                  if (element.bottom) style.bottom = `calc(${element.bottom} * ${previewScale})`;

                  // Transform for centered elements and rotation
                  const transforms: string[] = [];
                  if (element.left?.includes('%') && element.textAlign === 'center') {
                    transforms.push('translateX(-50%)');
                  }
                  if (element.rotation && element.rotation !== '0') {
                    transforms.push(`rotate(${element.rotation}deg)`);
                  }
                  if (transforms.length > 0) {
                    style.transform = transforms.join(' ');
                  }

                  // Get display value based on selected task and preview target
                  const getDisplayValue = () => {
                    switch (key) {
                      case 'contractNumber':
                        return currentBillboard 
                          ? `عقد رقم: ${taskDetails?.contract?.Contract_Number || '---'}`
                          : 'عقد رقم: 1234';
                      case 'adType':
                        const adLabel = settings?.elements?.adType?.label || 'نوع الإعلان:';
                        const adValue = selectedTask?.ad_type || 'إعلان تجاري';
                        return `${adLabel} ${adValue}`;
                      case 'billboardName':
                        return currentBillboard?.Billboard_Name || 'اسم اللوحة الإعلانية';
                      case 'size':
                        return currentBillboard?.Size || '3x4';
                      case 'facesCount':
                        return `عدد الأوجه: ${currentBillboard?.Faces_Count || 2}`;
                      case 'locationInfo':
                        return currentBillboard 
                          ? `${currentBillboard.Municipality || 'البلدية'} - ${currentBillboard.District || 'المنطقة'}`
                          : 'البلدية - المنطقة';
                      case 'landmarkInfo':
                        return currentBillboard?.Nearest_Landmark || 'أقرب معلم: بجوار المركز التجاري';
                      case 'installationDate':
                        const dateStr = new Date().toLocaleDateString('en-GB');
                        return `تاريخ التركيب: ${dateStr}`;
                      case 'printType':
                        return previewTarget === 'team' 
                          ? (selectedTask?.team_name || 'فريق التركيب') 
                          : 'نسخة العميل';
                      default:
                        return ELEMENT_LABELS[key] || key;
                    }
                  };

                  return (
                    <div
                      key={key}
                      style={style}
                      onClick={() => setSelectedElement(key)}
                      className="transition-all"
                    >
                      {key === 'image' ? (
                        <div 
                          className="flex items-center justify-center h-full overflow-hidden"
                          style={{
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.Image_URL ? (
                            <img 
                              src={currentBillboard.Image_URL} 
                              alt="Billboard" 
                              className="max-w-full max-h-full object-contain"
                              style={{
                                border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                                borderRadius: getBorderRadius(),
                                minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                              }}
                            />
                          ) : (
                            <div 
                              className="bg-muted/30 flex items-center justify-center w-full h-full"
                              style={{
                                border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                                borderRadius: getBorderRadius(),
                              }}
                            >
                              <Image className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ) : key === 'qrCode' ? (
                        <div className="bg-white flex items-center justify-center h-full rounded overflow-hidden p-1">
                          {qrCodeUrl ? (
                            <img 
                              src={qrCodeUrl} 
                              alt="QR Code" 
                              className="w-full h-full object-contain"
                              style={{
                                minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                              }}
                            />
                          ) : (
                            <QrCode className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      ) : key === 'designs' ? (
                        <div 
                          className="flex h-full overflow-hidden items-center justify-center"
                          style={{
                            borderRadius: getBorderRadius(),
                            gap: `calc(12px * ${previewScale})`,
                          }}
                        >
                          <div className="flex-1 flex items-center justify-center h-full overflow-hidden">
                            {currentBillboard?.design_face_a ? (
                              <img 
                                src={currentBillboard.design_face_a} 
                                alt="Design A" 
                                className="max-w-full max-h-full object-contain"
                                style={{ 
                                  borderRadius: getBorderRadius(),
                                  border: `${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}`,
                                  minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                                }}
                              />
                            ) : (
                              <div 
                                className="bg-muted/30 flex items-center justify-center w-full h-full"
                                style={{ borderRadius: getBorderRadius() }}
                              >
                                <span style={{ fontSize: `calc(8px * ${previewScale})` }}>تصميم A</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex items-center justify-center h-full overflow-hidden">
                            {currentBillboard?.design_face_b ? (
                              <img 
                                src={currentBillboard.design_face_b} 
                                alt="Design B" 
                                className="max-w-full max-h-full object-contain"
                                style={{ 
                                  borderRadius: getBorderRadius(),
                                  border: `${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}`,
                                  minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                                }}
                              />
                            ) : (
                              <div 
                                className="bg-muted/30 flex items-center justify-center w-full h-full"
                                style={{ borderRadius: getBorderRadius() }}
                              >
                                <span style={{ fontSize: `calc(8px * ${previewScale})` }}>تصميم B</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : key === 'cutoutImage' ? (
                        <div 
                          className="bg-muted/50 flex items-center justify-center h-full overflow-hidden"
                          style={{
                            border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.cutout_image_url ? (
                            <img src={currentBillboard.cutout_image_url} alt="Cutout" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Layers className="h-6 w-6 text-muted-foreground" />
                              <span style={{ fontSize: `calc(8px * ${previewScale})` }} className="mr-1">مجسم</span>
                            </>
                          )}
                        </div>
                      ) : key === 'faceAImage' ? (
                        <div 
                          className="bg-muted/50 flex items-center justify-center h-full overflow-hidden"
                          style={{
                            border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.design_face_a ? (
                            <img src={currentBillboard.design_face_a} alt="Face A" className="w-full h-full object-cover" />
                          ) : (
                            <span style={{ fontSize: `calc(8px * ${previewScale})` }}>الوجه الأمامي</span>
                          )}
                        </div>
                      ) : key === 'faceBImage' ? (
                        <div 
                          className="bg-muted/50 flex items-center justify-center h-full overflow-hidden"
                          style={{
                            border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.design_face_b ? (
                            <img src={currentBillboard.design_face_b} alt="Face B" className="w-full h-full object-cover" />
                          ) : (
                            <span style={{ fontSize: `calc(8px * ${previewScale})` }}>الوجه الخلفي</span>
                          )}
                        </div>
                      ) : (
                        <span>{getDisplayValue()}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
