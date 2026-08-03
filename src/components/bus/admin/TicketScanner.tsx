import React, { useState } from 'react';
import { Search, CheckCircle2, XCircle, Loader2, UserCheck, RefreshCw, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLookupBooking, useBoardPassenger } from '@/lib/api';
import type { LookupResult } from '@/lib/api';

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

const TicketScanner: React.FC = () => {
  const [refCode, setRefCode] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [boarded, setBoarded] = useState(false);

  const lookup = useLookupBooking();
  const board = useBoardPassenger();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = refCode.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await lookup.mutateAsync(code);
      setResult(res);
      setBoarded(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lookup failed');
    }
  };

  const handleBoard = async () => {
    if (!result?.bookingId) return;
    try {
      const res = await board.mutateAsync({ bookingId: result.bookingId, boardingMethod: 'manual' });
      if (res.success) {
        setBoarded(true);
        toast.success('Passenger boarded successfully!');
      } else {
        toast.error(res.message || 'Could not board passenger');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Board failed');
    }
  };

  const reset = () => { setRefCode(''); setResult(null); setBoarded(false); };

  const canBoard = result?.found && result.status !== 'used' && result.status !== 'cancelled' && !result.boardedAt && !boarded;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ticket Scanner</h1>
        <p className="text-slate-500 text-sm mt-1">Look up a ticket by reference code and board passengers</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <form onSubmit={handleLookup} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={refCode}
              onChange={(e) => setRefCode(e.target.value)}
              placeholder="Enter reference code, e.g. BK-XXXXXXXX"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={lookup.isPending || !refCode.trim()} className="bg-blue-700 hover:bg-blue-800 text-white">
            {lookup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look Up'}
          </Button>
        </form>
      </div>

      {result && (
        <div className={`bg-white rounded-xl shadow-sm border-2 p-6 ${result.found ? (boarded || result.boardedAt ? 'border-green-400' : result.status === 'cancelled' ? 'border-red-400' : 'border-blue-400') : 'border-red-400'}`}>
          {!result.found ? (
            <div className="text-center py-4">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 text-lg mb-1">Ticket Not Found</h3>
              <p className="text-slate-500 text-sm">{result.message}</p>
            </div>
          ) : (
            <>
              {/* Status badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {boarded || result.boardedAt ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : result.status === 'cancelled' ? (
                    <XCircle className="w-6 h-6 text-red-500" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  )}
                  <span className="font-bold text-slate-900">
                    {boarded ? 'Boarded ✓' : result.boardedAt ? 'Already Boarded' : result.status === 'cancelled' ? 'Cancelled' : 'Valid Ticket'}
                  </span>
                </div>
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">{result.referenceCode}</span>
              </div>

              {/* Passenger info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Passenger</div>
                  <div className="font-semibold text-slate-900">{result.passengerName || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Seats</div>
                  <div className="font-semibold text-slate-900">{result.seats?.join(', ') || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Route</div>
                  <div className="flex items-center gap-1 font-semibold text-slate-900">
                    <MapPin className="w-3 h-3 text-blue-600" />{result.routeFrom}
                    <span className="text-slate-400">→</span>
                    <MapPin className="w-3 h-3 text-orange-500" />{result.routeTo}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Departure</div>
                  <div className="flex items-center gap-1 text-slate-700"><Clock className="w-3 h-3" />{fmt(result.departureTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Type</div>
                  <div className="text-slate-700">{result.isWalkin ? 'Walk-in' : 'Online'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Status</div>
                  <div className="capitalize text-slate-700">{result.status}</div>
                </div>
                {result.boardedAt && (
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Boarded At</div>
                    <div className="text-green-700 font-medium">{fmt(result.boardedAt)}</div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                {canBoard && (
                  <Button onClick={handleBoard} disabled={board.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white">
                    {board.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                    Board Passenger
                  </Button>
                )}
                <Button variant="outline" onClick={reset}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Scan Next
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TicketScanner;
