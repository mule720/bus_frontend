import React, { useState } from 'react';
import { LifeBuoy, Plus, ChevronDown, ChevronUp, X, Loader2, Save } from 'lucide-react';
import {
  useSupportTickets, useCreateTicket, useUpdateTicket, useAllCompanies,
  type SupportTicket,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

const STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const STATUS_LABEL: Record<string, string> = {
  all: 'All', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
};
const STATUS_BADGE: Record<string, string> = {
  open:        'bg-sky-100 text-sky-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  resolved:    'bg-emerald-100 text-emerald-700',
  closed:      'bg-slate-100 text-slate-500',
};
const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-slate-100 text-slate-500',
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Ticket card ────────────────────────────────────────────────────────────────
const TicketCard: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => {
  const [expanded, setExpanded] = useState(false);
  const [edit, setEdit] = useState({ status: ticket.status, resolution: ticket.resolution ?? '' });
  const { mutate, isPending } = useUpdateTicket();

  const save = () => {
    mutate({ ticketId: ticket.id, status: edit.status, resolution: edit.resolution }, {
      onSuccess: () => toast.success('Ticket updated'),
      onError: () => toast.error('Failed to update ticket'),
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[ticket.priority] ?? 'bg-slate-100 text-slate-500'}`}>
                {ticket.priority?.toUpperCase()}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[ticket.status] ?? 'bg-slate-100 text-slate-500'}`}>
                {STATUS_LABEL[ticket.status] ?? ticket.status}
              </span>
              {ticket.company && (
                <span className="text-xs text-slate-400">{ticket.company.name}</span>
              )}
            </div>
            <p className="font-semibold text-slate-800 text-sm">{ticket.subject}</p>
            <p className={`text-slate-500 text-sm mt-1 ${expanded ? '' : 'line-clamp-2'}`}>{ticket.description}</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          <span>#{ticket.id}</span>
          <span>·</span>
          <span>{fmt(ticket.createdAt)}</span>
          {ticket.assignedTo && <><span>·</span><span>@{ticket.assignedTo.username}</span></>}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Full Description</label>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{ticket.description}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
              <select
                value={edit.status}
                onChange={e => setEdit(s => ({ ...s, status: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {STATUSES.filter(s => s !== 'all').map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Resolution</label>
              <textarea
                rows={2}
                value={edit.resolution}
                onChange={e => setEdit(s => ({ ...s, resolution: e.target.value }))}
                placeholder="Describe how this was resolved…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
              />
            </div>
          </div>
          <button
            onClick={save} disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

// ── Create ticket modal ────────────────────────────────────────────────────────
const CreateTicketModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: companies = [] } = useAllCompanies();
  const { mutate, isPending } = useCreateTicket();
  const [form, setForm] = useState({ subject: '', description: '', companyId: '', priority: 'medium' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.description) { toast.error('Subject and description required'); return; }
    mutate({
      subject: form.subject,
      description: form.description,
      companyId: form.companyId ? Number(form.companyId) : undefined,
      priority: form.priority,
    }, {
      onSuccess: () => { toast.success('Ticket created'); onClose(); },
      onError: () => toast.error('Failed to create ticket'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-600" /> New Support Ticket</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Subject</label>
            <input
              value={form.subject} onChange={e => set('subject', e.target.value)}
              placeholder="Brief summary of the issue"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Detailed description of the issue…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Company (optional)</label>
              <select
                value={form.companyId} onChange={e => set('companyId', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— None —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Priority</label>
              <select
                value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit" disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Ticket
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const SupportTickets: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const { data: tickets = [], isLoading } = useSupportTickets(activeTab === 'all' ? undefined : activeTab);

  const countFor = (s: string) => s === 'all' ? tickets.length : tickets.filter(t => t.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage platform and operator support requests</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} />}

      {/* Status tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setActiveTab(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {STATUS_LABEL[s]}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === s ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
              {countFor(s)}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <LifeBuoy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tickets in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => <TicketCard key={t.id} ticket={t} />)}
        </div>
      )}
    </div>
  );
};

export default SupportTickets;
