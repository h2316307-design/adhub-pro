import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Billboard } from '@/types';
import { fetchAllBillboards } from '@/services/supabaseService';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Layers, Check, ArrowDown, LogOut, User, BarChart3, Star, ChevronLeft, Shield, Eye, Sparkles } from 'lucide-react';
import BillboardShowcase from '@/components/landing/BillboardShowcase';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_NAME } from '@/lib/branding';
import { useBranding } from '@/hooks/useBranding';
import { supabase } from '@/integrations/supabase/client';
import { isBillboardAvailable } from '@/utils/contractUtils';
import { motion, useInView } from 'framer-motion';

const Index = () => {
  const { user, logout, isAdmin } = useAuth();
  const { logoUrl: BRAND_LOGO } = useBranding();
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, margin: '-100px' });

  useEffect(() => {
    document.body.classList.add('landing-page-body');
    return () => document.body.classList.remove('landing-page-body');
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAllBillboards();
        setBillboards(data);
      } catch (error) {
        console.error('Error loading billboards:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const availableCount = billboards.filter(b => isBillboardAvailable(b)).length;
  const bookedCount = billboards.filter(b =>
    b.Status === 'مؤجر' || b.Status === 'محجوز'
  ).length;
  const uniqueCities = [...new Set(billboards.map(b => b.City).filter(Boolean))].length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-2 border-primary/20 rounded-full animate-spin border-t-primary mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ══════════ Sticky Nav ══════════ */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled 
          ? 'bg-card/95 backdrop-blur-xl border-b border-primary/10 shadow-sm' 
          : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-all duration-300 ${scrolled ? 'bg-primary/10 border border-primary/20' : ''}`}>
                <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-8 md:h-10 w-auto" />
              </div>
              {scrolled && <span className="hidden md:block font-bold text-foreground text-sm">{BRAND_NAME}</span>}
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-foreground">{user.name}</span>
                  </div>
                  {(isAdmin || (user?.permissions && user.permissions.length > 0)) && (
                    <Link to="/admin">
                      <Button size="sm" className="rounded-full gap-1.5 text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90">
                        <BarChart3 className="h-3.5 w-3.5" />
                        لوحة التحكم
                      </Button>
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:bg-destructive/10 rounded-full h-8 w-8 p-0">
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Link to="/auth">
                  <Button size="sm" className="rounded-full gap-1.5 text-xs h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    تسجيل الدخول
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ══════════ Hero Section ══════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-accent/20" />
        <div className="absolute inset-0 art-deco-pattern" />
        
        {/* Floating decorative elements */}
        <div className="absolute top-[15%] left-[8%] w-4 h-4 border-2 border-primary/20 animate-float-diamond" />
        <div className="absolute top-[25%] right-[12%] w-6 h-6 border-2 border-primary/15 animate-float-diamond" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[30%] left-[15%] w-3 h-3 bg-primary/10 rounded-full animate-float-circle" />
        <div className="absolute top-[60%] right-[8%] w-5 h-5 border border-primary/10 rounded-full animate-float-circle" style={{ animationDelay: '2s' }} />
        
        {/* Large gradient orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-subtle-pulse" />

        <div className="container mx-auto px-6 relative z-10 text-center pt-20">
          {/* Top badge */}
          <div className="animate-hero-reveal">
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-primary/8 border border-primary/15 rounded-full mb-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary tracking-wide">منصة إعلانات احترافية</span>
            </div>
          </div>

          {/* Main headline */}
          <h1 className="animate-hero-reveal-delay-1 text-5xl md:text-7xl lg:text-8xl font-black text-foreground mb-6 leading-[1.1] tracking-tight">
            أفضل <span className="text-primary">المواقع</span>
            <br />
            <span className="text-muted-foreground/70">الإعلانية</span>
          </h1>

          {/* Gold divider line */}
          <div className="flex justify-center mb-8">
            <div className="animate-hero-line h-[2px] w-32 bg-gradient-to-l from-transparent via-primary to-transparent" />
          </div>

          {/* Subtitle */}
          <p className="animate-hero-reveal-delay-2 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            منصة متكاملة لحجز وإدارة اللوحات الإعلانية الطرقية
            <br className="hidden md:block" />
            بأسعار تنافسية وخدمة مميزة
          </p>

          {/* CTA Buttons */}
          <div className="animate-hero-reveal-delay-3 flex flex-wrap items-center justify-center gap-4 mb-16">
            {user ? (
              <Link to="/admin">
                <Button size="lg" className="rounded-full px-10 py-6 h-auto text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold hover:shadow-luxury transition-all duration-300 hover:scale-105">
                  <BarChart3 className="h-5 w-5 ml-2" />
                  لوحة التحكم
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button size="lg" className="rounded-full px-10 py-6 h-auto text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold hover:shadow-luxury transition-all duration-300 hover:scale-105">
                    ابدأ الآن
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="rounded-full px-10 py-6 h-auto text-base font-semibold border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300">
                    تسجيل الدخول
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Scroll indicator */}
          <div className="animate-hero-reveal-delay-4">
            <div className="animate-bounce-slow inline-flex flex-col items-center gap-2 text-muted-foreground/50">
              <span className="text-xs tracking-widest uppercase">اكتشف المزيد</span>
              <ArrowDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ Stats Strip ══════════ */}
      <section ref={statsRef} className="relative py-20 border-y border-primary/10">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-accent/10" />
        
        {/* Corner ornaments */}
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary/20 animate-corner-ornament" />
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary/20 animate-corner-ornament" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary/20 animate-corner-ornament" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary/20 animate-corner-ornament" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {[
              { value: billboards.length, label: 'إجمالي اللوحات', icon: Layers, delay: 'animate-slide-up-1' },
              { value: availableCount, label: 'لوحة متاحة', icon: Check, delay: 'animate-slide-up-2' },
              { value: bookedCount, label: 'لوحة مؤجرة', icon: Building2, delay: 'animate-slide-up-3' },
              { value: uniqueCities, label: 'مدينة مغطاة', icon: MapPin, delay: 'animate-slide-up-4' },
            ].map((stat, i) => (
              <div key={i} className={`text-center ${statsInView ? stat.delay : 'opacity-0'}`}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/8 border border-primary/10 mb-4">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-4xl md:text-5xl font-black text-primary font-manrope mb-2">
                  {statsInView ? stat.value : 0}
                </div>
                <div className="text-sm text-muted-foreground font-medium tracking-wide">
                  {stat.label}
                </div>
                {/* Divider between items - hidden on last */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-1/2 -translate-y-1/2 h-16 w-px bg-primary/10" 
                    style={{ left: `${(i + 1) * 25}%` }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Value Proposition ══════════ */}
      <section className="py-24 relative">
        <div className="absolute inset-0 art-deco-pattern opacity-50" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
                لماذا <span className="text-primary">تختارنا</span>؟
              </h2>
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent via-primary to-transparent mx-auto" />
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: MapPin,
                title: 'تغطية واسعة',
                description: 'شبكة لوحات إعلانية تغطي أهم المواقع والطرق الرئيسية في المدينة',
              },
              {
                icon: Shield,
                title: 'إدارة متكاملة',
                description: 'نظام إدارة احترافي للعقود والمدفوعات والتقارير بكل سهولة',
              },
              {
                icon: Eye,
                title: 'رؤية مميزة',
                description: 'مواقع استراتيجية مختارة بعناية لضمان أقصى انتشار لإعلاناتك',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group relative p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/20 transition-all duration-500 hover:shadow-luxury"
              >
                {/* Top-right corner accent */}
                <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-primary/10 rounded-tr-2xl group-hover:border-primary/30 transition-colors duration-500" />
                
                <div className="w-14 h-14 rounded-xl bg-primary/8 border border-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-all duration-300">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════ Available Billboards Showcase ══════════ */}
      <BillboardShowcase billboards={billboards} />

      {/* ══════════ CTA Footer ══════════ */}
      <section className="relative py-24 border-t border-primary/10">
        <div className="absolute inset-0 bg-gradient-to-t from-accent/10 to-transparent" />
        
        {/* Corner ornaments */}
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary/15" />
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary/15" />

        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
              جاهز لبدء <span className="text-primary">حملتك الإعلانية</span>؟
            </h2>
            <p className="text-muted-foreground mb-10 max-w-md mx-auto">
              انضم إلينا اليوم واحصل على أفضل المواقع الإعلانية بأسعار تنافسية
            </p>
            
            <div className="flex items-center justify-center gap-4">
              {user ? (
                <Link to="/admin">
                  <Button size="lg" className="rounded-full px-10 py-6 h-auto text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold hover:shadow-luxury transition-all duration-300 hover:scale-105">
                    الذهاب للوحة التحكم
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button size="lg" className="rounded-full px-10 py-6 h-auto text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold hover:shadow-luxury transition-all duration-300 hover:scale-105">
                    سجّل الآن مجاناً
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ Footer ══════════ */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-6 w-auto opacity-60" />
              <span className="text-xs text-muted-foreground">{BRAND_NAME}</span>
            </div>
            <p className="text-xs text-muted-foreground/50">
              © {new Date().getFullYear()} جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
