import React, { useState, useMemo } from 'react';
import {
  DollarSign, Ticket, Bus, Users, Activity, Loader2, MapPin, Clock,
  ChevronRight, Banknote, Smartphone, CreditCard, AlertTriangle, Info,
  TrendingUp, BarChart2, User, Building2, CheckCircle2, XCircle,
  ArrowUpRight, Navigation, RefreshCw,
} from 'lucide-react';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useCompanyDashboard, useCompanySalesReport, useStationDashboard, usePlatformStats, useCompanyOverview } from '@/lib/api';
import { useApp } from '@/contexts/AppContext';

interface Props {
  onNavigate?: (section: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtK(v: number) {
  return `K ${(v ?? 0).toLocaleString('en-ZM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// ── Shared primitives ─────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; onClick?: () => void;
}> = ({ label, value, sub, icon, color, onClick }) => (
  <button
    onClick={onClick}
    className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-left w-full transition
      ${onClick ? 'hover:shadow-md hover:border-slate-200 cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      {onClick && <ChevronRight className="w-4 h-4 text-slate-300" />}
    </div>
    <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    <div className="text-xs text-slate-500 mt-1">{label}</div>
    {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</h2>
    {children}
  </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 ${className}`}>{children}</div>
);

const AlertStrip: React.FC<{ alerts: { severity: string; message: string; }[] }> = ({ alerts }) => {
  if (!alerts.length) return null;
  return (
    <div className="space-y-1.5">
      {alerts.slice(0, 5).map((a, i) => (
        <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium ${
          a.severity === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
          a.severity === 'warning'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {a.severity === 'info' ? <Info className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {a.message}
        </div>
      ))}
    </div>
  );
};

const OccupancyBar: React.FC<{ routeFrom: string; routeTo: string; pct: number; tickets: number }> = ({ routeFrom, routeTo, pct: p, tickets }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-slate-700 truncate">{routeFrom} → {routeTo}</div>
      <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    </div>
    <div className="text-xs tabular-nums text-slate-500 whitespace-nowrap">{tickets} tkts</div>
    <div className="text-xs tabular-nums font-bold text-slate-700 w-10 text-right">{p}%</div>
  </div>
);

const RunStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    not_started: 'bg-slate-100 text-slate-600',
    departed:    'bg-blue-100 text-blue-700',
    completed:   'bg-green-100 text-green-700',
    cancelled:   'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const MiniDonut: React.FC<{ data: { name: string; value: number }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="text-sm text-slate-400 py-4 text-center">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={2} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => fmtK(v)} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── Date filter bar ───────────────────────────────────────────────────────────

const DateFilter: React.FC<{ date: string; onChange: (d: string) => void }> = ({ date, onChange }) => (
  <div className="flex items-center gap-2">
    <label className="text-xs text-slate-500 font-medium">Date:</label>
    <input
      type="date" value={date} onChange={e => onChange(e.target.value)}
      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <button onClick={() => onChange(todayIso())} title="Today"
      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
      <RefreshCw className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ── Company Admin View ────────────────────────────────────────────────────────

const CompanyAdminView: React.FC<{ date: string; onNavigate?: (s: string) => void }> = ({ date, onNavigate }) => {
  const { data, isLoading } = useCompanyDashboard(date);
  const nav = (s: string) => onNavigate?.(s);

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mt-16" />;
  if (!data) return <div className="text-slate-400 text-center mt-16">No data available</div>;

  const paymentData = [
    { name: 'Cash', value: data.cashToday },
    { name: 'Mobile', value: data.mobileToday },
    { name: 'Card', value: data.cardToday },
  ].filter(d => d.value > 0);

  const routeData = data.revenueByRoute.slice(0, 6).map(r => ({
    name: `${r.routeFrom}→${r.routeTo}`,
    revenue: r.revenue,
    tickets: r.ticketCount,
  }));

  const tripStatusData = [
    { name: 'Not Started', value: data.tripsNotStarted },
    { name: 'Departed', value: data.tripsDeparted },
    { name: 'Completed', value: data.tripsCompleted },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <OnboardingChecklist />
      <AlertStrip alerts={data.alerts} />

      <Section title="Revenue">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Revenue" value={fmtK(data.revenueToday)}
            sub={`${data.ticketsToday} tickets`} color="bg-green-100 text-green-700"
            icon={<DollarSign className="w-5 h-5" />} onClick={() => nav('reports')} />
          <StatCard label="Month Revenue" value={fmtK(data.revenueMonth)}
            sub={`${data.ticketsMonth} tickets`} color="bg-emerald-100 text-emerald-700"
            icon={<TrendingUp className="w-5 h-5" />} onClick={() => nav('reports')} />
          <StatCard label="Walk-in Sales" value={String(data.walkinToday)}
            sub={`${data.onlineToday} online`} color="bg-amber-100 text-amber-700"
            icon={<Ticket className="w-5 h-5" />} />
          <StatCard label="Avg Occupancy" value={`${Math.round(data.avgOccupancyPct)}%`}
            color="bg-purple-100 text-purple-700" icon={<Activity className="w-5 h-5" />} />
        </div>
      </Section>

      <Section title="Operations">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Trips Today" value={String(data.tripsToday)}
            color="bg-blue-100 text-blue-700" icon={<Bus className="w-5 h-5" />}
            onClick={() => nav('trips')} />
          <StatCard label="Departed" value={String(data.tripsDeparted)}
            color="bg-indigo-100 text-indigo-700" icon={<Navigation className="w-5 h-5" />} />
          <StatCard label="Active Buses" value={String(data.activeBuses)}
            color="bg-violet-100 text-violet-700" icon={<Bus className="w-5 h-5" />}
            onClick={() => nav('buses')} />
          <StatCard label="Active Staff" value={String(data.activeEmployees)}
            color="bg-pink-100 text-pink-700" icon={<Users className="w-5 h-5" />}
            onClick={() => nav('employees')} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by Route bar chart */}
        <Card className="lg:col-span-2 p-5">
          <div className="font-bold text-slate-800 mb-4 text-sm">Revenue by Route</div>
          {routeData.length === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">No sales data for this date</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={routeData} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `K${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtK(v)} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Payment methods donut */}
        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-1 text-sm">Payment Methods</div>
          <div className="text-xs text-slate-400 mb-3">Today's sales breakdown</div>
          <MiniDonut data={paymentData} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trip status donut */}
        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-1 text-sm">Trip Status</div>
          <div className="text-xs text-slate-400 mb-3">Today's run status</div>
          <MiniDonut data={tripStatusData} />
        </Card>

        {/* Top sellers */}
        <Card className="lg:col-span-2 p-5">
          <div className="font-bold text-slate-800 mb-4 text-sm">Top Sellers Today</div>
          {data.topSellers.length === 0 ? (
            <div className="text-sm text-slate-400 py-6 text-center">No walk-in sales today</div>
          ) : (
            <div className="space-y-2">
              {data.topSellers.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <span className="flex-1 text-sm text-slate-700 font-medium">{s.employeeName}</span>
                  <span className="text-xs text-slate-500">{s.ticketsSold} tkts</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtK(s.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Trips table */}
      <Card>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900 text-sm">Today's Trips</div>
            <div className="text-xs text-slate-400 mt-0.5">Live trip runs for {date}</div>
          </div>
          {onNavigate && (
            <button onClick={() => nav('trips')} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {data.trips.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No trips scheduled for this date</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                  <th className="text-left px-5 py-3">Route</th>
                  <th className="text-left px-5 py-3">Departs</th>
                  <th className="text-left px-5 py-3">Occupancy</th>
                  <th className="text-left px-5 py-3">Staff</th>
                  <th className="text-left px-5 py-3">Run</th>
                </tr>
              </thead>
              <tbody>
                {data.trips.map(t => {
                  const booked = t.totalSeats - t.availableSeats;
                  const o = pct(booked, t.totalSeats);
                  return (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 font-medium text-slate-900">
                          <MapPin className="w-3 h-3 text-blue-500" />{t.routeFrom}
                          <span className="text-slate-300 mx-0.5">→</span>
                          <MapPin className="w-3 h-3 text-orange-400" />{t.routeTo}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(t.departureTime)}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-slate-700 text-xs mb-1">{booked}/{t.totalSeats} ({o}%)</div>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${o >= 80 ? 'bg-green-500' : o >= 50 ? 'bg-amber-400' : 'bg-blue-400'}`}
                            style={{ width: `${o}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          {t.hasDriver ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                          Driver
                          {t.hasConductor ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-1" /> : <XCircle className="w-3.5 h-3.5 text-red-400 ml-1" />}
                          Cond.
                        </div>
                      </td>
                      <td className="px-5 py-3"><RunStatusBadge status={t.runStatus} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

// ── Finance View ──────────────────────────────────────────────────────────────

const FinanceView: React.FC<{ date: string; onNavigate?: (s: string) => void }> = ({ date, onNavigate }) => {
  const dateFrom = useMemo(() => {
    const d = new Date(date);
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  }, [date]);

  const { data, isLoading } = useCompanyDashboard(date);
  const { data: report, isLoading: reportLoading } = useCompanySalesReport(dateFrom, date);

  if (isLoading || reportLoading) return <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mt-16" />;

  const rev30  = report?.totalRevenue  ?? 0;
  const tix30  = report?.totalTickets  ?? 0;
  const cash30 = report?.cashTotal     ?? 0;
  const mob30  = report?.mobileTotal   ?? 0;
  const card30 = report?.cardTotal     ?? 0;
  const online30 = rev30 - cash30 - mob30 - card30;

  const payBreakdown = [
    { label: 'Cash',         value: cash30, icon: <Banknote    className="w-4 h-4 text-green-600"  /> },
    { label: 'Mobile Money', value: mob30,  icon: <Smartphone  className="w-4 h-4 text-violet-600" /> },
    { label: 'Card',         value: card30, icon: <CreditCard  className="w-4 h-4 text-blue-600"   /> },
  ];

  const routeRevSorted = data ? [...data.revenueByRoute].sort((a, b) => b.revenue - a.revenue) : [];
  const totalRouteRev  = routeRevSorted.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500 -mb-2">
        <Info className="w-3.5 h-3.5" />
        Revenue figures cover the 30 days ending {date}. Route / station breakdown shows the selected date only.
      </div>

      <Section title="Revenue Summary (Last 30 Days)">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={fmtK(rev30)} sub={`${tix30} tickets`}
            color="bg-green-100 text-green-700" icon={<DollarSign className="w-5 h-5" />}
            onClick={() => onNavigate?.('reports')} />
          <StatCard label="Walk-in Revenue" value={fmtK(cash30 + mob30 + card30)}
            sub="cash · mobile · card" color="bg-amber-100 text-amber-700" icon={<Ticket className="w-5 h-5" />} />
          <StatCard label="Online Revenue" value={fmtK(Math.max(online30, 0))}
            sub="booked online" color="bg-blue-100 text-blue-700" icon={<ArrowUpRight className="w-5 h-5" />} />
          <StatCard label="Avg / Day" value={fmtK(rev30 / 30)}
            sub="last 30 days" color="bg-emerald-100 text-emerald-700" icon={<TrendingUp className="w-5 h-5" />}
            onClick={() => onNavigate?.('reports')} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-4 text-sm">Payment Method Breakdown (30 Days)</div>
          {rev30 === 0 ? (
            <div className="text-sm text-slate-400 py-6 text-center">No booking revenue in this period</div>
          ) : (
            <div className="space-y-3">
              {payBreakdown.map(p => (
                <div key={p.label} className="flex items-center gap-3">
                  {p.icon}
                  <span className="flex-1 text-sm text-slate-600">{p.label}</span>
                  <div className="w-32 bg-slate-100 rounded-full h-1.5 mr-3">
                    <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pct(p.value, rev30)}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums w-24 text-right">{fmtK(p.value)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-4 text-sm">Revenue by Route ({date})</div>
          {routeRevSorted.length === 0 ? (
            <div className="text-sm text-slate-400 py-6 text-center">No route data for this date</div>
          ) : (
            <div className="space-y-2.5">
              {routeRevSorted.slice(0, 6).map(r => (
                <OccupancyBar key={`${r.routeFrom}-${r.routeTo}`}
                  routeFrom={r.routeFrom} routeTo={r.routeTo}
                  pct={pct(r.revenue, totalRouteRev)} tickets={r.ticketCount} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="font-bold text-slate-800 mb-4 text-sm">Revenue by Station – Walk-in ({date})</div>
        {!data || data.revenueByStation.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">No station data for this date</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.revenueByStation.slice(0, 8)} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="stationName" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `K${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtK(v)} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};

// ── Ops Manager View ──────────────────────────────────────────────────────────

const OpsManagerView: React.FC<{ date: string; onNavigate?: (s: string) => void }> = ({ date, onNavigate }) => {
  const { data, isLoading } = useCompanyDashboard(date);
  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mt-16" />;
  if (!data) return null;

  const staffedTrips = data.trips.filter(t => t.hasDriver && t.hasConductor).length;
  const unassignedTrips = data.trips.filter(t => !t.hasBus || !t.hasDriver || !t.hasConductor).length;

  return (
    <div className="space-y-6">
      <AlertStrip alerts={data.alerts} />

      <Section title="Fleet & Staffing">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Trips Today" value={String(data.tripsToday)}
            color="bg-blue-100 text-blue-700" icon={<Bus className="w-5 h-5" />} />
          <StatCard label="Fully Staffed" value={String(staffedTrips)}
            sub={`${unassignedTrips} incomplete`} color="bg-green-100 text-green-700"
            icon={<CheckCircle2 className="w-5 h-5" />} />
          <StatCard label="Avg Occupancy" value={`${Math.round(data.avgOccupancyPct)}%`}
            color="bg-amber-100 text-amber-700" icon={<Activity className="w-5 h-5" />} />
          <StatCard label="Departed" value={String(data.tripsDeparted)}
            color="bg-violet-100 text-violet-700" icon={<Navigation className="w-5 h-5" />} />
        </div>
      </Section>

      <Card>
        <div className="p-5 border-b border-slate-100">
          <div className="font-bold text-slate-900 text-sm">Trip Operations Status</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                <th className="text-left px-5 py-3">Route</th>
                <th className="text-left px-5 py-3">Departs</th>
                <th className="text-left px-5 py-3">Fill</th>
                <th className="text-left px-5 py-3">Bus</th>
                <th className="text-left px-5 py-3">Driver</th>
                <th className="text-left px-5 py-3">Conductor</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.trips.map(t => {
                const booked = t.totalSeats - t.availableSeats;
                const o = pct(booked, t.totalSeats);
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{t.routeFrom} → {t.routeTo}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{fmtTime(t.departureTime)}</td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-slate-500">{o}%</div>
                      <div className="w-16 bg-slate-100 rounded-full h-1 mt-0.5">
                        <div className={`h-1 rounded-full ${o >= 80 ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${o}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {t.hasBus ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    </td>
                    <td className="px-5 py-3">
                      {t.hasDriver ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    </td>
                    <td className="px-5 py-3">
                      {t.hasConductor ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    </td>
                    <td className="px-5 py-3"><RunStatusBadge status={t.runStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ── Station Supervisor View ───────────────────────────────────────────────────

const StationSupervisorView: React.FC<{ date: string; onNavigate?: (s: string) => void }> = ({ date }) => {
  const { data, isLoading } = useStationDashboard(date);
  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mt-16" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-blue-600" />
        <h2 className="font-bold text-slate-800">{data.stationName}</h2>
        <span className="text-xs text-slate-400">— today's station overview</span>
      </div>

      <Section title="Station Revenue">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Revenue Today" value={fmtK(data.revenueToday)} sub={`${data.ticketsToday} tickets`}
            color="bg-green-100 text-green-700" icon={<DollarSign className="w-5 h-5" />} />
          <StatCard label="Walk-in Sales" value={String(data.walkinToday)}
            color="bg-amber-100 text-amber-700" icon={<Ticket className="w-5 h-5" />} />
          <StatCard label="Cash" value={fmtK(data.cashToday)}
            color="bg-blue-100 text-blue-700" icon={<Banknote className="w-5 h-5" />} />
          <StatCard label="Mobile Money" value={fmtK(data.mobileToday)}
            color="bg-violet-100 text-violet-700" icon={<Smartphone className="w-5 h-5" />} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-4 text-sm">Trips at This Station</div>
          <div className="space-y-2">
            {data.trips.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">No trips today</div>
            ) : data.trips.map(t => (
              <div key={t.tripId} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{t.routeFrom} → {t.routeTo}</div>
                  <div className="text-xs text-slate-400">{fmtTime(t.departureTime)}</div>
                </div>
                <div className="text-xs text-slate-500">{t.ticketsSold} tkts</div>
                <div className="text-xs font-bold text-slate-700 tabular-nums">{fmtK(t.revenue)}</div>
                {t.isClosed && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Closed</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-4 text-sm">Seller Leaderboard</div>
          {data.topSellers.length === 0 ? (
            <div className="text-sm text-slate-400 py-4 text-center">No sales yet</div>
          ) : data.topSellers.map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </div>
              <span className="flex-1 text-sm text-slate-700">{s.employeeName}</span>
              <span className="text-xs text-slate-400">{s.ticketsSold} tkts</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtK(s.revenue)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ── Ticket Seller View ────────────────────────────────────────────────────────

const TicketSellerView: React.FC<{ date: string; onNavigate?: (s: string) => void }> = ({ date, onNavigate }) => {
  const { data, isLoading } = useStationDashboard(date);
  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mt-16" />;

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <Ticket className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <div className="font-bold text-blue-800">Ready to Sell Tickets</div>
          <div className="text-sm text-blue-600 mt-1">Your shift stats will appear here once you process sales</div>
          <button onClick={() => onNavigate?.('pos')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            Open POS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-blue-600" />
        <span className="font-medium text-slate-700">{data.stationName}</span>
      </div>

      <Section title="My Shift Today">
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Tickets Sold" value={String(data.ticketsToday)}
            color="bg-blue-100 text-blue-700" icon={<Ticket className="w-5 h-5" />}
            onClick={() => onNavigate?.('pos')} />
          <StatCard label="Revenue Collected" value={fmtK(data.revenueToday)}
            color="bg-green-100 text-green-700" icon={<DollarSign className="w-5 h-5" />} />
          <StatCard label="Cash" value={fmtK(data.cashToday)}
            color="bg-amber-100 text-amber-700" icon={<Banknote className="w-5 h-5" />} />
          <StatCard label="Mobile Money" value={fmtK(data.mobileToday)}
            color="bg-violet-100 text-violet-700" icon={<Smartphone className="w-5 h-5" />} />
        </div>
      </Section>

      <Card className="p-5">
        <div className="font-bold text-slate-800 mb-4 text-sm">Available Trips Today</div>
        <div className="space-y-2">
          {data.trips.filter(t => !t.isClosed).slice(0, 6).map(t => (
            <div key={t.tripId} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{t.routeFrom} → {t.routeTo}</div>
                <div className="text-xs text-slate-400">{fmtTime(t.departureTime)}</div>
              </div>
              <button onClick={() => onNavigate?.('pos')}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
                Sell
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ── Platform Admin View ───────────────────────────────────────────────────────

const PlatformAdminView: React.FC<{ onNavigate?: (s: string) => void }> = ({ onNavigate }) => {
  const { data, isLoading } = usePlatformStats();
  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mt-16" />;
  if (!data) return null;

  const companyStatusData = [
    { name: 'Active', value: data.activeCompanies },
    { name: 'Pending', value: data.pendingCompanies },
    { name: 'Suspended', value: data.suspendedCompanies },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <Section title="Platform Overview">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Companies" value={String(data.totalCompanies)}
            sub={`${data.activeCompanies} active`} color="bg-blue-100 text-blue-700"
            icon={<Building2 className="w-5 h-5" />} onClick={() => onNavigate?.('companies')} />
          <StatCard label="Pending Approval" value={String(data.pendingCompanies)}
            color="bg-amber-100 text-amber-700" icon={<AlertTriangle className="w-5 h-5" />}
            onClick={() => onNavigate?.('companies')} />
          <StatCard label="Total Bookings" value={data.totalBookings.toLocaleString()}
            sub={`${data.confirmedBookings} confirmed`} color="bg-green-100 text-green-700"
            icon={<Ticket className="w-5 h-5" />} />
          <StatCard label="Platform Revenue" value={fmtK(data.revenueTotal)}
            color="bg-emerald-100 text-emerald-700" icon={<DollarSign className="w-5 h-5" />} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-1 text-sm">Company Status</div>
          <div className="text-xs text-slate-400 mb-3">Breakdown by approval state</div>
          <MiniDonut data={companyStatusData} />
        </Card>
        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-4 text-sm">Quick Actions</div>
          <div className="space-y-2">
            {[
              { label: 'Review Pending Companies', sub: `${data.pendingCompanies} awaiting`, action: 'companies', urgent: data.pendingCompanies > 0 },
              { label: 'Subscription Plans', sub: 'Manage pricing tiers', action: 'plans' },
              { label: 'All Trips', sub: `${data.activeTrips} active`, action: 'trips' },
            ].map((item) => (
              <button key={item.action} onClick={() => onNavigate?.(item.action)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition
                  ${item.urgent ? 'border-amber-200 bg-amber-50 hover:bg-amber-100' : 'border-slate-100 hover:bg-slate-50'}`}>
                <div>
                  <div className={`text-sm font-medium ${item.urgent ? 'text-amber-800' : 'text-slate-700'}`}>{item.label}</div>
                  <div className="text-xs text-slate-400">{item.sub}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ── Default employee view ─────────────────────────────────────────────────────

const DefaultEmployeeView: React.FC<{ onNavigate?: (s: string) => void }> = ({ onNavigate }) => {
  const { data, isLoading } = useCompanyOverview();
  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mt-16" />;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <User className="w-12 h-12 text-blue-400 mx-auto mb-3" />
        <div className="font-bold text-blue-800">{data?.myCompany?.name ?? 'Welcome'}</div>
        <div className="text-sm text-blue-600 mt-1">Use the sidebar to navigate to your assigned tasks</div>
      </div>
      {data?.myTrips && data.myTrips.length > 0 && (
        <Card className="p-5">
          <div className="font-bold text-slate-800 mb-3 text-sm">Active Trips</div>
          <div className="space-y-2">
            {data.myTrips.slice(0, 4).map(t => (
              <div key={t.id} className="flex items-center gap-3 py-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm text-slate-700">{t.routeFrom} → {t.routeTo}</span>
                <Clock className="w-3.5 h-3.5 text-slate-400 ml-auto" />
                <span className="text-xs text-slate-500">{fmtTime(t.departureTime)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ── View detection ────────────────────────────────────────────────────────────

type ViewType = 'platform_admin' | 'company_admin' | 'finance' | 'ops_manager' |
  'station_supervisor' | 'ticket_seller' | 'default';

function detectView(role: string, perms: string[]): ViewType {
  const r = role.toLowerCase();
  const has = (p: string) => perms.includes(p);
  if (r === 'platform_admin') return 'platform_admin';
  if (r === 'company_admin') return 'company_admin';
  if (has('view_reports') && (has('manage_employees') || has('manage_trip_staff') || has('create_trips'))) return 'ops_manager';
  if (has('manage_stations') && !has('sell_tickets')) return 'station_supervisor';
  if (has('sell_tickets') || has('walk_in_sales') || has('scan_tickets')) return 'ticket_seller';
  if (has('view_reports')) return 'finance';
  return 'default';
}

// ── Root component ────────────────────────────────────────────────────────────

const DashboardOverview: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useApp();
  const [date, setDate] = useState(todayIso());

  const role = user?.role ?? 'employee';
  const perms: string[] = user?.permissions ?? [];
  const view = detectView(role, perms);

  const viewLabels: Record<ViewType, string> = {
    platform_admin:     'Platform Admin Dashboard',
    company_admin:      'Company Dashboard',
    finance:            'Finance Dashboard',
    ops_manager:        'Operations Dashboard',
    station_supervisor: 'Station Dashboard',
    ticket_seller:      'My Shift',
    default:            'Dashboard',
  };

  const needsDateFilter: ViewType[] = ['company_admin', 'finance', 'ops_manager', 'station_supervisor', 'ticket_seller'];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{viewLabels[view]}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {user?.firstName ? `${user.firstName} · ` : ''}{view.replace('_', ' ')}
          </p>
        </div>
        {needsDateFilter.includes(view) && (
          <DateFilter date={date} onChange={setDate} />
        )}
      </div>

      {view === 'platform_admin'     && <PlatformAdminView onNavigate={onNavigate} />}
      {view === 'company_admin'      && <CompanyAdminView date={date} onNavigate={onNavigate} />}
      {view === 'finance'            && <FinanceView date={date} onNavigate={onNavigate} />}
      {view === 'ops_manager'        && <OpsManagerView date={date} onNavigate={onNavigate} />}
      {view === 'station_supervisor' && <StationSupervisorView date={date} onNavigate={onNavigate} />}
      {view === 'ticket_seller'      && <TicketSellerView date={date} onNavigate={onNavigate} />}
      {view === 'default'            && <DefaultEmployeeView onNavigate={onNavigate} />}
    </div>
  );
};

export default DashboardOverview;
