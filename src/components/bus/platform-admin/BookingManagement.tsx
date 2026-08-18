import React, { useState } from 'react';
import {
  Search, ChevronDown, ChevronUp, XCircle, Ticket,
  MapPin, User, Phone, Building2, CreditCard, Clock,
} from 'lucide-react';
import {
  useAllBookings, useCancelBooking, fmtK, type PlatformBooking,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-100 text-emerald-700' },
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
  refunded:  { label: 'Refunded',  cls: 'bg-purple-100 text-purple-700' },
  boarded:   { label: 'Boarded',   cls: 'bg-blue-100 text-blue-700' },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CFG[status.toLowerCase()] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

const PaymentBadge: React.FC<{ isWalkin: boolean; method: string }> = ({ isWalkin, method }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
    isWalkin ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
  }`}>
    <CreditCard className="w-2.5 h-2.5" />
    {isWalkin ? 'Walk-in' : method}
  </span>
);

// ── Cancel Dialog ─────────────────────────────────────────────────────────────

interface CancelDialogProps {
  booking: PlatformBooking;
  onClose: () => void;
}

const CancelDialog: React.FC<CancelDialogProps> = ({ booking, onClose }) => {
  const [reason, setReason] = useState('');
  const { mutate: cancel, isPending } = useCancelBooking();

  const handleConfirm = () => {
    cancel({ bookingId: booking.id, reason: reason || undefined }, {
      onSuccess: () => { toast.success(`Booking ${booking.referenceCode} cancelled`); onClose(); },
      onError: (e: any) => toast.error(e.messages?.[0] ?? 'Failed to cancel booking'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Cancel Booking</h3>
        <p className="text-sm text-slate-600">
          Cancel booking <span className="font-mono font-semibold text-indigo-600">{booking.referenceCode}</span>?
          This action cannot be undone.
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reason (optional)</label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter cancellation reason…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Keep Booking
          </button>
          <button
            disabled={isPending}
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
          >
            {isPending ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Booking Row ───────────────────────────────────────────────────────────────

const BookingRow: React.FC<{ booking: PlatformBooking }> = ({ booking }) => {
  const [expanded, setExpanded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const status = booking.status.toLowerCase();
  const canCancel = status === 'confirmed' || status === 'pending';

  const passengers: any[] = Array.isArray(booking.passengerDetails) ? booking.passengerDetails : [];

  return (
    <>
      {showCancel && (
        <CancelDialog booking={booking} onClose={() => setShowCancel(false)} />
      )}
      <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
        {/* Main row */}
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-slate-50 cursor-pointer transition"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Ref badge */}
          <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
            {booking.referenceCode}
          </span>

          {/* Route */}
          <div className="flex items-center gap-1 text-sm text-slate-700 flex-1 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{booking.routeFrom} <span className="text-slate-400">→</span> {booking.routeTo}</span>
          </div>

          {/* Company */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
            <Building2 className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{booking.companyName}</span>
          </div>

          {/* Customer */}
          <div className="hidden md:flex items-center gap-1 text-xs text-slate-500">
            <User className="w-3 h-3" />
            <span>{booking.customerUsername}</span>
          </div>

          {/* Amount */}
          <span className="text-sm font-bold text-slate-800">{fmtK(booking.totalAmount)}</span>

          {/* Badges */}
          <PaymentBadge isWalkin={booking.isWalkin} method={booking.paymentMethod} />
          <StatusBadge status={booking.status} />

          {/* Date */}
          <span className="hidden sm:block text-xs text-slate-400">
            {new Date(booking.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </span>

          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Customer</p>
                <p className="text-slate-700 font-semibold">{booking.customerUsername}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Phone</p>
                <p className="text-slate-700 font-semibold">{booking.customerPhone || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Departure</p>
                <p className="text-slate-700 font-semibold">
                  {booking.departureTime ? new Date(booking.departureTime).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Seats</p>
                <p className="text-slate-700 font-semibold">
                  {booking.seats?.length ? booking.seats.join(', ') : '—'}
                </p>
              </div>
            </div>

            {/* Passengers */}
            {passengers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Passengers</p>
                <div className="space-y-1.5">
                  {passengers.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium text-slate-700">{p.name ?? p.full_name ?? '—'}</span>
                      {(p.phone ?? p.phoneNumber) && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Phone className="w-3 h-3" />{p.phone ?? p.phoneNumber}
                        </span>
                      )}
                      {p.seat_number && <span className="text-slate-400">Seat {p.seat_number}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {canCancel && (
              <div>
                <button
                  onClick={() => setShowCancel(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
                >
                  <XCircle className="w-3.5 h-3.5" /> Cancel Booking
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <div className="border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3 bg-white">
    <div className="w-24 h-5 bg-slate-100 rounded animate-pulse" />
    <div className="flex-1 h-5 bg-slate-100 rounded animate-pulse" />
    <div className="w-16 h-5 bg-slate-100 rounded animate-pulse" />
    <div className="w-20 h-5 bg-slate-100 rounded animate-pulse" />
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const STATUSES = ['All', 'Pending', 'Confirmed', 'Cancelled', 'Refunded', 'Boarded'];

const BookingManagement: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data: bookings = [], isLoading } = useAllBookings({
    search: search || undefined,
    status: status || undefined,
    limit: 100,
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Booking Management</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Search and manage all platform bookings
          {!isLoading && <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{bookings.length} results</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Reference code, username, or route…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
        >
          {STATUSES.map(s => (
            <option key={s} value={s === 'All' ? '' : s.toLowerCase()}>{s}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bookings found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => <BookingRow key={b.id} booking={b} />)}
        </div>
      )}
    </div>
  );
};

export default BookingManagement;
