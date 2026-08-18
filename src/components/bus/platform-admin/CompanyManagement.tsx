import React, { useState, useMemo } from 'react';
import {
  Building2, CheckCircle2, Clock, XCircle, Search, Loader2,
  ChevronDown, ChevronUp, MoreHorizontal, Ban, RotateCcw, ThumbsUp,
  Phone, Mail, MapPin, Hash, Calendar,
} from 'lucide-react';
import {
  useAllCompanies, useApproveCompany, useSuspendCompany,
  useReactivateCompany, companyStatus, type Company,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

type Filter = 'all' | 'pending' | 'active' | 'suspended';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    active:    { label: 'Active',    cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700',    icon: <Clock className="w-3 h-3" /> },
    suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-700',        icon: <XCircle className="w-3 h-3" /> },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
};

const CompanyRow: React.FC<{
  company: Company;
  onApprove: (id: number) => void;
  onSuspend: (id: number, comment: string) => void;
  onReactivate: (id: number) => void;
  loading: boolean;
}> = ({ company, onApprove, onSuspend, onReactivate, loading }) => {
  const [expanded, setExpanded] = useState(false);
  const [suspendComment, setSuspendComment] = useState('');
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const status = companyStatus(company);

  const handleSuspend = () => {
    onSuspend(parseInt(company.id), suspendComment);
    setShowSuspendForm(false);
    setSuspendComment('');
  };

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{company.name}</p>
          <p className="text-slate-400 text-xs truncate">{company.email}</p>
        </div>
        <StatusBadge status={status} />
        <span className="text-slate-300 text-xs ml-2 hidden sm:block">
          {new Date(company.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Detail icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={company.phone} />
            <Detail icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={company.email} />
            <Detail icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={company.address} />
            <Detail icon={<Hash className="w-3.5 h-3.5" />} label="Reg. No." value={company.registrationNumber || '—'} />
          </div>
          {company.rejectionComment && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
              <span className="font-semibold">Suspension reason:</span> {company.rejectionComment}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {status === 'pending' && (
              <button
                disabled={loading}
                onClick={() => onApprove(parseInt(company.id))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Approve
              </button>
            )}
            {status === 'active' && (
              <>
                {!showSuspendForm ? (
                  <button
                    disabled={loading}
                    onClick={() => setShowSuspendForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    <Ban className="w-3.5 h-3.5" /> Suspend
                  </button>
                ) : (
                  <div className="flex gap-2 w-full">
                    <input
                      type="text"
                      placeholder="Reason for suspension (optional)"
                      value={suspendComment}
                      onChange={(e) => setSuspendComment(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      disabled={loading}
                      onClick={handleSuspend}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowSuspendForm(false)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
            {status === 'suspended' && (
              <>
                <button
                  disabled={loading}
                  onClick={() => onReactivate(parseInt(company.id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                </button>
                {!showSuspendForm ? (
                  <button
                    disabled={loading}
                    onClick={() => setShowSuspendForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    Update reason
                  </button>
                ) : (
                  <div className="flex gap-2 w-full">
                    <input
                      type="text"
                      placeholder="Update suspension reason"
                      value={suspendComment}
                      onChange={(e) => setSuspendComment(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      disabled={loading}
                      onClick={handleSuspend}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                    >
                      Update
                    </button>
                    <button onClick={() => setShowSuspendForm(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Detail: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-1.5">
    <span className="text-slate-400 mt-0.5">{icon}</span>
    <div>
      <p className="text-slate-400 font-medium">{label}</p>
      <p className="text-slate-700 font-semibold">{value}</p>
    </div>
  </div>
);

const CompanyManagement: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const { data: companies = [], isLoading } = useAllCompanies();
  const { mutate: approve, isPending: approving } = useApproveCompany();
  const { mutate: suspend, isPending: suspending } = useSuspendCompany();
  const { mutate: reactivate, isPending: reactivating } = useReactivateCompany();
  const busy = approving || suspending || reactivating;

  const counts = useMemo(() => ({
    all: companies.length,
    pending: companies.filter((c) => companyStatus(c) === 'pending').length,
    active: companies.filter((c) => companyStatus(c) === 'active').length,
    suspended: companies.filter((c) => companyStatus(c) === 'suspended').length,
  }), [companies]);

  const filtered = useMemo(() =>
    companies.filter((c) => {
      const matchFilter = filter === 'all' || companyStatus(c) === filter;
      const q = search.toLowerCase();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    }),
    [companies, filter, search],
  );

  const tabs: { key: Filter; label: string; color: string }[] = [
    { key: 'all', label: `All (${counts.all})`, color: 'indigo' },
    { key: 'pending', label: `Pending (${counts.pending})`, color: 'amber' },
    { key: 'active', label: `Active (${counts.active})`, color: 'emerald' },
    { key: 'suspended', label: `Suspended (${counts.suspended})`, color: 'red' },
  ];

  const handleApprove = (id: number) => {
    approve(id, {
      onSuccess: () => toast.success('Company approved'),
      onError: (e: any) => toast.error(e.messages?.[0] ?? 'Failed'),
    });
  };

  const handleSuspend = (id: number, comment: string) => {
    suspend({ companyId: id, comment }, {
      onSuccess: () => toast.success('Company suspended'),
      onError: (e: any) => toast.error(e.messages?.[0] ?? 'Failed'),
    });
  };

  const handleReactivate = (id: number) => {
    reactivate(id, {
      onSuccess: () => toast.success('Company reactivated'),
      onError: (e: any) => toast.error(e.messages?.[0] ?? 'Failed'),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company Management</h1>
        <p className="text-slate-500 text-sm mt-0.5">Approve, suspend, and manage all bus operators</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
              filter === t.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No companies match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CompanyRow
              key={c.id}
              company={c}
              loading={busy}
              onApprove={handleApprove}
              onSuspend={handleSuspend}
              onReactivate={handleReactivate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;
