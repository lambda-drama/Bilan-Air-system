'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { submitContactMessage } from '@/services/contact';
import { toast } from 'sonner';

const contactFieldClass = cn(
  'bilan-light-field mt-1',
  'focus-visible:border-gold focus-visible:ring-gold/30',
);

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await submitContactMessage({
        sender_name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        message_body: formData.message.trim(),
      });
      const text = res.message || 'Thank you. We received your message.';
      setStatus({ type: 'success', text });
      toast.success(text);
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not send message';
      setStatus({ type: 'error', text });
      toast.error(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="bg-navy py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left - Contact Info */}
          <div>
            <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-gold" />
              CONTACT US
            </p>
            <h2 className="text-cream font-serif text-3xl sm:text-4xl mb-6">
              Get in touch with us
            </h2>
            <p className="text-cream/60 text-lg leading-relaxed mb-12">
              Have questions about our flights or services? Our team is here to help you with anything you need.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="text-cream font-medium mb-1">Phone</h4>
                  <p className="text-cream/60">+254 700 000 000</p>
                  <p className="text-cream/60">+252 61 000 0000</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="text-cream font-medium mb-1">Email</h4>
                  <p className="text-cream/60">info@bilanair.com</p>
                  <p className="text-cream/60">bookings@bilanair.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="text-cream font-medium mb-1">Offices</h4>
                  <p className="text-cream/60">Jomo Kenyatta International Airport, Nairobi</p>
                  <p className="text-cream/60">Aden Adde International Airport, Mogadishu</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Contact Form */}
          <div className="bg-cream rounded-2xl p-8">
            <h3 className="text-navy text-xl font-semibold mb-6">Send us a message</h3>
            {status && (
              <p
                className={cn(
                  'text-sm rounded-lg px-3 py-2 mb-4 border',
                  status.type === 'success'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-red-50 text-red-800 border-red-200',
                )}
                role="status"
              >
                {status.text}
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-navy/60 text-sm font-medium">Your Name</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className={contactFieldClass}
                  required
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="text-navy/60 text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className={contactFieldClass}
                  required
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="text-navy/60 text-sm font-medium">Phone Number</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+254 700 000 000"
                  className={contactFieldClass}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="text-navy/60 text-sm font-medium">Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="How can we help you?"
                  rows={4}
                  className={cn(
                    contactFieldClass,
                    'w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2',
                  )}
                  required
                  disabled={submitting}
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold py-6"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
