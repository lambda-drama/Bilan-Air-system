import { Navbar } from '@/components/navbar';
import { HeroSection } from '@/components/hero-section';
import { AboutSection } from '@/components/about-section';
import { ServicesSection } from '@/components/services-section';
import { LoginSection } from '@/components/login-section';
import { ContactSection } from '@/components/contact-section';
import { Footer } from '@/components/footer';

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <LoginSection />
      <ContactSection />
      <Footer />
    </main>
  );
}
