import React, { useMemo } from 'react';
import { TrendingUp, BarChart3, Building2, MapPin } from 'lucide-react';
import { usePlatformAnalytics, fmtK, type RevenueMonth, type GrowthPoint, type TopCompany, type TopRoute } from '@/lib/platformAdminApi';

// ── helpers ───────────────────────────────────────────────────────────────────

function shortMonth(m: string) {
  // m = "2025-01"
  const [, mm] = m.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mm, 10) - 1] ?? m;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

const SkeletonBar: React.FC<{ h?: string }> = ({ h = 'h-48' }) => (
  <div className={`${h} bg-slate-100 rounded-xl animate-pulse`} />
);

const SkeletonList = () => (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
    ))}
  </div>
);

// ── Revenue Bar Chart (SVG) ───────────────────────────────────────────────────

const RevenueChart: React.FC<{ data: RevenueMonth[] }> = ({ data }) => {
  const W = 640, H = 220, PAD = { top: 16, right: 16, bottom: 36, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap(d => [d.subscriptionRevenue, d.bookingRevenue]), 1);
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal / tickCount) * i);

  const groupW = chartW / data.length;
  const barW = Math.max(4, (groupW - 8) / 2);

  const barX = (i: number, j: 0 | 1) => PAD.left + i * groupW + 4 + j * (barW + 2);
  const barH = (v: number) => (v / maxVal) * chartH;
  const barY = (v: number) => PAD.top + chartH - barH(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Monthly revenue chart">
      {/* Y-axis ticks */}
      {ticks.map((t, i) => {
        const y = PAD.top + chartH - (t / maxVal) * chartH;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
              {t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => (
        <g key={d.month}>
          {/* subscription */}
          <rect
            x={barX(i, 0)} y={barY(d.subscriptionRevenue)}
            width={barW} height={Math.max(1, barH(d.subscriptionRevenue))}
            fill="#4f46e5" rx={2}
          />
          {/* booking */}
          <rect
            x={barX(i, 1)} y={barY(d.bookingRevenue)}
            width={barW} height={Math.max(1, barH(d.bookingRevenue))}
            fill="#059669" rx={2}
          />
          {/* x label */}
          <text
            x={PAD.left + i * groupW + groupW / 2} y={H - 8}
            textAnchor="middle" fontSize={9} fill="#64748b"
          >
            {shortMonth(d.month)}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── Growth Line Chart (SVG) ───────────────────────────────────────────────────

const GrowthChart: React.FC<{ data: GrowthPoint[] }> = ({ data }) => {
  const W = 640, H = 160, PAD = { top: 12, right: 16, bottom: 30, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map(d => d.count), 1);

  const px = (i: number) => PAD.left + (i / (data.length - 1 || 1)) * chartW;
  const py = (v: number) => PAD.top + chartH - (v / maxVal) * chartH;

  const points = data.map((d, i) => `${px(i)},${py(d.count)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Company growth chart">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = PAD.top + chartH * (1 - t);
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
              {Math.round(maxVal * t)}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      {data.length > 1 && (
        <polygon
          points={`${px(0)},${PAD.top + chartH} ${points} ${px(data.length - 1)},${PAD.top + chartH}`}
          fill="#f59e0b" fillOpacity={0.12}
        />
      )}

      {/* Line */}
      {data.length > 1 && (
        <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" />
      )}

      {/* Dots */}
      {data.map((d, i) => (
        <circle key={d.month} cx={px(i)} cy={py(d.count)} r={3} fill="#f59e0b" />
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        <text key={d.month} x={px(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#64748b">
          {shortMonth(d.month)}
        </text>
      ))}
    </svg>
  );
};

// ── Top Companies ─────────────────────────────────────────────────────────────

const TopCompaniesTable: React.FC<{ data: TopCompany[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.bookingRevenue), 1);
  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((c, i) => (
        <div key={c.companyId} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-5 text-right shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{c.companyName}</p>
            <div className="mt-0.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${(c.bookingRevenue / max) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-slate-700">{fmtK(c.bookingRevenue)}</p>
            <p className="text-xs text-slate-400">{c.bookingCount} bkgs</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Top Routes ────────────────────────────────────────────────────────────────

const TopRoutesTable: React.FC<{ data: TopRoute[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.bookingRevenue), 1);
  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((r, i) => (
        <div key={`${r.routeFrom}-${r.routeTo}`} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-5 text-right shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {r.routeFrom} <span className="text-slate-400">→</span> {r.routeTo}
            </p>
            <div className="mt-0.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${(r.bookingRevenue / max) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-slate-700">{fmtK(r.bookingRevenue)}</p>
            <p className="text-xs text-slate-400">{r.bookingCount} bkgs</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const AnalyticsDashboard: React.FC = () => {
  const { data, isLoading } = usePlatformAnalytics();

  const totals = useMemo(() => {
    if (!data) return null;
    return {
      subRevenue: data.monthlyRevenue.reduce((s, m) => s + m.subscriptionRevenue, 0),
      bkgRevenue: data.monthlyRevenue.reduce((s, m) => s + m.bookingRevenue, 0),
      totalBookings: data.monthlyRevenue.reduce((s, m) => s + m.bookingCount, 0),
    };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform-wide revenue and growth trends</p>
      </div>

      {/* KPI summary */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : totals ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-100 rounded-xl px-4 py-4">
            <p className="text-xs text-slate-500 font-medium">Subscription Revenue</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{fmtK(totals.subRevenue)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Last 12 months</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl px-4 py-4">
            <p className="text-xs text-slate-500 font-medium">Booking Revenue</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtK(totals.bkgRevenue)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Last 12 months</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl px-4 py-4">
            <p className="text-xs text-slate-500 font-medium">Total Bookings</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{totals.totalBookings.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Last 12 months</p>
          </div>
        </div>
      ) : null}

      {/* Revenue chart */}
      <div className="bg-white border border-slate-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          <h2 className="font-semibold text-slate-800 text-sm">Monthly Revenue</h2>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block" /> Subscription
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> Bookings
            </span>
          </div>
        </div>
        {isLoading ? <SkeletonBar /> : data && <RevenueChart data={data.monthlyRevenue} />}
      </div>

      {/* Growth chart */}
      <div className="bg-white border border-slate-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800 text-sm">Company Growth</h2>
          <span className="ml-1 text-xs text-slate-400">new operators per month</span>
        </div>
        {isLoading ? <SkeletonBar h="h-36" /> : data && <GrowthChart data={data.companyGrowth} />}
      </div>

      {/* Bottom two tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Top Companies by Revenue</h2>
          </div>
          {isLoading ? <SkeletonList /> : data && <TopCompaniesTable data={data.topCompanies} />}
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Top Routes by Revenue</h2>
          </div>
          {isLoading ? <SkeletonList /> : data && <TopRoutesTable data={data.topRoutes} />}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
