import Link from 'next/link';

const footerLinks = {
  fly: [
    { href: '/#book', label: 'Book a Flight' },
    { href: '/flight-status', label: 'Flight Status' },
    { href: '/check-in', label: 'Check-in' },
    { href: '/manage-booking', label: 'Manage Booking' },
    { href: '/cargo', label: 'Cargo' },
  ],
  company: [
    { href: '/#about', label: 'About Us' },
    { href: '/careers', label: 'Careers' },
    { href: '/press', label: 'Press' },
    { href: '/#contact', label: 'Contact' },
  ],
  support: [
    { href: '/faq', label: 'FAQ' },
    { href: '/baggage-policy', label: 'Baggage Policy' },
    { href: '/terms', label: 'Terms' },
    { href: '/privacy', label: 'Privacy' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-navy text-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold tracking-wide mb-4">BILAN AIR</h3>
            <p className="text-cream/60 text-sm leading-relaxed">
              Beyond Skies Together — connecting East Africa with Somali pride, reliability, and world-class service.
            </p>
          </div>

          {/* Fly */}
          <div>
            <h4 className="text-gold text-xs font-semibold tracking-widest mb-4">FLY</h4>
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

          {/* Company */}
          <div>
            <h4 className="text-gold text-xs font-semibold tracking-widest mb-4">COMPANY</h4>
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

          {/* Support */}
          <div>
            <h4 className="text-gold text-xs font-semibold tracking-widest mb-4">SUPPORT</h4>
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
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-navy-light flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-cream/40 text-sm">
            &copy; {new Date().getFullYear()} Bilan Air. All rights reserved.
          </p>
          <p className="text-cream/40 text-sm">
            Nairobi &middot; Mogadishu &middot; East Africa
          </p>
        </div>
      </div>

      {/* Hidden Admin Access */}
      <div className="border-t border-navy-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-center">
          <Link
            href="/portal"
            className="text-navy-light hover:text-gold/50 text-xs transition-colors opacity-30 hover:opacity-100"
          >
            Staff Portal
          </Link>
        </div>
      </div>
    </footer>
  );
}
