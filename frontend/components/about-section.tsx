import Link from 'next/link';
import { Shield, Clock, Heart, Globe, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const values = [
  'Safety First',
  'Reliability Always',
  'Respect for All',
  'Somali Identity',
  'Clear Communication',
];

export function AboutSection() {
  return (
    <section id="about" className="bg-cream py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left - Content */}
          <div>
            <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-gold" />
              ABOUT BILAN AIR
            </p>
            <h2 className="text-navy font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight mb-6">
              A Somali aviation brand built for Africa and beyond.
            </h2>
            <p className="text-navy/60 text-lg leading-relaxed mb-8">
              We combine international aviation standards with strong Somali identity to create a trusted and respected brand. Strong service culture, reliable operations, and Somali identity at the core of everything we do.
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="px-4 py-2 bg-navy text-cream text-sm rounded-full">
                Safety First
              </span>
              <span className="px-4 py-2 bg-navy text-cream text-sm rounded-full">
                Reliability
              </span>
              <span className="px-4 py-2 bg-navy text-cream text-sm rounded-full">
                Somali Identity
              </span>
            </div>

            <Button
              variant="outline"
              asChild
              className="border-navy text-navy hover:bg-navy hover:text-cream"
            >
              <Link href="/about">Learn More About Us</Link>
            </Button>
          </div>

          {/* Right - Values Cards */}
          <div className="space-y-4">
            {/* Values Card */}
            <div className="bg-navy rounded-xl p-6">
              <h3 className="text-gold text-xs font-semibold tracking-[0.2em] mb-4">OUR VALUES</h3>
              <ul className="space-y-3">
                {values.map((value) => (
                  <li key={value} className="flex items-center gap-3 text-cream">
                    <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                    {value}
                  </li>
                ))}
              </ul>
            </div>

            {/* Vision Card */}
            <div className="bg-navy rounded-xl p-6">
              <h3 className="text-gold text-xs font-semibold tracking-[0.2em] mb-3">VISION</h3>
              <p className="text-cream/80">
                To become the leading Somali airline connecting Africa to the world with reliability and pride.
              </p>
            </div>

            {/* Mission Card */}
            <div className="bg-navy rounded-xl p-6">
              <h3 className="text-gold text-xs font-semibold tracking-[0.2em] mb-3">MISSION</h3>
              <p className="text-cream/80">
                To deliver safe, smooth, and consistent air travel that represents the best of Somalia.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
