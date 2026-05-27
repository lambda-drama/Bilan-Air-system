'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, ArrowRight, Loader2 } from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (!phone) return;
    
    setLoading(true);
    setError('');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setLoading(false);
    setStep('otp');
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    
    setLoading(true);
    setError('');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (otp === '123456') {
      // Store auth state
      sessionStorage.setItem('customerPhone', phone);
      router.push('/account/bookings');
    } else {
      setError('Invalid OTP. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      
      <div className="pt-32 pb-20">
        <div className="max-w-md mx-auto px-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Phone className="w-8 h-8 text-gold" />
            </div>
            <h1 className="text-navy font-serif text-3xl mb-2">Customer Login</h1>
            <p className="text-navy/60">
              {step === 'phone' 
                ? 'Enter your phone number to access your bookings'
                : `Enter the OTP sent to ${phone}`
              }
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-navy/10">
            {step === 'phone' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-navy/60 text-sm font-medium">Phone Number</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleSendOTP}
                  disabled={loading || !phone}
                  className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      Send OTP
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-navy/60 text-sm font-medium">Enter OTP</label>
                  <Input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="mt-1 text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                  <p className="text-navy/40 text-xs mt-2 text-center">
                    For demo, use OTP: 123456
                  </p>
                </div>
                {error && (
                  <p className="text-red-500 text-sm text-center">{error}</p>
                )}
                <Button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    'Verify & Continue'
                  )}
                </Button>
                <button
                  onClick={() => setStep('phone')}
                  className="w-full text-navy/60 text-sm hover:text-navy"
                >
                  Change phone number
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
