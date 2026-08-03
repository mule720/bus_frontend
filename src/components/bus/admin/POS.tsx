import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { BusSeatPicker, seatLabel } from './BusSeatMap';
import {
  Search, Loader2, ChevronRight, CheckCircle2, Bus,
  Clock, CreditCard, Banknote, Smartphone, X, MapPin,
  Tag, Phone, ExternalLink, Copy, AlertCircle, LogOut,
  RefreshCw, Users, Save, FolderOpen, Trash2, UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useEmployeePosTrips, useAvailableSeatsForSegment,
  useEmployeeRouteOptions, useCreateWalkInBooking,
  useInitiateWalkInMobileMoney, useWalkInPaymentStatus,
  useTripStops, useCloseStationSales,
  useMyPosDrafts, useSavePosDraft, useDeletePosDraft,
  useLookupWalkInCustomer,
} from '@/lib/api';
import type { BackendTrip, POSTripEntry, PosDraft } from '@/lib/api';

type Step = 'search' | 'seat' | 'passenger' | 'pay' | 'waiting' | 'done';
type PayMethod = 'cash' | 'mobile_money';

interface Passenger { name: string; phone: string; nationalId: string; }
interface Receipt { referenceCode: string; qrCode?: string; seats: string[]; totalAmount: string; }

function fmt(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }); }
  catch { return iso; }
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StationBadge({ status }: { status: string }) {
  if (status === 'selling')
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">● Selling</span>;
  if (status === 'bus_left')
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">↗ Left — selling here</span>;
  if (status === 'completed')
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">✓ Completed</span>;
  return null; // no_station — show nothing extra
}

// ── Autocomplete input ────────────────────────────────────────────────────────

