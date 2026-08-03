import React, { useState } from 'react';
import { ArrowLeft, Armchair, User, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Trip } from './data';
import { toast } from 'sonner';
import { useBookedSeats, useCreateBooking } from '@/lib/api';
import { seatNumToLabel, seatLabelToNum } from '@/lib/tripAdapter';

interface Props {
  trip: Trip;
  passengers: number;
  travelDate: string;
  onBack: () => void;
  onConfirm: (seats: string[], passengerDetails: PassengerInfo[], total: number, bookingRef: string) => void;
}

export type PassengerInfo = { name: string; phone: string; nationalId: string; seat: string };

type SeatStatus = 'available' | 'selected' | 'booked';

const SeatSelection: React.FC<Props> = ({ trip, passengers, travelDate, onBack, onConfirm }) => {
  const raw = trip._raw;
  const tripId = raw?.id ?? trip.id;

  const { data: bookedNums = [], isLoading: seatsLoading } = useBookedSeats(tripId, travelDate);
  const createBooking = useCreateBooking();

  const bookedLabels = new Set(bookedNums.map(seatNumToLabel));

  const rows = Math.ceil((raw?.totalSeats ?? 40) / 4);
  const cols = ['A', 'B', 'C', 'D'];

  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<'seats' | 'details' | 'payment'>('seats');
  const [pxInfo, setPxInfo] = useState<PassengerInfo[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobile' | 'cash'>('card');
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);

  const seatStatus = (seat: string): SeatStatus => {
    if (selected.includes(seat)) return 'selected';
    if (bookedLabels.has(seat)) return 'booked';
    return 'available';
  };

  const toggleSeat = (seat: string) => {
    if (bookedLabels.has(seat)) return;
    setSelected((prev) => {
      if (prev.includes(seat)) return prev.filter((s) => s !== seat);
      if (prev.length >= passengers) {
        toast.error(`Select exactly ${passengers} seat${passengers > 1 ? 's' : ''}`);
        return prev;
      }
      return [...prev, seat];
    });
  };

  const total = selected.length * trip.price;
  const finalTotal = Math.max(0, total - discount);
  const currency = raw ? 'K' : '$';

  const proceedToDetails = () => {
    if (selected.length !== passengers) {
      toast.error(`Please select exactly ${passengers} seat${passengers > 1 ? 's' : ''}`);
      return;
    }
    setPxInfo(selected.map((s) => ({ name: '', phone: '', nationalId: '', seat: s })));
    setStep('details');
  };

  const submitDetails = () => {
    for (const p of pxInfo) {
      if (!p.name.trim() || !p.phone.trim()) {
        toast.error('Enter name and phone for all passengers');
        return;
      }
    }
    setStep('payment');
  };

  const applyPromo = () => {
    if (promoCode.toUpperCase() === 'BUS10') {
      setDiscount(total * 0.1);
      toast.success('10% off applied');
    } else {
      toast.error('Invalid promo code');
    }
  };

  const completePayment = async () => {
    try {
      const passengerDetails = pxInfo.map((p) => ({
        name: p.name,
        phone: p.phone,
        id_number: p.nationalId || undefined,
      }));

      const backendMethod = paymentMethod === 'card' ? 'card'
        : paymentMethod === 'mobile' ? 'mobile_money'
        : 'cash';

      // Convert seat labels to seat numbers (backend stores as ints or strings)
      const seatNums = selected.map((lbl) => String(seatLabelToNum(lbl)));

      const result = await createBooking.mutateAsync({
        tripId,
        seats: seatNums,
        passengerDetails: passengerDetails.length === 1 ? passengerDetails[0] : passengerDetails,
        paymentMethod: backendMethod,
        travelDate,
        fromStopId: raw?.stops?.[0]?.id,
        toStopId: raw?.stops?.[raw.stops.length - 1]?.id,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      const ref = result.bookings[0]?.referenceCode ?? 'BK-' + Math.random().toString(36).slice(2, 9).toUpperCase();
      toast.success('Booking confirmed!');
      onConfirm(selected, pxInfo, finalTotal, ref);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed';
      toast.error(msg);
    }
  };

  return (
    <section className="py-10 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={step === 'seats' ? onBack : () => setStep(step === 'payment' ? 'details' : 'seats')}
          className="flex items-center gap-2 text-slate-700 hover:text-blue-700 mb-4 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          {['Seats', 'Passengers', 'Payment'].map((label, i) => {
            const cur = ['seats', 'details', 'payment'][i];
            const active = step === cur;
            const done = (step === 'details' && i < 1) || (step === 'payment' && i < 2);
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-2 ${active ? 'text-blue-700' : done ? 'text-green-600' : 'text-slate-400'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-blue-700 text-white' : done ? 'bg-green-500 text-white' : 'bg-slate-200'}`}>
                    {i + 1}
                  </div>
                  <span className="font-semibold">{label}</span>
                </div>
                {i < 2 && <div className="flex-1 h-0.5 bg-slate-200 max-w-[60px]" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            {step === 'seats' && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Select your seats</h2>
                <p className="text-sm text-slate-500 mb-6">Pick {passengers} seat{passengers > 1 ? 's' : ''} • Tap to select</p>

                <div className="flex gap-4 mb-6 text-xs">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-100 border-2 border-green-500" /> Available</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-700" /> Selected</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-slate-300" /> Booked</div>
                </div>

                {seatsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-6 border-2 border-slate-200">
                    <div className="text-center mb-4 text-xs text-slate-500 uppercase tracking-wider font-semibold">Driver</div>
                    <div className="flex justify-end mb-6">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: rows }).map((_, r) => (
                        <div key={r} className="flex items-center justify-between gap-2">
                          <div className="flex gap-2">
                            {['A', 'B'].map((c) => {
                              const seat = `${r + 1}${c}`;
                              const status = seatStatus(seat);
                              return (
                                <button key={seat} onClick={() => toggleSeat(seat)} disabled={status === 'booked'}
                                  className={`w-10 h-10 rounded-lg text-xs font-bold transition ${
                                    status === 'available' ? 'bg-green-100 border-2 border-green-500 text-green-700 hover:bg-green-200' :
                                    status === 'selected' ? 'bg-blue-700 text-white scale-105 shadow-md' :
                                    'bg-slate-300 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  {seat}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-xs text-slate-400 w-6 text-center">{r + 1}</div>
                          <div className="flex gap-2">
                            {['C', 'D'].map((c) => {
                              const seat = `${r + 1}${c}`;
                              const status = seatStatus(seat);
                              return (
                                <button key={seat} onClick={() => toggleSeat(seat)} disabled={status === 'booked'}
                                  className={`w-10 h-10 rounded-lg text-xs font-bold transition ${
                                    status === 'available' ? 'bg-green-100 border-2 border-green-500 text-green-700 hover:bg-green-200' :
                                    status === 'selected' ? 'bg-blue-700 text-white scale-105 shadow-md' :
                                    'bg-slate-300 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  {seat}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 'details' && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Passenger details</h2>
                <p className="text-sm text-slate-500 mb-6">Enter details for each passenger</p>
                <div className="space-y-5">
                  {pxInfo.map((p, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-bold text-slate-900">Passenger {i + 1}</div>
                        <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                          <Armchair className="w-3 h-3" /> Seat {p.seat}
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input type="text" placeholder="Full name" value={p.name}
                          onChange={(e) => setPxInfo((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="tel" placeholder="Phone number" value={p.phone}
                          onChange={(e) => setPxInfo((arr) => arr.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))}
                          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="text" placeholder="National ID (optional)" value={p.nationalId}
                          onChange={(e) => setPxInfo((arr) => arr.map((x, j) => j === i ? { ...x, nationalId: e.target.value } : x))}
                          className="sm:col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 'payment' && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Payment</h2>
                <p className="text-sm text-slate-500 mb-6">Choose how you'd like to pay</p>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {([
                    { id: 'card', label: 'Card', icon: <CreditCard className="w-5 h-5" /> },
                    { id: 'mobile', label: 'Mobile Money', icon: <span className="text-lg">📱</span> },
                    { id: 'cash', label: 'Cash', icon: <span className="text-lg">💵</span> },
                  ] as const).map((m) => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                      className={`p-4 rounded-xl border-2 transition text-center ${paymentMethod === m.id ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                      <div className="flex justify-center mb-1 text-blue-700">{m.icon}</div>
                      <div className="text-xs font-semibold text-slate-900">{m.label}</div>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'card' && (
                  <div className="space-y-3 mb-5">
                    <input type="text" placeholder="Card number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="MM / YY" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      <input type="text" placeholder="CVC" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}

                {paymentMethod === 'mobile' && (
                  <div className="mb-5">
                    <input type="tel" placeholder="Mobile money number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  <input type="text" placeholder="Promo code (try BUS10)" value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  <Button variant="outline" onClick={applyPromo}>Apply</Button>
                </div>
              </>
            )}
          </div>

          {/* Summary sidebar */}
          <aside className="bg-white rounded-xl p-6 shadow-sm h-fit sticky top-24">
            <h3 className="font-bold text-slate-900 mb-4">Order summary</h3>
            <div className="space-y-2 text-sm mb-4 pb-4 border-b border-slate-200">
              <div className="flex justify-between"><span className="text-slate-500">Operator</span><span className="font-medium">{trip.company}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Route</span><span className="font-medium">{trip.from} → {trip.to}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{new Date(travelDate + 'T00:00:00').toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Departure</span><span className="font-medium">{trip.departTime}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Seats</span><span className="font-medium">{selected.join(', ') || '—'}</span></div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{currency}{total.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>−{currency}{discount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total</span><span>{currency}{finalTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-5">
              {step === 'seats' && (
                <Button onClick={proceedToDetails} disabled={selected.length === 0 || seatsLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600">
                  Continue ({selected.length}/{passengers})
                </Button>
              )}
              {step === 'details' && (
                <Button onClick={submitDetails} className="w-full bg-orange-500 hover:bg-orange-600">
                  Continue to payment
                </Button>
              )}
              {step === 'payment' && (
                <Button onClick={completePayment} disabled={createBooking.isPending}
                  className="w-full bg-orange-500 hover:bg-orange-600">
                  {createBooking.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
                    : `Pay ${currency}${finalTotal.toFixed(2)}`
                  }
                </Button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default SeatSelection;
