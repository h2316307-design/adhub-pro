import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Billboard } from '@/types';
import { fetchAllBillboards } from '@/services/supabaseService';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { BookingSummary } from '@/components/BookingSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, Filter, MapPin, Star, Play, ArrowDown, LogOut, User, BarChart3, Check, Map as MapIconLucide, Calendar, AlertTriangle, FileText, TrendingDown, ChevronLeft, ChevronRight, Layers, Building2, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { addRequest } from '@/services/bookingService';
import { getPriceFor, CUSTOMERS } from '@/data/pricing';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_NAME, BRAND_LOGO } from '@/lib/branding';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { HomeMap } from '@/components/Map/HomeMap';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface ExpiredContract {
  Contract_Number: number;
  'Customer Name': string;
  'End Date': string;
  Total: number;
  billboards_count: number;
}

const Index = () => {
  const { user, logout, isAdmin } = useAuth();
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [selectedBillboards, setSelectedBillboards] = useState<Billboard[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('متاحة');
  const [loading, setLoading] = useState(true);
  const [myOnly, setMyOnly] = useState(false);
  const [selectedContractNumbers, setSelectedContractNumbers] = useState<string[]>([]);
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');
  const [adTypeFilter, setAdTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expiredContracts, setExpiredContracts] = useState<ExpiredContract[]>([]);
  const PAGE_SIZE = 9;

  useEffect(() => {
    loadBillboards();
    loadExpiredContracts();
  }, []);

  const loadBillboards = async () => {
    setLoading(true);
    try {
      const data = await fetchAllBillboards();
      setBillboards(data);
    } catch (error) {
      console.error('Error in loadBillboards:', error);
      toast({
        title: "خطأ في تحميل البيانات",
        description: "تعذر تحميل اللوحات الإعلانية",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExpiredContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "End Date", Total, billboards_count')
        .lt('End Date', new Date().toISOString().split('T')[0])
        .order('End Date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setExpiredContracts(data || []);
    } catch (error) {
      console.error('Error loading expired contracts:', error);
    }
  };

  const filteredBillboards = billboards.filter(billboard => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || [
      billboard.Billboard_Name,
      billboard.District,
      billboard.City,
      billboard.Municipality,
      billboard.Nearest_Landmark,
      billboard.Size,
      billboard.Level,
      (billboard as any).Customer_Name,
      (billboard as any).Ad_Type,
      (billboard as any)['Ad Type'],
      String(billboard.ID),
      String((billboard as any).Contract_Number ?? (billboard as any)['Contract Number'] ?? '')
    ].some((v) => String(v || '').toLowerCase().includes(q));
    const matchesSize = sizeFilter === 'all' || billboard.Size === sizeFilter;
    const matchesMunicipality = municipalityFilter === 'all' || (billboard.Municipality ?? '') === municipalityFilter;
    const adTypeVal = String((billboard as any).Ad_Type ?? (billboard as any)['Ad Type'] ?? '');
    const matchesAdType = adTypeFilter === 'all' || adTypeVal === adTypeFilter;

    const statusVal = String((billboard as any).Status || (billboard as any).status || '').trim();
    const isAvailable = statusVal === 'متاح' || (!billboard.Contract_Number && statusVal !== 'صيانة');
    const isBooked = statusVal === 'مؤجر' || statusVal === 'محجوز';

    let isNearExpiry = false;
    if (billboard.Rent_End_Date) {
      try {
        const endDate = new Date(billboard.Rent_End_Date);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isNearExpiry = diffDays <= 20 && diffDays > 0;
      } catch {
        isNearExpiry = false;
      }
    }

    const allowed = Array.isArray((user as any)?.allowedCustomers)
      ? ((user as any).allowedCustomers as string[]).map((s) => String(s).trim().toLowerCase())
      : [];
    const customerName = String(billboard.Customer_Name ?? '').trim().toLowerCase();
    const isAllowedBoard = allowed.length > 0 && allowed.includes(customerName);

    const finalStatusMatch =
      (statusFilter === 'متاحة' && isAvailable) ||
      (statusFilter === 'محجوز' && isBooked) ||
      (statusFilter === 'قريبة الانتهاء' && isNearExpiry);

    const boardContract = String((billboard as any).Contract_Number ?? (billboard as any)['Contract Number'] ?? '').trim();
    const appliesContractFilter = isAdmin ? selectedContractNumbers.length > 0 : (myOnly && selectedContractNumbers.length > 0);
    const matchesContract = !appliesContractFilter || (boardContract && selectedContractNumbers.includes(boardContract));

    const matchesMyOnly = !myOnly || isAllowedBoard;

    return matchesSearch && matchesSize && matchesMunicipality && matchesAdType && finalStatusMatch && matchesMyOnly && matchesContract;
  });

  const handleToggleSelect = (billboard: Billboard) => {
    setSelectedBillboards(prev => {
      const isSelected = prev.find(b => b.ID === billboard.ID);
      if (isSelected) {
        return prev.filter(b => b.ID !== billboard.ID);
      } else {
        return [...prev, billboard];
      }
    });
  };

  const handleRemoveBillboard = (billboardId: string) => {
    setSelectedBillboards(prev => prev.filter(b => b.ID.toString() !== billboardId));
  };

  const handleSubmitBooking = () => {
    const months = 1;
    const customer = CUSTOMERS[0];
    const total = selectedBillboards.reduce((s,b)=> s + (getPriceFor((b as any).Size || (b as any).size, (b as any).Level || (b as any).level, customer, months) ?? 0), 0);
    addRequest(String((user as any)?.id || 'guest'), selectedBillboards, total);
    toast({
      title: "تم إرسال طلب الحجز",
      description: `تم إرسال طلب حجز ${selectedBillboards.length} لوحة بنجاح`,
    });
    setSelectedBillboards([]);
  };

  const availableBillboards = billboards.filter(b => 
    b.Status === 'متاح' || b.Status === 'available' || !b.Contract_Number
  ).length;
  const bookedBillboards = billboards.filter(b => 
    b.Status === 'مؤجر' || b.Status === 'محجوز'
  ).length;
  const uniqueSizes = [...new Set(billboards.map(b => b.Size))].filter(Boolean);
  const uniqueMunicipalities = [...new Set(billboards.map(b => b.Municipality).filter(Boolean))] as string[];
  const uniqueAdTypes = [...new Set(billboards.map((b:any) => (b.Ad_Type ?? b['Ad Type'] ?? '')).filter(Boolean))] as string[];

  const allowedList = Array.isArray((user as any)?.allowedCustomers)
    ? ((user as any).allowedCustomers as string[]).map((s) => String(s).trim().toLowerCase())
    : [];
  const sourceBillboards = isAdmin
    ? billboards
    : myOnly
    ? billboards.filter((b) => allowedList.includes(String((b as any).Customer_Name ?? '').trim().toLowerCase()))
    : [];
  const contractNumbers = Array.from(new Set(
    sourceBillboards
      .map((b) => (b as any).Contract_Number ?? (b as any)['Contract Number'] ?? '')
      .filter((v) => !!v)
      .map((v) => String(v))
  ));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getDaysAgo = (dateStr: string) => {
    const endDate = new Date(dateStr);
    const today = new Date();
    const diffTime = today.getTime() - endDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/30 rounded-full animate-spin border-t-primary mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-foreground font-medium">جاري تحميل اللوحات الإعلانية...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredBillboards.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBillboards = filteredBillboards.slice(startIndex, startIndex + PAGE_SIZE);
  const getVisiblePages = () => {
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - windowSize + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero Section - Modern Compact Design */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left Content */}
            <div className="flex-1 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
                <Star className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">منصة إعلانات متكاملة</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground mb-6 leading-tight">
                احجز <span className="text-primary">أفضل المواقع</span>
                <br />
                الإعلانية في المدينة
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0">
                منصة متكاملة لحجز وإدارة اللوحات الإعلانية الطرقية بأسعار تنافسية وخدمة مميزة
              </p>
              
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                <Button 
                  size="lg" 
                  className="group bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-6 h-auto rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  <Play className="h-5 w-5 ml-2 group-hover:scale-110 transition-transform" />
                  ابدأ الحجز الآن
                </Button>
                {!user && (
                  <Link to="/auth">
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="font-semibold px-8 py-6 h-auto rounded-xl border-2"
                    >
                      تسجيل الدخول
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            {/* Right Stats Cards */}
            <div className="flex-1 w-full max-w-md">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-card/80 backdrop-blur border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Layers className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-3xl font-black text-primary font-manrope">{billboards.length}</div>
                    <div className="text-sm text-muted-foreground">إجمالي اللوحات</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card/80 backdrop-blur border-green-500/20 hover:border-green-500/40 transition-all hover:shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Check className="h-6 w-6 text-green-500" />
                    </div>
                    <div className="text-3xl font-black text-green-500 font-manrope">{availableBillboards}</div>
                    <div className="text-sm text-muted-foreground">لوحة متاحة</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card/80 backdrop-blur border-orange-500/20 hover:border-orange-500/40 transition-all hover:shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Building2 className="h-6 w-6 text-orange-500" />
                    </div>
                    <div className="text-3xl font-black text-orange-500 font-manrope">{bookedBillboards}</div>
                    <div className="text-sm text-muted-foreground">لوحة مؤجرة</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card/80 backdrop-blur border-red-500/20 hover:border-red-500/40 transition-all hover:shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <div className="text-3xl font-black text-red-500 font-manrope">{expiredContracts.length}</div>
                    <div className="text-sm text-muted-foreground">عقد منتهي</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Header - Modern sticky header */}
      <header className="bg-card/95 backdrop-blur-lg border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-8 md:h-10 w-auto" />
              </div>
              <span className="hidden md:block font-bold text-foreground">{BRAND_NAME}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className="gap-2 px-3 py-1.5 rounded-full border-primary/30 bg-primary/5 text-foreground font-medium"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {availableBillboards} متاحة
              </Badge>
              
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{user.name}</span>
                    {isAdmin && (
                      <Badge className="text-xs bg-primary text-primary-foreground">مدير</Badge>
                    )}
                  </div>
                  {(isAdmin || (user?.permissions && user.permissions.length > 0)) && (
                    <Link to="/admin">
                      <Button variant="outline" size="sm" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden md:inline">لوحة التحكم</span>
                      </Button>
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:bg-destructive/10">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Link to="/auth">
                  <Button size="sm" className="bg-primary text-primary-foreground">
                    تسجيل الدخول
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Expired Contracts Section */}
        {expiredContracts.length > 0 && (
          <Card className="mb-8 border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <span>آخر 10 عقود منتهية</span>
                </CardTitle>
                <Link to="/contracts">
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    عرض الكل
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {expiredContracts.map((contract) => (
                  <div 
                    key={contract.Contract_Number}
                    className="group p-4 bg-card rounded-xl border border-border hover:border-red-500/30 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 font-manrope">
                        #{contract.Contract_Number}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 ml-1" />
                        {getDaysAgo(contract['End Date'])} يوم
                      </Badge>
                    </div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 truncate" title={contract['Customer Name']}>
                      {contract['Customer Name']}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(contract['End Date'])}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {contract.billboards_count || 0} لوحات
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-sm font-bold text-primary font-manrope">
                        {(contract.Total || 0).toLocaleString('ar-LY')} د.ل
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters - Enhanced design */}
        <Card className="mb-8 shadow-sm border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن اللوحات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="الحجم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأحجام</SelectItem>
                  {uniqueSizes.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v)=>{ setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="متاحة">متاحة</SelectItem>
                  <SelectItem value="قريبة الانتهاء">قريبة الانتهاء</SelectItem>
                  <SelectItem value="محجوز">محجوز</SelectItem>
                </SelectContent>
              </Select>

              <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="البلدية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع البلديات</SelectItem>
                  {uniqueMunicipalities.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {user && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Filter className="h-4 w-4" />
                      {adTypeFilter === 'all' ? 'نوع الإعلان' : adTypeFilter}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ابحث عن نوع الإعلان..." />
                      <CommandList>
                        <CommandEmpty>لا يوجد نتائج</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setAdTypeFilter('all')}>الكل</CommandItem>
                          {uniqueAdTypes.map((t) => (
                            <CommandItem key={t} onSelect={() => setAdTypeFilter(t)}>{t}</CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              {user && (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
                  <Switch id="my-only" checked={myOnly} onCheckedChange={setMyOnly} />
                  <Label htmlFor="my-only" className="text-sm">لوحاتي</Label>
                </div>
              )}

              {(isAdmin || myOnly) && contractNumbers.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      العقود {selectedContractNumbers.length > 0 && `(${selectedContractNumbers.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ابحث عن رقم عقد..." />
                      <CommandList>
                        <CommandEmpty>لا يوجد نتائج</CommandEmpty>
                        <CommandGroup>
                          {contractNumbers.map((num) => {
                            const selected = selectedContractNumbers.includes(num);
                            return (
                              <CommandItem
                                key={num}
                                onSelect={() => {
                                  setSelectedContractNumbers((prev) => selected ? prev.filter((n) => n !== num) : [...prev, num]);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                {num}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            عرض <span className="font-bold text-foreground">{filteredBillboards.length}</span> لوحة
          </p>
        </div>

        {/* Map and Grid Tabs */}
        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
            <TabsTrigger value="grid" className="flex items-center gap-2 h-full">
              <Layers className="h-4 w-4" />
              عرض الشبكة
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2 h-full">
              <MapIconLucide className="h-4 w-4" />
              عرض الخريطة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagedBillboards.map((billboard) => (
                <BillboardGridCard
                  key={billboard.ID}
                  billboard={billboard}
                  onBooking={handleToggleSelect}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="map">
            <HomeMap 
              billboards={filteredBillboards}
              onBillboardClick={(billboard) => {
                console.log('Billboard clicked:', billboard);
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Pagination */}
        {filteredBillboards.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="gap-1"
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>
            {getVisiblePages().map((p) => (
              <Button
                key={p}
                variant={p === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(p)}
                className="w-10"
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="gap-1"
            >
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {filteredBillboards.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
            <p className="text-muted-foreground">جرب تعديل معايير البحث أو الفلترة</p>
          </div>
        )}
      </div>

      {/* Booking Summary */}
      <BookingSummary
        selectedBillboards={selectedBillboards}
        onRemoveBillboard={handleRemoveBillboard}
        onSubmitBooking={handleSubmitBooking}
        isOpen={selectedBillboards.length > 0}
      />
    </div>
  );
};

export default Index;
