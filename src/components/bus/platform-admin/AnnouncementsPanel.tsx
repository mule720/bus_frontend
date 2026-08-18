import React, { useState } from 'react';
import { Megaphone, Plus, Trash2, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
import {
  useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement,
  type Announcement,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

const TARGET_OPTIONS = [
  { value: 'all',      label: 'All Companies' },
  { value: 'active',   label: 'Active Companies' },
  { value: 'pending',  label: 'Pending Companies' },
  { value: 'customers',label: 'All Customers' },
];

const TARGET_BADGE: Record<string, string> = {
  all:       'bg-indigo-100 text-indigo-700',
  active:    'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  customers: 'bg-sky-100 text-sky-700',
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Confirm delete dialog ──────────────────────────────────────────────────────
const DeleteConfirm: React.FC<{ title: string; onConfirm: () => void; onCancel: () => void; isPending: boolean }> = ({ title, onConfirm, onCancel, isPending }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <h3 className="font-bold text-slate-800 mb-2">Delete Announcement</h3>
      <p className="text-sm text-slate-500 mb-5">
        Are you sure you want to delete <span className="font-semibold text-slate-700">"{title}"</span>? This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onConfirm} disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Delete
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  </div>
);

// ── Announcement card ──────────────────────────────────────────────────────────
const AnnouncementCard: React.FC<{ ann: Announcement }> = ({ ann }) => {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: del, isPending } = useDeleteAnnouncement();

  const handleDelete = () => {
    del(ann.id, {
      onSuccess: () => { toast.success('Announcement deleted'); setShowConfirm(false); },
      onError: () => toast.error('Failed to delete'),
    });
  };

  const targetLabel = TARGET_OPTIONS.find(t => t.value === ann.target)?.label ?? ann.target;

  return (
    <>
      {showConfirm && (
        <DeleteConfirm
          title={ann.title}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
          isPending={isPending}
        />
      )}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-800 text-sm">{ann.title}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TARGET_BADGE[ann.target] ?? 'bg-slate-100 text-slate-600'}`}>
                {targetLabel}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ann.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {ann.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className={`text-slate-500 text-sm mt-2 ${expanded ? '' : 'line-clamp-2'}`}>{ann.body}</p>
            {ann.body.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1 font-medium"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
              </button>
            )}
            <p className="text-slate-300 text-xs mt-2">
              {ann.createdBy ? `By @${ann.createdBy.username} · ` : ''}{fmt(ann.createdAt)}
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition shrink-0"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

// ── Create form ────────────────────────────────────────────────────────────────
const CreateForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [form, setForm] = useState({ title: '', body: '', target: 'all' });
  const { mutate, isPending } = useCreateAnnouncement();
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.body) { toast.error('Title and body are required'); return; }
    mutate(form, {
      onSuccess: () => { toast.success('Announcement created'); onClose(); },
      onError: () => toast.error('Failed to create announcement'),
    });
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-600" /> New Announcement</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Title</label>
          <input
            value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Scheduled maintenance on 15 Jun"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Body</label>
          <textarea
            rows={4} value={form.body} onChange={e => set('body', e.target.value)}
            placeholder="Write the announcement message here…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Target Audience</label>
          <select
            value={form.target} onChange={e => set('target', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="submit" disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
            Publish Announcement
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      </form>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const AnnouncementsPanel: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const { data: announcements = [], isLoading } = useAnnouncements();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-slate-500 text-sm mt-0.5">Publish platform-wide notices to operators and customers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      {showForm && <CreateForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No announcements yet</p>
          <p className="text-sm mt-1">Create one to notify your operators and customers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => <AnnouncementCard key={a.id} ann={a} />)}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPanel;
