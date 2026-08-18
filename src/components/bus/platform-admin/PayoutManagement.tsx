import React, { useState } from 'react';
import { DollarSign, Plus, X, Loader2, CheckCircle, Clock, XCircle, Banknote } from 'lucide-react';
import {
  usePayouts, useCreatePayout, useMarkPayoutPaid, useAllCompanies,
  type Payout, fmtK,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  paid:      'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock className="w-3 h-3" />,
  paid:      <CheckCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

// ── Mark-Paid dialog ───────────────────────────────────────────────────────────
const MarkPaidDialog: React.FC<{ payout: Payout; onClose: () => void }> = ({ payout, onClose }) => {
  const [ref, setRef] = useState('');
  const { mutate, isPending } = useMarkPayoutPaid();

  const submit = () => {
    mutate({ payoutId: payout.id, reference: ref || undefined }, {
      onSuccess: () => { toast.success('Payout marked as paid'); onClose(); },
      onError: () => toast.error('Failed to update payout'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Mark Payout as Paid</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-1">
          Marking <span className="font-semibold text-slate-700">{payout.company.name}</span> payout of{' '}
          <span className="font-semibold text-slate-700">{fmtK(payout.amount)}</span> as paid.
        </p>
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Reference / Transfer ID (optional)</label>
          <input
            value={ref}
            onChange={e => setRef(e.target.value)}
            placeholder="e.g. MTN-20250601-0034"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={submit}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Confirm Payment
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ── Create-Payout form ─────────────────────────────────────────────────────────
const CreatePayoutForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: companies = [] } = useAllCompanies();
  const { mutate, isPending } = useCreatePayout();
  const [form, setForm] = useState({ companyId: '', amount: '', periodStart: '', periodEnd: '', notes: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyId || !form.amount || !form.periodStart || !form.periodEnd) {
      toast.error('Company, amount, and period are required'); return;
    }
    mutate({
      companyId: Number(form.companyId),
      amount: Number(form.amount),
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      notes: form.notes || undefined,
    }, {
      onSuccess: () => { toast.success('Payout created'); onClose(); },
      onError: () => toast.error('Failed to create payout'),
    });
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-600" /> Create Payout</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Company</label>
            <select
              value={form.companyId}
              onChange={e => set('companyId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Amount (K)</label>
            <input
              type="number" min="0" step="0.01"
              value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="e.g. 12500"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Period Start</label>
            <input
              type="date" value={form.periodStart} onChange={e => set('periodStart', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Period End</label>
            <input
              type="date" value={form.periodEnd} onChange={e => set('periodEnd', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Notes (optional)</label>
          <textarea
            rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Any notes for this payout…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="submit" disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            Create Payout
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      </form>
    </div>
  );
};

// ── Payout card ────────────────────────────────────────────────────────────────
const PayoutCard: React.FC<{ payout: Payout }> = ({ payout }) => {
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const initials = payout.company.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      {showMarkPaid && <MarkPaidDialog payout={payout} onClose={() => setShowMarkPaid(false)} />}
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{payout.company.name}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {fmt(payout.periodStart)} – {fmt(payout.periodEnd)}
          </p>
          {payout.status === 'paid' && (
            <p className="text-slate-400 text-xs mt-0.5">
              Paid {payout.paidAt ? fmt(payout.paidAt) : '—'}
              {payout.reference && <span className="ml-2 text-slate-500 font-mono">{payout.reference}</span>}
            </p>
          )}
          {payout.notes && <p className="text-slate-400 text-xs mt-0.5 truncate">{payout.notes}</p>}
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <p className="text-2xl font-bold text-slate-900">{fmtK(payout.amount)}</p>
          </div>
          <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[payout.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {STATUS_ICON[payout.status]}
            {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
          </span>
          {payout.status === 'pending' && (
            <button
              onClick={() => setShowMarkPaid(true)}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition whitespace-nowrap"
            >
              Mark as Paid
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const PayoutManagement: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const { data: payouts = [], isLoading } = usePayouts();

  const pending = payouts.filter(p => p.status === 'pending');
  const paid    = payouts.filter(p => p.status === 'paid');
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);
  const paidTotal    = paid.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payout Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track and settle operator revenue payouts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" /> Create Payout
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Pending Amount</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{fmtK(pendingTotal)}</p>
          <p className="text-xs text-amber-500 mt-0.5">{pending.length} pending payout{pending.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Total Paid</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{fmtK(paidTotal)}</p>
          <p className="text-xs text-emerald-500 mt-0.5">{paid.length} paid payout{paid.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Records</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">{payouts.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">All payouts</p>
        </div>
      </div>

      {showForm && <CreatePayoutForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No payouts yet. Create your first payout above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map(p => <PayoutCard key={p.id} payout={p} />)}
        </div>
      )}
    </div>
  );
};

export default PayoutManagement;
