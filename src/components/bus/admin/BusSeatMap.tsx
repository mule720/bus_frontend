/**
 * BusSeatMap — renders a top-down bus layout: 2 seats | aisle | 2 seats per row.
 *
 * Seat numbering:
 *   Row 1:  1A  1B  [aisle]  1C  1D
 *   Row 2:  2A  2B  [aisle]  2C  2D
 *   …
 * Seat number n maps to row = ceil(n/4), col index (n-1)%4.
 * Columns 0,1 are left of the aisle; 2,3 are right.
 */
import React from 'react';

export function seatLabel(n: number): string {
  const row = Math.ceil(n / 4);
  const col = 'ABCD'[(n - 1) % 4];
  return `${row}${col}`;
}

// ── Interactive seat picker (POS) ─────────────────────────────────────────────

interface PickerProps {
  total: number;
  /** seat numbers (1-based) that are still free for this segment */
  freeSeats: number[];
  selected: number[];
  onToggle: (n: number) => void;
}

export function BusSeatPicker({ total, freeSeats, selected, onToggle }: PickerProps) {
  const freeSet = new Set(freeSeats);
  const rows = Math.ceil(total / 4);

  return (
    <div className="overflow-x-auto">
      {/* Bus shell */}
      <div className="inline-block bg-slate-50 rounded-2xl border-2 border-slate-200 p-4 min-w-[220px]">
        {/* Windshield / driver area */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="flex-1 h-3 rounded-full bg-slate-200" />
          <div className="w-7 h-7 rounded-full border-2 border-slate-300 flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="5" />
              <path d="M8 3v5l3 2" />
            </svg>
          </div>
          <div className="flex-1 h-3 rounded-full bg-slate-200" />
        </div>

        {/* Seat rows */}
        <div className="space-y-1.5">
          {Array.from({ length: rows }, (_, ri) => {
            const seatsInRow = [ri * 4 + 1, ri * 4 + 2, ri * 4 + 3, ri * 4 + 4].filter((n) => n <= total);
            const left = seatsInRow.filter((_, ci) => ci < 2);
            const right = seatsInRow.filter((_, ci) => ci >= 2);
            return (
              <div key={ri} className="flex items-center gap-1.5">
                {/* Left pair */}
                <div className="flex gap-1">
                  {left.map((n) => <SeatBtn key={n} n={n} free={freeSet.has(n)} selected={selected.includes(n)} onToggle={onToggle} />)}
                  {left.length < 2 && <div className="w-8 h-8" />}
                </div>
                {/* Aisle */}
                <div className="w-5 text-center text-[9px] text-slate-300 font-semibold select-none">
                  {ri === 0 ? '✕' : '│'}
                </div>
                {/* Right pair */}
                <div className="flex gap-1">
                  {right.map((n) => <SeatBtn key={n} n={n} free={freeSet.has(n)} selected={selected.includes(n)} onToggle={onToggle} />)}
                  {right.length < 2 && <div className="w-8 h-8" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back row label */}
        <div className="mt-3 border-t-2 border-slate-200 pt-2 text-center text-[10px] text-slate-400 font-semibold tracking-wide">
          REAR
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-slate-500">
        <LegendDot color="bg-white border-2 border-slate-300" label="Available" />
        <LegendDot color="bg-blue-600" label="Selected" />
        <LegendDot color="bg-slate-200" label="Taken" />
      </div>
    </div>
  );
}

function SeatBtn({ n, free, selected, onToggle }: {
  n: number; free: boolean; selected: boolean; onToggle: (n: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(n)}
      disabled={!free}
      title={seatLabel(n)}
      className={`w-8 h-8 rounded-md text-[10px] font-bold border-2 transition-all duration-100
        ${selected
          ? 'bg-blue-600 border-blue-700 text-white scale-105 shadow-sm'
          : free
            ? 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-blue-50 active:scale-95'
            : 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed'
        }`}
    >
      {seatLabel(n)}
    </button>
  );
}

// ── Read-only seat map (SeatAvailability) ─────────────────────────────────────

export type SeatStatus = 'available' | 'booked' | 'boarded';

interface MapSeat {
  seatNumber: number;
  status: string;
  passenger: string;
  bookingId: string;
}

interface MapProps {
  total: number;
  seats: MapSeat[];
  onSeatClick?: (seat: MapSeat) => void;
}

export function BusSeatMapReadonly({ total, seats, onSeatClick }: MapProps) {
  const seatByNum = new Map(seats.map((s) => [s.seatNumber, s]));
  const rows = Math.ceil(total / 4);

  const statusMeta = (st: string): { color: string; label: string } => {
    const s = st.toLowerCase();
    if (s === 'boarding' || s === 'boarded')
      return { color: 'bg-blue-600 border-blue-700 text-white', label: 'boarded' };
    if (s === 'available' || s === 'free' || s === '')
      return { color: 'bg-green-50 border-green-300 text-green-700', label: 'available' };
    return { color: 'bg-red-500 border-red-600 text-white', label: 'booked' };
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-block bg-slate-50 rounded-2xl border-2 border-slate-200 p-4 min-w-[220px]">
        {/* Windshield */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="flex-1 h-3 rounded-full bg-slate-200" />
          <div className="w-7 h-7 rounded-full border-2 border-slate-300 flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="5" />
              <path d="M8 3v5l3 2" />
            </svg>
          </div>
          <div className="flex-1 h-3 rounded-full bg-slate-200" />
        </div>

        <div className="space-y-1.5">
          {Array.from({ length: rows }, (_, ri) => {
            const seatsInRow = [ri * 4 + 1, ri * 4 + 2, ri * 4 + 3, ri * 4 + 4].filter((n) => n <= total);
            const left = seatsInRow.filter((_, ci) => ci < 2);
            const right = seatsInRow.filter((_, ci) => ci >= 2);
            return (
              <div key={ri} className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  {left.map((n) => {
                    const seat = seatByNum.get(n);
                    const st = seat?.status ?? 'available';
                    const { color } = statusMeta(st);
                    const syntheticSeat = seat ?? { seatNumber: n, status: 'available', passenger: '', bookingId: '' };
                    return (
                      <button key={n} type="button"
                        onClick={() => onSeatClick && onSeatClick(syntheticSeat)}
                        title={seatLabel(n)}
                        className={`w-8 h-8 rounded-md text-[10px] font-bold border-2 transition ${color} cursor-pointer hover:opacity-80`}>
                        {seatLabel(n)}
                      </button>
                    );
                  })}
                  {left.length < 2 && <div className="w-8 h-8" />}
                </div>
                <div className="w-5 text-center text-[9px] text-slate-300 font-semibold select-none">
                  {ri === 0 ? '✕' : '│'}
                </div>
                <div className="flex gap-1">
                  {right.map((n) => {
                    const seat = seatByNum.get(n);
                    const st = seat?.status ?? 'available';
                    const { color } = statusMeta(st);
                    const syntheticSeat = seat ?? { seatNumber: n, status: 'available', passenger: '', bookingId: '' };
                    return (
                      <button key={n} type="button"
                        onClick={() => onSeatClick && onSeatClick(syntheticSeat)}
                        title={seatLabel(n)}
                        className={`w-8 h-8 rounded-md text-[10px] font-bold border-2 transition ${color} cursor-pointer hover:opacity-80`}>
                        {seatLabel(n)}
                      </button>
                    );
                  })}
                  {right.length < 2 && <div className="w-8 h-8" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t-2 border-slate-200 pt-2 text-center text-[10px] text-slate-400 font-semibold tracking-wide">
          REAR
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-slate-500">
        <LegendDot color="bg-green-50 border-2 border-green-300" label="Available" />
        <LegendDot color="bg-red-500" label="Booked" />
        <LegendDot color="bg-blue-600" label="Boarded" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3.5 h-3.5 rounded ${color}`} />
      <span>{label}</span>
    </div>
  );
}
