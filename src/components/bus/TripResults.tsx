import React, { useMemo, useState } from 'react';
import { Wifi, Snowflake, Usb, Utensils, Star, Clock, MapPin, Filter, X, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Trip } from './data';
import { useSearchTrips } from '@/lib/api';
import { adaptTrips } from '@/lib/tripAdapter';

interface Props {
  search: { from: string; to: string; date: string; passengers: number };
  onSelect: (trip: Trip) => void;
  onClose: () => void;
}

const amenityIcon = (a: string) => {
  const map: Record<string, React.ReactNode> = {
    WiFi: <Wifi className="w-3.5 h-3.5" />,
    AC: <Snowflake className="w-3.5 h-3.5" />,
    USB: <Usb className="w-3.5 h-3.5" />,
    Meals: <Utensils className="w-3.5 h-3.5" />,
  };
  return map[a] ?? null;
};

const TripResults: React.FC<Props> = ({ search, onSelect, onClose }) => {
  const [sort, setSort] = useState<'price' | 'depart' | 'duration' | 'rating'>('depart');
  const [maxPrice, setMaxPrice] = useState<number>(500);
  const [wifiOnly, setWifiOnly] = useState(false);

  const { data: raw = [], isLoading, isError, refetch } = useSearchTrips({
    routeFrom: search.from,
    routeTo: search.to,
    date: search.date,
    passengers: search.passengers,
  });

  const trips = useMemo(() => {
    let list = adaptTrips(raw);
    if (wifiOnly) list = list.filter((t) => t.amenities.includes('WiFi'));
    list = list.filter((t) => t.price <= maxPrice);
    list.sort((a, b) => {
      if (sort === 'price') return a.price - b.price;
      if (sort === 'duration') return a.duration.localeCompare(b.duration);
      if (sort === 'rating') return b.rating - a.rating;
      return a.departTime.localeCompare(b.departTime);
    });
    return list;
  }, [raw, sort, maxPrice, wifiOnly]);

  const currency = raw[0] ? 'K' : '$';
  const priceMax = raw.length ? Math.max(500, ...raw.map((t) => parseFloat(t.price))) : 500;

  return (
    <section id="results" className="py-10 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6 bg-white rounded-xl p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
              <MapPin className="w-4 h-4 text-blue-700" /> {search.from}
              <span className="text-slate-400">→</span>
              <MapPin className="w-4 h-4 text-orange-500" /> {search.to}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {new Date(search.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {' '}• {search.passengers} passenger{search.passengers > 1 ? 's' : ''}
              {!isLoading && ` • ${trips.length} bus${trips.length !== 1 ? 'es' : ''} found`}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-900" aria-label="Close results">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters */}
          <aside className="lg:col-span-1 bg-white rounded-xl p-5 shadow-sm h-fit sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-blue-700" />
              <h3 className="font-bold text-slate-900">Filters</h3>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-500 uppercase">Sort by</label>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="depart">Departure time</option>
                <option value="price">Price (low to high)</option>
                <option value="duration">Duration</option>
                <option value="rating">Rating</option>
              </select>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Max Price: {currency}{maxPrice}
              </label>
              <input type="range" min={0} max={priceMax} value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full mt-2 accent-orange-500" />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={wifiOnly} onChange={(e) => setWifiOnly(e.target.checked)}
                className="w-4 h-4 accent-blue-700" />
              WiFi required
            </label>
          </aside>

          {/* Results */}
          <div className="lg:col-span-3 space-y-4">
            {isLoading && (
              <div className="bg-white rounded-xl p-16 text-center shadow-sm">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-slate-500">Searching for trips…</p>
              </div>
            )}

            {isError && (
              <div className="bg-white rounded-xl p-10 text-center shadow-sm">
                <p className="text-red-500 font-semibold mb-3">Failed to load trips</p>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Retry
                </Button>
              </div>
            )}

            {!isLoading && !isError && trips.length === 0 && (
              <div className="bg-white rounded-xl p-10 text-center shadow-sm">
                <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <MapPin className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-1">No buses found</h3>
                <p className="text-slate-500 text-sm">Try a different date or adjust filters.</p>
              </div>
            )}

            {trips.map((trip) => (
              <div key={trip.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition border border-transparent hover:border-blue-200 overflow-hidden">
                <div className="grid md:grid-cols-4 gap-4 p-5">
                  <div className="md:col-span-1 flex md:flex-col items-center md:items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-700 to-blue-900 text-white font-bold flex items-center justify-center text-lg shrink-0">
                      {trip.companyLogo}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{trip.company}</div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {trip.rating} • {trip.busType}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900">{trip.departTime}</div>
                        <div className="text-xs text-slate-500">{trip.from}</div>
                      </div>
                      <div className="flex-1 relative">
                        <div className="h-0.5 bg-slate-200 relative">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-700" />
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-500" />
                        </div>
                        <div className="text-center text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" /> {trip.duration}
                          {trip.stops.length > 0 && <span>• {trip.stops.length} stop{trip.stops.length > 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900">{trip.arriveTime}</div>
                        <div className="text-xs text-slate-500">{trip.to}</div>
                      </div>
                    </div>
                    {trip.amenities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {trip.amenities.map((a) => (
                          <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">
                            {amenityIcon(a)} {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-1 flex md:flex-col items-center md:items-end justify-between gap-2">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">{currency}{trip.price}</div>
                      <div className={`text-xs font-medium ${trip.seatsAvailable <= 8 ? 'text-orange-600' : 'text-green-600'}`}>
                        {trip.seatsAvailable} seat{trip.seatsAvailable !== 1 ? 's' : ''} left
                      </div>
                    </div>
                    <Button
                      onClick={() => onSelect(trip)}
                      disabled={trip.seatsAvailable === 0}
                      className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                    >
                      {trip.seatsAvailable === 0 ? 'Sold Out' : 'Select Seats'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TripResults;
