'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LoginSection() {
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

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Agent Login */}
          <div className="bg-white border border-navy/10 rounded-xl p-8">
            <h3 className="text-navy text-xl font-semibold mb-3">Agent Login</h3>
            <p className="text-navy/60 mb-6">
              Approved agents manage bookings and statements. Access your dedicated portal to handle reservations and track commissions.
            </p>
            <Button asChild className="bg-gold hover:bg-gold-dark text-navy">
              <Link href="/portal/login">Agent Login</Link>
            </Button>
          </div>

          {/* Traveler account */}
          <div className="bg-white border border-navy/10 rounded-xl p-8">
            <h3 className="text-navy text-xl font-semibold mb-3">My Account</h3>
            <p className="text-navy/60 mb-6">
              Sign in with your email to view bookings, manage trips, and book faster on your next flight.
            </p>
            <Button asChild className="bg-gold hover:bg-gold-dark text-navy">
              <Link href="/account">My Account</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
