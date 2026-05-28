'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plane, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { registerWebsiteUser } from '@/services/websiteAuth';
import { ensureCSRF } from '@/services/apiClient';
import { bookingFlowPath } from '@/lib/booking-flow-params';
import { toast } from 'sonner';

function AccountGateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, login, refreshUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm: '',
    mobile_no: '',
  });

  const continuePath = bookingFlowPath('/booking/passengers', searchParams);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(continuePath);
    }
  }, [isLoading, isAuthenticated, router, continuePath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(loginForm.email.trim(), loginForm.password);
      toast.success('Signed in');
      router.push(continuePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await registerWebsiteUser({
        full_name: signupForm.full_name.trim(),
        email: signupForm.email.trim(),
        password: signupForm.password,
        mobile_no: signupForm.mobile_no.trim() || undefined,
      });
      await ensureCSRF(true);
      await refreshUser();
      toast.success('Account created');
      router.push(continuePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-10">
        <div className="max-w-lg mx-auto px-4 text-center">
          <Plane className="h-10 w-10 text-gold mx-auto mb-4" />
          <h1 className="text-cream font-serif text-3xl">Sign in to continue</h1>
          <p className="text-cream/60 mt-2 text-sm">
            Log in or create an account before entering traveler details. You can pay now or
            reserve your seats and pay later with your PNR.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 pb-16">
        <div className="bg-white rounded-2xl border border-navy/10 shadow-lg p-6">
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={mode === 'login' ? 'default' : 'outline'}
              className={mode === 'login' ? 'flex-1 bg-gold text-navy hover:bg-gold-dark' : 'flex-1'}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Sign in
            </Button>
            <Button
              type="button"
              variant={mode === 'signup' ? 'default' : 'outline'}
              className={mode === 'signup' ? 'flex-1 bg-gold text-navy hover:bg-gold-dark' : 'flex-1'}
              onClick={() => {
                setMode('signup');
                setError('');
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create account
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  className="mt-1"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  className="mt-1"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold hover:bg-gold-dark text-navy"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="signup-name">Full name</Label>
                <Input
                  id="signup-name"
                  required
                  className="mt-1"
                  value={signupForm.full_name}
                  onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  className="mt-1"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="signup-phone">Phone (optional)</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  className="mt-1"
                  value={signupForm.mobile_no}
                  onChange={(e) => setSignupForm({ ...signupForm, mobile_no: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  className="mt-1"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="signup-confirm">Confirm password</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  required
                  className="mt-1"
                  value={signupForm.confirm}
                  onChange={(e) => setSignupForm({ ...signupForm, confirm: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold hover:bg-gold-dark text-navy"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account & continue'}
              </Button>
            </form>
          )}

          <p className="text-xs text-navy/50 text-center mt-6">
            <Link href={bookingFlowPath('/booking/seats', searchParams)} className="underline">
              Back to seat selection
            </Link>
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default function BookingAccountPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream pt-32 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </main>
      }
    >
      <AccountGateContent />
    </Suspense>
  );
}
