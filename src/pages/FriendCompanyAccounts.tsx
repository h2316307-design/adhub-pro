import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Building2, Calendar } from 'lucide-react';

export default function FriendCompanyAccounts() {
  // Fetch friend company financials
  const { data: financials, isLoading } = useQuery({
    queryKey: ['friend-company-financials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_company_financials')
        .select('*')
        .order('company_name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch detailed rentals
  const { data: rentals } = useQuery({
    queryKey: ['friend-rentals-detailed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_billboard_rentals')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const totalRevenue = financials?.reduce((sum: number, f: any) => sum + (Number(f.total_revenue_from_customers) || 0), 0) || 0;
  const totalPaid = financials?.reduce((sum: number, f: any) => sum + (Number(f.total_paid_to_friend) || 0), 0) || 0;
  const totalProfit = financials?.reduce((sum: number, f: any) => sum + (Number(f.total_profit) || 0), 0) || 0;

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">حسابات لوحات الأصدقاء</h1>
          <p className="text-muted-foreground mt-1">
            التقارير المالية للشركات الصديقة
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                إجمالي الإيرادات من الزبائن
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalRevenue.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                إجمالي المدفوع للأصدقاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {totalPaid.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                صافي الربح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {totalProfit.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              ملخص الشركات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
            ) : financials && financials.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الشركة</TableHead>
                    <TableHead className="text-center">عدد اللوحات</TableHead>
                    <TableHead className="text-center">عدد العقود</TableHead>
                    <TableHead className="text-right">المدفوع للصديق</TableHead>
                    <TableHead className="text-right">الإيرادات من الزبون</TableHead>
                    <TableHead className="text-right">صافي الربح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financials.map((company: any) => (
                    <TableRow key={company.company_id}>
                      <TableCell className="font-medium">{company.company_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{company.total_billboards}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{company.total_contracts}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {Number(company.total_paid_to_friend || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {Number(company.total_revenue_from_customers || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {Number(company.total_profit || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد بيانات مالية
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Rentals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              تفاصيل الإيجارات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              عدد الإيجارات: {rentals?.length || 0}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم اللوحة</TableHead>
                  <TableHead>رقم العقد</TableHead>
                  <TableHead className="text-right">المدفوع للصديق</TableHead>
                  <TableHead className="text-right">الإيراد من الزبون</TableHead>
                  <TableHead className="text-right">الربح</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals?.map((rental: any) => (
                  <TableRow key={rental.id}>
                    <TableCell className="font-mono">{rental.billboard_id}</TableCell>
                    <TableCell className="font-mono">{rental.contract_number}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {Number(rental.friend_rental_cost).toLocaleString('ar-LY')} د.ل
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {Number(rental.customer_rental_price).toLocaleString('ar-LY')} د.ل
                    </TableCell>
                    <TableCell className="text-right text-blue-600 font-bold">
                      {Number(rental.profit).toLocaleString('ar-LY')} د.ل
                    </TableCell>
                    <TableCell>{new Date(rental.start_date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell>{new Date(rental.end_date).toLocaleDateString('ar-LY')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
