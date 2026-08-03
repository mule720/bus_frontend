import React, { useState, useEffect } from 'react';
import { Bus, Search, X, User, AlertTriangle, CheckCircle2, Loader2, Flag, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useEmployeeTripSearch, useTripSeatMap, useTripStaffingData,
  useCloseStationSales, useCompleteTripRun,
} from '@/lib/api';
import { BusSeatMapReadonly, seatLabel } from './BusSeatMap';

function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtTime(dt: string) {
  try { return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return dt || '—'; }
}

type SeatEntry = { seatNumber: number; status: string; passenger: string; bookingId: string };

interface Props {
  onGoToPOS?: (tripId: string, seatNumber: number) => void;
}

const SeatAvailability: React.FC<Props> = ({ onGoToPOS }) => {
  const today = todayIso();
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [searchParams, setSearchParams] = useState<{ routeFrom?: string; routeTo?: string; date: string } | null>({ date: today });
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [passengerPopup, setPassengerPopup] = useState<SeatEntry | null>(null);
  const [availableSeatPopup, setAvailableSeatPopup] = useState<SeatEntry | null>(null);

  const { data: trips = [], isLoading: tripsLoading } = useEmployeeTripSearch(searchParams);
  const { data: seatMap, isLoading: mapLoading, refetch: refetchMap } = useTripSeatMap(selectedTrip?.id ?? null);
  const { data: staffing, refetch: refetchStaffing } = useTripStaffingData(selectedTrip?.id ?? null, today);
  const closeSales = useCloseStationSales();
  const completeRun = useCompleteTripRun();

  const runStatus = (staffing as any)?.run?.status ?? 'not_started';

  const handleSearch = () => {
    setSearchParams({ date: today, routeFrom: routeFrom.trim() || undefined, routeTo: routeTo.trim() || undefined });
  };

  const selectTrip = (t: any) => { setSelectedTrip(t); };

  const handleCloseSales = async () => {
    if (!confirm('Close ticket sales for this trip at this station? The bus has left. Other stations are unaffected.')) return;
    try {
      await closeSales.mutateAsync({ tripId: selectedTrip.id, travelDate: today });
      await refetchStaffing();
      toast.success('Sales closed for this station');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close sales');
    }
  };

  const handleCompleteTrip = async () => {
    if (!confirm('Mark this trip as complete? No further ticket sales will be possible.')) return;
    try {
      await completeRun.mutateAsync({ tripId: selectedTrip.id, travelDate: today });
      await refetchStaffing();
      toast.success('Trip marked complete');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete trip');
    }
  };

  const seats: SeatEntry[] = seatMap?.seats ?? [];
  const bookedSeats = seats.filter((s) => {
    const st = s.status.toLowerCase();
    return st !== 'available' && st !== 'free' && st !== '';
  });

  const totalSeats = seatMap?.totalSeats ?? 0;
  const availSeats = seatMap?.availableSeats ?? 0;
  const bookedCount = totalSeats - availSeats;
  const pct = totalSeats > 0 ? bookedCount / totalSeats : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {selectedTrip ? `${selectedTrip.routeFrom} → ${selectedTrip.routeTo}` : 'Seat Availability'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {selectedTrip ? `${fmtTime(selectedTrip.departureTime)} · ${selectedTrip.busNumber}` : "View today's seat maps and manage trip status"}
          </p>
        </div>
        {selectedTrip && (
          <Button variant="outline" onClick={() => setSelectedTrip(null)}>
            ← All Trips
          </Button>
        )}
      </div>

      {/* Passenger popup (booked seat) */}
      {passengerPopup && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPassengerPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <span className="font-bold text-red-600">{passengerPopup.seatNumber}</span>
              </div>
              <div>
                <div className="font-bold text-slate-900">Seat {passengerPopup.seatNumber}</div>
                <div className="text-xs text-slate-500 capitalize">{passengerPopup.status}</div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-800">{passengerPopup.passenger || 'Unknown Passenger'}</span>
              </div>
              {passengerPopup.bookingId && (
                <div className="text-xs text-slate-400">Booking #{passengerPopup.bookingId}</div>
              )}
            </div>
            <Button className="w-full mt-4 bg-violet-700 text-white" onClick={() => setPassengerPopup(null)}>Close</Button>
          </div>
        </div>
      )}

      {/* Available seat popup */}
      {availableSeatPopup && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAvailableSeatPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <span className="font-bold text-green-700">{availableSeatPopup.seatNumber}</span>
              </div>
              <div>
                <div className="font-bold text-slate-900">Seat {availableSeatPopup.seatNumber}</div>
                <div className="text-xs text-green-600 font-semibold">Available</div>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This seat is available. Would you like to sell a ticket for this seat?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAvailableSeatPopup(null)}>Cancel</Button>
              {onGoToPOS ? (
                <Button
                  className="flex-[2] bg-blue-700 hover:bg-blue-800 text-white"
                  onClick={() => {
                    onGoToPOS(selectedTrip.id, availableSeatPopup.seatNumber);
                    setAvailableSeatPopup(null);
                  }}
                >
                  Sell Ticket → POS
                </Button>
              ) : (
                <Button className="flex-1 bg-slate-200 text-slate-500 cursor-not-allowed" disabled>
                  No POS access
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedTrip ? (
        <>
          {/* Route filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={routeFrom}
                onChange={(e) => setRouteFrom(e.target.value)}
                placeholder="From (e.g. Lusaka)"
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="text"
                value={routeTo}
                onChange={(e) => setRouteTo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="To (e.g. Ndola)"
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <Button onClick={handleSearch} disabled={tripsLoading} className="w-full bg-violet-700 hover:bg-violet-800 text-white">
              {tripsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              {tripsLoading ? 'Searching…' : 'Search Today\'s Trips'}
            </Button>
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {routeFrom || routeTo ? `Results — ${routeFrom || 'Any'} → ${routeTo || 'Any'}` : "Today's Trips"}
          </p>

          {tripsLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>
          ) : trips.length === 0 ? (
            <div className="text-center py-16">
              <Bus className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="font-semibold text-slate-500">No trips today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((t: any) => {
                const p = t.totalSeats > 0 ? (t.totalSeats - t.availableSeats) / t.totalSeats : 0;
                const fillColor = p > 0.8 ? 'bg-red-500' : p > 0.5 ? 'bg-amber-400' : 'bg-green-500';
                const textColor = p > 0.8 ? 'text-red-600' : p > 0.5 ? 'text-amber-600' : 'text-green-600';
                const full = t.availableSeats === 0;
                return (
                  <button key={t.id} onClick={() => selectTrip(t)}
                    className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-left hover:border-violet-300 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                        <span className="font-bold text-violet-700 text-sm">{fmtTime(t.departureTime)}</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{t.routeFrom} → {t.routeTo}</div>
                        <div className="text-xs text-slate-500">{t.busNumber}</div>
                      </div>
                      {full ? (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">FULL</span>
                      ) : (
                        <div className="text-right">
                          <div className={`font-bold text-lg ${textColor}`}>{t.availableSeats}</div>
                          <div className="text-[10px] text-slate-400">of {t.totalSeats}</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${fillColor} transition-all`} style={{ width: `${p * 100}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-slate-400">{Math.round(p * 100)}% full</span>
                      <span className="text-[10px] text-violet-600 font-semibold">View seat map →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {mapLoading || !seatMap ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>
          ) : (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total', value: totalSeats, color: 'text-slate-700', bg: 'bg-slate-100' },
                  { label: 'Available', value: availSeats, color: 'text-green-700', bg: 'bg-green-100' },
                  { label: 'Booked', value: bookedCount, color: 'text-red-600', bg: 'bg-red-100' },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Trip run status */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${runStatus === 'completed' ? 'bg-slate-400' : runStatus === 'departed' ? 'bg-blue-500' : 'bg-green-500'}`} />
                  <span className="font-semibold text-slate-800 capitalize">Trip {runStatus.replace('_', ' ')}</span>
                </div>
                {runStatus === 'not_started' && (
                  <Button
                    onClick={handleCloseSales}
                    disabled={closeSales.isPending}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    {closeSales.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}
                    Finish Trip Sales (this station)
                  </Button>
                )}
                {runStatus === 'departed' && (
                  <Button
                    onClick={handleCompleteTrip}
                    disabled={completeRun.isPending}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                  >
                    {completeRun.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCheck className="w-4 h-4 mr-2" />}
                    Mark Trip Complete
                  </Button>
                )}
                {runStatus === 'completed' && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    This trip has been completed
                  </div>
                )}
              </div>

              {/* Seat map */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Seat Map</p>
                <BusSeatMapReadonly
                  total={totalSeats}
                  seats={seats}
                  onSeatClick={(seat) => {
                    const st = seat.status.toLowerCase();
                    const isAvailable = st === 'available' || st === 'free' || st === '';
                    if (isAvailable) {
                      setAvailableSeatPopup(seat);
                    } else {
                      setPassengerPopup(seat);
                    }
                  }}
                />
              </div>

              {/* Passenger list */}
              {bookedSeats.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Passengers ({bookedSeats.length})</p>
                  {bookedSeats.map((s) => {
                    const st = s.status.toLowerCase();
                    const isBoarded = st === 'boarding' || st === 'boarded';
                    return (
                      <button key={s.seatNumber} onClick={() => setPassengerPopup(s)}
                        className="w-full bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 text-left hover:border-violet-300 transition">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm
                          ${isBoarded ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                          {seatLabel(s.seatNumber)}
                        </div>
                        <div className="flex-1 font-medium text-slate-800">{s.passenger || 'Passenger'}</div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize
                          ${isBoarded ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                          {s.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SeatAvailability;
