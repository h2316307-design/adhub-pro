import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { loginUser, LoginCredentials } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { BRAND_NAME } from '@/lib/branding';
import { useBranding } from '@/hooks/useBranding';

const Index = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { logoUrl: BRAND_LOGO } = useBranding();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginData, setLoginData] = useState<LoginCredentials>({ email: '', password: '' });

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { user, error } = await loginUser(loginData);

    if (error) {
      setError(error);
    } else if (user) {
      login(user);
      toast({ title: 'تم تسجيل الدخول بنجاح', description: `مرحباً ${user.name}` });
      navigate('/admin');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={BRAND_LOGO} alt={BRAND_NAME} className="mx-auto mb-4 h-12 md:h-16 w-auto" />
          <p className="text-muted-foreground">منظومة إدارة اللوحات الإعلانية</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              تسجيل الدخول
            </CardTitle>
            <CardDescription>أدخل بياناتك للوصول إلى حسابك</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginEmail">البريد الإلكتروني أو اسم المستخدم</Label>
                <Input
                  id="loginEmail"
                  type="text"
                  value={loginData.email}
                  onChange={(e) => setLoginData((p) => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="example@domain.com أو username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginPassword">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="loginPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={(e) => setLoginData((p) => ({ ...p, password: e.target.value }))}
                    required
                    placeholder="كلمة المرور"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 py-2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