function AutocompleteInput({
  label, value, onChange, options, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => value.length >= 1
      ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
      : options.slice(0, 8),
    [value, options],
  );
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
      <div className="relative mt-1">
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-7"
          value={value} placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button onClick={() => { onChange(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-auto">
          {filtered.map((o) => (
            <li key={o}>
              <button onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main POS ──────────────────────────────────────────────────────────────────

interface POSProps {
  preselectedTripId?: string | null;
  preselectedSeat?: number | null;
}

const POS: React.FC<POSProps> = ({ preselectedTripId, preselectedSeat }) => {
  const today = new Date().toISOString().split('T')[0];

  const [step, setStep] = useState<Step>('search');
  const [searchForm, setSearchForm] = useState({ routeFrom: '', routeTo: '', date: today });
  const [searchParams, setSearchParams] = useState<typeof searchForm | null>(null);

  // Selected trip entry (includes station context)
  const [selectedEntry, setSelectedEntry] = useState<POSTripEntry | null>(null);
  const selectedTrip = selectedEntry?.trip ?? null;

  // Segment stops — FROM is auto-set to boarding stop, TO is chosen by employee
  const [fromStopId, setFromStopId] = useState<string | null>(null);
  const [toStopId, setToStopId] = useState<string | null>(null);

  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([{ name: '', phone: '', nationalId: '' }]);
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);

  // Auto-load upcoming trips on mount (empty date = backend returns all future trips)
  useEffect(() => {
    setSearchParams({ routeFrom: '', routeTo: '', date: '' });
  }, []);

  const { data: routeOptions } = useEmployeeRouteOptions();
  const origins = routeOptions?.origins ?? [];
  const destinations = routeOptions?.destinations ?? [];

  const { data: entries = [], isLoading: tripsLoading, refetch: refetchTrips } =
    useEmployeePosTrips(searchParams);

  // Auto-jump when arriving from Seat Availability with a pre-selected trip+seat
  const [preselectionApplied, setPreselectionApplied] = useState(false);
  useEffect(() => {
    if (!preselectedTripId || preselectionApplied) return;
    if (entries.length === 0) return; // wait for trips to load
    const match = entries.find((e) => e.trip.id === preselectedTripId);
    if (match) {
      setSelectedEntry(match);
      if (preselectedSeat) setSelectedSeats([preselectedSeat]);
      setStep('seat');
      setPreselectionApplied(true);
    }
  }, [entries, preselectedTripId]);

  // Trip stops for segment selection
  const { data: stops = [] } = useTripStops(
    selectedTrip?.isMultiStop ? selectedTrip.id : null,
  );

  // Destination stops = all stops after the FROM stop
  const fromStop = stops.find((s) => s.id === fromStopId) ?? null;
  const toStop = stops.find((s) => s.id === toStopId) ?? null;
  const destOptions = fromStop ? stops.filter((s) => s.order > fromStop.order) : stops.slice(1);

  // Segment-aware available seats — replaces global bookedSeats
  const { data: availableSeats = [] } = useAvailableSeatsForSegment(
    selectedTrip?.id ?? null,
    fromStopId,
    toStopId,
    selectedEntry?.travelDate,
  );

  // For non-multi-stop trips: use the global available seat numbers
  const { data: simpleAvailable = [] } = useAvailableSeatsForSegment(
    (!selectedTrip?.isMultiStop && selectedTrip) ? selectedTrip.id : null,
    null, null, // won't fire (enabled=false when either stop is null)
  );

  // The actual "free seats" list shown in the seat picker
  const freeSeatNums: number[] = selectedTrip?.isMultiStop ? availableSeats : (() => {
    // Non-multi-stop: all seat numbers that aren't booked
    const booked = new Set<number>();
    // availableSeats won't fire without stops, so derive from totalSeats - availableSeats count
    const avail = selectedTrip?.availableSeats ?? 0;
    const total = selectedTrip?.totalSeats ?? 0;
    const all = Array.from({ length: total }, (_, i) => i + 1);
    // We don't have booked seat numbers for simple trips in this hook
    // Fall back to using a global booked-seat query isn't needed — we track via selectedSeats
    return all; // server will validate; seat picker greyed = already selected
  })();

  // Payment status polling
  const { data: paymentStatus } = useWalkInPaymentStatus(
    step === 'waiting' ? pendingOrderId : null,
  );
  useEffect(() => {
    if (step !== 'waiting' || !paymentStatus) return;
    if (paymentStatus.status === 'confirmed') {
      setReceipts(paymentStatus.bookings);
      if (activeDraftId) { deletePosDraft.mutate(activeDraftId); setActiveDraftId(null); }
      setStep('done');
    }
    else if (paymentStatus.status === 'cancelled' || paymentStatus.status === 'expired') {
      toast.error('Payment expired or cancelled. Please try again.');
      setStep('pay'); setPendingOrderId(null);
    }
  }, [paymentStatus, step]);

  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);

  const createWalkIn = useCreateWalkInBooking();
  const initiateMMoney = useInitiateWalkInMobileMoney();
  const closeStation = useCloseStationSales();
  const savePosDraft = useSavePosDraft();
  const deletePosDraft = useDeletePosDraft();
  const lookupCustomer = useLookupWalkInCustomer();
  const { data: drafts = [] } = useMyPosDrafts();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ ...searchForm });
    setSelectedEntry(null); setSelectedSeats([]);
  };

  const selectEntry = (entry: POSTripEntry) => {
    setSelectedEntry(entry);
    setSelectedSeats([]);
    // Auto-set FROM stop to the employee's boarding stop
    setFromStopId(entry.boardingStopId ?? null);
    setToStopId(null);
    setStep('seat');
  };

  const toggleSeat = (n: number) => {
    if (!freeSeatNums.includes(n)) return;
    setSelectedSeats((prev) => prev.includes(n) ? prev.filter((s) => s !== n) : [...prev, n]);
  };

  const goToPassenger = () => {
    if (selectedSeats.length === 0) { toast.error('Select at least one seat.'); return; }
    if (selectedTrip?.isMultiStop && (!fromStopId || !toStopId)) {
      toast.error('Select boarding and destination stops for this multi-stop trip.'); return;
    }
    setPassengers(selectedSeats.map(() => ({ name: '', phone: '', nationalId: '' })));
    setStep('passenger');
  };

  const passengerValid = passengers.every((p) => p.name.trim() && p.phone.trim());

  const price = useMemo(() => {
    if (!selectedTrip) return 0;
    if (selectedTrip.isMultiStop && fromStop && toStop) {
      const seg = selectedTrip.segmentPrices?.find(
        (sp) => sp.fromStop.order === fromStop.order && sp.toStop.order === toStop.order,
      );
      return seg ? parseFloat(seg.price) : parseFloat(selectedTrip.price);
    }
    return parseFloat(selectedTrip.price);
  }, [selectedTrip, fromStop, toStop]);

  const discountAmt = parseFloat(discount) || 0;
  const total = Math.max(0, selectedSeats.length * price - discountAmt);
  const change = parseFloat(cashReceived) - total;
  const seatLabels = useMemo(() => selectedSeats.map(seatLabel), [selectedSeats]);

  const handlePay = async () => {
    if (!passengerValid) { toast.error('All passengers must have a name and phone.'); return; }
    if (payMethod === 'cash' && (parseFloat(cashReceived) || 0) < total) {
      toast.error(`Cash received is less than total K${total.toFixed(2)}.`); return;
    }
    if (payMethod === 'mobile_money' && !customerPhone.trim()) {
      toast.error('Enter the customer phone number for mobile money.'); return;
    }
    const passengerData = passengers.map((p, i) => ({
      name: p.name, phone: p.phone, national_id: p.nationalId, seat: selectedSeats[i],
    }));
    try {
      if (payMethod === 'cash') {
        const result = await createWalkIn.mutateAsync({
          tripId: selectedTrip!.id, seats: selectedSeats.map(String), passengerDetails: passengerData,
          paymentMethod: 'cash', cashCollected: parseFloat(cashReceived),
          discountAmount: discountAmt || undefined, discountReason: discountReason || undefined,
          ...(fromStopId && { fromStopId }), ...(toStopId && { toStopId }),
        } as Parameters<typeof createWalkIn.mutateAsync>[0]);
        setReceipts(result.bookings);
        if (activeDraftId) { deletePosDraft.mutate(activeDraftId); setActiveDraftId(null); }
        setStep('done');
      } else {
        const result = await initiateMMoney.mutateAsync({
          tripId: selectedTrip!.id, seats: selectedSeats.map(String), passengerDetails: passengerData,
          customerPhone: customerPhone.trim(),
          discountAmount: discountAmt || undefined, discountReason: discountReason || undefined,
          ...(fromStopId && { fromStopId }), ...(toStopId && { toStopId }),
          travelDate: selectedEntry?.travelDate,
        });
        setPendingOrderId(result.orderId); setPendingCheckoutUrl(result.checkoutUrl || null);
        setStep('waiting');
      }
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Payment failed'); }
  };

  const handleCloseStation = async (entry: POSTripEntry) => {
    if (!confirm('Mark the bus as departed from your station? This will close ticket sales here.')) return;
    try {
      await closeStation.mutateAsync({ tripId: entry.trip.id, travelDate: entry.travelDate });
      toast.success('Station closed — bus has left your stop.');
      refetchTrips();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close station');
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedTrip) { toast.error('No trip selected'); return; }
    try {
      const result = await savePosDraft.mutateAsync({
        draftId: activeDraftId ?? undefined,
        tripId: selectedTrip.id,
        seats: selectedSeats,
        passengerDetails: passengers.map((p) => ({ name: p.name, phone: p.phone, national_id: p.nationalId })),
        paymentMethod: payMethod,
        fromStopId: fromStopId ?? undefined,
        toStopId: toStopId ?? undefined,
        travelDate: selectedEntry?.travelDate,
        notes: '',
      });
      setActiveDraftId(result.draftId);
      toast.success('Sale saved as draft');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    }
  };

  const handleLoadDraft = useCallback((draft: PosDraft) => {
    setSelectedEntry(null);
    setSelectedSeats(draft.seats ?? []);
    setFromStopId(draft.fromStop?.id ?? null);
    setToStopId(draft.toStop?.id ?? null);
    setPassengers(
      (draft.passengerDetails ?? []).map((p) => ({
        name: p.name ?? '', phone: p.phone ?? '', nationalId: p.nationalId ?? '',
      })),
    );
    setPayMethod((draft.paymentMethod as 'cash' | 'mobile_money') || 'cash');
    setActiveDraftId(draft.id);
    setShowDrafts(false);
    // Navigate directly to passenger step so employee can review and complete
    setStep('passenger');
    toast.success(`Draft loaded — ${draft.trip?.routeFrom} → ${draft.trip?.routeTo}`);
  }, []);

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deletePosDraft.mutateAsync(id);
    if (activeDraftId === id) { setActiveDraftId(null); }
    toast.success('Draft deleted');
  };

  const handlePhoneLookup = useCallback(async (phone: string, idx: number) => {
    if (phone.replace(/\D/g, '').length < 8) return;
    const cust = await lookupCustomer.mutateAsync(phone).catch(() => null);
    if (!cust) return;
    setPassengers((prev) => prev.map((p, i) =>
      i === idx ? { name: cust.name || p.name, phone: cust.phone || p.phone, nationalId: cust.nationalId || p.nationalId } : p,
    ));
    toast.success(`Passenger auto-filled: ${cust.name}`);
  }, [lookupCustomer]);

  const handleNidLookup = useCallback(async (nid: string, idx: number) => {
    if (nid.length < 5) return;
    const cust = await lookupCustomer.mutateAsync(nid).catch(() => null);
    if (!cust) return;
    setPassengers((prev) => prev.map((p, i) =>
      i === idx ? { name: cust.name || p.name, phone: cust.phone || p.phone, nationalId: cust.nationalId || p.nationalId } : p,
    ));
    toast.success(`Passenger auto-filled: ${cust.name}`);
  }, [lookupCustomer]);

  const reset = () => {
    setStep('search');
    setSearchParams({ routeFrom: '', routeTo: '', date: '' });
    setSelectedEntry(null); setSelectedSeats([]);
    setFromStopId(null); setToStopId(null);
    setPassengers([{ name: '', phone: '', nationalId: '' }]);
    setPayMethod('cash'); setCashReceived(''); setDiscount(''); setDiscountReason('');
    setCustomerPhone(''); setReceipts([]); setPendingOrderId(null); setPendingCheckoutUrl(null);
    setActiveDraftId(null);
  };

  const STEPS: Step[] = ['search', 'seat', 'passenger', 'pay'];
  const stepLabels = ['Find Trip', 'Seat', 'Passenger', 'Payment'];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Point of Sale</h1>
          <p className="text-slate-500 text-sm mt-1">Walk-in ticket sales terminal</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Drafts button — always visible */}
          <button onClick={() => setShowDrafts((v) => !v)}
            className={`relative text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg border transition ${showDrafts ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-500 hover:text-slate-800'}`}>
            <FolderOpen className="w-4 h-4" />
            Drafts
            {drafts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {drafts.length}
              </span>
            )}
          </button>
          {/* Save draft — visible when actively in a sale */}
          {selectedTrip && !['done', 'waiting'].includes(step) && (
            <button onClick={handleSaveDraft} disabled={savePosDraft.isPending}
              className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 transition">
              {savePosDraft.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
          )}
          {step !== 'search' && step !== 'done' && step !== 'waiting' && (
            <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Drafts panel */}
      {showDrafts && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-amber-900 text-sm">Saved Drafts</h3>
            <button onClick={() => setShowDrafts(false)}><X className="w-4 h-4 text-amber-500" /></button>
          </div>
          {drafts.length === 0 ? (
            <p className="text-amber-700 text-xs">No drafts saved yet.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => (
                <div key={d.id} onClick={() => handleLoadDraft(d)}
                  className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2 cursor-pointer hover:border-amber-400 transition">
                  <div>
                    <div className="font-semibold text-sm text-slate-900">
                      {d.trip?.routeFrom} → {d.trip?.routeTo}
                    </div>
                    <div className="text-xs text-slate-500">
                      {d.seats?.length} seat{d.seats?.length !== 1 ? 's' : ''} ·{' '}
                      {d.passengerDetails?.[0]?.name || 'No passenger'} ·{' '}
                      {new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600 font-semibold">Resume →</span>
                    <button onClick={(e) => handleDeleteDraft(d.id, e)}
                      className="text-slate-300 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step indicator */}
      {!['done', 'waiting'].includes(step) && (
        <div className="flex items-center gap-1 text-xs font-semibold overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const idx = STEPS.indexOf(step);
            const done = i < idx; const active = s === step;
            return (
              <React.Fragment key={s}>
                <span className={`px-2.5 py-1 rounded-full whitespace-nowrap ${
                  active ? 'bg-blue-700 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>{i + 1}. {stepLabels[i]}</span>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── SEARCH ── */}
      {step === 'search' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Find a Trip</h3>
            <button onClick={() => refetchTrips()} className="text-slate-400 hover:text-blue-600 transition" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <AutocompleteInput label="From" value={searchForm.routeFrom}
                onChange={(v) => setSearchForm((f) => ({ ...f, routeFrom: v }))}
                options={origins} placeholder="e.g. Lusaka" />
              <AutocompleteInput label="To" value={searchForm.routeTo}
                onChange={(v) => setSearchForm((f) => ({ ...f, routeTo: v }))}
                options={destinations} placeholder="e.g. Ndola" />
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Date</label>
                <input type="date"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchForm.date}
                  onChange={(e) => setSearchForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white">
              <Search className="w-4 h-4 mr-1" /> Search Trips
            </Button>
          </form>

          {tripsLoading && (
            <div className="flex justify-center py-8"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
          )}

          {searchParams && !tripsLoading && entries.length === 0 && (
            <div className="text-center py-8">
              <Bus className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No trips found for this route/date.</p>
              <button onClick={() => { setSearchForm((f) => ({ ...f, routeFrom: '', routeTo: '', date: '' })); setSearchParams({ routeFrom: '', routeTo: '', date: '' }); }}
                className="text-blue-600 text-xs mt-2 hover:underline">Show all upcoming trips</button>
            </div>
          )}

          {entries.length > 0 && (
            <div className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const t = entry.trip;
                const canSell = entry.stationStatus === 'selling' || entry.stationStatus === 'no_station';
                const isBusLeft = entry.stationStatus === 'bus_left';
                const isCompleted = entry.stationStatus === 'completed';
                const avail = entry.availableFromStation ?? t.availableSeats;
                const full = avail === 0;

                return (
                  <div key={t.id} className={`p-4 rounded-lg transition ${isCompleted ? 'opacity-40' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{t.routeFrom} → {t.routeTo}</span>
                          <StationBadge status={entry.stationStatus} />
                          {t.isRecurring && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">Recurring</span>}
                          {t.isMultiStop && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Multi-stop</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                          <span><Clock className="inline w-3 h-3 mr-0.5" />{fmt(t.departureTime)}</span>
                          <span><Bus className="inline w-3 h-3 mr-0.5" />{t.busNumber || 'TBA'}</span>
                          <span className="font-medium text-slate-700">
                            K{parseFloat(t.price).toFixed(2)}
                          </span>
                          {entry.boardingStopName && (
                            <span className="flex items-center gap-1 text-blue-600">
                              <MapPin className="w-3 h-3" />
                              Boarding: {entry.boardingStopName}
                            </span>
                          )}
                          <span className={`font-semibold ${full ? 'text-red-600' : 'text-green-700'}`}>
                            {full ? 'Fully booked' : `${avail} seat${avail !== 1 ? 's' : ''} available`}
                            {entry.boardingStopName ? ' from here' : ''}
                          </span>
                        </div>

                        {/* Segment price hints for multi-stop */}
                        {t.isMultiStop && (t.segmentPrices ?? []).length > 0 && entry.boardingStopName && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(t.segmentPrices ?? [])
                              .filter((sp) => sp.fromStop.name === entry.boardingStopName)
                              .sort((a, b) => a.toStop.order - b.toStop.order)
                              .map((sp) => (
                                <span key={sp.id} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-md">
                                  → {sp.toStop.name}: K{parseFloat(sp.price).toFixed(2)}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Close station button — shown when selling and bus is about to leave */}
                        {(canSell || isBusLeft) && entry.stationStatus !== 'no_station' && !isBusLeft && (
                          <button
                            onClick={() => handleCloseStation(entry)}
                            disabled={closeStation.isPending}
                            title="Mark bus as departed from your station"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition">
                            <LogOut className="w-3 h-3" /> Bus Left
                          </button>
                        )}

                        {canSell && !full && (
                          <button onClick={() => selectEntry(entry)}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition">
                            Sell <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canSell && full && (
                          <span className="px-3 py-2 bg-slate-100 text-slate-400 text-xs font-semibold rounded-lg">Full</span>
                        )}
                        {isBusLeft && (
                          <span className="px-3 py-2 bg-orange-50 text-orange-600 text-xs font-semibold rounded-lg">Departed</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SEAT SELECTION ── */}
      {step === 'seat' && selectedTrip && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">{selectedTrip.routeFrom} → {selectedTrip.routeTo}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <Clock className="inline w-3 h-3 mr-0.5" />{fmt(selectedTrip.departureTime)}
                {' · '}{selectedTrip.busNumber || 'Bus TBA'}
                {selectedEntry?.travelDate && ` · ${fmtDate(selectedEntry.travelDate)}`}
              </p>
            </div>
            <button onClick={reset} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
          </div>

          {/* Stop selection for multi-stop trips */}
          {selectedTrip.isMultiStop && stops.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Segment</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold">Boarding stop</label>
                  <select className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={fromStopId ?? ''} onChange={(e) => { setFromStopId(e.target.value || null); setToStopId(null); setSelectedSeats([]); }}>
                    <option value="">Select boarding stop</option>
                    {stops.slice(0, -1).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold">Destination</label>
                  <select className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={toStopId ?? ''} onChange={(e) => { setToStopId(e.target.value || null); setSelectedSeats([]); }}
                    disabled={!fromStopId}>
                    <option value="">Select destination</option>
                    {destOptions.map((s) => {
                      const seg = selectedTrip.segmentPrices?.find(
                        (sp) => sp.fromStop.id === fromStopId && sp.toStop.id === s.id,
                      );
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name}{seg ? ` — K${parseFloat(seg.price).toFixed(2)}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              {fromStopId && toStopId && (
                <p className="text-xs text-blue-600 font-semibold">
                  {availableSeats.length} seat{availableSeats.length !== 1 ? 's' : ''} available for this segment · K{price.toFixed(2)}/seat
                </p>
              )}
            </div>
          )}

          {/* Seat grid */}
          {(!selectedTrip.isMultiStop || (fromStopId && toStopId)) && (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Select Seats</p>
                <BusSeatPicker
                  total={selectedTrip.totalSeats}
                  freeSeats={selectedTrip.isMultiStop ? availableSeats : Array.from({ length: selectedTrip.totalSeats }, (_, i) => i + 1)}
                  selected={selectedSeats}
                  onToggle={toggleSeat}
                />
              </div>
              {selectedSeats.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <span className="font-semibold text-slate-700">
                    {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''} selected:
                  </span>{' '}
                  {seatLabels.join(', ')} · Total: <b>K{total.toFixed(2)}</b>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3">
            <Button onClick={goToPassenger} disabled={selectedSeats.length === 0}
              className="bg-blue-700 hover:bg-blue-800 text-white">
              Next: Passenger Info <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── PASSENGER INFO ── */}
      {step === 'passenger' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900">Passenger Details</h3>
            <UserCheck className="w-4 h-4 text-blue-500" title="Enter phone or NRC to auto-fill returning customers" />
            <span className="text-xs text-slate-400">Phone or NRC auto-fills returning customers</span>
          </div>
          {passengers.map((p, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">Seat {seatLabels[i]}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Phone *</label>
                  <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+260 97..."
                    value={p.phone}
                    onChange={(e) => setPassengers((prev) => prev.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))}
                    onBlur={(e) => handlePhoneLookup(e.target.value, i)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">National ID / NRC</label>
                  <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                    value={p.nationalId}
                    onChange={(e) => setPassengers((prev) => prev.map((x, j) => j === i ? { ...x, nationalId: e.target.value } : x))}
                    onBlur={(e) => handleNidLookup(e.target.value, i)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Full Name *</label>
                  <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. John Banda"
                    value={p.name}
                    onChange={(e) => setPassengers((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-3">
            <Button onClick={() => setStep('pay')} disabled={!passengerValid}
              className="bg-blue-700 hover:bg-blue-800 text-white">
              Next: Payment <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button variant="outline" onClick={() => setStep('seat')}>Back</Button>
          </div>
        </div>
      )}

      {/* ── PAYMENT ── */}
      {step === 'pay' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
          <h3 className="font-bold text-slate-900">Payment</h3>

          <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Route</span><span className="font-medium">{selectedTrip?.routeFrom} → {selectedTrip?.routeTo}</span></div>
            {fromStop && toStop && <div className="flex justify-between"><span className="text-slate-500">Segment</span><span className="font-medium">{fromStop.name} → {toStop.name}</span></div>}
            <div className="flex justify-between"><span className="text-slate-500">Seats</span><span className="font-medium">{seatLabels.join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Price/seat</span><span>K{price.toFixed(2)}</span></div>
            {discountAmt > 0 && <div className="flex justify-between text-orange-600"><span>Discount</span><span>−K{discountAmt.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg pt-1 border-t border-slate-200 mt-2"><span>Total</span><span>K{total.toFixed(2)}</span></div>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1"><Tag className="w-3 h-3" /> Discount (K)</label>
              <input type="number" min="0" step="0.01" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Reason</label>
              <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Staff discount" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'cash' as const, label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
                { id: 'mobile_money' as const, label: 'Mobile Money', icon: <Smartphone className="w-4 h-4" /> },
              ].map(({ id, label, icon }) => (
                <button key={id} type="button" onClick={() => setPayMethod(id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-semibold transition ${
                    payMethod === id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {payMethod === 'cash' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Cash Received (K)</label>
              <input type="number" min="0" step="0.01"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={total.toFixed(2)} value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
              {parseFloat(cashReceived) >= total && cashReceived && (
                <p className="text-green-600 text-xs mt-1 font-semibold">Change: K{change.toFixed(2)}</p>
              )}
            </div>
          )}

          {payMethod === 'mobile_money' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1"><Phone className="w-3 h-3" /> Customer Phone</label>
              <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="+260 97..." value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handlePay}
              disabled={createWalkIn.isPending || initiateMMoney.isPending}
              className="bg-green-600 hover:bg-green-700 text-white flex-1">
              {(createWalkIn.isPending || initiateMMoney.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {payMethod === 'cash' ? 'Confirm & Print' : 'Send Payment Request'}
              <CreditCard className="w-4 h-4 ml-1" />
            </Button>
            <Button variant="outline" onClick={() => setStep('passenger')}>Back</Button>
          </div>
        </div>
      )}

      {/* ── WAITING FOR MOBILE PAYMENT ── */}
      {step === 'waiting' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <h3 className="font-bold text-slate-900">Awaiting Payment</h3>
          <p className="text-slate-500 text-sm">Ask the customer to approve the payment on their phone.</p>
          {pendingCheckoutUrl && (
            <a href={pendingCheckoutUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline">
              Open payment page <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <Button variant="outline" onClick={() => { setStep('pay'); setPendingOrderId(null); }}>
            Cancel / Retry
          </Button>
        </div>
      )}

      {/* ── DONE / RECEIPTS ── */}
      {step === 'done' && receipts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-900">Booking Confirmed!</h3>
              <p className="text-slate-500 text-sm">{receipts.length} ticket{receipts.length > 1 ? 's' : ''} issued</p>
            </div>
          </div>
          {receipts.map((r, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-base">{r.referenceCode}</span>
                <button onClick={() => navigator.clipboard.writeText(r.referenceCode).then(() => toast.success('Copied!'))}
                  className="text-slate-400 hover:text-slate-700"><Copy className="w-4 h-4" /></button>
              </div>
              <div className="text-slate-600">Seat{r.seats.length > 1 ? 's' : ''}: <b>{r.seats.join(', ')}</b></div>
              <div className="text-slate-600">Amount: <b>K{parseFloat(r.totalAmount).toFixed(2)}</b></div>
              {r.qrCode && (
                <div className="bg-white rounded border p-2 text-center font-mono text-xs text-slate-400 break-all">{r.qrCode}</div>
              )}
            </div>
          ))}
          <Button onClick={reset} className="bg-blue-700 hover:bg-blue-800 text-white w-full">
            New Sale
          </Button>
        </div>
      )}
    </div>
  );
};


export default POS;
