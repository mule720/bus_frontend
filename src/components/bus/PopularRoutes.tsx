import React from 'react';
import { ArrowRight, Clock, TrendingUp } from 'lucide-react';
import { POPULAR_ROUTES } from './data';

interface Props {
  onSelectRoute: (from: string, to: string) => void;
}

const PopularRoutes: React.FC<Props> = ({ onSelectRoute }) => {
  return (
    <section className="py-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-orange-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Popular Routes</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Most-Booked Journeys</h2>
            <p className="text-slate-600 mt-2">Best prices on the routes travelers love.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {POPULAR_ROUTES.map((r, i) => (
            <button
              key={i}
              onClick={() => onSelectRoute(r.from, r.to)}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-xl transition-all duration-300 text-left"
            >
              <div className="aspect-[3/2] overflow-hidden">
                <img
                  src={r.image}
                  alt={`${r.from} to ${r.to}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-blue-900">
                  From ${r.price}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <span>{r.from}</span>
                  <ArrowRight className="w-4 h-4 text-orange-400" />
                  <span>{r.to}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="flex items-center gap-1 text-blue-100">
                    <Clock className="w-3 h-3" /> {r.duration}
                  </span>
                  <span className="text-orange-300 font-semibold opacity-0 group-hover:opacity-100 transition">
                    Book now →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PopularRoutes;
