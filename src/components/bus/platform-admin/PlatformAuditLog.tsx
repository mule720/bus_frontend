import React, { useState, useMemo } from 'react';
import { Activity, Search, Loader2, User, Clock } from 'lucide-react';
import { useAuditLogs, type AuditLog } from '@/lib/platformAdminApi';

const ACTION_META: Record<string, { label: string; cls: string }> = {
  company_approved:    { label: 'Company Approved',    cls: 'bg-emerald-100 text-emerald-700' },
  company_suspended:   { label: 'Company Suspended',   cls: 'bg-red-100 text-red-700' },
  company_reactivated: { label: 'Company Reactivated', cls: 'bg-blue-100 text-blue-700' },
  staff_created:       { label: 'Staff Created',       cls: 'bg-violet-100 text-violet-700' },
  staff_updated:       { label: 'Staff Updated',       cls: 'bg-slate-100 text-slate-600' },
  booking_cancelled:   { label: 'Booking Cancelled',   cls: 'bg-orange-100 text-orange-700' },
  plan_fees_updated:   { label: 'Plan Updated',        cls: 'bg-amber-100 text-amber-700' },
};

const ALL_ACTIONS = Object.keys(ACTION_META);

const PlatformAuditLog: React.FC = () => {
  const { data: logs = [], isLoading } = useAuditLogs();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchAction = actionFilter === 'all' || log.action === actionFilter;
      const q = search.toLowerCase();
      const detailStr = JSON.stringify(log.details ?? {}).toLowerCase();
      const matchSearch = !q
        || (log.user?.username ?? '').toLowerCase().includes(q)
        || log.action.includes(q)
        || detailStr.includes(q);
      return matchAction && matchSearch;
    });
  }, [logs, search, actionFilter]);

  const formatDetails = (details: Record<string, unknown>) => {
    return Object.entries(details)
      .filter(([k]) => !k.endsWith('_id'))
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join(' · ');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">Complete history of all platform admin actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user, action, or details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="all">All actions</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_META[a].label}</option>
          ))}
        </select>
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-xs text-slate-400">
          Showing {filtered.length} of {logs.length} log entries (last 200)
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No audit logs match your filters</p>
        </div>
      ) : (
        <div className="space-y-0 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {filtered.map((log, i) => {
            const meta = ACTION_META[log.action] ?? { label: log.action, cls: 'bg-slate-100 text-slate-600' };
            return (
              <div
                key={log.id}
                className={`flex items-start gap-4 px-5 py-4 ${i !== filtered.length - 1 ? 'border-b border-slate-50' : ''} hover:bg-slate-50 transition`}
              >
                {/* Icon */}
                <div className="mt-0.5 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                    {log.user && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3" /> {log.user.username}
                      </span>
                    )}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-slate-500 text-xs truncate">{formatDetails(log.details)}</p>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-right shrink-0">
                  <p className="text-slate-400 text-xs flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {new Date(log.createdAt).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {log.ipAddress && (
                    <p className="text-slate-300 text-xs mt-0.5">{log.ipAddress}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlatformAuditLog;
