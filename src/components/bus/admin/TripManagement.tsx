import React, { useState } from 'react';
import {
  Plus, MapPin, Clock, Loader2, X, Bus, ChevronDown, ChevronUp,
  Trash2, Zap, Edit2, ArrowUp, ArrowDown, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useMyTrips, useCreateTrip, useUpdateTrip, useCancelTrip,
  useSetTripStatus, useMyBuses,
} from '@/lib/api';
import type { BackendTrip, StopInput, SegmentPriceInput } from '@/lib/api';

interface Props { canCreate: boolean; }

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}
function toLocalDatetime(iso: string) {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ''; }
}

const AMENITY_OPTS = ['WiFi', 'AC', 'USB', 'Meals', 'TV', 'Restroom'];
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_MAP: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday',
  FRI: 'friday', SAT: 'saturday', SUN: 'sunday',
};
const DAY_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(DAY_MAP).map(([k, v]) => [v, k]),
);

// ── Stop helpers ──────────────────────────────────────────────────────────────

let _keyCounter = 0;
const newKey = () => String(++_keyCounter);

interface StopRow { key: string; name: string; time: string; }
type PriceMap = Record<string, string>; // "fi-ti" → price string

function priceKey(fi: number, ti: number) { return `${fi}-${ti}`; }

// All (from,to) ordered pairs
function pricePairs(n: number) {
  const pairs: { fi: number; ti: number }[] = [];
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++)
      pairs.push({ fi: i, ti: j });
  return pairs;
}

// ── Single-stop form ──────────────────────────────────────────────────────────

interface SingleForm {
  routeFrom: string; routeTo: string;
  departureTime: string; arrivalTime: string;
  price: string; busNumber: string; totalSeats: string;
  amenities: string[];
  isRecurring: boolean; recurringDays: string[];
}

const emptySingle = (): SingleForm => ({
  routeFrom: '', routeTo: '',
  departureTime: '', arrivalTime: '',
  price: '', busNumber: '', totalSeats: '40',
  amenities: [], isRecurring: false, recurringDays: [],
});

