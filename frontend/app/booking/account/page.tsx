'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Loader2, Plane } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { TravelerAuthForm } from '@/components/traveler-auth-form';
import { bookingFlowPath } from '@/lib/booking-flow-params';
import { toast } from 'sonner';

function AccountGateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, refreshUser } = useAuth();

  const continuePath = bookingFlowPath('/booking/passengers', searchParams);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(continuePath);
    }
  }, [isLoading, isAuthenticated, router, continuePath]);

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
        <TravelerAuthForm
          onSuccess={async () => {
            await refreshUser();
            toast.success('Signed in');
            router.push(continuePath);
          }}
        />

        <p className="text-xs text-navy/50 text-center mt-6">
          <Link href={bookingFlowPath('/booking/seats', searchParams)} className="underline">
            Back to seat selection
          </Link>
        </p>
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
