'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeSelector } from '@/components/portal/theme-selector';
import { useAuth } from '@/contexts/auth-context';
import { updateUserPassword } from '@/services/userProfile';
import { toast } from 'sonner';

function AccountSettingsContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/account?redirect=/account/settings');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Enter your current and new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-10">
        <div className="max-w-lg mx-auto px-4">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-cream/60 hover:text-gold text-sm mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Account
          </Link>
          <h1 className="text-cream font-serif text-3xl">Settings</h1>
          <p className="text-cream/60 mt-2 text-sm">
            Appearance and security for {user?.email}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 pb-16 space-y-6">
        <div className="bilan-light-card rounded-2xl shadow-lg p-6">
          <h2 className="text-navy font-semibold text-lg mb-1">Appearance</h2>
          <p className="text-navy/60 text-sm mb-4">
            Choose light, dark, or match your device.
          </p>
          <ThemeSelector />
        </div>

        <div className="bilan-light-card rounded-2xl shadow-lg p-6">
          <h2 className="text-navy font-semibold text-lg mb-1">Change password</h2>
          <p className="text-navy/60 text-sm mb-4">
            Update the password you use to sign in to My Account.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 bilan-light-field"
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 bilan-light-field"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 bilan-light-field"
              />
            </div>
            <Button
              onClick={handleUpdatePassword}
              disabled={savingPassword}
              className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
            >
              {savingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Update password'
              )}
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default function AccountSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </main>
      }
    >
      <AccountSettingsContent />
    </Suspense>
  );
}
