import React from 'react';
import {
  Building2, CheckCircle2, Clock, XCircle, Bus, Ticket, DollarSign,
  TrendingUp, Loader2, RefreshCw, Users, Activity,
} from 'lucide-react';
import { usePlatformStats, usePlatformRevenue, useAuditLogs, fmtK } from '@/lib/platformAdminApi';

interface Props {
  onNavigate: (s: string) => void;
}

const Kpi: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; bg: string; onClick?: () => void;
}> = ({ label, value, sub, icon, bg, onClick }) => (
  <button
    onClick={onClick}
    className={`${bg} rounded-xl p-5 text-left w-full transition hover:opacity-90 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">{icon}</div>
    </div>
    <p className="text-white/80 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
    <p className="text-white text-2xl font-bold">{value}</p>
    {sub && <p className="text-white/70 text-xs mt-1">{sub}</p>}
  </button>
);

const PlatformOverview: React.FC<Props> = ({ onNavigate }) => {
  const { data: stats, isLoading: sLoading, refetch: refetchStats } = usePlatformStats();
  const { data: revenue, isLoading: rLoading } = usePlatformRevenue();
  const { data: logs } = useAuditLogs();

  const loading = sLoading || rLoading;
  const recentLogs = (logs ?? []).slice(0, 8);

  const actionLabel: Record<string, string> = {
    company_approved: 'Company approved',
    company_suspended: 'Company suspended',
    company_reactivated: 'Company reactivated',
    staff_created: 'Staff member created',
    staff_updated: 'Staff updated',
    booking_cancelled: 'Booking cancelled',
    plan_fees_updated: 'Subscription plan updated',
  };

  const actionColor: Record<string, string> = {
    company_approved: 'bg-emerald-100 text-emerald-700',
    company_suspended: 'bg-red-100 text-red-700',
    company_reactivated: 'bg-blue-100 text-blue-700',
    staff_created: 'bg-violet-100 text-violet-700',
    plan_fees_updated: 'bg-amber-100 text-amber-700',
    booking_cancelled: 'bg-orange-100 text-orange-700',
    staff_updated: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">Live metrics across all operators on BusGo</p>
        </div>
        <button
          onClick={() => refetchStats()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Company KPIs */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Companies</h2>
        {sLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Total operators" value={stats?.totalCompanies ?? 0}
              icon={<Building2 className="w-5 h-5 text-white" />}
              bg="bg-indigo-600" onClick={() => onNavigate('companies')} />
            <Kpi label="Pending approval" value={stats?.pendingCompanies ?? 0}
              sub="Awaiting review"
              icon={<Clock className="w-5 h-5 text-white" />}
              bg="bg-amber-500" onClick={() => onNavigate('companies')} />
            <Kpi label="Active operators" value={stats?.activeCompanies ?? 0}
              icon={<CheckCircle2 className="w-5 h-5 text-white" />}
              bg="bg-emerald-600" onClick={() => onNavigate('companies')} />
            <Kpi label="Suspended" value={stats?.suspendedCompanies ?? 0}
              icon={<XCircle className="w-5 h-5 text-white" />}
              bg="bg-red-500" onClick={() => onNavigate('companies')} />
          </div>
        )}
      </div>

      {/* Bookings + Trips */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Activity</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Total trips" value={stats?.totalTrips ?? 0}
            icon={<Bus className="w-5 h-5 text-white" />}
            bg="bg-sky-600" />
          <Kpi label="Active trips" value={stats?.activeTrips ?? 0}
            icon={<Activity className="w-5 h-5 text-white" />}
            bg="bg-teal-600" />
          <Kpi label="Total bookings" value={(stats?.totalBookings ?? 0).toLocaleString()}
            icon={<Ticket className="w-5 h-5 text-white" />}
            bg="bg-violet-600" />
          <Kpi label="Confirmed bookings" value={(stats?.confirmedBookings ?? 0).toLocaleString()}
            icon={<CheckCircle2 className="w-5 h-5 text-white" />}
            bg="bg-emerald-500" />
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Platform Revenue</h2>
        {rLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Kpi label="Subscription revenue" value={fmtK(revenue?.totalSubscriptionRevenue ?? 0)}
              icon={<DollarSign className="w-5 h-5 text-white" />}
              bg="bg-indigo-700" onClick={() => onNavigate('finance')} />
            <Kpi label="Commission revenue" value={fmtK(revenue?.totalCommissionRevenue ?? 0)}
              sub={`Online: ${fmtK(revenue?.totalOnlineCommissionRevenue ?? 0)} · Walk-in: ${fmtK(revenue?.totalWalkinCommissionRevenue ?? 0)}`}
              icon={<TrendingUp className="w-5 h-5 text-white" />}
              bg="bg-emerald-700" onClick={() => onNavigate('finance')} />
            <Kpi label="Grand total" value={fmtK(revenue?.grandTotal ?? 0)}
              sub="Subscriptions + Commissions"
              icon={<DollarSign className="w-5 h-5 text-white" />}
              bg="bg-slate-800" onClick={() => onNavigate('finance')} />
          </div>
        )}
      </div>

      {/* Recent audit activity */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            Recent Activity
          </h2>
          <button onClick={() => onNavigate('audit')} className="text-xs text-indigo-600 hover:underline font-medium">
            View all →
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {recentLogs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No activity yet</p>
          ) : recentLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${actionColor[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                {actionLabel[log.action] ?? log.action}
              </span>
              <div className="flex-1 min-w-0">
                {log.details && Object.keys(log.details).length > 0 && (
                  <p className="text-slate-600 text-xs truncate">
                    {Object.entries(log.details).filter(([k]) => !k.includes('_id')).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-400 text-xs">{log.user?.username ?? 'System'}</p>
                <p className="text-slate-300 text-xs">{new Date(log.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformOverview;
