'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle2, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { registerWebsiteUser, requestPasswordReset } from '@/services/websiteAuth';
import { ensureCSRF } from '@/services/apiClient';

export interface TravelerAuthFormProps {
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
  loginTitle?: string;
  signupTitle?: string;
}

export function TravelerAuthForm({
  onSuccess,
  initialMode = 'login',
  loginTitle = 'Sign in',
  signupTitle = 'Create account',
}: TravelerAuthFormProps) {
  const { login, refreshUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm: '',
    mobile_no: '',
    id_number: '',
    date_of_birth: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(loginForm.username.trim(), loginForm.password);
      onSuccess?.();
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
        mobile_no: signupForm.mobile_no.trim(),
        id_number: signupForm.id_number.trim() || undefined,
        date_of_birth: signupForm.date_of_birth,
      });
      await ensureCSRF(true);
      await refreshUser();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await requestPasswordReset(resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bilan-light-card rounded-2xl shadow-lg p-6">
      <div className="flex gap-2 mb-6">
        <Button
          type="button"
          variant={mode === 'login' ? 'default' : 'outline'}
          className={
            mode === 'login'
              ? 'flex-1 bg-gold text-navy hover:bg-gold-dark'
              : 'flex-1 border-navy/20 text-navy bg-white hover:bg-navy/5'
          }
          onClick={() => {
            setMode('login');
            setResetMode(false);
            setResetSent(false);
            setError('');
          }}
        >
          <LogIn className="h-4 w-4 mr-2" />
          {loginTitle}
        </Button>
        <Button
          type="button"
          variant={mode === 'signup' ? 'default' : 'outline'}
          className={
            mode === 'signup'
              ? 'flex-1 bg-gold text-navy hover:bg-gold-dark'
              : 'flex-1 border-navy/20 text-navy bg-white hover:bg-navy/5'
          }
          onClick={() => {
            setMode('signup');
            setResetMode(false);
            setResetSent(false);
            setError('');
          }}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {signupTitle}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {mode === 'login' ? (
        resetMode ? (
          resetSent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  If an account exists for{' '}
                  <span className="font-medium break-all">{resetEmail}</span>, we&apos;ve sent a
                  password reset link. Check your inbox and spam folder.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-navy/20 text-navy"
                onClick={() => {
                  setResetMode(false);
                  setResetSent(false);
                  setError('');
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <p className="text-sm text-navy/60">
                Enter the email you use for Bilan Air. If an account exists, we&apos;ll send a link
                to reset your password.
              </p>
              <div>
                <Label htmlFor="traveler-reset-email">Email</Label>
                <Input
                  id="traveler-reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 bilan-light-field"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Send reset link'
                )}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm font-medium text-navy/70 hover:text-gold"
                onClick={() => {
                  setResetMode(false);
                  setError('');
                }}
              >
                Back to sign in
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="traveler-login-username">Email or username</Label>
              <Input
                id="traveler-login-username"
                type="text"
                required
                autoComplete="username"
                placeholder="admin@example.com or Administrator"
                className="mt-1 bilan-light-field"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="traveler-login-password">Password</Label>
              <PasswordInput
                id="traveler-login-password"
                required
                autoComplete="current-password"
                className="mt-1 bilan-light-field"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
            <div className="-mt-1 flex justify-end">
              <button
                type="button"
                className="text-xs font-light text-gray-500 underline-offset-4 transition-colors hover:text-gray-700 hover:underline"
                onClick={() => {
                  setResetMode(true);
                  setResetSent(false);
                  setError('');
                  const candidate = loginForm.username.trim();
                  if (candidate.includes('@')) setResetEmail(candidate);
                }}
              >
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>
        )
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <Label htmlFor="traveler-signup-name">Full name</Label>
            <Input
              id="traveler-signup-name"
              required
              className="mt-1 bilan-light-field"
              value={signupForm.full_name}
              onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="traveler-signup-email">Email</Label>
            <Input
              id="traveler-signup-email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 bilan-light-field"
              value={signupForm.email}
              onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="traveler-signup-phone">Phone</Label>
            <Input
              id="traveler-signup-phone"
              type="tel"
              required
              className="mt-1 bilan-light-field"
              value={signupForm.mobile_no}
              onChange={(e) => setSignupForm({ ...signupForm, mobile_no: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="traveler-signup-id">ID / passport number (optional)</Label>
            <Input
              id="traveler-signup-id"
              className="mt-1 bilan-light-field"
              value={signupForm.id_number}
              onChange={(e) => setSignupForm({ ...signupForm, id_number: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="traveler-signup-dob">Date of birth</Label>
            <Input
              id="traveler-signup-dob"
              type="date"
              required
              className="mt-1 bilan-light-field"
              value={signupForm.date_of_birth}
              onChange={(e) => setSignupForm({ ...signupForm, date_of_birth: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="traveler-signup-password">Password</Label>
            <PasswordInput
              id="traveler-signup-password"
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1 bilan-light-field"
              value={signupForm.password}
              onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="traveler-signup-confirm">Confirm password</Label>
            <PasswordInput
              id="traveler-signup-confirm"
              required
              autoComplete="new-password"
              className="mt-1 bilan-light-field"
              value={signupForm.confirm}
              onChange={(e) => setSignupForm({ ...signupForm, confirm: e.target.value })}
            />
          </div>
          <p className="text-xs text-navy/50">
            We create a traveler profile and login so you can manage bookings with your email.
          </p>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
