import { Plane, Package, Briefcase } from 'lucide-react';

const services = [
  {
    icon: Plane,
    title: 'Passenger Flights',
    description: 'Reliable route-focused flights connecting East Africa\'s key cities with comfort and care.',
  },
  {
    icon: Package,
    title: 'Cargo Services',
    description: 'Support for traders and parcels. Reliable freight handling across all our routes.',
  },
  {
    icon: Briefcase,
    title: 'Baggage Support',
    description: 'Baggage tags, claims, and dedicated customer support throughout your journey.',
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="bg-navy py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-gold" />
            OUR SERVICES
            <span className="w-8 h-px bg-gold" />
          </p>
          <h2 className="text-cream font-serif text-3xl sm:text-4xl">
            Passenger, cargo, and support services
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="bg-navy-light/30 border border-navy-light rounded-xl p-8 hover:border-gold/30 transition-colors"
            >
              <div className="w-14 h-14 bg-gold/10 rounded-xl flex items-center justify-center mb-6">
                <service.icon className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-cream text-xl font-semibold mb-3">{service.title}</h3>
              <p className="text-cream/60 leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
