import type { BackendTrip } from './api';
import type { Trip } from '@/components/bus/data';
import { BUS_IMAGES } from '@/components/bus/data';

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function duration(dep: string, arr: string) {
  const ms = new Date(arr).getTime() - new Date(dep).getTime();
  if (ms <= 0) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

let imgIdx = 0;

export function adaptTrip(t: BackendTrip): Trip {
  const companyName = t.company?.name ?? 'Unknown';
  const logo = companyName.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const img = BUS_IMAGES[imgIdx++ % BUS_IMAGES.length];

  return {
    id: t.id,
    company: companyName,
    companyLogo: logo,
    rating: 4.5,
    from: t.routeFrom,
    to: t.routeTo,
    departTime: fmt(t.departureTime),
    arriveTime: fmt(t.arrivalTime),
    duration: duration(t.departureTime, t.arrivalTime),
    busType: 'Standard',
    amenities: Array.isArray(t.amenities) ? t.amenities : [],
    seatsAvailable: t.availableSeats,
    totalSeats: t.totalSeats,
    price: parseFloat(t.price),
    stops: (t.stops ?? []).map((s: { name: string }) => s.name),
    image: img,
    // Attach raw backend fields for booking mutation
    _raw: t,
  } as Trip & { _raw: BackendTrip };
}

export function adaptTrips(list: BackendTrip[]): (Trip & { _raw: BackendTrip })[] {
  imgIdx = 0;
  return list.map(adaptTrip);
}

// Seat number (1-based int) ↔ label ("1A", "2C", …)
const COLS = ['A', 'B', 'C', 'D'];

export function seatNumToLabel(n: number): string {
  const row = Math.ceil(n / 4);
  const col = COLS[(n - 1) % 4];
  return `${row}${col}`;
}

export function seatLabelToNum(label: string): number {
  const row = parseInt(label.slice(0, -1), 10);
  const colIdx = COLS.indexOf(label.slice(-1).toUpperCase());
  return (row - 1) * 4 + colIdx + 1;
}
