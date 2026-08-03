import React from 'react';
import {
  DollarSign, Ticket, Bus, Users, TrendingUp, TrendingDown,
  Activity, Loader2, MapPin, Clock, ChevronRight,
  Banknote, Smartphone, CreditCard,
} from 'lucide-react';
import { useCompanyOverview, useCompanySalesReport } from '@/lib/api';

interface Props {
  onNavigate?: (section: string) => void;
}

const StatCard: React.FC<{
  title: string; value: string; sub?: string; icon: React.ReactNode; color: string;
  onClick?: () => void;
}> = ({ title, value, sub, icon, color, onClick }) => (
  <button
    onClick={onClick}
    className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-left w-full transition
      ${onClick ? 'hover:shadow-md hover:border-slate-200 cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      {onClick && <ChevronRight className="w-4 h-4 text-slate-300" />}
    </div>
    <div className="text-2xl font-bold text-slate-900">{value}</div>
    <div className="text-xs text-slate-500 mt-1">{title}</div>
    {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
  </button>
);

function fmt(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function fmtK(v: number) {
  return `K ${v.toLocaleString('en-ZM', { maximumFractionDigits: 0 })}`;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
function firstOfMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
};

const DashboardOverview: React.FC<Props> = ({ onNavigate }) => {
  const { data, isLoading } = useCompanyOverview();
  const today = todayIso();
  const monthStart = firstOfMonthIso();

  const { data: todayReport, isLoading: loadingToday } = useCompanySalesReport(today, today);
  const { data: monthReport, isLoading: loadingMonth } = useCompanySalesReport(monthStart, today);

  const loading = isLoading || loadingToday || loadingMonth;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const trips = data?.myTrips ?? [];
  const employees = data?.myEmployees ?? [];
  const buses = data?.myBuses ?? [];

  const activeEmployees = employees.filter((e) => e.isActive).length;
  const activeBuses = buses.filter((b) => b.isActive).length;
  const totalSeats = trips.reduce((s, t) => s + t.totalSeats, 0);
  const bookedSeats = trips.reduce((s, t) => s + (t.totalSeats - t.availableSeats), 0);
  const availableSeats = trips.reduce((s, t) => s + t.availableSeats, 0);
  const occupancy = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;

  const todayRevenue = todayReport?.totalRevenue ?? 0;
  const todayTickets = todayReport?.totalTickets ?? 0;
  const monthRevenue = monthReport?.totalRevenue ?? 0;
  const monthTickets = monthReport?.totalTickets ?? 0;

  const nav = (section: string) => onNavigate?.(section);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {data?.myCompany?.name ?? 'Company'} — live overview
        </p>
      </div>

      {/* Revenue stats */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Revenue (confirmed bookings)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Today's Revenue" value={fmtK(todayRevenue)}
            sub={`${todayTickets} ticket${todayTickets !== 1 ? 's' : ''} sold`}
            color="bg-green-100 text-green-700" icon={<DollarSign className="w-5 h-5" />}
            onClick={() => nav('reports')} />
          <StatCard title="This Month's Revenue" value={fmtK(monthRevenue)}
            sub={`${monthTickets} ticket${monthTickets !== 1 ? 's' : ''} sold`}
            color="bg-emerald-100 text-emerald-700" icon={<DollarSign className="w-5 h-5" />}
            onClick={() => nav('reports')} />

          {/* Payment breakdown (today) */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 col-span-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Today — payment methods</div>
            {todayRevenue === 0 ? (
              <p className="text-sm text-slate-400">No sales today yet</p>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'Cash',         value: todayReport?.cashTotal ?? 0,   icon: <Banknote className="w-4 h-4 text-green-600" /> },
                  { label: 'Mobile Money', value: todayReport?.mobileTotal ?? 0, icon: <Smartphone className="w-4 h-4 text-violet-600" /> },
                  { label: 'Card',         value: todayReport?.cardTotal ?? 0,   icon: <CreditCard className="w-4 h-4 text-blue-600" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    {icon}
                    <span className="text-slate-600 flex-1">{label}</span>
                    <span className="font-bold text-slate-900">{fmtK(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operations stats */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Operations</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Active trips" value={String(trips.length)}
            color="bg-blue-100 text-blue-700" icon={<Bus className="w-5 h-5" />}
            onClick={() => nav('trips')} />
          <StatCard title="Employees" value={String(activeEmployees)} sub={`${employees.length} total`}
            color="bg-indigo-100 text-indigo-700" icon={<Users className="w-5 h-5" />}
            onClick={() => nav('employees')} />
          <StatCard title="Active buses" value={String(activeBuses)} sub={`${buses.length} registered`}
            color="bg-purple-100 text-purple-700" icon={<Bus className="w-5 h-5" />}
            onClick={() => nav('buses')} />
          <StatCard title="Occupancy rate" value={`${occupancy}%`}
            sub={`${bookedSeats}/${totalSeats} seats booked`}
            color="bg-teal-100 text-teal-700" icon={<Activity className="w-5 h-5" />} />
          <StatCard title="Seats booked" value={String(bookedSeats)}
            color="bg-amber-100 text-amber-700" icon={<TrendingUp className="w-5 h-5" />}
            onClick={() => nav('seat-avail')} />
          <StatCard title="Seats available" value={String(availableSeats)}
            color="bg-pink-100 text-pink-700" icon={<TrendingDown className="w-5 h-5" />}
            onClick={() => nav('seat-avail')} />
          <StatCard title="Tickets sold today" value={String(todayTickets)}
            color="bg-orange-100 text-orange-700" icon={<Ticket className="w-5 h-5" />}
            onClick={() => nav('reports')} />
          <StatCard title="Tickets sold this month" value={String(monthTickets)}
            color="bg-rose-100 text-rose-700" icon={<Ticket className="w-5 h-5" />}
            onClick={() => nav('reports')} />
        </div>
      </div>

      {/* Active trips table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Active Trips</h3>
            <p className="text-xs text-slate-500 mt-0.5">Trips currently on sale</p>
          </div>
          {onNavigate && (
            <button onClick={() => nav('trips')} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {trips.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No active trips found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase border-b border-slate-100">
                  <th className="text-left px-5 py-3">Route</th>
                  <th className="text-left px-5 py-3">Departure</th>
                  <th className="text-left px-5 py-3">Bus</th>
                  <th className="text-left px-5 py-3">Seats</th>
                  <th className="text-left px-5 py-3">Price</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id} onClick={() => nav('trips')}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-600" />{t.routeFrom}
                        <span className="text-slate-400">→</span>
                        <MapPin className="w-3 h-3 text-orange-500" />{t.routeTo}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(t.departureTime)}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{t.busNumber || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="text-slate-900 font-medium">{t.totalSeats - t.availableSeats}/{t.totalSeats}</div>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                        <div
                          className="bg-blue-600 h-1 rounded-full"
                          style={{ width: `${totalSeats > 0 ? Math.round(((t.totalSeats - t.availableSeats) / t.totalSeats) * 100) : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">K{parseFloat(t.price).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
