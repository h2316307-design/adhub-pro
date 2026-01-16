import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle2,
  Clock,
  ChevronDown,
  MoreVertical,
  Users,
  MapPin,
  Sparkles,
  ArrowRight,
  PaintBucket,
  Layers,
  Edit,
  Trash2,
  Printer,
  Package,
  FileText,
  Calendar,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface MobileTaskCardProps {
  task: any;
  contract: any;
  contractById: Record<number, any>;
  team: any;
  taskItems: any[];
  taskDesigns: any[];
  isSelected: boolean;
  children?: React.ReactNode;
  designImage?: string;
  installationPricingByBillboard?: Record<number, number>;
  onToggleSelect: () => void;
  onManageDesigns: () => void;
  onDistributeDesigns: () => void;
  onEditTaskType: () => void;
  onTransferBillboards: () => void;
  onPrintAll: () => void;
  onDelete: () => void;
  onCreatePrintTask: () => void;
  onCompleteBillboards: () => void;
  onSetInstallationDate: () => void;
  onUnmerge?: () => void;
  onNavigateToPrint?: () => void;
  onNavigateToCutout?: () => void;
  onCreateCompositeTask?: () => void;
  onDeletePrintTask?: () => void;
}

export function MobileTaskCard({
  task,
  contract,
  contractById,
  team,
  taskItems,
  taskDesigns,
  isSelected,
  children,
  designImage,
  installationPricingByBillboard = {},
  onToggleSelect,
  onManageDesigns,
  onDistributeDesigns,
  onEditTaskType,
  onTransferBillboards,
  onPrintAll,
  onDelete,
  onCreatePrintTask,
  onCompleteBillboards,
  onSetInstallationDate,
  onUnmerge,
  onNavigateToPrint,
  onNavigateToCutout,
  onCreateCompositeTask,
  onDeletePrintTask
}: MobileTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isMergedTask = task.contract_ids && task.contract_ids.length > 0;
  const taskContractIds = isMergedTask ? task.contract_ids : [task.contract_id];
  
  const completedItems = taskItems.filter(i => i.status === 'completed').length;
  const completionPercentage = taskItems.length > 0 
    ? Math.round((completedItems / taskItems.length) * 100) 
    : 0;
  const isFullyCompleted = completedItems === taskItems.length && taskItems.length > 0;
  const isPartiallyCompleted = completedItems > 0 && !isFullyCompleted;

  // حساب تكلفة التركيب من جدول التسعير
  const totalInstallCost = taskItems.reduce((sum, item) => {
    const price = installationPricingByBillboard[item.billboard_id] || 0;
    return sum + price;
  }, 0);
  const customerTotal = taskItems.reduce((sum, item) => sum + (item.customer_installation_cost || 0), 0);
  const additionalTotal = taskItems.reduce((sum, item) => sum + (item.additional_cost || 0), 0);
  const pendingItems = taskItems.filter(i => i.status !== 'completed').length;

  // جمع كل صور التصميم من عناصر المهمة
  const allDesignImages = taskItems
    .flatMap(item => [item.design_face_a, item.design_face_b])
    .filter(Boolean) as string[];
  const uniqueDesignImages = [...new Set(allDesignImages)].slice(0, 4);

  // أول صورة تصميم لاستخدامها كخلفية
  const primaryDesignImage = uniqueDesignImages[0];

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 border-2",
      isFullyCompleted && "border-emerald-300",
      isPartiallyCompleted && "border-amber-300",
      !isFullyCompleted && !isPartiallyCompleted && "border-border hover:border-primary/30",
      isSelected && "ring-2 ring-primary ring-offset-2"
    )}>
      {/* خلفية مستوحاة من التصميم */}
      {primaryDesignImage && (
        <div 
          className="absolute inset-0 opacity-[0.08] dark:opacity-[0.12]"
          style={{ 
            backgroundImage: `url(${primaryDesignImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(30px) saturate(1.5)',
          }}
        />
      )}
      
      {/* شريط التقدم في الأعلى */}
      {taskItems.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-muted/50 overflow-hidden z-10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
              "h-full",
              isFullyCompleted 
                ? 'bg-gradient-to-r from-emerald-500 to-green-500' 
                : 'bg-gradient-to-r from-primary to-primary/70'
            )}
          />
        </div>
      )}

      {/* التخطيط الرئيسي: المحتوى على اليسار + التصميم على اليمين */}
      <div className="relative flex flex-row-reverse min-h-[160px]" dir="ltr">
        {/* قسم التصميم على اليمين */}
        {uniqueDesignImages.length > 0 && (
          <div className="relative w-32 sm:w-40 md:w-48 flex-shrink-0 border-l border-border/30">
            {/* خلفية ضبابية من التصميم */}
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundImage: `url(${primaryDesignImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(20px) brightness(0.8)',
                opacity: 0.6
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/80" />
            
            {/* شبكة الصور */}
            <div className={cn(
              "relative h-full p-2 grid gap-1.5 z-10",
              uniqueDesignImages.length === 1 && "grid-rows-1",
              uniqueDesignImages.length === 2 && "grid-rows-2",
              uniqueDesignImages.length >= 3 && "grid-rows-2 grid-cols-2"
            )}>
              {uniqueDesignImages.slice(0, 4).map((img, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative rounded-lg overflow-hidden border border-white/20 shadow-lg group cursor-pointer"
                >
                  <img 
                    src={img} 
                    alt={`تصميم ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {uniqueDesignImages.length > 1 && (
                    <Badge 
                      className="absolute bottom-1 right-1 text-[9px] px-1.5 py-0 bg-black/70 text-white border-0 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {idx + 1}
                    </Badge>
                  )}
                </motion.div>
              ))}
            </div>
            
            {/* عداد التصاميم */}
            <div className="absolute bottom-1 left-1 z-20">
              <Badge className="text-[10px] px-1.5 py-0.5 bg-black/60 text-white border-0 backdrop-blur-sm gap-1">
                <PaintBucket className="h-3 w-3" />
                {uniqueDesignImages.length}
              </Badge>
            </div>
          </div>
        )}

        {/* قسم المحتوى على اليسار */}
        <div className="flex-1" dir="rtl">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            {/* الجزء الرئيسي - دائماً ظاهر */}
            <div className="relative p-4 space-y-3 pt-5">
          {/* الصف الأول: رقم العقد + نوع المهمة + زر الإجراءات */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              {/* Checkbox */}
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelect}
                  className="h-5 w-5 rounded border-2 border-primary text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* أرقام العقود */}
              {isMergedTask ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {taskContractIds.slice(0, 2).map((contractId: number, index: number) => (
                    <Badge 
                      key={contractId}
                      variant="outline" 
                      className="font-bold text-xs bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
                    >
                      #{contractId}
                    </Badge>
                  ))}
                  {taskContractIds.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{taskContractIds.length - 2}
                    </Badge>
                  )}
                  <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs border-0">
                    مدمجة
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Badge 
                    variant="outline" 
                    className="font-bold text-sm bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
                  >
                    #{task.contract_id}
                  </Badge>
                  {contract?.['Ad Type'] && (
                    <Badge variant="secondary" className="text-xs">
                      {contract['Ad Type']}
                    </Badge>
                  )}
                </div>
              )}

              {/* نوع المهمة */}
              {task.task_type === 'reinstallation' ? (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0 gap-1">
                  <ArrowRight className="h-3 w-3" />
                  إعادة تركيب
                </Badge>
              ) : (
                <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs border-0 gap-1">
                  <Sparkles className="h-3 w-3" />
                  تركيب جديد
                </Badge>
              )}
            </div>

            {/* زر الإجراءات */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={onManageDesigns} className="gap-2">
                    <PaintBucket className="h-4 w-4" />
                    إدارة التصاميم
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDistributeDesigns} className="gap-2">
                    <Layers className="h-4 w-4" />
                    توزيع التصاميم
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onEditTaskType} className="gap-2">
                    <Edit className="h-4 w-4" />
                    تعديل النوع
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onTransferBillboards} className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    نقل لوحات
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onPrintAll} className="gap-2">
                    <FileText className="h-4 w-4" />
                    طباعة الكل
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!task.print_tasks && !task.cutout_tasks && (
                    <DropdownMenuItem onClick={onCreatePrintTask} className="gap-2">
                      <Printer className="h-4 w-4" />
                      إنشاء مهام طباعة/مجسمات
                    </DropdownMenuItem>
                  )}
                  {pendingItems > 0 && (
                    <>
                      <DropdownMenuItem onClick={onCompleteBillboards} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        إكمال اللوحات
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onSetInstallationDate} className="gap-2">
                        <Calendar className="h-4 w-4" />
                        تحديد تاريخ تركيب
                      </DropdownMenuItem>
                    </>
                  )}
                  {task.task_type === 'reinstallation' && onCreateCompositeTask && (
                    <DropdownMenuItem onClick={onCreateCompositeTask} className="gap-2 text-amber-600">
                      <Plus className="h-4 w-4" />
                      مهمة مجمعة
                    </DropdownMenuItem>
                  )}
                  {isMergedTask && onUnmerge && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onUnmerge} className="gap-2 text-orange-600">
                        <ArrowRight className="h-4 w-4 rotate-180" />
                        التراجع عن الدمج
                      </DropdownMenuItem>
                    </>
                  )}
                  {task.print_task_id && onDeletePrintTask && (
                    <DropdownMenuItem onClick={onDeletePrintTask} className="gap-2 text-destructive">
                      <Trash2 className="h-4 w-4" />
                      حذف مهمة الطباعة
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    حذف المهمة
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* الصف الثاني: اسم الزبون + الفريق */}
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-base sm:text-lg truncate max-w-[200px]">
              {contract?.['Customer Name'] || 'غير محدد'}
            </h3>
            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="truncate max-w-[100px]">{team?.team_name || 'غير محدد'}</span>
            </div>
          </div>

          {/* الصف الثالث: الإحصائيات */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* عدد اللوحات */}
            <div className="flex items-center gap-1 text-xs sm:text-sm">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{taskItems.length} لوحة</span>
            </div>

            {/* حالة الإكمال */}
            {isFullyCompleted ? (
              <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs gap-1 px-2">
                <CheckCircle2 className="h-3 w-3" />
                مكتملة
              </Badge>
            ) : isPartiallyCompleted ? (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs gap-1 px-2">
                <Clock className="h-3 w-3" />
                {completedItems}/{taskItems.length}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs gap-1">
                <Clock className="h-3 w-3" />
                لم تبدأ
              </Badge>
            )}

            {/* حالة الطباعة والمجسمات */}
            {task.print_tasks && (
              <Badge 
                className={cn(
                  "cursor-pointer text-xs gap-1",
                  task.print_tasks.status === 'completed' 
                    ? 'bg-emerald-500 hover:bg-emerald-600' 
                    : task.print_tasks.status === 'in_progress' 
                      ? 'bg-amber-500 hover:bg-amber-600' 
                      : 'bg-red-500 hover:bg-red-600'
                )}
                onClick={onNavigateToPrint}
              >
                <Printer className="h-3 w-3" />
                طباعة
              </Badge>
            )}
            
            {task.cutout_tasks && (
              <Badge 
                className={cn(
                  "cursor-pointer text-xs gap-1",
                  task.cutout_tasks.status === 'completed' 
                    ? 'bg-emerald-500 hover:bg-emerald-600' 
                    : task.cutout_tasks.status === 'in_progress' 
                      ? 'bg-amber-500 hover:bg-amber-600' 
                      : 'bg-red-500 hover:bg-red-600'
                )}
                onClick={onNavigateToCutout}
              >
                <Package className="h-3 w-3" />
                مجسمات
              </Badge>
            )}
          </div>

          {/* الصف الرابع: التكاليف */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
              الفريق: <span className="font-manrope font-semibold">{totalInstallCost.toLocaleString('ar-LY')}</span> د.ل
            </Badge>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
              الزبون: <span className="font-manrope font-semibold">{customerTotal.toLocaleString('ar-LY')}</span> د.ل
            </Badge>
            {additionalTotal > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                إضافية: +<span className="font-manrope font-semibold">{additionalTotal.toLocaleString('ar-LY')}</span> د.ل
              </Badge>
            )}
          </div>

          {/* أزرار الإجراءات السريعة */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onManageDesigns}
              className="flex-1 h-8 text-xs gap-1.5 hover:bg-primary hover:text-primary-foreground"
            >
              <PaintBucket className="h-3.5 w-3.5" />
              التصاميم
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDistributeDesigns}
              className="flex-1 h-8 text-xs gap-1.5 hover:bg-primary hover:text-primary-foreground"
            >
              <Layers className="h-3.5 w-3.5" />
              توزيع
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onPrintAll}
              className="flex-1 h-8 text-xs gap-1.5 hover:bg-primary hover:text-primary-foreground"
            >
              <FileText className="h-3.5 w-3.5" />
              طباعة
            </Button>
          </div>

          {/* زر الطي/الفتح - كبير وواضح */}
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full h-10 mt-2 flex items-center justify-center gap-2 hover:bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg"
            >
              <span className="text-sm text-muted-foreground">
                {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل واللوحات'}
              </span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* المحتوى القابل للطي */}
        <CollapsibleContent>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-dashed border-muted-foreground/20"
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </Card>
  );
}
