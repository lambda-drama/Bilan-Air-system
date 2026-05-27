'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plane, User, Briefcase, Check, AlertCircle, Loader2 } from 'lucide-react';

function CheckInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPnr = searchParams.get('pnr') || '';
  
  const [pnr, setPnr] = useState(initialPnr);
  const [step, setStep] = useState<'search' | 'details' | 'baggage' | 'complete'>('search');
  const [loading, setLoading] = useState(false);
  const [baggageWeight, setBaggageWeight] = useState('');
  const [boardingPass, setBoardingPass] = useState<{
    pnr: string;
    passenger: string;
    flight: string;
    seat: string;
    gate: string;
    boardingTime: string;
    baggageTag?: string;
  } | null>(null);

  const handleSearch = async () => {
    if (!pnr) return;
    
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (pnr.startsWith('BA-')) {
      setStep('details');
    }
    setLoading(false);
  };

  const handleCheckIn = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setBoardingPass({
      pnr,
      passenger: 'John Doe',
      flight: 'BA-101',
      seat: '12A',
      gate: 'A5',
      boardingTime: '07:30',
      baggageTag: baggageWeight ? `BAG-${Date.now().toString().slice(-6)}` : undefined,
    });
    
    setStep('complete');
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      
      {/* Header */}
      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-3">
            <span className="w-8 h-px bg-gold" />
            WEB CHECK-IN
          </p>
          <h1 className="text-cream font-serif text-4xl">Online Check-in</h1>
          <p className="text-cream/60 mt-2">
            Check in online and get your boarding pass
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress */}
        {step !== 'search' && (
          <div className="flex items-center gap-2 mb-8">
            <div className={`flex items-center gap-2 ${step === 'details' || step === 'baggage' || step === 'complete' ? 'text-gold' : 'text-navy/40'}`}>
              <div className="w-8 h-8 rounded-full bg-gold text-navy flex items-center justify-center text-sm font-medium">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Find Booking</span>
            </div>
            <div className="flex-1 h-px bg-navy/20" />
            <div className={`flex items-center gap-2 ${step === 'baggage' || step === 'complete' ? 'text-gold' : 'text-navy/40'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'baggage' || step === 'complete' ? 'bg-gold text-navy' : 'bg-navy/10 text-navy/40'
              }`}>
                {step === 'baggage' || step === 'complete' ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Details</span>
            </div>
            <div className="flex-1 h-px bg-navy/20" />
            <div className={`flex items-center gap-2 ${step === 'complete' ? 'text-gold' : 'text-navy/40'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'complete' ? 'bg-gold text-navy' : 'bg-navy/10 text-navy/40'
              }`}>
                {step === 'complete' ? <Check className="w-4 h-4" /> : '3'}
              </div>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>
        )}

        {/* Search Step */}
        {step === 'search' && (
          <div className="bg-white rounded-xl p-6 border border-navy/10">
            <h2 className="text-navy font-semibold text-lg mb-4">Find Your Booking</h2>
            <p className="text-navy/60 text-sm mb-6">
              Enter your booking reference number to start the check-in process.
            </p>
            <div className="flex gap-3">
              <Input
                value={pnr}
                onChange={(e) => setPnr(e.target.value.toUpperCase())}
                placeholder="Enter booking reference (e.g. BA-20261234)"
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !pnr}
                className="bg-gold hover:bg-gold-dark text-navy font-semibold"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Details Step */}
        {step === 'details' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-navy/10">
              <h3 className="text-navy font-semibold mb-4">Flight Details</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center">
                  <Plane className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <p className="text-gold font-semibold">BA-101</p>
                  <p className="text-navy/60 text-sm">Nairobi (NBO) → Mogadishu (MGQ)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-navy/60">Date</p>
                  <p className="text-navy font-medium">June 1, 2026</p>
                </div>
                <div>
                  <p className="text-navy/60">Departure</p>
                  <p className="text-navy font-medium">08:00 AM</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-navy/10">
              <h3 className="text-navy font-semibold mb-4">Passenger & Seat</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-navy" />
                </div>
                <div>
                  <p className="text-navy font-semibold">John Doe</p>
                  <p className="text-navy/60 text-sm">Adult &middot; Seat 12A &middot; Economy</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-navy/10">
              <h3 className="text-navy font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Baggage (Optional)
              </h3>
              <p className="text-navy/60 text-sm mb-4">
                If you have checked baggage, enter the weight below. You can also add baggage at the airport.
              </p>
              <div className="flex gap-3">
                <Input
                  type="number"
                  value={baggageWeight}
                  onChange={(e) => setBaggageWeight(e.target.value)}
                  placeholder="Weight in kg"
                  className="w-32"
                />
                <span className="text-navy/60 self-center">kg</span>
              </div>
              <p className="text-navy/40 text-xs mt-2">
                Free allowance: 23kg. Additional baggage fee may apply.
              </p>
            </div>

            <Button
              onClick={handleCheckIn}
              disabled={loading}
              className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold py-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Check-in...
                </>
              ) : (
                'Complete Check-in'
              )}
            </Button>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && boardingPass && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-navy font-serif text-2xl mb-2">Check-in Complete!</h2>
              <p className="text-navy/60">Your boarding pass is ready</p>
            </div>

            {/* Boarding Pass */}
            <div className="bg-white rounded-2xl border border-navy/10 overflow-hidden">
              <div className="bg-navy p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-1">BOARDING PASS</p>
                    <p className="text-cream text-xl font-bold">{boardingPass.pnr}</p>
                  </div>
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                    <span className="text-navy font-bold text-lg">BA</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Passenger</p>
                    <p className="text-navy font-semibold">{boardingPass.passenger}</p>
                  </div>
                  <div>
                    <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Flight</p>
                    <p className="text-navy font-semibold">{boardingPass.flight}</p>
                  </div>
                  <div>
                    <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Seat</p>
                    <p className="text-gold text-2xl font-bold">{boardingPass.seat}</p>
                  </div>
                  <div>
                    <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Gate</p>
                    <p className="text-navy text-2xl font-bold">{boardingPass.gate}</p>
                  </div>
                  <div>
                    <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Boarding Time</p>
                    <p className="text-navy font-semibold">{boardingPass.boardingTime}</p>
                  </div>
                  {boardingPass.baggageTag && (
                    <div>
                      <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Baggage Tag</p>
                      <p className="text-navy font-mono">{boardingPass.baggageTag}</p>
                    </div>
                  )}
                </div>

                {/* Barcode placeholder */}
                <div className="border-t border-dashed border-navy/20 pt-6">
                  <div className="h-16 bg-[repeating-linear-gradient(90deg,#1a2744,#1a2744_2px,transparent_2px,transparent_4px)] rounded" />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button className="flex-1 bg-gold hover:bg-gold-dark text-navy font-semibold">
                Download Boarding Pass
              </Button>
              <Button variant="outline" className="flex-1 border-navy text-navy hover:bg-navy hover:text-cream">
                Add to Wallet
              </Button>
            </div>

            <div className="bg-gold/10 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                <div className="text-sm text-navy/70">
                  <p className="font-semibold text-navy mb-1">Important Information</p>
                  <ul className="space-y-1">
                    <li>• Please arrive at the airport at least 2 hours before departure</li>
                    <li>• Bring a valid ID/Passport matching your booking details</li>
                    <li>• Gates close 20 minutes before departure</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-cream">
        <Navbar />
        <div className="pt-32 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
        </div>
      </main>
    }>
      <CheckInContent />
    </Suspense>
  );
}
