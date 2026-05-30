'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { TravelerProfileMenu } from '@/components/traveler-profile-menu';

const publicNavLinks = [
  { href: '/#book', label: 'Book' },
  { href: '/#about', label: 'About' },
  { href: '/#services', label: 'Services' },
  { href: '/manage-booking', label: 'Manage Booking' },
  { href: '/#contact', label: 'Contact' },
];

function getNavLinks(isAuthenticated: boolean) {
  if (isAuthenticated) return publicNavLinks;
  return [
    publicNavLinks[0],
    publicNavLinks[1],
    publicNavLinks[2],
    { href: '/account', label: 'My Account' },
    ...publicNavLinks.slice(3),
  ];
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  const navLinks = getNavLinks(isAuthenticated);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-navy-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-gold flex items-center justify-center">
              <span className="text-gold font-bold text-sm">BA</span>
            </div>
            <div className="flex flex-col">
              <span className="text-cream font-bold text-lg tracking-wide">BILAN AIR</span>
              <span className="text-gold text-xs tracking-widest">Beyond Skies Together</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-cream/80 hover:text-gold transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
            {!isLoading && isAuthenticated && (
              <TravelerProfileMenu />
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {!isLoading && isAuthenticated && (
              <TravelerProfileMenu onNavigate={() => setIsOpen(false)} />
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-cream p-2"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t border-navy-light">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block py-3 text-cream/80 hover:text-gold transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
