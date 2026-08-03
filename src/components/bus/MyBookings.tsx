import React, { useState } from 'react';
import { Ticket, MapPin, Clock, Calendar, QrCode, X, Loader2, Printer, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useMyBookings, useCancelBooking, useRequestRefund, type BackendBooking } from '@/lib/api';

export interface Booking {
  ref: string;
  company: string;
  from: string;
  to: string;
  date: string;
  departTime: string;
  arriveTime: string;
  seats: string[];
  total: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  id?: string;
  qrCode?: string;
}

interface Props {
  onClose: () => void;
}

function adaptStatus(s: string): 'upcoming' | 'completed' | 'cancelled' {
  if (s === 'confirmed' || s === 'pending') return 'upcoming';
  if (s === 'used' || s === 'completed') return 'completed';
  return 'cancelled';
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function adaptBooking(b: BackendBooking): Booking {
  return {
    id: b.id,
    ref: b.referenceCode || b.id,
    company: b.trip?.company?.name ?? '—',
    from: b.trip?.routeFrom ?? '—',
    to: b.trip?.routeTo ?? '—',
    date: b.travelDate || b.trip?.departureTime?.split('T')[0] || '',
    departTime: fmt(b.trip?.departureTime ?? ''),
    arriveTime: fmt(b.trip?.arrivalTime ?? ''),
    seats: b.seats ?? [],
    total: parseFloat(b.totalAmount ?? '0'),
    status: adaptStatus(b.status),
    qrCode: b.qrCode,
  };
}

const statusColor = (s: string) => {
  if (s === 'upcoming') return 'bg-blue-100 text-blue-700';
  if (s === 'completed') return 'bg-green-100 text-green-700';
  return 'bg-slate-200 text-slate-600';
};

// ── QR / Ticket modal ────────────────────────────────────────────────────────
function TicketModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Ticket ${booking.ref}</title>
      <style>
        body{font-family:sans-serif;padding:24px;max-width:400px;margin:0 auto}
        h2{text-align:center;color:#1e40af}
        .ref{font-family:monospace;font-size:22px;font-weight:bold;text-align:center;
             letter-spacing:4px;margin:16px 0;padding:12px;border:2px dashed #334155}
        .row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
        img{display:block;margin:16px auto;width:140px;height:140px}
        .footer{text-align:center;font-size:11px;color:#64748b;margin-top:16px}
      </style></head>
      <body>
      <h2>🚌 BusGo E-Ticket</h2>
      <div class="row"><span>Company</span><span>${booking.company}</span></div>
      <div class="row"><span>Route</span><span>${booking.from} → ${booking.to}</span></div>
      <div class="row"><span>Date</span><span>${booking.date}</span></div>
      <div class="row"><span>Departs</span><span>${booking.departTime}</span></div>
      <div class="row"><span>Arrives</span><span>${booking.arriveTime}</span></div>
      <div class="row"><span>Seat(s)</span><span>${booking.seats.join(', ') || '—'}</span></div>
      <div class="row"><span>Amount</span><span>K${booking.total.toFixed(2)}</span></div>
      ${booking.qrCode ? `<img src="${booking.qrCode}" alt="QR Code" />` : ''}
      <div class="ref">${booking.ref}</div>
      <p class="footer">Present this code at the boarding gate. Valid for the travel date shown above.</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-lg">Your Ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="text-center space-y-3">
          {booking.qrCode ? (
            <img src={booking.qrCode} alt="QR Code" className="w-44 h-44 mx-auto border border-slate-200 rounded-xl" />
          ) : (
            <div className="w-44 h-44 mx-auto border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2">
              <QrCode className="w-12 h-12 text-slate-300" />
              <span className="text-xs text-slate-400">QR not available</span>
            </div>
          )}
          <div className="font-mono text-xl font-bold tracking-widest text-slate-900 bg-slate-50 rounded-xl py-3 border-2 border-dashed border-slate-300">
            {booking.ref}
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          {[
            ['Route', `${booking.from} → ${booking.to}`],
            ['Date', booking.date],
            ['Time', `${booking.departTime} → ${booking.arriveTime}`],
            ['Seat(s)', booking.seats.join(', ') || '—'],
            ['Total', `K${booking.total.toFixed(2)}`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-800">{val}</span>
            </div>
          ))}
        </div>

        <Button onClick={handlePrint} className="w-full bg-blue-700 hover:bg-blue-800 text-white">
          <Printer className="w-4 h-4 mr-2" /> Print / Download
        </Button>
      </div>
    </div>
  );
}

// ── Refund modal ─────────────────────────────────────────────────────────────
const REFUND_REASONS = [
  'Change of travel plans',
  'Emergency / medical reason',
  'Trip cancelled by operator',
  'Duplicate booking',
  'Other',
];

function RefundModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const requestRefund = useRequestRefund();
  const [reason, setReason] = useState(REFUND_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  const handleSubmit = async () => {
    if (!booking.id) return;
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) { toast.error('Please provide a reason.'); return; }
    try {
      await requestRefund.mutateAsync({ bookingId: booking.id, reason: finalReason });
      toast.success('Refund request submitted. We\'ll review it within 2 business days.');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Refund request failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-lg">Request Refund</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500">
          Booking <strong>{booking.ref}</strong> — K{booking.total.toFixed(2)}
        </p>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Reason for refund</label>
          <div className="space-y-2">
            {REFUND_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="refund-reason" value={r} checked={reason === r}
                  onChange={() => setReason(r)} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-slate-700">{r}</span>
              </label>
            ))}
          </div>
          {reason === 'Other' && (
            <textarea
              className="mt-3 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3} placeholder="Please describe your reason…"
              value={customReason} onChange={(e) => setCustomReason(e.target.value)}
            />
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={requestRefund.isPending}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            {requestRefund.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const MyBookings: React.FC<Props> = ({ onClose }) => {
  const [tab, setTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [viewTicket, setViewTicket] = useState<Booking | null>(null);
  const [refundBooking, setRefundBooking] = useState<Booking | null>(null);
  const { data: raw = [], isLoading } = useMyBookings();
  const cancel = useCancelBooking();

  const bookings = raw.map(adaptBooking);
  const filtered = bookings.filter((b) => b.status === tab);

  const handleCancel = async (b: Booking) => {
    if (!b.id) return;
    try {
      await cancel.mutateAsync(b.id);
      toast.success('Booking cancelled.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  return (
    <section className="py-10 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Bookings</h1>
            <p className="text-slate-500 text-sm mt-1">Manage and download your e-tickets</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-2 mb-5 inline-flex gap-1">
          {(['upcoming', 'completed', 'cancelled'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition capitalize ${tab === t ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {t} ({bookings.filter((b) => b.status === t).length})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl p-16 text-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Ticket className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">No {tab} bookings</h3>
            <p className="text-slate-500 text-sm">Your {tab} trips will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((b) => (
              <div key={b.ref} className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Booking Ref</div>
                    <div className="font-bold text-slate-900 tracking-wider font-mono">{b.ref}</div>
                    {b.company !== '—' && <div className="text-xs text-slate-500 mt-0.5">{b.company}</div>}
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${statusColor(b.status)}`}>{b.status}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700 mb-3">
                  <MapPin className="w-4 h-4 text-blue-700" /><span className="font-semibold">{b.from}</span>
                  <span className="text-slate-400">→</span>
                  <MapPin className="w-4 h-4 text-orange-500" /><span className="font-semibold">{b.to}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString() : '—'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.departTime} – {b.arriveTime}</span>
                  <span>Seats: <span className="font-bold text-slate-700">{b.seats.join(', ') || '—'}</span></span>
                  <span>Total: <span className="font-bold text-slate-700">K{b.total.toFixed(2)}</span></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewTicket(b)}>
                    <QrCode className="w-4 h-4 mr-1" /> View Ticket
                  </Button>
                  {b.status === 'upcoming' && (
                    <>
                      <Button variant="outline" size="sm" disabled={cancel.isPending} onClick={() => handleCancel(b)}>
                        {cancel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRefundBooking(b)}
                        className="text-red-600 border-red-200 hover:bg-red-50">
                        <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Refund
                      </Button>
                    </>
                  )}
                  {b.status === 'completed' && (
                    <Button variant="outline" size="sm" onClick={() => setRefundBooking(b)}
                      className="text-red-600 border-red-200 hover:bg-red-50">
                      <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Request Refund
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewTicket && <TicketModal booking={viewTicket} onClose={() => setViewTicket(null)} />}
      {refundBooking && <RefundModal booking={refundBooking} onClose={() => setRefundBooking(null)} />}
    </section>
  );
};

export default MyBookings;
