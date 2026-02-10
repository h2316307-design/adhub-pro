import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Eye, Edit, Trash2, Calendar, User, DollarSign, 
  Building, AlertCircle, Clock, CheckCircle, Printer, 
  Hammer, Wrench, Percent, PaintBucket, FileText, 
  Send, FileSpreadsheet, MoreHorizontal, Phone,
  TrendingUp, TrendingDown, Minus, ImageIcon, RefreshCw,
  Maximize2, X, MapPin, Landmark
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Contract } from '@/services/contractService';
import { useNavigate } from 'react-router-dom';
import { AddPaymentDialog } from './AddPaymentDialog';
import { SendContractDialog } from './SendContractDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContractCardProps {
  contract: Contract;
  yearlyCode?: string;
  onDelete: (id: string) => void;
  onPrint: (contract: Contract) => void;
  onInstall: (contract: Contract) => void;
  onBillboardPrint: (contract: Contract) => void;
  onPrintAll?: (contract: Contract) => void;
  onExport: (contract: Contract, type: 'basic' | 'detailed' | 'installation') => void;
  onRefresh: () => void;
  isSelected?: boolean;
  onToggleSelect?: (contractId: string | number) => void;
}

export const ContractCard: React.FC<ContractCardProps> = ({
  contract,
  yearlyCode,
  onDelete,
  onPrint,
  onInstall,
  onBillboardPrint,
  onPrintAll,
  onExport,
  onRefresh,
  isSelected = false,
  onToggleSelect
}) => {
  const navigate = useNavigate();
  const [designImage, setDesignImage] = useState<string | null>(null);
  // نخزن اللون كلون HSL (صيغة CSS الحديثة: "210 50% 40%")
  const [dominantHsl, setDominantHsl] = useState<string | null>(null);
  const [actualPaid, setActualPaid] = useState<number | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [showDesignFullscreen, setShowDesignFullscreen] = useState(false);
  const [customerData, setCustomerData] = useState<{ phone: string | null; company: string | null } | null>(null);
  const [installationTasks, setInstallationTasks] = useState<{
    total: number;
    completed: number;
    pending: number;
    tasks: Array<{ id: string; billboard_name: string; status: string; installation_date: string | null; nearest_landmark: string | null; district: string | null }>;
  }>({ total: 0, completed: 0, pending: 0, tasks: [] });

  // جلب بيانات العميل من جدول customers
  useEffect(() => {
    const fetchCustomerData = async () => {
      const customerId = (contract as any).customer_id;
      if (!customerId) return;
      
      const { data, error } = await supabase
        .from('customers')
        .select('phone, company')
        .eq('id', customerId)
        .single();
      
      if (!error && data) {
        setCustomerData(data);
      }
    };
    
    fetchCustomerData();
  }, [contract]);

  // جلب مهام التركيب المرتبطة بالعقد
  useEffect(() => {
    const fetchInstallationTasks = async () => {
      const contractNumber = Number(
        (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id
      );
      if (!Number.isFinite(contractNumber)) return;

      try {
        // 1. جلب مهام التركيب المباشرة لهذا العقد
        const { data: directTasks } = await supabase
          .from('installation_tasks')
          .select('id, status, contract_id')
          .eq('contract_id', contractNumber);

        // 2. جلب مهام التركيب المدمجة (contract_ids يحتوي على هذا العقد)
        const { data: combinedTasks } = await supabase
          .from('installation_tasks')
          .select('id, status, contract_id')
          .contains('contract_ids', [contractNumber]);

        const allTaskIds = new Set<string>();
        [...(directTasks || []), ...(combinedTasks || [])].forEach(t => allTaskIds.add(t.id));

        if (allTaskIds.size === 0) {
          setInstallationTasks({ total: 0, completed: 0, pending: 0, tasks: [] });
          return;
        }

        // جلب عناصر المهام (اللوحات) لهذه المهام
        const { data: items } = await supabase
          .from('installation_task_items')
          .select(`
            id, task_id, billboard_id, status, installation_date,
            billboard:billboards!installation_task_items_billboard_id_fkey(Billboard_Name, Contract_Number, Nearest_Landmark, District)
          `)
          .in('task_id', Array.from(allTaskIds));

        // فلترة العناصر التي تخص لوحات هذا العقد فقط
        const relevantItems = (items || []).filter(item => {
          const billboard = item.billboard as any;
          return billboard?.Contract_Number === contractNumber;
        });

        // تجميع العناصر حسب billboard_id لتجنب التكرار (في حال وجود مهام متعددة لنفس اللوحة)
        const uniqueBillboards = new Map<number, typeof relevantItems[0]>();
        relevantItems.forEach(item => {
          if (item.billboard_id && !uniqueBillboards.has(item.billboard_id)) {
            uniqueBillboards.set(item.billboard_id, item);
          }
        });
        const uniqueItems = Array.from(uniqueBillboards.values());

        const completed = uniqueItems.filter(i => i.status === 'completed').length;
        const pending = uniqueItems.length - completed;

        const tasksData = uniqueItems.slice(0, 2).map(item => ({
          id: item.id,
          billboard_name: (item.billboard as any)?.Billboard_Name || `لوحة ${item.billboard_id}`,
          status: item.status || 'pending',
          installation_date: item.installation_date,
          nearest_landmark: (item.billboard as any)?.Nearest_Landmark || null,
          district: (item.billboard as any)?.District || null
        }));

        setInstallationTasks({
          total: uniqueItems.length,
          completed,
          pending,
          tasks: tasksData
        });
      } catch (error) {
        console.error('Error fetching installation tasks:', error);
      }
    };

    fetchInstallationTasks();
  }, [contract]);

  // دالة تجديد العقد - إنشاء عقد جديد من بيانات العقد الحالي
  const handleRenewContract = async () => {
    try {
      setIsRenewing(true);
      
      const contractData = contract as any;
      const billboardIds = contractData.billboard_ids || '';
      
      // حساب التواريخ الجديدة
      const today = new Date();
      const origStart = contractData['Contract Date'] || contractData.start_date;
      const origEnd = contractData['End Date'] || contractData.end_date;
      
      let durationMonths = 3; // افتراضي
      if (origStart && origEnd) {
        const sd = new Date(origStart);
        const ed = new Date(origEnd);
        const diffDays = Math.ceil((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
        durationMonths = Math.max(1, Math.round(diffDays / 30));
      }
      
      const newEndDate = new Date(today);
      newEndDate.setMonth(newEndDate.getMonth() + durationMonths);
      
      // إنشاء العقد الجديد
      const { data: newContract, error } = await supabase
        .from('Contract')
        .insert({
          'Customer Name': contractData['Customer Name'] || contractData.customer_name,
          customer_id: contractData.customer_id,
          'Contract Date': today.toISOString().slice(0, 10),
          'End Date': newEndDate.toISOString().slice(0, 10),
          'Ad Type': contractData['Ad Type'] || contractData.ad_type || 'إعلان',
          'Total Rent': contractData['Total Rent'] || contractData.total_rent || 0,
          Discount: 0,
          Total: contractData['Total'] || contractData.total || 0,
          billboard_ids: billboardIds,
          billboards_count: billboardIds ? billboardIds.split(',').filter(Boolean).length : 0,
          customer_category: contractData.customer_category,
          contract_currency: contractData.contract_currency || 'LYD',
          exchange_rate: contractData.exchange_rate || '1',
          installation_cost: contractData.installation_cost || 0,
          installation_enabled: contractData.installation_enabled !== false,
          print_cost: contractData.print_cost || 0,
          print_cost_enabled: contractData.print_cost_enabled || 'false',
          print_price_per_meter: contractData.print_price_per_meter || '0',
          operating_fee_rate: contractData.operating_fee_rate || 3,
          payment_status: 'unpaid',
          'Renewal Status': 'نشط',
        })
        .select('Contract_Number')
        .single();
      
      if (error) throw error;
      
      if (newContract?.Contract_Number) {
        toast.success(`تم إنشاء العقد الجديد رقم ${newContract.Contract_Number}`);
        navigate(`/admin/contracts/edit?contract=${newContract.Contract_Number}`);
      }
    } catch (error) {
      console.error('Error renewing contract:', error);
      toast.error('حدث خطأ أثناء تجديد العقد');
    } finally {
      setIsRenewing(false);
    }
  };
  
  // جلب المدفوعات الفعلية من customer_payments
  useEffect(() => {
    const fetchActualPayments = async () => {
      const contractNumber = (contract as any).Contract_Number || (contract as any)['Contract Number'] || contract.id;
      const { data, error } = await supabase
        .from('customer_payments')
        .select('amount')
        .eq('contract_number', contractNumber);
      
      if (!error && data) {
        const total = data.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        setActualPaid(total);
      }
    };
    
    fetchActualPayments();
  }, [contract]);
  
  // حساب القيم
  const totalRent = Number(contract.rent_cost || (contract as any)['Total Rent'] || 0);
  const installationCost = Number((contract as any).installation_cost || 0);
  const printCost = Number((contract as any).print_cost || 0);
  const operatingFee = Number((contract as any).fee || 0);
  const totalCost = Number((contract as any).total_cost || (contract as any)['Total'] || 0);
  const discount = Number((contract as any).Discount || (contract as any).discount || 0);
  
  // إذا كان الإيجار = 0، لا نحسب التركيب والطباعة في المجموع المستحق لأنها لم تحدث بعد
  const hasRentalActivity = totalRent > 0 || totalCost > 0;
  const effectiveInstallationCost = hasRentalActivity ? installationCost : 0;
  const effectivePrintCost = hasRentalActivity ? printCost : 0;
  const effectiveOperatingFee = hasRentalActivity ? operatingFee : 0;
  
  const finalTotalCost = totalCost > 0 ? totalCost : (totalRent + effectiveInstallationCost + effectivePrintCost + effectiveOperatingFee);
  
  // استخدام المدفوعات الفعلية إذا توفرت، وإلا استخدام القيمة المحفوظة
  const totalPaid = actualPaid !== null ? actualPaid : Number((contract as any)['Total Paid'] || (contract as any).total_paid || 0);
  const paymentPercentage = finalTotalCost > 0 ? (totalPaid / finalTotalCost) * 100 : 0;
  const remaining = finalTotalCost - totalPaid;
  
  // استخراج اللون السائد من الصورة (كنمط HSL لتوافق أفضل مع الثيم)
  const extractDominantColor = (imageUrl: string) => {
    const rgbToHsl = (r: number, g: number, b: number) => {
      r /= 255;
      g /= 255;
      b /= 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        switch (max) {
          case r:
            h = ((g - b) / delta) % 6;
            break;
          case g:
            h = (b - r) / delta + 2;
            break;
          default:
            h = (r - g) / delta + 4;
        }
        h *= 60;
        if (h < 0) h += 360;
      }

      return {
        h: Math.round(h),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      };
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          // تجاهل الأسود/الأبيض الشديد
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          const hsl = rgbToHsl(r, g, b);
          // ضبط السطوع لضمان تباين جيد - خفض السطوع للخلفية
          const adjustedL = Math.min(hsl.l, 25); // حد أقصى 25% سطوع للخلفية
          setDominantHsl(`${hsl.h} ${Math.min(hsl.s, 60)}% ${adjustedL}%`);
        } else {
          setDominantHsl(null);
        }
      } catch (e) {
        setDominantHsl(null);
      }
    };
    img.src = imageUrl;
  };
  
  // جلب أول صورة تصميم من مهام التركيب المرتبطة بهذا العقد فقط
  useEffect(() => {
    const fetchDesignImage = async () => {
      const rawContractNumber =
        (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id;

      const contractNumber = Number(rawContractNumber);
      if (!Number.isFinite(contractNumber)) return;

      let foundImage: string | null = null;

      /**
       * ✅ الحل الصحيح:
       * 1. نجلب مهام التركيب المرتبطة بهذا العقد مباشرة (contract_id = contractNumber)
       * 2. أو المهام المدمجة (contract_ids تحتوي على contractNumber)
       * 3. ثم نبحث عن التصاميم في عناصر هذه المهام فقط
       * 
       * ⚠️ مهم: لا نعتمد على Contract_Number في billboards لأن اللوحة قد تنتقل لعقد جديد
       *    لكن التصميم المخزن في installation_task_items يخص العقد القديم
       */

      // ✅ 1. البحث عن التصاميم من مهام التركيب المرتبطة بهذا العقد مباشرة (contract_id)
      if (!foundImage) {
        const { data: tasks } = await supabase
          .from('installation_tasks')
          .select('id')
          .eq('contract_id', contractNumber);

        if (tasks && tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const { data: items } = await supabase
            .from('installation_task_items')
            .select('design_face_a, design_face_b')
            .in('task_id', taskIds)
            .or('design_face_a.not.is.null,design_face_b.not.is.null')
            .limit(1);

          if (items && items.length > 0) {
            foundImage = items[0].design_face_a || items[0].design_face_b;
          }
        }
      }

      // ✅ 2. البحث في المهام المدمجة (contract_ids يحتوي على هذا العقد)
      // ⚠️ مهم: يجب فلترة التصاميم حسب لوحات هذا العقد فقط وليس أي تصميم في المهمة المدمجة
      if (!foundImage) {
        const { data: combinedTasks } = await supabase
          .from('installation_tasks')
          .select('id')
          .contains('contract_ids', [contractNumber]);

        if (combinedTasks && combinedTasks.length > 0) {
          const taskIds = combinedTasks.map(t => t.id);
          // جلب عناصر المهام مع بيانات اللوحة للفلترة حسب Contract_Number
          const { data: items } = await supabase
            .from('installation_task_items')
            .select(`
              design_face_a, 
              design_face_b,
              billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)
            `)
            .in('task_id', taskIds)
            .or('design_face_a.not.is.null,design_face_b.not.is.null');

          if (items && items.length > 0) {
            // ✅ فلترة: فقط التصاميم التي تخص لوحات هذا العقد
            const relevantItem = items.find(item => {
              const billboard = item.billboard as any;
              return billboard?.Contract_Number === contractNumber;
            });
            
            if (relevantItem) {
              foundImage = relevantItem.design_face_a || relevantItem.design_face_b;
            }
          }
        }
      }

      // ✅ 2.5. البحث عبر المهام المجمعة (composite_tasks) المرتبطة بهذا العقد
      if (!foundImage) {
        const { data: compositeTasks } = await supabase
          .from('composite_tasks')
          .select('installation_task_id')
          .eq('contract_id', contractNumber)
          .not('installation_task_id', 'is', null);

        if (compositeTasks && compositeTasks.length > 0) {
          const taskIds = compositeTasks
            .map(ct => ct.installation_task_id)
            .filter((id): id is string => id !== null);

          if (taskIds.length > 0) {
            const { data: items } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b')
              .in('task_id', taskIds)
              .or('design_face_a.not.is.null,design_face_b.not.is.null')
              .limit(1);

            if (items && items.length > 0) {
              foundImage = items[0].design_face_a || items[0].design_face_b;
            }
          }
        }
      }

      // ✅ 3. البحث عبر لوحات العقد مباشرة (حل ذكي: التحقق من الزبون)
      if (!foundImage) {
        // الحصول على اسم زبون العقد الحالي
        const currentCustomerName = (contract as any)['Customer Name'] || (contract as any).customer_name;
        
        // جلب أرقام لوحات هذا العقد
        const { data: contractBillboards } = await supabase
          .from('billboards')
          .select('ID')
          .eq('Contract_Number', contractNumber);

        if (contractBillboards && contractBillboards.length > 0) {
          const billboardIds = contractBillboards.map(b => b.ID);
          
          // البحث عن تصاميم هذه اللوحات (بدون join معقد)
          const { data: designItems } = await supabase
            .from('installation_task_items')
            .select('design_face_a, design_face_b, task_id')
            .in('billboard_id', billboardIds)
            .or('design_face_a.not.is.null,design_face_b.not.is.null');

          if (designItems && designItems.length > 0) {
            // جلب معلومات المهام بشكل منفصل
            const taskIds = [...new Set(designItems.map(d => d.task_id).filter(Boolean))];
            
            if (taskIds.length > 0) {
              const { data: tasks } = await supabase
                .from('installation_tasks')
                .select('id, contract_id, contract_ids')
                .in('id', taskIds);
              
              // جلب أسماء الزبائن للعقود المرتبطة بالمهام
              const taskContractIds = [...new Set((tasks || []).map(t => t.contract_id).filter(Boolean))];
              let taskCustomerMap: Record<number, string> = {};
              
              if (taskContractIds.length > 0) {
                const { data: taskContracts } = await supabase
                  .from('Contract')
                  .select('"Contract_Number", "Customer Name"')
                  .in('Contract_Number', taskContractIds);
                
                (taskContracts || []).forEach(tc => {
                  taskCustomerMap[tc.Contract_Number] = tc['Customer Name'] || '';
                });
              }

              // إنشاء map للمهام
              const taskMap = new Map((tasks || []).map(t => [t.id, t]));

              // ✅ فلترة ذكية
              const relevantItem = designItems.find(item => {
                const task = taskMap.get(item.task_id);
                if (!task) return false;
                
                // الحالة 1: المهمة مرتبطة مباشرة بهذا العقد
                if (task.contract_id === contractNumber) return true;
                
                // الحالة 2: هذا العقد في قائمة العقود المدمجة
                if (Array.isArray(task.contract_ids) && task.contract_ids.includes(contractNumber)) return true;
                
                // الحالة 3: نفس الزبون (لحالات الدمج)
                const taskCustomerName = taskCustomerMap[task.contract_id];
                if (currentCustomerName && taskCustomerName && currentCustomerName === taskCustomerName) {
                  return true;
                }
                
                return false;
              });
              
              if (relevantItem) {
                foundImage = relevantItem.design_face_a || relevantItem.design_face_b;
              }
            }
          }
        }
      }

      // ✅ 4. بديل أخير: البحث في design_data المحفوظة في العقد
      if (!foundImage) {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('design_data')
          .eq('Contract_Number', contractNumber)
          .single();

        if (contractData?.design_data) {
          try {
            const designData =
              typeof contractData.design_data === 'string'
                ? JSON.parse(contractData.design_data)
                : contractData.design_data;

            if (Array.isArray(designData)) {
              for (const d of designData) {
                const img =
                  d?.designFaceA ||
                  d?.designFaceB ||
                  d?.faceA ||
                  d?.faceB ||
                  d?.design_face_a ||
                  d?.design_face_b ||
                  null;

                if (typeof img === 'string' && img.trim()) {
                  foundImage = img;
                  break;
                }
              }
            }
          } catch (e) {
            // تجاهل أخطاء التحليل
          }
        }
      }

      // إذا وجدنا صورة، نثبتها ونستخرج اللون السائد
      if (foundImage) {
        setDesignImage(foundImage);
        extractDominantColor(foundImage);
      } else {
        setDesignImage(null);
        setDominantHsl(null);
      }
    };

    fetchDesignImage();
  }, [contract]);
  
  // حساب حالة العقد
  const getStatus = () => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) {
      return { label: 'غير محدد', variant: 'secondary' as const, icon: null };
    }
    
    if (today < startDate) {
      return { label: 'لم يبدأ', variant: 'secondary' as const, icon: <Clock className="h-3 w-3" /> };
    } else if (today > endDate) {
      return { label: 'منتهي', variant: 'destructive' as const, icon: <AlertCircle className="h-3 w-3" /> };
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        return { label: `ينتهي خلال ${daysRemaining} أيام`, variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, className: 'border-orange-500 text-orange-500' };
      }
      return { label: 'نشط', variant: 'default' as const, icon: <CheckCircle className="h-3 w-3" /> };
    }
  };
  
  // حساب التقدم/التأخر
  const getProgress = () => {
    // إذا كانت نسبة السداد 100% أو أكثر - مكتمل
    if (paymentPercentage >= 100) {
      return { label: 'مكتمل', variant: 'default' as const, percent: 0, icon: <CheckCircle className="h-4 w-4" /> };
    }

    const startDate = contract.start_date ? new Date(contract.start_date) : null;
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    const today = new Date();

    if (!startDate || !endDate || today < startDate) {
      return { label: '—', variant: 'secondary' as const, percent: 0, icon: <Minus className="h-4 w-4" /> };
    }

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    const timePercentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;
    const diff = paymentPercentage - timePercentage;
    const percent = Math.abs(diff);

    if (percent < 5) {
      return { label: 'متوازن', variant: 'secondary' as const, percent, icon: <Minus className="h-4 w-4" /> };
    }
    if (diff > 0) {
      return { label: `متقدم ${percent.toFixed(0)}%`, variant: 'default' as const, percent, icon: <TrendingUp className="h-4 w-4" /> };
    }
    return { label: `متأخر ${percent.toFixed(0)}%`, variant: 'destructive' as const, percent, icon: <TrendingDown className="h-4 w-4" /> };
  };
  
  const status = getStatus();
  const progress = getProgress();
  const contractNumber = String((contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id);
  
  // تحديد لون الكارد حسب الحالة
  const getCardStyle = () => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    
    if (!contract.end_date) return '';
    
    if (today > endDate) {
      return 'border-destructive/50 bg-destructive/5';
    }
    
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20';
    }
    
    return 'border-border hover:border-primary/50';
  };

  // نمط الكارت مع اللون السائد - ألوان متباينة وواضحة
  const cardStyle = dominantHsl
    ? {
        background: `linear-gradient(145deg, hsl(${dominantHsl}) 0%, hsl(${dominantHsl} / 0.85) 50%, hsl(var(--card)) 100%)`,
        borderColor: `hsl(${dominantHsl})`,
        borderWidth: '2px',
        boxShadow: `0 8px 24px hsl(${dominantHsl} / 0.25)`,
      }
    : {};

  return (
    <Card 
      className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg flex flex-col ${getCardStyle()} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      style={cardStyle}
    >
      {/* Checkbox للاختيار - في أعلى اليمين فوق كل شيء */}
      {onToggleSelect && (
        <div 
          className="absolute -top-1 -right-1 z-50 cursor-pointer p-2"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(contract.id);
          }}
        >
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-md ${
            isSelected 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'bg-background border-border hover:border-primary'
          }`}>
            {isSelected && (
              <CheckCircle className="h-4 w-4" />
            )}
          </div>
        </div>
      )}
      
      {/* منطقة الصورة - ارتفاع ثابت دائماً للحفاظ على التنسيق */}
      <div className="h-32 w-full overflow-hidden bg-muted/30 flex-shrink-0">
        {designImage ? (
          <>
            <div 
              className="relative h-full w-full cursor-pointer group/design"
              onClick={() => setShowDesignFullscreen(true)}
            >
              <img 
                src={designImage} 
                alt="تصميم الإعلان" 
                className="w-full h-full object-cover transition-transform duration-300 group-hover/design:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover/design:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover/design:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center text-muted-foreground/50">
              <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-30" />
              <span className="text-xs">بدون تصميم</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Fullscreen Design Modal */}
      {showDesignFullscreen && designImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowDesignFullscreen(false)}
        >
          <button
            onClick={() => setShowDesignFullscreen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img 
            src={designImage} 
            alt="تصميم الإعلان - عرض كامل" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            عقد #{contractNumber} - {contract.customer_name}
          </div>
        </div>
      )}
      
      {/* شريط الحالة العلوي */}
      <div
        className={`h-1.5 w-full ${
          !dominantHsl
            ? status.variant === 'destructive'
              ? 'bg-destructive'
              : status.variant === 'default'
                ? 'bg-primary'
                : status.className?.includes('orange')
                  ? 'bg-orange-500'
                  : 'bg-muted'
            : ''
        }`}
        style={dominantHsl ? { backgroundColor: `hsl(${dominantHsl})` } : {}}
      />
      
      <CardContent className={`p-5 ${dominantHsl ? 'text-white' : ''}`}>
        {/* الرأس */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-2xl font-bold font-manrope ${dominantHsl ? 'text-white' : 'text-foreground'}`}>#{contractNumber}</span>
              {yearlyCode && (
                <Badge variant="secondary" className={`text-base font-bold font-manrope px-2 py-1 ${dominantHsl ? 'bg-white/20 text-white border-white/30' : ''}`}>
                  {yearlyCode}
                </Badge>
              )}
              <Badge variant={status.variant} className={`gap-1 ${status.className || ''} ${dominantHsl ? 'bg-white/20 text-white border-white/30' : ''}`}>
                {status.icon}
                {status.label}
              </Badge>
            </div>
            {/* اسم العميل مع الشركة والهاتف */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <User className={`h-4 w-4 ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`} />
                <span className={`font-bold text-xl ${dominantHsl ? 'text-white' : 'text-foreground'}`}>{contract.customer_name}</span>
              </div>
              {(contract.Company || customerData?.company) && (
                <div className="flex items-center gap-1.5">
                  <Building className={`h-4 w-4 ${dominantHsl ? 'text-white/70' : 'text-primary'}`} />
                  <span className={`font-semibold text-lg ${dominantHsl ? 'text-white/90' : 'text-primary'}`}>{contract.Company || customerData?.company}</span>
                </div>
              )}
              {(contract.Phone || customerData?.phone) && (
                <div className="flex items-center gap-1.5">
                  <Phone className={`h-4 w-4 ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`} />
                  <span dir="ltr" className={`font-manrope font-semibold text-lg ${dominantHsl ? 'text-white/80' : 'text-muted-foreground'}`}>{contract.Phone || customerData?.phone}</span>
                </div>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate(`/admin/contracts/view/${contract.id}`)}>
                <Eye className="h-4 w-4 ml-2" />
                عرض التفاصيل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/admin/contracts/edit?contract=${contract.id}`)}>
                <Edit className="h-4 w-4 ml-2" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleRenewContract}
                disabled={isRenewing}
                className="text-emerald-600 focus:text-emerald-600"
              >
                <RefreshCw className={`h-4 w-4 ml-2 ${isRenewing ? 'animate-spin' : ''}`} />
                {isRenewing ? 'جاري التجديد...' : 'تجديد العقد'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onPrint(contract)}>
                <Printer className="h-4 w-4 ml-2" />
                طباعة العقد
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onInstall(contract)}>
                <Hammer className="h-4 w-4 ml-2" />
                طباعة التركيب
              </DropdownMenuItem>
              {onPrintAll && (
                <DropdownMenuItem onClick={() => onPrintAll(contract)}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة الكل
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport(contract, 'basic')}>
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                تصدير Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(String(contract.id))}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 ml-2" />
                حذف العقد
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* نوع الإعلان */}
        <div className="flex items-center gap-2 mb-4">
          <PaintBucket className={`h-5 w-5 ${dominantHsl ? 'text-white/70' : 'text-primary'}`} />
          <span className={`text-base ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>نوع الإعلان:</span>
          <span className={`font-bold text-xl ${dominantHsl ? 'text-white' : 'text-primary'}`}>{(contract as any)['Ad Type'] || 'غير محدد'}</span>
        </div>
        
        {/* التواريخ */}
        <div className={`grid grid-cols-2 gap-3 mb-3 p-3 rounded-lg ${dominantHsl ? 'bg-white/10' : 'bg-muted/50'}`}>
          <div className="flex items-center gap-2">
            <Calendar className={`h-5 w-5 ${dominantHsl ? 'text-emerald-300' : 'text-emerald-600'}`} />
            <div>
              <span className={`text-xs block ${dominantHsl ? 'text-white/60' : 'text-muted-foreground'}`}>البداية</span>
              <span className={`font-semibold font-manrope text-base ${dominantHsl ? 'text-white' : ''}`}>{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className={`h-5 w-5 ${dominantHsl ? 'text-rose-300' : 'text-rose-600'}`} />
            <div>
              <span className={`text-xs block ${dominantHsl ? 'text-white/60' : 'text-muted-foreground'}`}>النهاية</span>
              <span className={`font-semibold font-manrope text-base ${dominantHsl ? 'text-white' : ''}`}>{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</span>
            </div>
          </div>
        </div>
        
        {/* مهام التركيب */}
        {installationTasks.total > 0 && (
          <div className={`mb-3 p-3 rounded-lg ${dominantHsl ? 'bg-white/10' : 'bg-muted/50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wrench className={`h-4 w-4 ${dominantHsl ? 'text-white/70' : 'text-orange-600'}`} />
                <span className={`font-semibold text-sm ${dominantHsl ? 'text-white' : 'text-foreground'}`}>مهام التركيب</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={installationTasks.completed === installationTasks.total ? "default" : "secondary"}
                  className={`text-xs ${dominantHsl ? 'bg-white/20 text-white border-white/30' : ''}`}
                >
                  {installationTasks.completed}/{installationTasks.total}
                </Badge>
                {installationTasks.completed === installationTasks.total && installationTasks.total > 0 ? (
                  <CheckCircle className={`h-4 w-4 ${dominantHsl ? 'text-emerald-300' : 'text-emerald-600'}`} />
                ) : (
                  <Clock className={`h-4 w-4 ${dominantHsl ? 'text-amber-300' : 'text-amber-600'}`} />
                )}
              </div>
            </div>
            
            {/* شريط التقدم */}
            <div className={`relative h-2 rounded-full overflow-hidden mb-2 ${dominantHsl ? 'bg-white/20' : 'bg-muted'}`}>
              <div 
                className={`absolute inset-y-0 right-0 rounded-full transition-all duration-500 ${
                  installationTasks.completed === installationTasks.total 
                    ? 'bg-emerald-500' 
                    : 'bg-orange-500'
                }`}
                style={{
                  width: `${(installationTasks.completed / installationTasks.total) * 100}%`,
                }}
              />
            </div>
            
            {/* تفاصيل المهام */}
            <div className="space-y-2">
              {installationTasks.tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`text-xs py-2 ${
                    index < installationTasks.tasks.length - 1 
                      ? `border-b ${dominantHsl ? 'border-white/10' : 'border-border'}` 
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium truncate max-w-[60%] ${dominantHsl ? 'text-white' : 'text-foreground'}`}>
                      {task.billboard_name}
                    </span>
                    <div className="flex items-center gap-1">
                      {task.status === 'completed' ? (
                        <>
                          <CheckCircle className={`h-3 w-3 ${dominantHsl ? 'text-emerald-300' : 'text-emerald-600'}`} />
                          <span className={`${dominantHsl ? 'text-emerald-300' : 'text-emerald-600'}`}>مكتمل</span>
                        </>
                      ) : (
                        <>
                          <Clock className={`h-3 w-3 ${dominantHsl ? 'text-amber-300' : 'text-amber-600'}`} />
                          <span className={`${dominantHsl ? 'text-amber-300' : 'text-amber-600'}`}>قيد الانتظار</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* المنطقة وأقرب نقطة دالة */}
                  <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${dominantHsl ? 'text-white/60' : 'text-muted-foreground'}`}>
                    {task.district && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className={`h-3 w-3 ${dominantHsl ? 'text-rose-300' : 'text-rose-500'}`} />
                        {task.district}
                      </span>
                    )}
                    {task.nearest_landmark && (
                      <span className="flex items-center gap-0.5 truncate">
                        <Landmark className={`h-3 w-3 shrink-0 ${dominantHsl ? 'text-sky-300' : 'text-sky-500'}`} />
                        {task.nearest_landmark}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {installationTasks.total > 2 && (
                <div className={`text-xs text-center pt-1 ${dominantHsl ? 'text-white/60' : 'text-muted-foreground'}`}>
                  +{installationTasks.total - 2} مهام أخرى
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* شريط السداد - محسّن وأوضح */}
        <div 
          className={`mb-4 p-3 rounded-xl border-2 ${dominantHsl ? 'bg-white/10 border-white/20' : 'bg-muted/50 border-border'}`}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className={`h-4 w-4 ${dominantHsl ? 'text-white/70' : 'text-primary'}`} />
              <span className={`font-semibold ${dominantHsl ? 'text-white' : 'text-foreground'}`}>نسبة السداد</span>
            </div>
            <span className={`text-2xl font-bold font-manrope ${dominantHsl ? 'text-white' : 'text-primary'}`}>
              {paymentPercentage.toFixed(0)}%
            </span>
          </div>
          <div className={`relative h-4 rounded-full overflow-hidden ${dominantHsl ? 'bg-white/20' : 'bg-muted'}`}>
            <div 
              className="absolute inset-y-0 right-0 rounded-full transition-all duration-500 bg-primary"
              style={{
                width: `${Math.min(paymentPercentage, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className={`text-sm ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>
              المدفوع:{' '}
              <span className={`font-bold font-manrope text-base ${dominantHsl ? 'text-white' : 'text-primary'}`}>
                {totalPaid.toLocaleString('ar-LY')} د.ل
              </span>
            </span>
            <span className={`text-sm ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>
              المتبقي:{' '}
              <span className={`font-bold font-manrope text-base ${dominantHsl ? 'text-white' : 'text-foreground'}`}>
                {remaining.toLocaleString('ar-LY')} د.ل
              </span>
            </span>
          </div>

          {/* ✅ متأخر/متوازن/متقدم تحت شريط السداد */}
          <div className="mt-2">
            <Badge
              variant={progress.variant}
              className={`gap-1 ${dominantHsl ? 'bg-white/20 text-white border-white/30' : ''}`}
            >
              {progress.icon}
              <span className="text-sm font-medium">{progress.label}</span>
            </Badge>
          </div>
        </div>
        
        {/* التكاليف */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className={`text-sm ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>الإيجار</span>
            <span className={`font-bold font-manrope text-base ${dominantHsl ? 'text-white' : 'text-primary'}`}>
              {totalRent.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
          
          {installationCost > 0 && (
            <div className="flex justify-between items-center">
              <div className={`flex items-center gap-1 text-sm ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>
                <Wrench className="h-3 w-3" />
                <span>التركيب</span>
              </div>
              <span className={`font-semibold font-manrope text-base ${dominantHsl ? 'text-white/90' : 'text-foreground'}`}>
                {installationCost.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          {printCost > 0 && (
            <div className="flex justify-between items-center">
              <div className={`flex items-center gap-1 text-sm ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>
                <PaintBucket className="h-3 w-3" />
                <span>الطباعة</span>
              </div>
              <span className={`font-semibold font-manrope text-base ${dominantHsl ? 'text-white/90' : 'text-foreground'}`}>
                {printCost.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          {operatingFee > 0 && (
            <div className="flex justify-between items-center">
              <div className={`flex items-center gap-1 text-sm ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>
                <Percent className="h-3 w-3" />
                <span>رسوم التشغيل</span>
              </div>
              <span className={`font-semibold font-manrope text-base ${dominantHsl ? 'text-white/90' : 'text-foreground'}`}>
                {operatingFee.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          {discount > 0 && (
            <div className="flex justify-between items-center">
              <div className={`flex items-center gap-1 text-sm ${dominantHsl ? 'text-white/70' : 'text-muted-foreground'}`}>
                <TrendingDown className="h-3 w-3" />
                <span>التخفيض</span>
              </div>
              <span className={`font-semibold font-manrope text-base ${dominantHsl ? 'text-rose-300' : 'text-destructive'}`}>
                - {discount.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          <div className={`border-t pt-2 flex justify-between items-center ${dominantHsl ? 'border-white/20' : ''}`}>
            <span className={`font-semibold ${dominantHsl ? 'text-white' : ''}`}>المجموع الكلي</span>
            <span className={`font-bold font-manrope text-xl ${dominantHsl ? 'text-white' : 'text-primary'}`}>{finalTotalCost.toLocaleString('ar-LY')} د.ل</span>
          </div>
        </div>
        {/* الأزرار السريعة */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/admin/contracts/view/${contract.id}`)}
            className="flex-1 gap-1"
          >
            <Eye className="h-4 w-4" />
            عرض
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPrint(contract)}
            className="flex-1 gap-1"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
          {onPrintAll && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPrintAll(contract)}
              className="flex-1 gap-1"
              title="طباعة الكل"
            >
              <Printer className="h-4 w-4" />
              طباعة الكل
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/admin/contracts/edit?contract=${contract.id}`)}
            className="flex-1 gap-1"
          >
            <Edit className="h-4 w-4" />
            تعديل
          </Button>
          <AddPaymentDialog
            contractNumber={contractNumber}
            customerName={contract.customer_name || ''}
            customerId={(contract as any).customer_id}
            onPaymentAdded={onRefresh}
          />
        </div>
      </CardContent>
    </Card>
  );
};
