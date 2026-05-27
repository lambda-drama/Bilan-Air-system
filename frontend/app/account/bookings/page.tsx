'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Plane, Calendar, Clock, MapPin, ChevronRight, Ticket, LogOut } from 'lucide-react';
import type { Booking } from '@/lib/types';
import { useCurrency } from '@/contexts/currency-context';

// Mock bookings
const mockBookings: Booking[] = [
  {
    name: 'BOOK-001',
    pnr: 'BA-20261234',
    flight_schedule: 'FS-001',
    flight_number: 'BA-101',
    route_name: 'Nairobi to Mogadishu',
    departure_date: '2026-06-01',
    departure_time: '08:00',
    passenger: 'PASS-001',
    passenger_name: 'John Doe',
    seat: '12A',
    seat_class: 'Economy',
    fare_amount: 280,
    status: 'Paid',
    payment_status: 'Paid',
    created_at: '2026-05-20T10:30:00',
  },
  {
    name: 'BOOK-002',
    pnr: 'BA-20265678',
    flight_schedule: 'FS-002',
    flight_number: 'BA-201',
    route_name: 'Mogadishu to Hargeisa',
    departure_date: '2026-06-15',
    departure_time: '14:00',
    passenger: 'PASS-001',
    passenger_name: 'John Doe',
    seat: '8B',
    seat_class: 'Business',
    fare_amount: 450,
    status: 'Checked In',
    payment_status: 'Paid',
    created_at: '2026-05-18T09:15:00',
  },
  {
    name: 'BOOK-003',
    pnr: 'BA-20269999',
    flight_schedule: 'FS-003',
    flight_number: 'BA-103',
    route_name: 'Nairobi to Mogadishu',
    departure_date: '2026-03-10',
    departure_time: '10:00',
    passenger: 'PASS-001',
    passenger_name: 'John Doe',
    seat: '15C',
    seat_class: 'Economy',
    fare_amount: 250,
    status: 'Boarded',
    payment_status: 'Paid',
    created_at: '2026-02-28T16:45:00',
  },
];

export default function MyBookingsPage() {
  const { formatMoney } = useCurrency();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  useEffect(() => {
    // Check if logged in
    const phone = sessionStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/account');
      return;
    }

    // Load bookings
    setTimeout(() => {
      setBookings(mockBookings);
      setLoading(false);
    }, 500);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('customerPhone');
    router.push('/account');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Reserved': return 'bg-yellow-100 text-yellow-700';
      case 'Checked In': return 'bg-blue-100 text-blue-700';
      case 'Boarded': return 'bg-navy text-cream';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const isUpcoming = new Date(booking.departure_date || '') >= new Date();
    if (filter === 'upcoming') return isUpcoming;
    if (filter === 'past') return !isUpcoming;
    return true;
  });

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      
      {/* Header */}
      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">MY ACCOUNT</p>
              <h1 className="text-cream font-serif text-3xl">My Bookings</h1>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="border-cream/30 text-cream hover:bg-cream/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-8">
          {(['upcoming', 'past', 'all'] as const).map((tab) => (
            <button
              key={tab}
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

        {/* Bookings List */}
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
              {filter === 'upcoming' ? "You don't have any upcoming flights" : "No past bookings"}
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
                href={`/manage-booking?pnr=${booking.pnr}`}
                className="block bg-white rounded-xl border border-navy/10 p-6 hover:border-gold/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center">
                      <Plane className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-gold font-semibold">{booking.flight_number}</p>
                      <p className="text-navy/60 text-sm">{booking.route_name}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>

                <div className="grid sm:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-navy/40" />
                    <span className="text-navy text-sm">
                      {new Date(booking.departure_date || '').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-navy/40" />
                    <span className="text-navy text-sm">{booking.departure_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-navy/40" />
                    <span className="text-navy text-sm">Seat {booking.seat}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-navy/60 text-sm">PNR:</span>
                    <span className="text-navy font-mono text-sm">{booking.pnr}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-navy/10">
                  <span className="text-gold font-semibold">{formatMoney(booking.fare_amount)}</span>
                  <span className="text-navy/60 text-sm flex items-center gap-1">
                    View Details
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
