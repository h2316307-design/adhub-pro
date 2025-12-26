import { useState } from 'react';
import { CompositeTasksListEnhanced } from '@/components/composite-tasks/CompositeTasksListEnhanced';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Info } from 'lucide-react';

export default function CompositeTasks() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">المهام المجمعة</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            إدارة ومتابعة المهام المجمعة (تركيب + طباعة + قص) وحساب التكاليف والأرباح
          </p>
        </div>
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <Package className="h-10 w-10 md:h-12 md:w-12 text-primary" />
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">نظام المهام المجمعة</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                • يتم إنشاء المهمة المجمعة تلقائياً عند إنشاء مهمة طباعة من مهمة التركيب
                <br />
                • تتبع تكاليف الزبون (ما يدفعه) وتكاليف الشركة (ما تدفعه للفرق والمطابع)
                <br />
                • احسب صافي الربح ونسبة الربح لكل مهمة
                <br />
                • أنشئ فاتورة موحدة تشمل جميع التكاليف
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl text-foreground">قائمة المهام المجمعة</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            عرض وإدارة جميع المهام المجمعة مع تفاصيل التكاليف والأرباح
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="all" className="text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">الكل</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">قيد التنفيذ</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">مكتملة</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4 md:mt-6">
              <CompositeTasksListEnhanced filter="all" />
            </TabsContent>
            
            <TabsContent value="pending" className="mt-4 md:mt-6">
              <CompositeTasksListEnhanced filter="pending" />
            </TabsContent>
            
            <TabsContent value="completed" className="mt-4 md:mt-6">
              <CompositeTasksListEnhanced filter="completed" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
