'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function LoginSection() {
  const scrollToSearch = () => {
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-cream py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-gold" />
            LOGIN
            <span className="w-8 h-px bg-gold" />
          </p>
          <h2 className="text-navy font-serif text-3xl sm:text-4xl">
            Access your account
          </h2>
        </div>

        {/* Travelers first: Search + My Account, then Agent Login */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
          <div className="bg-white border border-navy/10 rounded-xl p-5 md:p-8 col-span-1">
            <h3 className="text-navy text-lg md:text-xl font-semibold mb-2 md:mb-3">
              Search Flights
            </h3>
            <p className="text-navy/60 text-sm mb-4 md:mb-6 hidden sm:block">
              Find routes, dates, and fares for your next trip.
            </p>
            <Button
              type="button"
              onClick={scrollToSearch}
              className="w-full bg-gold hover:bg-gold-dark text-navy text-sm md:text-base"
            >
              <Search className="h-4 w-4 mr-2 shrink-0" />
              Search
            </Button>
          </div>

          <div className="bg-white border border-navy/10 rounded-xl p-5 md:p-8 col-span-1">
            <h3 className="text-navy text-lg md:text-xl font-semibold mb-2 md:mb-3">
              My Account
            </h3>
            <p className="text-navy/60 text-sm mb-4 md:mb-6 hidden sm:block">
              Sign in with your email to view bookings, manage trips, and book faster on your next
              flight.
            </p>
            <Button asChild className="w-full bg-gold hover:bg-gold-dark text-navy text-sm md:text-base">
              <Link href="/account">My Account</Link>
            </Button>
          </div>

          <div className="bg-white border border-navy/10 rounded-xl p-5 md:p-8 col-span-2 md:col-span-1">
            <h3 className="text-navy text-lg md:text-xl font-semibold mb-2 md:mb-3">
              Agent Login
            </h3>
            <p className="text-navy/60 text-sm mb-4 md:mb-6 hidden sm:block">
              Approved agents manage bookings, schedules, and the staff portal.
            </p>
            <Button asChild className="w-full bg-gold hover:bg-gold-dark text-navy text-sm md:text-base">
              <Link href="/portal/login">Agent Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
