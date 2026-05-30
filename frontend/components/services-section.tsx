'use client';

import { Plane, Package, Briefcase } from 'lucide-react';
import { Reveal, RevealItem, RevealStagger } from '@/components/motion/reveal';
import { useTranslations } from '@/contexts/locale-context';

const serviceIcons = [Plane, Package, Briefcase];

export function ServicesSection() {
  const t = useTranslations();

  return (
    <Reveal as="section" id="services" className="bg-navy py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal delay={0} className="text-center mb-16">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-gold" />
            {t.services.eyebrow}
            <span className="w-8 h-px bg-gold" />
          </p>
          <h2 className="text-cream font-serif text-3xl sm:text-4xl">{t.services.title}</h2>
        </Reveal>

        <RevealStagger className="grid md:grid-cols-3 gap-8">
          {t.services.items.map((service, index) => {
            const Icon = serviceIcons[index] ?? Plane;
            return (
              <RevealItem key={service.title} index={index}>
                <div className="bg-navy-light/30 border border-navy-light rounded-xl p-8 hover:border-gold/30 bilan-lift h-full">
                  <div className="w-14 h-14 bg-gold/10 rounded-xl flex items-center justify-center mb-6">
                    <Icon className="w-7 h-7 text-gold" />
                  </div>
                  <h3 className="text-cream text-xl font-semibold mb-3">{service.title}</h3>
                  <p className="text-cream/60 leading-relaxed">{service.description}</p>
                </div>
              </RevealItem>
            );
          })}
        </RevealStagger>
      </div>
    </Reveal>
  );
}
