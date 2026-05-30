'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plane, Eye, EyeOff, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { hasPortalAccess } from '@/lib/portal-access';
import { getCurrentUserProfile } from '@/services/auth';

function PortalLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ username: '', password: '' });

  const accessDenied =
    searchParams.get('reason') === 'access_denied' ||
    (!isLoading && isAuthenticated && user != null && !hasPortalAccess(user.roles));

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    if (hasPortalAccess(user.roles)) {
      router.replace('/portal');
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await login(formData.username, formData.password);
      const profile = await getCurrentUserProfile();
      if (!hasPortalAccess(profile.roles)) {
        setError(
          'This portal is for booking agents and staff only. Customer accounts cannot sign in here.',
        );
        return;
      }
      router.push('/portal');
    } catch {
      setError('Invalid credentials. Use your Frappe email, username, and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Plane className="h-10 w-10 text-gold" />
            <span className="text-2xl font-serif text-white">Bilan Air</span>
          </Link>
          <p className="text-white/60 mt-2">Agent & Staff Portal</p>
        </div>

        {accessDenied ? (
          <Card className="bg-white border-0 shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <ShieldAlert className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-navy text-2xl">Access not allowed</CardTitle>
              <CardDescription>
                The agent portal is restricted to booking agents and staff. Your account does not
                have the required role.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {user && (
                <p className="rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy/70 text-center">
                  Signed in as <span className="font-medium text-navy">{user.email}</span>
                </p>
              )}
              <Button asChild className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold">
                <Link href="/account">Go to My Account</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Back to website</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white border-0 shadow-2xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-navy text-2xl">Welcome Back</CardTitle>
              <CardDescription>Sign in with your Frappe account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username">Email or username</Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="admin@example.com or Administrator"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-white/40 text-sm mt-6">
          <Link href="/" className="hover:text-white">
            Back to main website
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy flex items-center justify-center text-white/60">
          Loading...
        </div>
      }
    >
      <PortalLoginContent />
    </Suspense>
  );
}
