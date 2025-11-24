import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, MapPin, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function FriendBillboards() {
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    notes: ''
  });

  // Fetch friend companies
  const { data: friendCompanies, refetch: refetchCompanies } = useQuery({
    queryKey: ['friend-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_companies')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch billboards with friend companies
  const { data: friendBillboards } = useQuery({
    queryKey: ['friend-billboards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select(`
          *,
          friend_companies:friend_company_id (
            id,
            name,
            contact_person,
            phone
          )
        `)
        .not('friend_company_id', 'is', null)
        .order('Billboard_Name');
      
      if (error) throw error;
      return data;
    }
  });

  const handleAddCompany = async () => {
    if (!newCompany.name.trim()) {
      toast.error('الرجاء إدخال اسم الشركة');
      return;
    }

    const { error } = await supabase
      .from('friend_companies')
      .insert([newCompany]);

    if (error) {
      toast.error('فشل إضافة الشركة');
      console.error(error);
      return;
    }

    toast.success('تمت إضافة الشركة بنجاح');
    setIsAddingCompany(false);
    setNewCompany({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      notes: ''
    });
    refetchCompanies();
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">لوحات الأصدقاء</h1>
            <p className="text-muted-foreground mt-1">
              إدارة اللوحات التابعة للشركات الصديقة
            </p>
          </div>
          
          <Dialog open={isAddingCompany} onOpenChange={setIsAddingCompany}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                إضافة شركة صديقة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة شركة صديقة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الشركة *</Label>
                  <Input
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    placeholder="اسم الشركة"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>الشخص المسؤول</Label>
                  <Input
                    value={newCompany.contact_person}
                    onChange={(e) => setNewCompany({ ...newCompany, contact_person: e.target.value })}
                    placeholder="اسم الشخص المسؤول"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                    placeholder="رقم الهاتف"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                    placeholder="البريد الإلكتروني"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={newCompany.notes}
                    onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
                    placeholder="ملاحظات إضافية"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddingCompany(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleAddCompany}>
                  إضافة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">عدد الشركات الصديقة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{friendCompanies?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">عدد اللوحات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{friendBillboards?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">اللوحات المحجوزة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {friendBillboards?.filter(b => b.Status === 'محجوز').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Friend Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              الشركات الصديقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الشركة</TableHead>
                  <TableHead>الشخص المسؤول</TableHead>
                  <TableHead>رقم الهاتف</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead className="text-center">عدد اللوحات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {friendCompanies?.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.contact_person || '-'}</TableCell>
                    <TableCell>
                      {company.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {company.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {company.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {friendBillboards?.filter(b => b.friend_company_id === company.id).length || 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Friend Billboards Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              اللوحات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم اللوحة</TableHead>
                  <TableHead>اسم اللوحة</TableHead>
                  <TableHead>الشركة الصديقة</TableHead>
                  <TableHead>الحجم</TableHead>
                  <TableHead>المستوى</TableHead>
                  <TableHead>المدينة</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {friendBillboards?.map((billboard) => (
                  <TableRow key={billboard.ID}>
                    <TableCell className="font-mono">{billboard.ID}</TableCell>
                    <TableCell className="font-medium">{billboard.Billboard_Name}</TableCell>
                    <TableCell>
                      {billboard.friend_companies?.name || '-'}
                    </TableCell>
                    <TableCell>{billboard.Size}</TableCell>
                    <TableCell>{billboard.Level}</TableCell>
                    <TableCell>{billboard.City}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={billboard.Status === 'محجوز' ? 'default' : 'secondary'}
                      >
                        {billboard.Status}
                      </Badge>
                    </TableCell>
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
