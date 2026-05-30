"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Gauge,
  Plane,
  Route,
  Timer,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Reveal, RevealItem, RevealStagger } from "@/components/motion/reveal";
import { useLocale } from "@/contexts/locale-context";
import {
  CITIES,
  ROUTES,
  getAboutPageContent,
} from "@/lib/content/about-page";
import { fetchAllRoutes } from "@/services/search";
import { cn } from "@/lib/utils";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-3">
      <span className="w-8 h-px bg-gold" />
      {children}
    </p>
  );
}

function RouteMapVisual() {
  return (
    <div className="relative aspect-[16/10] rounded-2xl border border-navy-light/40 bg-gradient-to-br from-navy via-navy-light/20 to-navy overflow-hidden">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_40%,rgba(212,175,55,0.15),transparent_50%),radial-gradient(circle_at_70%_60%,rgba(212,175,55,0.1),transparent_45%)]" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-6">
        {ROUTES.map((route) => {
          const from = CITIES.find((c) => c.code === route.from);
          const to = CITIES.find((c) => c.code === route.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${route.from}-${route.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeWidth="0.4"
              className="text-gold/40"
              strokeDasharray="2 2"
            />
          );
        })}
        {CITIES.map((city) => (
          <g key={city.code}>
            <circle cx={city.x} cy={city.y} r="2.2" className="fill-gold" />
            <text
              x={city.x}
              y={city.y - 4}
              textAnchor="middle"
              className="fill-cream text-[3px] font-semibold"
            >
              {city.code}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
        {CITIES.map((city) => (
          <span
            key={city.code}
            className="rounded-full border border-cream/15 bg-navy/60 px-2 py-1 text-[10px] text-cream/80"
          >
            {city.code} {city.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AboutPage() {
  const { locale, isRtl } = useLocale();
  const content = useMemo(() => getAboutPageContent(locale), [locale]);
  const [routeCount, setRouteCount] = useState<number | null>(null);

  useEffect(() => {
    fetchAllRoutes()
      .then((routes) => setRouteCount(routes.length))
      .catch(() => setRouteCount(null));
  }, []);

  const liveStatValues = [
    "—",
    routeCount != null ? String(routeCount) : "—",
    "—",
    "—",
  ];

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      {/* Hero */}
      <section className="bg-navy pt-32 pb-24 text-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionEyebrow>{content.hero.eyebrow}</SectionEyebrow>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
              {content.hero.title}
              <br />
              {content.hero.titleLine2}
            </h1>
            <p className="text-cream/70 text-lg max-w-3xl leading-relaxed">{content.hero.body}</p>
          </Reveal>
        </div>
      </section>

      {/* Fleet */}
      <section className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-12">
            <SectionEyebrow>{content.fleet.eyebrow}</SectionEyebrow>
            <h2 className="text-navy font-serif text-3xl sm:text-4xl mb-2">{content.fleet.title}</h2>
            <p className="text-navy/60 max-w-2xl">{content.fleet.subtitle}</p>
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <Reveal delay={80}>
              <div className="relative rounded-2xl bg-navy p-10 min-h-[320px] flex flex-col justify-between overflow-hidden bilan-lift">
                <div className="absolute -right-8 -top-8 text-gold/10">
                  <Plane className="h-48 w-48 -rotate-12" />
                </div>
                <div>
                  <p className="text-gold text-xs tracking-[0.25em] mb-2">BILAN AIR</p>
                  <p className="text-cream font-serif text-2xl">BEYOND SKIES TOGETHER</p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold">
                  {content.fleet.badge}
                </span>
              </div>
            </Reveal>

            <RevealStagger className="grid grid-cols-2 gap-4">
              {content.fleet.stats.map((stat, index) => (
                <RevealItem key={stat.label} index={index}>
                  <div className="rounded-xl border border-navy/10 bg-white p-6 bilan-lift">
                    <p className="text-navy font-serif text-2xl font-bold">{stat.value}</p>
                    <p className="text-navy/60 text-sm mt-1">{stat.label}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </div>
      </section>

      {/* Live routes marquee */}
      <section className="py-20 bg-navy overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          <Reveal>
            <SectionEyebrow>{content.liveRoutes.eyebrow}</SectionEyebrow>
            <h2 className="text-cream font-serif text-3xl sm:text-4xl mb-2">{content.liveRoutes.title}</h2>
            <p className="text-cream/60">{content.liveRoutes.subtitle}</p>
          </Reveal>
        </div>
        <div className="relative">
          <div className="flex gap-4 animate-[bilan-marquee_28s_linear_infinite] w-max px-4">
            {[...ROUTES, ...ROUTES].map((route, i) => (
              <div
                key={`${route.from}-${route.to}-${i}`}
                className="flex shrink-0 items-center gap-3 rounded-full border border-gold/30 bg-navy-light/40 px-6 py-3"
              >
                <Plane className="h-4 w-4 text-gold shrink-0" />
                <span className="text-cream font-semibold">{route.from}</span>
                <ArrowRight className={cn("h-4 w-4 text-gold/70", isRtl && "rotate-180")} />
                <span className="text-cream font-semibold">{route.to}</span>
                <span className="text-cream/50 text-sm hidden sm:inline">
                  {route.fromCity} → {route.toCity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <SectionEyebrow>{content.liveStats.eyebrow}</SectionEyebrow>
            <h2 className="text-navy font-serif text-3xl sm:text-4xl">{content.liveStats.title}</h2>
          </Reveal>
          <RevealStagger className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {content.liveStats.items.map((item, index) => {
              const icons = [Plane, Route, Users, Timer];
              const Icon = icons[index] ?? Gauge;
              return (
                <RevealItem key={item.label} index={index}>
                  <div className="rounded-xl border border-navy/10 bg-white p-8 text-center bilan-lift">
                    <Icon className="h-6 w-6 text-gold mx-auto mb-4" />
                    <p className="text-navy font-serif text-4xl font-bold mb-2">
                      {liveStatValues[index]}
                    </p>
                    <p className="text-navy/60 text-sm">{item.label}</p>
                  </div>
                </RevealItem>
              );
            })}
          </RevealStagger>
        </div>
      </section>

      {/* Network */}
      <section className="py-24 bg-navy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <SectionEyebrow>{content.network.eyebrow}</SectionEyebrow>
              <h2 className="text-cream font-serif text-3xl sm:text-4xl mb-4">{content.network.title}</h2>
              <p className="text-cream/70 mb-8">{content.network.body}</p>
              <div className="flex flex-wrap gap-2">
                {ROUTES.map((route) => (
                  <span
                    key={`${route.from}-${route.to}`}
                    className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-cream"
                  >
                    {route.from} → {route.to}
                  </span>
                ))}
              </div>
            </Reveal>
            <Reveal delay={100}>
              <RouteMapVisual />
              <p className="text-center text-gold/60 text-xs tracking-[0.2em] mt-3">
                {content.network.mapLabel}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Story + headline stats */}
      <section className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl mb-16">
            <SectionEyebrow>{content.story.eyebrow}</SectionEyebrow>
            <h2 className="text-navy font-serif text-3xl sm:text-4xl mb-8">{content.story.title}</h2>
            <div className="space-y-5 text-navy/70 text-lg leading-relaxed">
              {content.story.paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
          </Reveal>
          <RevealStagger className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {content.story.stats.map((stat, index) => (
              <RevealItem key={stat.label} index={index}>
                <div className="rounded-xl bg-navy p-8 text-center bilan-lift">
                  <p className="text-gold font-serif text-4xl font-bold mb-2">{stat.value}</p>
                  <p className="text-cream/70 text-sm">{stat.label}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-navy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <SectionEyebrow>{content.values.eyebrow}</SectionEyebrow>
            <h2 className="text-cream font-serif text-3xl sm:text-4xl mb-4">{content.values.title}</h2>
            <p className="text-cream/60">{content.values.subtitle}</p>
          </Reveal>
          <RevealStagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.values.items.map((item, index) => (
              <RevealItem key={item.num} index={index}>
                <div className="rounded-xl border border-navy-light bg-navy-light/20 p-8 h-full bilan-lift">
                  <p className="text-gold font-serif text-3xl mb-4">{item.num}</p>
                  <h3 className="text-cream text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-cream/65 text-sm leading-relaxed">{item.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <SectionEyebrow>{content.leadership.eyebrow}</SectionEyebrow>
            <h2 className="text-navy font-serif text-3xl sm:text-4xl mb-4">{content.leadership.title}</h2>
            <p className="text-navy/60">{content.leadership.subtitle}</p>
          </Reveal>
          <RevealStagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.leadership.roles.map((role, index) => (
              <RevealItem key={role.title} index={index}>
                <div className="rounded-xl border border-navy/10 bg-white p-8 text-center bilan-lift">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-navy/5 border border-navy/10">
                    <span className="text-navy/40 text-sm font-semibold">{content.leadership.comingSoon}</span>
                  </div>
                  <h3 className="text-navy font-semibold mb-2">{role.title}</h3>
                  <p className="text-navy/50 text-sm">{content.leadership.announcedSoon}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Journey timeline */}
      <section className="py-24 bg-navy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-16">
            <SectionEyebrow>{content.journey.eyebrow}</SectionEyebrow>
            <h2 className="text-cream font-serif text-3xl sm:text-4xl">{content.journey.title}</h2>
          </Reveal>
          <div className="relative border-s border-gold/30 ms-4 sm:ms-6 space-y-10">
            {content.journey.milestones.map((item, index) => (
              <Reveal key={item.year} delay={index * 60}>
                <div className="relative ps-8 sm:ps-10">
                  <span className="absolute -start-[5px] top-2 h-2.5 w-2.5 rounded-full bg-gold" />
                  <p className="text-gold font-serif text-2xl mb-2">{item.year}</p>
                  <h3 className="text-cream text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-cream/65 max-w-2xl leading-relaxed">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-navy font-serif text-3xl sm:text-4xl mb-6">{content.cta.title}</h2>
            <p className="text-navy/65 text-lg leading-relaxed mb-8">{content.cta.body}</p>
            <Button asChild className="bg-gold hover:bg-gold-dark text-navy font-semibold px-8 py-6 text-base gap-2">
              <Link href="/#book">
                {content.cta.button}
                <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
