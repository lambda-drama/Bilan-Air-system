'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, User, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useLocale, useTranslations } from '@/contexts/locale-context';
import { TravelerProfileMenu } from '@/components/traveler-profile-menu';
import { cn } from '@/lib/utils';

function SignInButton({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations();

  return (
    <Link
      href="/account"
      onClick={onNavigate}
      aria-label={t.nav.signIn}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition-colors hover:border-gold hover:bg-gold hover:text-navy',
        className,
      )}
    >
      <User className="h-4 w-4" />
    </Link>
  );
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const { isRtl } = useLocale();
  const t = useTranslations();

  const navLinks = isAuthenticated
    ? [
        { href: '/#book', label: t.nav.book },
        { href: '/schedules', label: t.nav.schedules },
        { href: '/flight-status', label: t.nav.flightStatus },
        { href: '/check-in', label: t.nav.checkIn },
        { href: '/#services', label: t.nav.services },
        { href: '/manage-booking', label: t.nav.manageBooking },
        { href: '/#contact', label: t.nav.contact },
      ]
    : [
        { href: '/#book', label: t.nav.book },
        { href: '/about', label: t.nav.about },
        { href: '/schedules', label: t.nav.schedules },
        { href: '/flight-status', label: t.nav.flightStatus },
        { href: '/#services', label: t.nav.services },
        { href: '/manage-booking', label: t.nav.manageBooking },
        { href: '/#contact', label: t.nav.contact },
      ];

  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-navy-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between h-20 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <Link href="/" className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-12 h-12 rounded-full border-2 border-gold flex items-center justify-center">
              <span className="text-gold font-bold text-sm">BA</span>
            </div>
            <div className={`flex flex-col ${isRtl ? 'items-end' : ''}`}>
              <span className="text-cream font-bold text-lg tracking-wide">{t.brand.name}</span>
              <span className="text-gold text-xs tracking-widest">{t.brand.tagline}</span>
            </div>
          </Link>

          <div
            className={`hidden md:flex items-center gap-6 lg:gap-8 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-cream/80 hover:text-gold transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
            {!isLoading &&
              (isAuthenticated ? (
                <TravelerProfileMenu compact />
              ) : (
                <SignInButton />
              ))}
          </div>

          <div className={`flex items-center gap-2 md:hidden ${isRtl ? 'flex-row-reverse' : ''}`}>
            {!isLoading &&
              (isAuthenticated ? (
                <TravelerProfileMenu compact onNavigate={closeMenu} />
              ) : (
                <SignInButton onNavigate={closeMenu} />
              ))}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-cream p-2"
              aria-label={t.nav.toggleMenu}
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
                onClick={closeMenu}
                className={`block py-3 text-cream/80 hover:text-gold transition-colors text-sm font-medium ${isRtl ? 'text-right' : ''}`}
              >
                {link.label}
              </Link>
            ))}
            {!isLoading && !isAuthenticated && (
              <Link
                href="/account"
                onClick={closeMenu}
                className={`flex items-center gap-3 py-3 text-gold text-sm font-medium ${isRtl ? 'flex-row-reverse justify-end' : ''}`}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
                  <User className="h-4 w-4" />
                </span>
                {t.nav.signIn}
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
