'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { TravelerAuthForm } from '@/components/traveler-auth-form';
import { useAuth } from '@/contexts/auth-context';
import { listMyBookings, type MyBookingRow } from '@/services/websiteAuth';
import { useCurrency } from '@/contexts/currency-context';
import {
  Plane,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  Ticket,
  LogOut,
  Loader2,
} from 'lucide-react';

export default function MyBookingsPage() {
  const { formatMoney } = useCurrency();
  const router = useRouter();
  const { isAuthenticated, isLoading, logout, refreshUser } = useAuth();
  const [bookings, setBookings] = useState<MyBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyBookings(100, 0);
      setBookings(res.data || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      loadBookings();
    }
    if (!isLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [isLoading, isAuthenticated, loadBookings]);

  const handleLogout = async () => {
    await logout();
    router.push('/account');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-700';
      case 'Reserved':
        return 'bg-yellow-100 text-yellow-700';
      case 'Checked In':
        return 'bg-blue-100 text-blue-700';
      case 'Boarded':
        return 'bg-navy text-cream';
      case 'Cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (!booking.departure_date) return filter === 'all';
    const isUpcoming = new Date(booking.departure_date) >= new Date(new Date().toDateString());
    if (filter === 'upcoming') return isUpcoming;
    if (filter === 'past') return !isUpcoming;
    return true;
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-cream">
        <Navbar />
        <div className="bg-navy pt-24 pb-10">
          <div className="max-w-lg mx-auto px-4 text-center">
            <Ticket className="h-10 w-10 text-gold mx-auto mb-4" />
            <h1 className="text-cream font-serif text-3xl">My Bookings</h1>
            <p className="text-cream/60 mt-2 text-sm">
              Sign in to view trips linked to your account
            </p>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 -mt-6 pb-16">
          <TravelerAuthForm
            onSuccess={async () => {
              await refreshUser();
              loadBookings();
            }}
          />
          <p className="text-center mt-4">
            <Link href="/account" className="text-sm text-navy/60 hover:text-navy underline">
              Back to My Account
            </Link>
          </p>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">
                MY ACCOUNT
              </p>
              <h1 className="text-cream font-serif text-3xl">My Bookings</h1>
            </div>
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                className="border-cream/30 text-cream hover:bg-cream/10"
              >
                <Link href="/account">Account</Link>
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="border-cream/30 text-cream hover:bg-cream/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-8">
          {(['upcoming', 'past', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === tab
                  ? 'bg-navy text-cream'
                  : 'bg-navy/10 text-navy hover:bg-navy/20'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-navy/60">Loading your bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="w-16 h-16 text-navy/20 mx-auto mb-4" />
            <h3 className="text-navy text-xl font-semibold mb-2">No bookings found</h3>
            <p className="text-navy/60 mb-6">
              {filter === 'upcoming'
                ? "You don't have any upcoming flights yet"
                : 'No bookings match this filter'}
            </p>
            <Button asChild className="bg-gold hover:bg-gold-dark text-navy">
              <Link href="/#book">Book a Flight</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Link
                key={booking.name}
                href={`/manage-booking?pnr=${encodeURIComponent(booking.pnr)}`}
                className="block bg-white rounded-xl border border-navy/10 p-6 hover:border-gold/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
                      <Plane className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-gold font-semibold">
                        {booking.flight_number || 'Flight'}
                      </p>
                      <p className="text-navy/60 text-sm">{booking.route_name || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}
                    >
                      {booking.status}
                    </span>
                    {booking.payment_status === 'Pending' && (
                      <p className="text-amber-700 text-xs mt-1">Payment pending</p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-4 gap-4 mb-4">
                  {booking.departure_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-navy/40" />
                      <span className="text-navy text-sm">
                        {new Date(booking.departure_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {booking.departure_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-navy/40" />
                      <span className="text-navy text-sm">{booking.departure_time}</span>
                    </div>
                  )}
                  {booking.seat && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-navy/40" />
                      <span className="text-navy text-sm">Seat {booking.seat}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-navy/60 text-sm">PNR:</span>
                    <span className="text-navy font-mono text-sm">{booking.pnr}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-navy/10">
                  <span className="text-gold font-semibold">
                    {formatMoney(booking.fare_amount)}
                  </span>
                  <span className="text-navy/60 text-sm flex items-center gap-1">
                    View details
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
