'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Reveal, RevealItem, RevealStagger } from '@/components/motion/reveal';
import { useTranslations } from '@/contexts/locale-context';

export function LoginSection() {
  const t = useTranslations();

  const scrollToSearch = () => {
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Reveal as="section" className="bg-cream py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal delay={0} className="text-center mb-16">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-gold" />
            {t.login.eyebrow}
            <span className="w-8 h-px bg-gold" />
          </p>
          <h2 className="text-navy font-serif text-3xl sm:text-4xl">{t.login.title}</h2>
        </Reveal>

        <RevealStagger className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
          <RevealItem index={0}>
            <div className="bg-white border border-navy/10 rounded-xl p-5 md:p-8 col-span-1 bilan-lift h-full">
              <h3 className="text-navy text-lg md:text-xl font-semibold mb-2 md:mb-3">
                {t.login.searchTitle}
              </h3>
              <p className="text-navy/60 text-sm mb-4 md:mb-6 hidden sm:block">
                {t.login.searchBody}
              </p>
              <Button
                type="button"
                onClick={scrollToSearch}
                className="w-full bg-gold hover:bg-gold-dark text-navy text-sm md:text-base gap-2"
              >
                <Search className="h-4 w-4 shrink-0" />
                {t.login.searchBtn}
              </Button>
            </div>
          </RevealItem>

          <RevealItem index={1}>
            <div className="bg-white border border-navy/10 rounded-xl p-5 md:p-8 col-span-1 bilan-lift h-full">
              <h3 className="text-navy text-lg md:text-xl font-semibold mb-2 md:mb-3">
                {t.login.accountTitle}
              </h3>
              <p className="text-navy/60 text-sm mb-4 md:mb-6 hidden sm:block">
                {t.login.accountBody}
              </p>
              <Button asChild className="w-full bg-gold hover:bg-gold-dark text-navy text-sm md:text-base">
                <Link href="/account">{t.login.accountBtn}</Link>
              </Button>
            </div>
          </RevealItem>

          <RevealItem index={2}>
            <div className="bg-white border border-navy/10 rounded-xl p-5 md:p-8 col-span-2 md:col-span-1 bilan-lift h-full">
              <h3 className="text-navy text-lg md:text-xl font-semibold mb-2 md:mb-3">
                {t.login.agentTitle}
              </h3>
              <p className="text-navy/60 text-sm mb-4 md:mb-6 hidden sm:block">
                {t.login.agentBody}
              </p>
              <Button asChild className="w-full bg-gold hover:bg-gold-dark text-navy text-sm md:text-base">
                <Link href="/portal/login">{t.login.agentBtn}</Link>
              </Button>
            </div>
          </RevealItem>
        </RevealStagger>
      </div>
    </Reveal>
  );
}
