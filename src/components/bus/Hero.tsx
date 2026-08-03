import React, { useState } from 'react';
import { MapPin, Calendar, Users, Search, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HERO_IMAGE } from './data';
import { useRouteOptions } from '@/lib/api';

interface HeroProps {
  onSearch: (params: { from: string; to: string; date: string; passengers: number }) => void;
}

const Hero: React.FC<HeroProps> = ({ onSearch }) => {
  const { data: routeOptions } = useRouteOptions();
  const cities = routeOptions?.origins ?? [];
  const destCities = routeOptions?.destinations ?? [];

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [passengers, setPassengers] = useState(1);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const swap = () => {
    const t = from;
    setFrom(to);
    setTo(t);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to || !date) return;
    onSearch({ from, to, date, passengers });
  };

  const filterCities = (q: string, list = cities) =>
    list.filter((c) => c.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  return (
    <section className="relative min-h-[600px] flex items-center">
      <div className="absolute inset-0">
        <img src={HERO_IMAGE} alt="Bus travel" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-900/70 to-blue-800/50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
        <div className="max-w-2xl text-white mb-8">
          <span className="inline-block px-3 py-1 bg-orange-500/20 border border-orange-400/40 text-orange-200 text-xs font-semibold rounded-full mb-4 uppercase tracking-wider">
            Trusted by 2M+ Travelers
          </span>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
            Book Bus Tickets <span className="text-orange-400">Smarter</span>, Travel Better
          </h1>
          <p className="text-lg text-blue-100/90 mb-2">
            Compare 250+ bus operators, pick your seat, pay securely — all in under 60 seconds.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <div className="relative md:col-span-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">From</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-700" />
              <input
                type="text"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setFromOpen(true); }}
                onFocus={() => setFromOpen(true)}
                onBlur={() => setTimeout(() => setFromOpen(false), 150)}
                className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Departure city"
              />
              {fromOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                  {filterCities(from).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onMouseDown={() => { setFrom(c); setFromOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-slate-700"
                    >
                      <MapPin className="inline w-3 h-3 mr-2 text-slate-400" />{c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-1 flex md:justify-center">
            <button
              type="button"
              onClick={swap}
              className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center mx-auto"
              aria-label="Swap cities"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <div className="relative md:col-span-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">To</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
              <input
                type="text"
                value={to}
                onChange={(e) => { setTo(e.target.value); setToOpen(true); }}
                onFocus={() => setToOpen(true)}
                onBlur={() => setTimeout(() => setToOpen(false), 150)}
                className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Destination city"
              />
              {toOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                  {filterCities(to, destCities.length ? destCities : cities).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onMouseDown={() => { setTo(c); setToOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-slate-700"
                    >
                      <MapPin className="inline w-3 h-3 mr-2 text-slate-400" />{c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-700" />
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-2 py-3 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Pax</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-700" />
              <select
                value={passengers}
                onChange={(e) => setPassengers(Number(e.target.value))}
                className="w-full pl-9 pr-2 py-3 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-6 text-base">
              <Search className="w-4 h-4 mr-2" /> Search
            </Button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-3 text-sm text-blue-100">
          <span className="opacity-80">Trending:</span>
          {['NY → Boston', 'LA → SF', 'Chicago → Detroit', 'Miami → Orlando'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                const [f, tt] = t.split(' → ');
                const map: Record<string,string> = { NY: 'New York', LA: 'Los Angeles', SF: 'San Francisco' };
                onSearch({ from: map[f] ?? f, to: map[tt] ?? tt, date, passengers });
              }}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
