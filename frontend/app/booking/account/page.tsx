'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { TravelerAuthForm } from '@/components/traveler-auth-form';
import { bookingFlowPath } from '@/lib/booking-flow-params';
import { WebsiteBookingFlowHeader } from '@/components/website-booking-flow-header';
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

      <WebsiteBookingFlowHeader
        currentStep="account"
        searchParams={searchParams}
        title="Sign in to continue"
        description="Log in or create an account before entering traveler details. You can pay now or reserve your seats and pay later using your reservation reference."
      />

      <div className="max-w-md mx-auto px-4 -mt-6 pb-16">
        <TravelerAuthForm
          onSuccess={async () => {
            await refreshUser();
            toast.success('Signed in');
            router.push(continuePath);
          }}
        />
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
