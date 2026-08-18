import React, { useState } from 'react';
import { Users, Loader2, Plus, X, Shield, User } from 'lucide-react';
import { usePlatformStaff, useCreateStaff, type PlatformStaff } from '@/lib/platformAdminApi';
import { toast } from 'sonner';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full access to all platform features' },
  { value: 'ops_manager', label: 'Operations Manager', desc: 'Manage companies, trips, bookings' },
  { value: 'finance', label: 'Finance', desc: 'View revenue and financial reports' },
  { value: 'support', label: 'Support', desc: 'Handle customer and company issues' },
  { value: 'moderator', label: 'Moderator', desc: 'Review content and company applications' },
];

const ROLE_BADGE: Record<string, string> = {
  super_admin:  'bg-red-100 text-red-700',
  ops_manager:  'bg-indigo-100 text-indigo-700',
  finance:      'bg-emerald-100 text-emerald-700',
  support:      'bg-sky-100 text-sky-700',
  moderator:    'bg-amber-100 text-amber-700',
};

const StaffCard: React.FC<{ staff: PlatformStaff }> = ({ staff }) => {
  const initials = [staff.user.firstName, staff.user.lastName].filter(Boolean).map((n) => n[0].toUpperCase()).join('') || staff.user.username[0].toUpperCase();
  const roleLabel = ROLES.find((r) => r.value === staff.role)?.label ?? staff.role;

  return (
    <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm">
          {[staff.user.firstName, staff.user.lastName].filter(Boolean).join(' ') || staff.user.username}
        </p>
        <p className="text-slate-400 text-xs truncate">{staff.user.email}</p>
        <p className="text-slate-400 text-xs">@{staff.user.username}</p>
      </div>
      <div className="text-right">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[staff.role] ?? 'bg-slate-100 text-slate-600'}`}>
          {roleLabel}
        </span>
        <p className="text-slate-300 text-xs mt-1.5">
          {new Date(staff.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <span className={`text-xs ${staff.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
          {staff.isActive ? '● Active' : '○ Inactive'}
        </span>
      </div>
    </div>
  );
};

const AddStaffForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'support' });
  const { mutate: createStaff, isPending } = useCreateStaff();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) {
      toast.error('All fields are required'); return;
    }
    createStaff(form, {
      onSuccess: () => { toast.success('Staff member created'); onClose(); },
      onError: (e: any) => toast.error(e.messages?.[0] ?? 'Failed to create staff'),
    });
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-600" /> Add Platform Staff
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledInput label="Username" type="text" value={form.username} onChange={(v) => set('username', v)} placeholder="e.g. john_ops" />
          <LabeledInput label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="e.g. john@busgo.zm" />
          <LabeledInput label="Password" type="password" value={form.password} onChange={(v) => set('password', v)} placeholder="Min 8 characters" />
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Role</label>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">{ROLES.find((r) => r.value === form.role)?.desc}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Staff Member
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

const LabeledInput: React.FC<{
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}> = ({ label, type, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
);

const PlatformStaffMgmt: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const { data: staff = [], isLoading } = usePlatformStaff();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Staff</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your internal team's access and roles</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {/* Roles reference */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ROLES.map((r) => (
          <div key={r.value} className={`rounded-xl px-3 py-2 ${ROLE_BADGE[r.value] ?? 'bg-slate-100 text-slate-600'} bg-opacity-30`}>
            <p className="text-xs font-bold">{r.label}</p>
            <p className="text-xs opacity-80 mt-0.5">{r.desc}</p>
          </div>
        ))}
      </div>

      {showForm && <AddStaffForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No staff members yet. Add your first team member above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((s) => <StaffCard key={s.id} staff={s} />)}
        </div>
      )}
    </div>
  );
};

export default PlatformStaffMgmt;
