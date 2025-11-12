import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Billboard } from '@/types';
import { fetchAllBillboards } from '@/services/supabaseService';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { BookingSummary } from '@/components/BookingSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, Filter, MapPin, Star, Play, ArrowDown, LogOut, User, BarChart3, Check, Map as MapIconLucide } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { addRequest } from '@/services/bookingService';
import { getPriceFor, CUSTOMERS } from '@/data/pricing';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_NAME, BRAND_LOGO } from '@/lib/branding';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { HomeMap } from '@/components/Map/HomeMap';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const PAGE_SIZE = 9;

  useEffect(() => {
    loadBillboards();
  }, []);

  const loadBillboards = async () => {
    try {
      const data = await fetchAllBillboards();
      setBillboards(data);
    } catch (error) {
      toast({
        title: "خطأ في تحميل البيانات",
        description: "تعذر تحميل اللوحا   الإعلانية",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
    const isMaintenance = statusVal === 'صيانة';

    // near expiry = within 20 days
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
      (statusFilter === 'مح  وز' && isBooked) ||
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
    const months = 1; // افتراضي
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">جاري تحم  ل اللوحات الإعلانية...</p>
        </div>
      </div>
    );
  }

  // pagination computations
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
      {/* Hero Section - Modern & Trendy */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-luxury dark:bg-gradient-hero">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.3) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, hsl(var(--accent) / 0.3) 0%, transparent 50%)`
          }} />
        </div>
        
        {/* Glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/60 backdrop-blur-[2px]" />
        
        <div className="relative z-10 text-center max-w-5xl mx-auto px-4 animate-fade-up">
          {/* Logo with glow effect */}
          <div className="mb-8 animate-scale-in">
            <div className="inline-block p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-luxury">
              <img src={BRAND_LOGO} alt={BRAND_NAME} className="mx-auto h-20 md:h-24 w-auto drop-shadow-2xl" />
            </div>
          </div>
          
          {/* Main heading with gradient */}
          <h1 className="text-6xl md:text-8xl font-black text-foreground mb-8 leading-tight animate-fade-in drop-shadow-2xl">
            <span className="inline-block bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent animate-shimmer bg-[length:200%_100%]">
              احجز
            </span>{' '}
            أفضل المواقع
            <br />
            <span className="inline-block bg-gradient-to-r from-accent via-primary-glow to-primary bg-clip-text text-transparent">
              الإعلانية
            </span>{' '}
            في المدينة
          </h1>
          
          {/* Subtitle with better contrast */}
          <p className="text-xl md:text-3xl text-foreground/90 mb-12 leading-relaxed font-medium max-w-3xl mx-auto drop-shadow-lg">
            منصة متكاملة لحجز وإدارة اللوحات الإعلانية الطرقية
            <br />
            <span className="text-primary font-bold">بأسعار تنافسية وخدمة مميزة على مدار الساعة</span>
          </p>
          
          {/* CTA Buttons - Modern design */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button 
              size="lg" 
              className="group relative overflow-hidden bg-gradient-to-r from-primary to-accent hover:shadow-luxury transition-all duration-300 text-lg px-10 py-6 h-auto rounded-xl text-primary-foreground font-bold hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Play className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                ابدأ الحجز الآن
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-10 py-6 h-auto rounded-xl border-2 border-border bg-card/50 backdrop-blur-sm text-foreground hover:bg-card hover:border-primary hover:scale-105 transition-all duration-300 font-semibold"
            >
              شاهد العروض
            </Button>
          </div>
          
          {/* Stats - Enhanced design */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {[
              { value: `${availableBillboards}+`, label: 'لوحة متاحة', icon: '📍' },
              { value: '24/7', label: 'خدمة العملاء', icon: '⏰' },
              { value: '100%', label: 'ضمان الجودة', icon: '✓' }
            ].map((stat, i) => (
              <div 
                key={i} 
                className="group text-center p-6 rounded-2xl bg-card/50 backdrop-blur-md border border-border hover:bg-card hover:border-primary/50 transition-all duration-300 hover:scale-110 hover:shadow-luxury min-w-[140px]"
              >
                <div className="text-3xl mb-2">{stat.icon}</div>
                <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-foreground/80 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="animate-bounce-slow">
            <ArrowDown className="h-8 w-8 text-primary drop-shadow-lg" />
          </div>
        </div>
      </section>

      {/* Header - Modern sticky header */}
      <header className="bg-card/95 backdrop-blur-lg border-b border-border sticky top-0 z-40 shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-10 md:h-12 w-auto" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge 
                variant="outline" 
                className="gap-2 px-4 py-2 rounded-full border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 text-foreground font-semibold hover:shadow-hover transition-all duration-300"
              >
                <Star className="h-4 w-4 text-primary animate-pulse" />
                {availableBillboards} لوحة متاحة
              </Badge>
              
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-card rounded-xl border border-border shadow-soft hover:shadow-hover transition-all duration-300">
                    <div className="p-1.5 rounded-full bg-gradient-to-br from-primary to-accent">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{user.name}</span>
                    {isAdmin && (
                      <Badge className="text-xs bg-gradient-to-r from-primary to-accent text-white border-0">مدير</Badge>
                    )}
                  </div>
                  {isAdmin && (
                    <Link to="/dashboard">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="gap-2 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300 hover:scale-105"
                      >
                        <BarChart3 className="h-4 w-4" />
                        لوحة التحكم
                      </Button>
                    </Link>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={logout}
                    className="gap-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all duration-300"
                  >
                    <LogOut className="h-4 w-4" />
                    خروج
                  </Button>
                </div>
              ) : (
                <Link to="/auth">
                  <Button 
                    className="bg-gradient-to-r from-primary to-accent text-white font-semibold hover:shadow-luxury transition-all duration-300 hover:scale-105"
                  >
                    تسجيل الدخول
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Filters - Enhanced design */}
        <Card className="mb-8 shadow-luxury border-primary/10 bg-gradient-card hover:shadow-hover transition-all duration-300 animate-fade-in">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن اللوحات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="حجم اللوحة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأحجام</SelectItem>
                  {uniqueSizes.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v)=>{ setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="حالة اللوحة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="متاحة">متاحة</SelectItem>
                  <SelectItem value="قريبة الانتهاء">قريبة الانتهاء</SelectItem>
                  <SelectItem value="محجوز">محجوز</SelectItem>
                </SelectContent>
              </Select>

              <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="البلدية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الب  ديات</SelectItem>
                  {uniqueMunicipalities.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {user && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      {adTypeFilter === 'all' ? 'نوع الإعلان (الكل)' : `نوع الإعلان: ${adTypeFilter}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ابحث ع   نوع الإعلان..." />
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
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
                  <Switch id="my-only" checked={myOnly} onCheckedChange={setMyOnly} />
                  <Label htmlFor="my-only">لوحاتي</Label>
                </div>
              )}

              {(isAdmin || myOnly) && contractNumbers.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      أرقام العقود {selectedContractNumbers.length > 0 ? `(${selectedContractNumbers.length})` : ''}
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

              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                فلترة متقدمة
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Map and Grid Tabs */}
        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              عرض الشبكة
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapIconLucide className="h-4 w-4" />
              عرض الخريطة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid">
            {/* Billboards Grid */}
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
                // Optional: handle billboard click
                console.log('Billboard clicked:', billboard);
              }}
            />
          </TabsContent>
        </Tabs>

        {filteredBillboards.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              className={`px-3 py-1 rounded border ${currentPage === 1 ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              السابق
            </button>
            {getVisiblePages().map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`px-3 py-1 rounded border ${p === currentPage ? 'bg-primary text-primary-foreground' : ''}`}
              >
                {p}
              </button>
            ))}
            <button
              className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              التالي
            </button>
          </div>
        )}

        {filteredBillboards.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
            <p className="text-muted-foreground">جرب تعديل مع  يير البحث أو الفلترة</p>
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
