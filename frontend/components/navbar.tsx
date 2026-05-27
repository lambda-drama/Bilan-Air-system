'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Plane } from 'lucide-react';

const navLinks = [
  { href: '/#book', label: 'Book' },
  { href: '/#about', label: 'About' },
  { href: '/#services', label: 'Services' },
  { href: '/account', label: 'My Account' },
  { href: '/manage-booking', label: 'Manage Booking' },
  { href: '/#contact', label: 'Contact' },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-navy-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-gold flex items-center justify-center">
              <span className="text-gold font-bold text-sm">BA</span>
            </div>
            <div className="flex flex-col">
              <span className="text-cream font-bold text-lg tracking-wide">BILAN AIR</span>
              <span className="text-gold text-xs tracking-widest">Beyond Skies Together</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-cream/80 hover:text-gold transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-cream p-2"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
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
