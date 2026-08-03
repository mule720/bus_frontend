import React from 'react';
import { CheckCircle2, Download, Share2, Calendar, QrCode, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Trip } from './data';
import type { PassengerInfo } from './SeatSelection';

interface Props {
  trip: Trip;
  passengers: PassengerInfo[];
  total: number;
  bookingRef: string;
  onDone: () => void;
  onViewBookings: () => void;
}

const BookingConfirmation: React.FC<Props> = ({ trip, passengers, total, bookingRef, onDone, onViewBookings }) => {
  return (
    <section className="py-10 bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Booking Confirmed!</h1>
          <p className="text-slate-500">Your e-tickets are ready. A copy has been emailed to you.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-blue-200">Booking Reference</div>
                <div className="text-2xl font-bold tracking-wider">{bookingRef}</div>
              </div>
              <Ticket className="w-10 h-10 text-orange-400" />
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-5 pb-5 border-b border-dashed border-slate-200">
              <div>
                <div className="text-xs text-slate-500 uppercase">Operator</div>
                <div className="font-bold text-slate-900">{trip.company}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Bus Type</div>
                <div className="font-bold text-slate-900">{trip.busType}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">From</div>
                <div className="font-bold text-slate-900">{trip.from}</div>
                <div className="text-sm text-slate-500">{trip.departTime}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">To</div>
                <div className="font-bold text-slate-900">{trip.to}</div>
                <div className="text-sm text-slate-500">{trip.arriveTime}</div>
              </div>
            </div>

            <div className="space-y-3 mb-5 pb-5 border-b border-dashed border-slate-200">
              {passengers.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.phone}</div>
                  </div>
                  <div className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                    Seat {p.seat}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center mb-5">
              <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
                <div className="w-40 h-40 bg-slate-900 flex items-center justify-center relative rounded">
                  {/* Fake QR */}
                  <div className="grid grid-cols-8 gap-0.5 p-2">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 ${((i * 13 + bookingRef.charCodeAt(i % bookingRef.length)) % 3 === 0) ? 'bg-white' : 'bg-slate-900'}`}
                      />
                    ))}
                  </div>
                  <QrCode className="absolute w-8 h-8 text-orange-400 opacity-0" />
                </div>
                <div className="text-[10px] text-center text-slate-400 mt-2 uppercase tracking-wider">Show at boarding</div>
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold pb-4 border-b border-slate-200 mb-4">
              <span>Total paid</span>
              <span className="text-green-600">${total.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Download</Button>
              <Button variant="outline" size="sm"><Share2 className="w-4 h-4 mr-1" />Share</Button>
              <Button variant="outline" size="sm"><Calendar className="w-4 h-4 mr-1" />Calendar</Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={onViewBookings} className="flex-1 bg-blue-700 hover:bg-blue-800">View My Bookings</Button>
              <Button onClick={onDone} variant="outline" className="flex-1">Book Another</Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookingConfirmation;
