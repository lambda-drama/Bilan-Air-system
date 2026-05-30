'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Reveal, RevealItem, RevealStagger } from '@/components/motion/reveal';
import { useTranslations } from '@/contexts/locale-context';

export function AboutSection() {
  const t = useTranslations();

  return (
    <Reveal as="section" id="about" className="bg-cream py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          <div>
            <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-gold" />
              {t.about.eyebrow}
            </p>
            <h2 className="text-navy font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight mb-6">
              {t.about.title}
            </h2>
            <p className="text-navy/60 text-lg leading-relaxed mb-8">{t.about.body}</p>

            <div className="flex flex-wrap gap-3 mb-8">
              <span className="px-4 py-2 bg-navy text-cream text-sm rounded-full">
                {t.about.tagSafety}
              </span>
              <span className="px-4 py-2 bg-navy text-cream text-sm rounded-full">
                {t.about.tagReliability}
              </span>
              <span className="px-4 py-2 bg-navy text-cream text-sm rounded-full">
                {t.about.tagIdentity}
              </span>
            </div>

            <Button
              variant="outline"
              asChild
              className="border-navy text-navy hover:bg-navy hover:text-cream"
            >
              <Link href="/about">{t.about.learnMore}</Link>
            </Button>
          </div>

          <RevealStagger className="space-y-4">
            <RevealItem index={0}>
              <div className="bg-navy rounded-xl p-6 bilan-lift">
                <h3 className="text-gold text-xs font-semibold tracking-[0.2em] mb-4">
                  {t.about.valuesTitle}
                </h3>
                <ul className="space-y-3">
                  {t.about.values.map((value) => (
                    <li key={value} className="flex items-center gap-3 text-cream">
                      <span className="w-1.5 h-1.5 bg-gold rounded-full shrink-0" />
                      {value}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealItem>

            <RevealItem index={1}>
              <div className="bg-navy rounded-xl p-6 bilan-lift">
                <h3 className="text-gold text-xs font-semibold tracking-[0.2em] mb-3">
                  {t.about.visionTitle}
                </h3>
                <p className="text-cream/80">{t.about.vision}</p>
              </div>
            </RevealItem>

            <RevealItem index={2}>
              <div className="bg-navy rounded-xl p-6 bilan-lift">
                <h3 className="text-gold text-xs font-semibold tracking-[0.2em] mb-3">
                  {t.about.missionTitle}
                </h3>
                <p className="text-cream/80">{t.about.mission}</p>
              </div>
            </RevealItem>
          </RevealStagger>
        </div>
      </div>
    </Reveal>
  );
}
