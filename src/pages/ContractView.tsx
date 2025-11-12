import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { ArrowLeft, Calendar, User, DollarSign, MapPin, FileText, Percent, Wrench, Eye, Phone, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';

interface Contract {
  [key: string]: any; // Allow any field name
}

interface BillboardData {
  id: string;
  name: string;
  location: string;
  city: string;
  size: string;
  level: string;
  price: number;
  image?: string;
  faces?: number;
}

export default function ContractView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [billboards, setBillboards] = useState<BillboardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadContract();
    }
  }, [id]);

  const loadContract = async () => {
    try {
      setLoading(true);
      
      // First try to find by Contract_Number, then by ID
      let { data, error } = await (supabase as any)
        .from('Contract')
        .select('*')
        .eq('Contract_Number', id)
        .single();

      // If not found by Contract_Number, try by ID
      if (error && error.code === 'PGRST116') {
        const { data: dataById, error: errorById } = await (supabase as any)
          .from('Contract')
          .select('*')
          .eq('ID', id)
          .single();
        
        data = dataById;
        error = errorById;
      }

      if (error) {
        console.error('Error loading contract:', error);
        toast.error('فشل في تحميل العقد');
        return;
      }

      console.log('Contract data loaded:', data); // Debug log
      console.log('Available fields:', Object.keys(data)); // Show all available fields
      setContract(data);
      
      // Load billboards based on billboard_ids or billboards_data
      await loadBillboardsFromContract(data);
      
    } catch (error) {
      console.error('Error loading contract:', error);
      toast.error('فشل في تحميل العقد');
    } finally {
      setLoading(false);
    }
  };

  const loadBillboardsFromContract = async (contractData: Contract) => {
    try {
      let billboardsToLoad: BillboardData[] = [];

      // Method 1: Load from billboard_ids (preferred method)
      if (contractData.billboard_ids) {
        console.log('Loading billboards from billboard_ids:', contractData.billboard_ids);
        const ids = contractData.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
        
        if (ids.length > 0) {
          const { data: billboardsData, error } = await (supabase as any)
            .from('Billboard')
            .select('ID, Billboard_Name, Size, City, Level, Nearest_Landmark, faces, face_count, Image, image_url, Image_URL, price')
            .in('ID', ids);

          if (!error && billboardsData) {
            billboardsToLoad = billboardsData.map((b: any) => ({
              id: String(b.ID),
              name: b.Billboard_Name || `Billboard ${b.ID}`,
              location: b.Nearest_Landmark || '',
              city: b.City || '',
              size: b.Size || '',
              level: b.Level || 'A',
              price: Number(b.price) || 0,
              faces: b.faces || b.face_count || 2,
              image: b.Image || b.image_url || b.Image_URL || ''
            }));
            console.log('Loaded billboards from billboard_ids:', billboardsToLoad);
          }
        }
      }

      // Method 2: Fallback to billboards_data (JSON stored data)
      if (billboardsToLoad.length === 0 && contractData.billboards_data) {
        console.log('Loading billboards from billboards_data');
        try {
          const billboardsData = JSON.parse(contractData.billboards_data);
          if (Array.isArray(billboardsData)) {
            billboardsToLoad = billboardsData;
            console.log('Loaded billboards from billboards_data:', billboardsToLoad);
          }
        } catch (e) {
          console.warn('Failed to parse billboards_data:', e);
        }
      }

      // Method 3: Legacy method - load from separate Billboard IDs field
      if (billboardsToLoad.length === 0) {
        const billboardIdsField = contractData['Billboard IDs'] || contractData.billboard_ids_legacy;
        if (billboardIdsField) {
          console.log('Loading billboards from legacy Billboard IDs field');
          await loadBillboardsFromIds(billboardIdsField);
          return;
        }
      }

      setBillboards(billboardsToLoad);
    } catch (error) {
      console.error('Error loading billboards from contract:', error);
      setBillboards([]);
    }
  };

  const loadBillboardsFromIds = async (billboardIds: string) => {
    try {
      const ids = billboardIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      
      if (ids.length === 0) return;

      const { data, error } = await (supabase as any)
        .from('Billboard')
        .select('ID, Billboard_Name, Size, City, Level, Nearest_Landmark, faces, face_count, Image, image_url, Image_URL, price')
        .in('ID', ids);

      if (!error && data) {
        const formattedBillboards: BillboardData[] = data.map((b: any) => ({
          id: String(b.ID),
          name: b.Billboard_Name || `Billboard ${b.ID}`,
          location: b.Nearest_Landmark || '',
          city: b.City || '',
          size: b.Size || '',
          level: b.Level || 'A',
          price: Number(b.price) || 0,
          faces: b.faces || b.face_count || 2,
          image: b.Image || b.image_url || b.Image_URL || ''
        }));
        setBillboards(formattedBillboards);
        console.log('Loaded billboards from legacy method:', formattedBillboards);
      }
    } catch (error) {
      console.error('Error loading billboards from IDs:', error);
    }
  };

  // Helper functions to get data from contract with multiple field name possibilities
  const getFieldValue = (contract: Contract, ...fieldNames: string[]) => {
    for (const fieldName of fieldNames) {
      if (contract[fieldName] !== undefined && contract[fieldName] !== null && contract[fieldName] !== '') {
        console.log(`Found value for ${fieldName}:`, contract[fieldName]);
        return contract[fieldName];
      }
    }
    console.log(`No value found for fields:`, fieldNames);
    return '';
  };

  const getNumericFieldValue = (contract: Contract, ...fieldNames: string[]) => {
    for (const fieldName of fieldNames) {
      const value = contract[fieldName];
      if (value !== undefined && value !== null && !isNaN(Number(value))) {
        const numValue = Number(value);
        console.log(`Found numeric value for ${fieldName}:`, numValue);
        return numValue;
      }
    }
    console.log(`No numeric value found for fields:`, fieldNames);
    return 0;
  };

  const getContractStatus = () => {
    if (!contract) return { status: 'غير محدد', color: 'bg-gray-100 text-gray-800' };
    
    const today = new Date();
    const endDateStr = getFieldValue(contract, 'End Date', 'end_date', 'End_Date');
    const endDate = endDateStr ? new Date(endDateStr) : null;
    const totalPaid = getNumericFieldValue(contract, 'Total Paid', 'total_paid', 'Total_Paid');
    const totalCost = getNumericFieldValue(contract, 'Total', 'total_cost', 'Total_Cost', 'Total Rent', 'rent_cost');
    const remaining = getNumericFieldValue(contract, 'Remaining', 'remaining') || (totalCost - totalPaid);

    if (remaining <= 0) {
      return { status: 'مدفوع بالكامل', color: 'bg-green-100 text-green-800' };
    } else if (endDate && endDate < today) {
      return { status: 'منتهي', color: 'bg-red-100 text-red-800' };
    } else if (remaining > 0) {
      return { status: 'مستحق جزئياً', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { status: 'نشط', color: 'bg-blue-100 text-blue-800' };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('ar-LY');
    } catch {
      return dateString; // Return as-is if parsing fails
    }
  };

  const getDaysRemaining = () => {
    if (!contract) return 0;
    const today = new Date();
    const endDateStr = getFieldValue(contract, 'End Date', 'end_date', 'End_Date');
    if (!endDateStr) return 0;
    
    try {
      const endDate = new Date(endDateStr);
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6" dir="rtl">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mr-3 text-muted-foreground">جاري تحميل العقد...</p>
        </div>
      </div>
    );
  };

  if (!contract) {
    return (
      <div className="container mx-auto px-4 py-6" dir="rtl">
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-muted-foreground">العقد غير موجود</h2>
          <p className="text-muted-foreground mt-2">العقد رقم {id} غير موجود في النظام</p>
          <Button onClick={() => navigate('/admin/contracts')} className="mt-4">
            العودة إلى قائمة العقود
          </Button>
        </div>
      </div>
    );
  }

  const { status, color } = getContractStatus();
  const daysRemaining = getDaysRemaining();

  // Get values ONLY from database columns - NO CALCULATIONS AT ALL
  const customerName = getFieldValue(contract, 'Customer Name', 'customer_name', 'Customer_Name', 'Customer');
  const customerCategory = getFieldValue(contract, 'Customer Category', 'customer_category', 'Customer_Category') || 'عادي';
  const adType = getFieldValue(contract, 'Ad Type', 'ad_type', 'Ad_Type') || 'غير محدد';
  const startDate = getFieldValue(contract, 'Contract Date', 'start_date', 'Start_Date', 'Start Date');
  const endDate = getFieldValue(contract, 'End Date', 'end_date', 'End_Date');
  
  // Financial values - READ ONLY from database columns, NO calculations
  const rentCost = getNumericFieldValue(contract, 'Total Rent', 'rent_cost', 'Rent_Cost');
  const installationCost = getNumericFieldValue(contract, 'Installation Cost', 'installation_cost', 'Installation_Cost');
  const operatingFee = getNumericFieldValue(contract, 'Operating Fee', 'operating_fee', 'fee', 'Fee');
  const operatingFeeRate = getNumericFieldValue(contract, 'Operating Fee Rate', 'operating_fee_rate', 'Operating_Fee_Rate') || 3;
  const discount = getNumericFieldValue(contract, 'Discount', 'discount');
  const grossRentalCost = getNumericFieldValue(contract, 'Gross Rental Cost', 'gross_rental_cost', 'Gross_Rental_Cost');
  const netRentalCostBeforeOperatingFee = getNumericFieldValue(contract, 'Net Rental Cost Before Operating Fee', 'net_rental_cost_before_operating_fee');
  
  // Total cost - READ ONLY from database, NO calculations whatsoever
  const totalCost = getNumericFieldValue(contract, 'Total', 'total_cost', 'Total_Cost', 'Total Cost');

  // Billboard IDs for display
  const billboardIds = contract.billboard_ids || '';

  // Log all final values
  console.log('Final values (NO calculations):', {
    customerName,
    startDate,
    endDate,
    rentCost,
    installationCost,
    operatingFee,
    discount,
    totalCost,
    grossRentalCost,
    netRentalCostBeforeOperatingFee,
    billboardIds,
    billboardsCount: billboards.length
  });

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/contracts')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Eye className="h-8 w-8 text-primary" />
              عرض العقد #{contract.Contract_Number || contract.ID}
            </h1>
            <p className="text-muted-foreground">تفاصيل كاملة للعقد مع معلومات اللوحات والتكلفة</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/contracts/edit?contract=${contract.Contract_Number || contract.ID}`)}
          >
            تعديل العقد
          </Button>
          <Badge className={`${color} border-0 text-lg px-4 py-2`}>
            {status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Contract Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card className="bg-card border-border shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <User className="h-5 w-5 text-primary" />
                معلومات الزبون
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">اسم الزبون</label>
                  <div className="text-lg font-semibold text-card-foreground">{customerName || 'غير محدد'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">فئة العميل</label>
                  <div className="text-lg text-card-foreground">{customerCategory}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">نوع الإعلان</label>
                  <div className="text-lg text-card-foreground">{adType}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">عدد اللوحات</label>
                  <div className="text-lg font-semibold text-primary">
                    {getNumericFieldValue(contract, 'billboards_count', 'Billboards_Count') || billboards.length || 0} لوحة
                  </div>
                </div>
              </div>
              {billboardIds && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">معرفات اللوحات</label>
                  <div className="text-sm text-card-foreground bg-muted p-2 rounded">{billboardIds}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contract Timeline */}
          <Card className="bg-card border-border shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Calendar className="h-5 w-5 text-primary" />
                المدة الزمنية للعقد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">تاريخ البداية</label>
                  <div className="text-lg font-semibold text-card-foreground">{formatDate(startDate) || 'غير محدد'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">تاريخ النهاية</label>
                  <div className="text-lg font-semibold text-card-foreground">{formatDate(endDate) || 'غير محدد'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">الأيام المتبقية</label>
                  <div className={`text-lg font-semibold ${daysRemaining < 0 ? 'text-red-400' : daysRemaining < 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {endDate ? (daysRemaining < 0 ? `منتهي منذ ${Math.abs(daysRemaining)} يوم` : `${daysRemaining} يوم`) : 'غير محدد'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billboards Information */}
          <Card className="bg-card border-border shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <MapPin className="h-5 w-5 text-primary" />
                اللوحات الإعلانية ({billboards.length})
                {billboardIds && (
                  <span className="text-xs text-muted-foreground">
                    من معرفات: {billboardIds}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {billboards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {billboardIds ? 
                    `لا يمكن العثور على اللوحات بالمعرفات: ${billboardIds}` : 
                    'لا توجد معلومات عن اللوحات'
                  }
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {billboards.map((billboard, index) => (
                    <Card key={billboard.id} className="bg-muted border-border overflow-hidden">
                      <CardContent className="p-0">
                        {/* Billboard Image */}
                        {billboard.image && (
                          <div className="relative h-48 w-full overflow-hidden">
                            <img
                              src={billboard.image}
                              alt={billboard.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Billboard Details */}
                        <div className="p-4 space-y-2">
                          <div className="font-semibold text-lg text-foreground">{billboard.name}</div>
                          <div className="text-xs text-muted-foreground">ID: {billboard.id}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {billboard.location} - {billboard.city}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">الحجم: <span className="font-medium text-foreground">{billboard.size}</span></span>
                            <span className="text-muted-foreground">المستوى: <span className="font-medium text-foreground">{billboard.level}</span></span>
                          </div>
                          {billboard.faces && (
                            <div className="flex items-center gap-1 text-sm text-primary">
                              <Eye className="h-3 w-3" />
                              <span>{billboard.faces} {billboard.faces === 1 ? 'وجه' : 'أوجه'}</span>
                            </div>
                          )}
                          {billboard.price > 0 && (
                            <div className="text-sm">
                              السعر: <span className="font-medium text-primary">{formatCurrency(billboard.price)} د.ل</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary Sidebar */}
        <div className="space-y-6">
          {/* Cost Breakdown */}
          <Card className="bg-card border-border shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <DollarSign className="h-5 w-5 text-primary" />
                تفاصيل التكلفة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Gross Rental Cost */}
              {grossRentalCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">إجمالي الإيجار قبل الخصم:</span>
                  <span className="font-semibold text-card-foreground">{formatCurrency(grossRentalCost)} د.ل</span>
                </div>
              )}

              {/* Discount */}
              {discount > 0 && (
                <div className="flex justify-between items-center text-red-400">
                  <span className="text-sm">الخصم:</span>
                  <span className="font-semibold">-{formatCurrency(discount)} د.ل</span>
                </div>
              )}

              {/* Net Rental Cost Before Operating Fee */}
              {netRentalCostBeforeOperatingFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">صافي الإيجار قبل نسبة التشغيل:</span>
                  <span className="font-semibold text-card-foreground">{formatCurrency(netRentalCostBeforeOperatingFee)} د.ل</span>
                </div>
              )}

              {/* Operating Fee */}
              {operatingFee > 0 && (
                <div className="bg-secondary/20 border border-secondary/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-card-foreground">نسبة التشغيل</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      ({operatingFeeRate}%)
                    </span>
                    <span className="font-semibold text-card-foreground">
                      {formatCurrency(operatingFee)} د.ل
                    </span>
                  </div>
                </div>
              )}

              {/* Final Rental Cost */}
              {rentCost > 0 && (
                <div className="flex justify-between items-center border-t border-border pt-3">
                  <span className="text-sm font-medium text-muted-foreground">صافي الإيجار:</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(rentCost)} د.ل
                  </span>
                </div>
              )}

              {/* Installation Cost */}
              {installationCost > 0 && (
                <div className="bg-secondary/20 border border-secondary/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-card-foreground">تكلفة التركيب</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-card-foreground text-lg">
                      {formatCurrency(installationCost)} د.ل
                    </span>
                  </div>
                </div>
              )}

              {/* Total Cost - READ ONLY from database */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 border-t-2 border-t-primary">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-card-foreground">الإجمالي النهائي:</span>
                  <span className="font-bold text-2xl text-primary">
                    {formatCurrency(totalCost)} د.ل
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card className="bg-card border-border shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <FileText className="h-5 w-5 text-primary" />
                معلومات الدفع
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {getNumericFieldValue(contract, 'Payment 1', 'payment_1') > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">الدفعة الأولى:</span>
                    <span className="font-semibold text-card-foreground">{formatCurrency(getNumericFieldValue(contract, 'Payment 1', 'payment_1'))} د.ل</span>
                  </div>
                )}
                {getNumericFieldValue(contract, 'Payment 2', 'payment_2') > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">الدفعة الثانية:</span>
                    <span className="font-semibold text-card-foreground">{formatCurrency(getNumericFieldValue(contract, 'Payment 2', 'payment_2'))} د.ل</span>
                  </div>
                )}
                {getNumericFieldValue(contract, 'Payment 3', 'payment_3') > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">الدفعة الثالثة:</span>
                    <span className="font-semibold text-card-foreground">{formatCurrency(getNumericFieldValue(contract, 'Payment 3', 'payment_3'))} د.ل</span>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">المدفوع:</span>
                  <span className="font-semibold text-green-400">
                    {formatCurrency(getNumericFieldValue(contract, 'Total Paid', 'total_paid', 'Total_Paid'))} د.ل
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">المتبقي:</span>
                  <span className={`font-semibold ${getNumericFieldValue(contract, 'Remaining', 'remaining') > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCurrency(getNumericFieldValue(contract, 'Remaining', 'remaining'))} د.ل
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contract Metadata */}
          <Card className="bg-card border-border shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <FileText className="h-5 w-5 text-primary" />
                معلومات العقد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">رقم العقد</label>
                <div className="text-lg font-semibold text-card-foreground">{contract.Contract_Number || contract.ID}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">معرف النظام</label>
                <div className="text-sm text-muted-foreground">{contract.ID}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">تاريخ الإنشاء</label>
                <div className="text-sm text-card-foreground">{formatDate(contract.created_at || '')}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">الحالة الحالية</label>
                <Badge className={`${color} border-0 mt-1`}>
                  {status}
                </Badge>
              </div>
              {billboardIds && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">معرفات اللوحات المحفوظة</label>
                  <div className="text-sm text-card-foreground bg-muted p-2 rounded font-mono">
                    {billboardIds}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    هذه المعرفات تُستخدم لاسترجاع اللوحات عند انتهاء العقد
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}