function tripToSingle(t: BackendTrip): SingleForm {
  return {
    routeFrom: t.routeFrom,
    routeTo: t.routeTo,
    departureTime: toLocalDatetime(t.departureTime),
    arrivalTime: toLocalDatetime(t.arrivalTime),
    price: parseFloat(t.price).toString(),
    busNumber: t.busNumber ?? '',
    totalSeats: String(t.totalSeats),
    amenities: t.amenities ?? [],
    isRecurring: t.isRecurring,
    recurringDays: (t.recurringDays ?? []).map((d) => DAY_REVERSE[d.toLowerCase()] ?? d.toUpperCase().slice(0, 3)),
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

const TripManagement: React.FC<Props> = ({ canCreate }) => {
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTrip, setEditTrip] = useState<BackendTrip | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Form mode toggle ──
  const [multiStop, setMultiStop] = useState(false);

  // ── Single-destination form ──
  const [form, setForm] = useState<SingleForm>(emptySingle());

  // ── Multi-stop form ──
  const [stops, setStops] = useState<StopRow[]>([
    { key: newKey(), name: '', time: '08:00' },
    { key: newKey(), name: '', time: '14:00' },
  ]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [msAmenities, setMsAmenities] = useState<string[]>([]);
  const [msBusNumber, setMsBusNumber] = useState('');
  const [msSeats, setMsSeats] = useState('40');
  const [msDate, setMsDate] = useState(new Date().toISOString().slice(0, 10));
  const [msRecurring, setMsRecurring] = useState(false);
  const [msRecurringDays, setMsRecurringDays] = useState<string[]>(['MON']);
  const [msError, setMsError] = useState<string | null>(null);

  const { data: trips = [], isLoading } = useMyTrips(statusFilter || undefined);
  const { data: buses = [] } = useMyBuses();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const cancelTrip = useCancelTrip();
  const setStatus = useSetTripStatus();

  // ── Open / close ──

  const openCreate = () => {
    setEditTrip(null);
    setMultiStop(false);
    setForm(emptySingle());
    resetMultiStop();
    setShowCreate(true);
  };

  const openEdit = (t: BackendTrip) => {
    setEditTrip(t);
    if (t.isMultiStop && (t.stops ?? []).length >= 2) {
      setMultiStop(true);
      // Populate stops
      const sorted = [...(t.stops ?? [])].sort((a, b) => a.order - b.order);
      setStops(sorted.map((s) => ({
        key: newKey(),
        name: s.name,
        time: s.departureTime
          ? new Date(s.departureTime).toTimeString().slice(0, 5)
          : (s.arrivalTime ? new Date(s.arrivalTime).toTimeString().slice(0, 5) : ''),
      })));
      // Populate prices — key format is "fi-ti" by stop index in sorted array
      const initPrices: PriceMap = {};
      for (const sp of (t.segmentPrices ?? [])) {
        const fi = sorted.findIndex((s) => s.id === sp.fromStop.id);
        const ti = sorted.findIndex((s) => s.id === sp.toStop.id);
        if (fi !== -1 && ti !== -1) initPrices[priceKey(fi, ti)] = String(sp.price);
      }
      setPrices(initPrices);
      setMsAmenities(t.amenities ?? []);
      setMsBusNumber(t.busNumber ?? '');
      setMsSeats(String(t.totalSeats));
      setMsDate(new Date(t.departureTime).toISOString().slice(0, 10));
      setMsRecurring(t.isRecurring);
      setMsRecurringDays((t.recurringDays ?? []).map((d) => DAY_REVERSE[d.toLowerCase()] ?? d.toUpperCase().slice(0, 3)));
    } else {
      setMultiStop(false);
      setForm(tripToSingle(t));
    }
    setShowCreate(true);
  };

  const closeForm = () => { setShowCreate(false); setEditTrip(null); setMsError(null); };

  const resetMultiStop = () => {
    setStops([
      { key: newKey(), name: '', time: '08:00' },
      { key: newKey(), name: '', time: '14:00' },
    ]);
    setPrices({});
    setMsAmenities([]);
    setMsBusNumber('');
    setMsSeats('40');
    setMsDate(new Date().toISOString().slice(0, 10));
    setMsRecurring(false);
    setMsRecurringDays(['MON']);
    setMsError(null);
  };

  // ── Stop helpers ──

  const addStop = () =>
    setStops((prev) => {
      const s: StopRow = { key: newKey(), name: '', time: '' };
      return [...prev.slice(0, -1), s, prev[prev.length - 1]];
    });

  const removeStop = (key: string) =>
    setStops((prev) => {
      if (prev.length <= 2) return prev;
      setPrices({});
      return prev.filter((s) => s.key !== key);
    });

  const updateStop = (key: string, field: keyof StopRow, val: string) =>
    setStops((prev) => prev.map((s) => s.key === key ? { ...s, [field]: val } : s));

  const moveStop = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= stops.length) return;
    setStops((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      setPrices({});
      return next;
    });
  };

  // ── Day toggles ──

  const toggleDay = (d: string) =>
    setForm((f) => ({
      ...f,
      recurringDays: f.recurringDays.includes(d) ? f.recurringDays.filter((x) => x !== d) : [...f.recurringDays, d],
    }));

  const toggleMsDay = (d: string) =>
    setMsRecurringDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );

  const toggleAmenity = (a: string) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));

  const toggleMsAmenity = (a: string) =>
    setMsAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );

  // ── Submit — single destination ──

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.routeFrom || !form.routeTo || !form.departureTime || !form.arrivalTime || !form.price) {
      toast.error('Fill in all required fields.'); return;
    }
    const recurringDays = form.isRecurring
      ? form.recurringDays.map((d) => DAY_MAP[d] ?? d.toLowerCase())
      : [];
    try {
      if (editTrip) {
        await updateTrip.mutateAsync({
          tripId: editTrip.id,
          routeFrom: form.routeFrom, routeTo: form.routeTo,
          departureTime: new Date(form.departureTime).toISOString(),
          arrivalTime: new Date(form.arrivalTime).toISOString(),
          price: parseFloat(form.price),
          busNumber: form.busNumber || undefined,
          amenities: form.amenities,
          isRecurring: form.isRecurring,
          recurringDays: form.isRecurring ? recurringDays : [],
        });
        toast.success('Trip updated!');
      } else {
        await createTrip.mutateAsync({
          routeFrom: form.routeFrom, routeTo: form.routeTo,
          departureTime: new Date(form.departureTime).toISOString(),
          arrivalTime: new Date(form.arrivalTime).toISOString(),
          price: parseFloat(form.price),
          busNumber: form.busNumber || undefined,
          totalSeats: parseInt(form.totalSeats, 10) || 40,
          amenities: form.amenities,
          isRecurring: form.isRecurring,
          recurringDays: form.isRecurring ? recurringDays : undefined,
        });
        toast.success('Trip created!');
      }
      closeForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : editTrip ? 'Update failed' : 'Create failed');
    }
  };

  // ── Submit — multi-stop ──

  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsError(null);

    const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
    const names = stops.map((s) => s.name.trim());
    if (names.some((n) => !n)) { setMsError('All stop names are required'); return; }
    const times = stops.map((s) => s.time.trim());
    if (times.some((t) => !t)) { setMsError('All stop times are required'); return; }
    const badIdx = times.findIndex((t) => !HHMM.test(t));
    if (badIdx !== -1) { setMsError(`Stop ${badIdx + 1}: time "${times[badIdx]}" must be HH:MM`); return; }

    const depISO = `${msDate}T${stops[0].time}:00`;
    const arrISO = `${msDate}T${stops[stops.length - 1].time}:00`;
    if (new Date(arrISO) <= new Date(depISO)) {
      setMsError('Last stop time must be after first stop time'); return;
    }

    const fullKey = priceKey(0, stops.length - 1);
    const fullPrice = parseFloat(prices[fullKey] || '');
    if (!fullPrice || fullPrice <= 0) {
      setMsError(`Price for ${stops[0].name} → ${stops[stops.length - 1].name} (full route) is required`);
      return;
    }

    if (msRecurring && msRecurringDays.length === 0) {
      setMsError('Select at least one day for the recurring schedule'); return;
    }

    const stopsPayload: StopInput[] = stops.map((s, idx) => ({
      name: s.name.trim(),
      order: idx,
      departureTime: idx === stops.length - 1 ? null : `${msDate}T${s.time}:00`,
      arrivalTime: idx === 0 ? null : `${msDate}T${s.time}:00`,
    }));

    const pairs = pricePairs(stops.length);
    const segPrices: SegmentPriceInput[] = pairs
      .filter(({ fi, ti }) => prices[priceKey(fi, ti)])
      .map(({ fi, ti }) => ({
        fromStopOrder: fi,
        toStopOrder: ti,
        price: parseFloat(prices[priceKey(fi, ti)]) || 0,
      }));

    const payload = {
      routeFrom: stops[0].name.trim(),
      routeTo: stops[stops.length - 1].name.trim(),
      departureTime: depISO,
      arrivalTime: arrISO,
      price: fullPrice,
      busNumber: msBusNumber || undefined,
      totalSeats: parseInt(msSeats, 10) || 40,
      amenities: msAmenities,
      isRecurring: msRecurring,
      recurringDays: msRecurring ? msRecurringDays.map((d) => DAY_MAP[d]) : undefined,
      stops: stopsPayload,
      segmentPrices: segPrices,
    };
    try {
      if (editTrip) {
        await updateTrip.mutateAsync({ tripId: editTrip.id, ...payload });
        toast.success('Multi-stop trip updated!');
      } else {
        await createTrip.mutateAsync(payload);
        toast.success('Multi-stop trip created!');
      }
      closeForm();
    } catch (err: unknown) {
      setMsError(err instanceof Error ? err.message : editTrip ? 'Update failed' : 'Create failed');
    }
  };

  const handleCancel = async (trip: BackendTrip) => {
    if (!confirm(`Cancel trip ${trip.routeFrom} → ${trip.routeTo}?`)) return;
    try {
      await cancelTrip.mutateAsync(trip.id);
      toast.success('Trip cancelled.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  const handleActivate = async (trip: BackendTrip) => {
    try {
      await setStatus.mutateAsync({ tripId: trip.id, status: 'active' });
      toast.success('Trip is now active.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate trip');
    }
  };

  const saving = createTrip.isPending || updateTrip.isPending;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trips</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your scheduled trips</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {canCreate && (
            <Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="w-4 h-4 mr-1" /> New Trip
            </Button>
          )}
        </div>
      </div>

      {/* ── Form ── */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg">
              {editTrip ? `Edit Trip: ${editTrip.routeFrom} → ${editTrip.routeTo}` : 'Create New Trip'}
            </h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
          </div>

          {/* Trip type toggle */}
          {(
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <button type="button"
                onClick={() => { setMultiStop(false); setMsError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${!multiStop ? 'bg-white shadow text-blue-700 border border-blue-200' : 'text-slate-500 hover:text-slate-700'}`}>
                Single Destination
              </button>
              <button type="button"
                onClick={() => { setMultiStop(true); setMsError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${multiStop ? 'bg-white shadow text-blue-700 border border-blue-200' : 'text-slate-500 hover:text-slate-700'}`}>
                Multi-stop Route
              </button>
            </div>
          )}

          {/* ── SINGLE DESTINATION FORM ── */}
          {!multiStop && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'From *', key: 'routeFrom', placeholder: 'e.g. Lusaka' },
                  { label: 'To *', key: 'routeTo', placeholder: 'e.g. Kitwe' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
                    <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={(form as Record<string, string>)[key]} placeholder={placeholder} required
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Departure *</label>
                  <input type="datetime-local" required
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.departureTime}
                    onChange={(e) => setForm((f) => ({ ...f, departureTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Arrival *</label>
                  <input type="datetime-local" required
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.arrivalTime}
                    onChange={(e) => setForm((f) => ({ ...f, arrivalTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Price (K) *</label>
                  <input type="number" min="0" step="0.01" required
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                </div>
                {!editTrip && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Total Seats</label>
                    <input type="number" min="1"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.totalSeats}
                      onChange={(e) => setForm((f) => ({ ...f, totalSeats: e.target.value }))} />
                  </div>
                )}
                <div className={editTrip ? '' : 'md:col-span-2'}>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Bus</label>
                  <select className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.busNumber}
                    onChange={(e) => setForm((f) => ({ ...f, busNumber: e.target.value }))}>
                    <option value="">— Assign later</option>
                    {buses.map((b) => (
                      <option key={b.id} value={b.busNumber}>{b.busNumber} — {b.busType} ({b.totalSeats} seats)</option>
                    ))}
                  </select>
                </div>
              </div>

              <AmenitiesRow selected={form.amenities} toggle={toggleAmenity} />

              <RecurringRow
                isRecurring={form.isRecurring}
                days={form.recurringDays}
                onToggle={(v) => setForm((f) => ({ ...f, isRecurring: v }))}
                onToggleDay={toggleDay}
              />

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  {editTrip ? 'Save Changes' : 'Create Trip'}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          )}

          {/* ── MULTI-STOP FORM ── */}
          {multiStop && (
            <form onSubmit={handleMultiSubmit} className="space-y-5">
              {/* Stops editor */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Route Stops</h4>
                <p className="text-xs text-slate-400 mb-3">First stop = departure · Last stop = final destination</p>
                <div className="space-y-2">
                  {stops.map((stop, idx) => (
                    <div key={stop.key} className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 p-3">
                      {/* Order badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        idx === 0 ? 'bg-green-500' : idx === stops.length - 1 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>{idx + 1}</div>

                      <input
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={idx === 0 ? 'Origin (e.g. Lusaka)' : idx === stops.length - 1 ? 'Destination (e.g. Kitwe)' : `Stop ${idx + 1} name`}
                        value={stop.name}
                        onChange={(e) => updateStop(stop.key, 'name', e.target.value)}
                      />
                      <input
                        className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="HH:MM"
                        value={stop.time}
                        onChange={(e) => updateStop(stop.key, 'time', e.target.value)}
                      />

                      {/* Move up/down + remove — only intermediate stops */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {idx > 0 && idx < stops.length - 1 && (
                          <button type="button" onClick={() => moveStop(idx, -1)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition" title="Move up">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx > 0 && idx < stops.length - 1 && (
                          <button type="button" onClick={() => moveStop(idx, 1)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition" title="Move down">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx > 0 && idx < stops.length - 1 && (
                          <button type="button" onClick={() => removeStop(stop.key)}
                            className="p-1 text-red-400 hover:text-red-600 transition" title="Remove stop">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addStop}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 border border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-semibold hover:bg-blue-50 transition">
                  <Plus className="w-4 h-4" /> Add Intermediate Stop
                </button>
              </div>

              {/* Segment price matrix */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Segment Prices</h4>
                <p className="text-xs text-slate-400 mb-3">
                  Set a price for each (from → to) pair. The full-route price is required <span className="text-red-500">*</span>; others let passengers book partial segments.
                </p>
                <div className="space-y-4">
                  {stops.slice(0, -1).map((fromStop, fi) => (
                    <div key={fromStop.key}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-800">
                          From: {fromStop.name || `Stop ${fi + 1}`}
                        </span>
                      </div>
                      <div className="space-y-1.5 ml-4">
                        {stops.slice(fi + 1).map((toStop, rel) => {
                          const ti = fi + 1 + rel;
                          const pk = priceKey(fi, ti);
                          const isFullRoute = fi === 0 && ti === stops.length - 1;
                          return (
                            <div key={toStop.key} className="flex items-center gap-3">
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className={`flex-1 text-sm ${isFullRoute ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                                {toStop.name || `Stop ${ti + 1}`}
                                {isFullRoute && <span className="text-red-500 ml-1">*</span>}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">K</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  className={`w-28 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isFullRoute ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
                                  }`}
                                  placeholder={isFullRoute ? 'Required' : 'Optional'}
                                  value={prices[pk] || ''}
                                  onChange={(e) => setPrices((p) => ({ ...p, [pk]: e.target.value }))}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date + Bus + Seats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Date *</label>
                  <input type="date" required
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={msDate} onChange={(e) => setMsDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Bus</label>
                  <select className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={msBusNumber} onChange={(e) => { setMsBusNumber(e.target.value); const b = buses.find(x => x.busNumber === e.target.value); if (b) setMsSeats(String(b.totalSeats)); }}>
                    <option value="">— Assign later</option>
                    {buses.map((b) => (
                      <option key={b.id} value={b.busNumber}>{b.busNumber} ({b.totalSeats} seats)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Total Seats</label>
                  <input type="number" min="1"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={msSeats} onChange={(e) => setMsSeats(e.target.value)} />
                </div>
              </div>

              <AmenitiesRow selected={msAmenities} toggle={toggleMsAmenity} />

              <RecurringRow
                isRecurring={msRecurring}
                days={msRecurringDays}
                onToggle={setMsRecurring}
                onToggleDay={toggleMsDay}
              />

              {msError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
                  ⚠ {msError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  Create Multi-stop Trip
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Trip list ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
        ) : trips.length === 0 ? (
          <div className="p-12 text-center">
            <Bus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No trips found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {trips.map((t) => {
              const isExpanded = expandedId === t.id;
              const booked = t.totalSeats - t.availableSeats;
              return (
                <div key={t.id} className="p-5 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{t.routeFrom} → {t.routeTo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {t.status}
                        </span>
                        {t.isMultiStop && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Multi-stop</span>}
                        {t.isRecurring && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">Recurring</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(t.departureTime)}</span>
                        <span className="flex items-center gap-1"><Bus className="w-3 h-3" />{t.busNumber || '—'}</span>
                        <span className="font-medium text-slate-700">K{parseFloat(t.price).toFixed(2)}</span>
                        <span><b>{booked}</b>/{t.totalSeats} booked</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.status === 'scheduled' && (
                        <button onClick={() => handleActivate(t)} disabled={setStatus.isPending}
                          className="p-1.5 text-slate-400 hover:text-green-600 transition" title="Activate">
                          {setStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        </button>
                      )}
                      {t.status !== 'cancelled' && t.status !== 'completed' && canCreate && (
                        <button onClick={() => openEdit(t)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {t.status !== 'cancelled' && t.status !== 'completed' && (
                        <button onClick={() => handleCancel(t)} disabled={cancelTrip.isPending}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition" title="Cancel">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : t.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-xs">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><div className="text-slate-400 font-semibold mb-0.5">Arrival</div><div>{fmt(t.arrivalTime)}</div></div>
                        <div><div className="text-slate-400 font-semibold mb-0.5">Available</div><div>{t.availableSeats} seats</div></div>
                        <div><div className="text-slate-400 font-semibold mb-0.5">Company</div><div>{t.company?.name ?? '—'}</div></div>
                        {t.isRecurring && (
                          <div>
                            <div className="text-slate-400 font-semibold mb-0.5">Runs on</div>
                            <div>{(t.recurringDays ?? []).join(', ') || '—'}</div>
                          </div>
                        )}
                      </div>

                      {/* Stops */}
                      {t.stops.length > 0 && (
                        <div>
                          <div className="text-slate-400 font-semibold mb-1">Stops</div>
                          <div className="flex flex-wrap gap-1">
                            {[...t.stops].sort((a, b) => a.order - b.order).map((s, i) => (
                              <span key={s.id} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                                <MapPin className="w-3 h-3" />{s.name}
                                {i < t.stops.length - 1 && <span className="text-blue-300">→</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Segment prices */}
                      {(t.segmentPrices ?? []).length > 0 && (
                        <div>
                          <div className="text-slate-400 font-semibold mb-1">Segment prices</div>
                          <div className="flex flex-wrap gap-1.5">
                            {[...(t.segmentPrices ?? [])]
                              .sort((a, b) => a.fromStop.order - b.fromStop.order || a.toStop.order - b.toStop.order)
                              .map((sp) => (
                                <span key={sp.id} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md">
                                  {sp.fromStop.name} → {sp.toStop.name}: <b>K{parseFloat(sp.price).toFixed(2)}</b>
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Amenities */}
                      {(t.amenities ?? []).length > 0 && (
                        <div>
                          <div className="text-slate-400 font-semibold mb-1">Amenities</div>
                          <div className="flex flex-wrap gap-1">
                            {t.amenities.map((a) => (
                              <span key={a} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Shared sub-components ──────────────────────────────────────────────────────

function AmenitiesRow({ selected, toggle }: { selected: string[]; toggle: (a: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Amenities</label>
      <div className="flex flex-wrap gap-2">
        {AMENITY_OPTS.map((a) => (
          <button key={a} type="button" onClick={() => toggle(a)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
              selected.includes(a) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'
            }`}>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecurringRow({
  isRecurring, days, onToggle, onToggleDay,
}: {
  isRecurring: boolean;
  days: string[];
  onToggle: (v: boolean) => void;
  onToggleDay: (d: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={isRecurring} onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-blue-600" />
        Recurring trip
      </label>
      {isRecurring && (
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Repeat on days</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => (
              <button key={d} type="button" onClick={() => onToggleDay(d)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                  days.includes(d) ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-200 text-slate-600 hover:border-orange-300'
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TripManagement;
