'use client';

import Link from 'next/link';
import { StaffDeskLink } from '@/components/staff-desk-link';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations } from '@/contexts/locale-context';

export function Footer() {
  const t = useTranslations();

  const footerLinks = {
    fly: [
      { href: '/#book', label: t.footer.links.bookFlight },
      { href: '/flight-status', label: t.footer.links.flightStatus },
      { href: '/check-in', label: t.footer.links.checkIn },
      { href: '/manage-booking', label: t.footer.links.manageBooking },
      { href: '/cargo', label: t.footer.links.cargo },
    ],
    company: [
      { href: '/about', label: t.footer.links.aboutUs },
      { href: '/careers', label: t.footer.links.careers },
      { href: '/press', label: t.footer.links.press },
      { href: '/#contact', label: t.footer.links.contact },
    ],
    support: [
      { href: '/faq', label: t.footer.links.faq },
      { href: '/baggage-policy', label: t.footer.links.baggagePolicy },
      { href: '/terms', label: t.footer.links.terms },
      { href: '/privacy', label: t.footer.links.privacy },
    ],
  };

  return (
    <footer className="bg-navy text-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <h3 className="text-xl font-bold tracking-wide mb-4">{t.brand.name}</h3>
            <p className="text-cream/60 text-sm leading-relaxed">{t.footer.tagline}</p>
          </div>

          <div>
            <h4 className="text-gold text-xs font-semibold tracking-widest mb-4">
              {t.footer.fly}
            </h4>
            <ul className="space-y-3">
              {footerLinks.fly.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-cream/60 hover:text-cream text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-gold text-xs font-semibold tracking-widest mb-4">
              {t.footer.company}
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-cream/60 hover:text-cream text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-gold text-xs font-semibold tracking-widest mb-4">
              {t.footer.support}
            </h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-cream/60 hover:text-cream text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <StaffDeskLink className="text-cream/60 hover:text-cream text-sm transition-colors">
                  {t.footer.staffDesk}
                </StaffDeskLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-navy-light flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-cream/40 text-sm">
            &copy; {new Date().getFullYear()} Bilan Air. {t.footer.copyright}
          </p>
          <p className="text-cream/40 text-sm">{t.footer.locations}</p>
          <LanguageSwitcher variant="footer" />
        </div>
      </div>

      <div className="border-t border-navy-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-center">
          <Link
            href="/portal"
            className="text-navy-light hover:text-gold/50 text-xs transition-colors opacity-30 hover:opacity-100"
          >
            {t.footer.staffPortal}
          </Link>
        </div>
      </div>
    </footer>
  );
}
