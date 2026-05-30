'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { TravelerAuthForm } from '@/components/traveler-auth-form';
import { useAuth } from '@/contexts/auth-context';
import { getMyAccount, type WebsiteAccountProfile } from '@/services/websiteAuth';
import { followAuthRedirect, getSafeRedirect } from '@/lib/auth-redirect';
import {
  Calendar,
  ClipboardCheck,
  Loader2,
  LogOut,
  Plane,
  Settings,
  Ticket,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));
  const { user, isLoading, isAuthenticated, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState<WebsiteAccountProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await getMyAccount();
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !redirectTo) return;
    followAuthRedirect(redirectTo);
  }, [isLoading, isAuthenticated, redirectTo]);

  useEffect(() => {
    if (isAuthenticated && !redirectTo) {
      loadProfile();
    } else if (!isAuthenticated) {
      setProfile(null);
    }
  }, [isAuthenticated, redirectTo, loadProfile]);

  const handleAuthSuccess = async () => {
    await refreshUser();
    toast.success('Welcome back');
    if (redirectTo) {
      followAuthRedirect(redirectTo);
      return;
    }
    loadProfile();
  };

  const handleLogout = async () => {
    await logout();
    setProfile(null);
    toast.success('Signed out');
    router.replace('/account');
  };

  const isDeskGate = redirectTo === '/app';

  if (isLoading || (isAuthenticated && redirectTo)) {
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
          <User className="h-10 w-10 text-gold mx-auto mb-4" />
          <h1 className="text-cream font-serif text-3xl">
            {isDeskGate && !isAuthenticated ? 'Staff sign in' : 'My Account'}
          </h1>
          <p className="text-cream/60 mt-2 text-sm">
            {isAuthenticated
              ? 'Manage your profile and view your trips'
              : isDeskGate
                ? 'Sign in with your email or username to open the staff desk'
                : 'Sign in with your email or create an account to see your bookings'}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 pb-16">
        {isAuthenticated && user ? (
          <div className="space-y-6">
            <div className="bilan-light-card rounded-2xl shadow-lg p-6">
              {profileLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gold" />
                </div>
              ) : (
                <>
                  <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">
                    SIGNED IN
                  </p>
                  <h2 className="text-navy font-serif text-2xl mb-1">
                    {profile?.full_name || user.full_name}
                  </h2>
                  <p className="text-navy/60 text-sm">{profile?.email || user.email}</p>
                  {(profile?.mobile_no || user.mobile_no) && (
                    <p className="text-navy/60 text-sm mt-1">
                      {profile?.mobile_no || user.mobile_no}
                    </p>
                  )}
                  {profile?.passenger?.id_number && (
                    <p className="text-navy/50 text-xs mt-3">
                      Traveler ID: {profile.passenger.id_number}
                    </p>
                  )}
                  <p className="text-navy/70 text-sm mt-4">
                    {profile?.booking_count ?? 0} booking
                    {(profile?.booking_count ?? 0) === 1 ? '' : 's'} on file
                  </p>
                </>
              )}

              <div className="grid gap-3 mt-6">
                <Button
                  asChild
                  className="w-full bg-navy hover:bg-navy-light text-cream font-semibold"
                >
                  <Link href="/check-in">
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Online check-in
                  </Link>
                </Button>
                <Button
                  asChild
                  className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
                >
                  <Link href="/account/bookings">
                    <Ticket className="h-4 w-4 mr-2" />
                    My bookings
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-navy/20">
                  <Link href="/#book">
                    <Plane className="h-4 w-4 mr-2" />
                    Book a flight
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-navy/20">
                  <Link href="/account/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-navy/20">
                  <Link href="/manage-booking">
                    <Calendar className="h-4 w-4 mr-2" />
                    Manage booking (PNR)
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-navy/20">
                  <a href="/app">Open staff desk</a>
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full mt-4 text-navy/60 hover:text-navy"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <TravelerAuthForm
            onSuccess={handleAuthSuccess}
            loginTitle="Sign in"
            signupTitle="Create account"
          />
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </main>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
