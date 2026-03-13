import { CompositeTasksListEnhanced } from '@/components/composite-tasks/CompositeTasksListEnhanced';

export default function CompositeTasks() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">المهام المجمعة</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">إدارة ومتابعة المهام المجمعة (تركيب + طباعة + قص) وحساب التكاليف والأرباح</p>
        </div>
      </div>
      <CompositeTasksListEnhanced />
    </div>
  );
}
