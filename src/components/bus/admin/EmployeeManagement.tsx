import React, { useState, useEffect } from 'react';
import {
  Plus, X, Loader2, Users, ShoppingCart, QrCode, Bus, Grid3x3,
  BarChart3, Search, UserPlus, Truck, MapPin, CreditCard, Shield,
  ChevronRight, Eye, EyeOff, Check, XCircle, DollarSign, Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useCompanyEmployees, useCompanyStations,
  useEmpCreateStaff, useEmpUpdateStaffPermissions,
  type CompanyEmployeeFull,
} from '@/lib/api';

const ALL_PERMISSIONS = [
  // ── Operations ────────────────────────────────────────────────────────────
  { key: 'sell_tickets',        label: 'Point of Sale',                  Icon: ShoppingCart },
  { key: 'scan_tickets',        label: 'Boarding Scanner',               Icon: QrCode },
  { key: 'cancel_bookings',     label: 'Cancel Bookings',                Icon: XCircle },
  { key: 'reconcile_cash',      label: 'Cash Reconciliation',            Icon: DollarSign },
  { key: 'manage_notifications',label: 'Send Notifications',             Icon: Bell },
  // ── Trip & Fleet ──────────────────────────────────────────────────────────
  { key: 'create_trips',        label: 'Trip Management',                Icon: Bus },
  { key: 'manage_seats',        label: 'Seat Availability',              Icon: Grid3x3 },
  { key: 'manage_buses',        label: 'Fleet Management',               Icon: Truck },
  { key: 'manage_trip_staff',   label: 'Trip Staffing',                  Icon: Users },
  // ── Reporting & Customers ─────────────────────────────────────────────────
  { key: 'view_reports',        label: 'Sales & Reports',                Icon: BarChart3 },
  { key: 'manage_customers',    label: 'Customer Lookup',                Icon: Search },
  // ── Admin ─────────────────────────────────────────────────────────────────
  { key: 'manage_employees',    label: 'Staff Management',               Icon: UserPlus },
  { key: 'manage_stations',     label: 'Station Management',             Icon: MapPin },
  { key: 'manage_subscription', label: 'Subscription',                   Icon: CreditCard },
  { key: 'super_user',          label: 'Super User (all access)',        Icon: Shield },
];

function parsePerms(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return Object.fromEntries(p.map((k) => [k, true]));
    return p;
  } catch { return {}; }
}

function permCount(perms: Record<string, boolean>) {
  return Object.values(perms).filter(Boolean).length;
}

type Mode = 'list' | 'add' | 'edit';

interface Props {
  initialEmployee?: CompanyEmployeeFull | null;
}

const EmployeeManagement: React.FC<Props> = ({ initialEmployee }) => {
  const { data: staff = [], isLoading, refetch } = useCompanyEmployees();
  const { data: stations = [] } = useCompanyStations();
  const createStaff = useEmpCreateStaff();
  const updateStaff = useEmpUpdateStaffPermissions();

  const [mode, setMode] = useState<Mode>(initialEmployee ? 'edit' : 'list');
  const [editTarget, setEditTarget] = useState<CompanyEmployeeFull | null>(initialEmployee ?? null);
  const [perms, setPerms] = useState<Record<string, boolean>>(initialEmployee ? parsePerms(initialEmployee.permissions) : {});
  const [isActive, setIsActive] = useState(initialEmployee ? initialEmployee.isActive : true);
  const [showPw, setShowPw] = useState(false);
  const [stationId, setStationId] = useState<string>('');
  const [form, setForm] = useState({ username: '', email: '', password: '', fullName: '', stationId: '' });

  // Resolve stationId once stations have loaded (needed when opened from Stations page)
  useEffect(() => {
    if (initialEmployee && stations.length > 0 && !stationId) {
      const match = stations.find((s) => s.name === initialEmployee.station);
      if (match) setStationId(match.id);
    }
  }, [stations]);

  const saving = createStaff.isPending || updateStaff.isPending;

  const openAdd = () => {
    setEditTarget(null);
    setForm({ username: '', email: '', password: '', fullName: '', stationId: '' });
    setPerms({});
    setIsActive(true);
    setStationId('');
    setMode('add');
  };

  const openEdit = (s: CompanyEmployeeFull) => {
    setEditTarget(s);
    setPerms(parsePerms(s.permissions));
    setIsActive(s.isActive);
    const matchedStation = stations.find((st) => st.name === s.station);
    setStationId(matchedStation?.id ?? '');
    setMode('edit');
  };

  const togglePerm = (key: string) => setPerms((p) => ({ ...p, [key]: !p[key] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'add') {
        if (!form.username || !form.email || !form.password || !form.fullName) {
          toast.error('All fields are required'); return;
        }
        await createStaff.mutateAsync({
          username: form.username.trim(), email: form.email.trim(),
          password: form.password, fullName: form.fullName.trim(),
          permissions: perms, stationId: form.stationId || undefined,
        });
        toast.success('Staff member created');
      } else if (editTarget) {
        await updateStaff.mutateAsync({
          staffId: editTarget.id, permissions: perms, isActive,
          stationId: stationId || null,
        });
        toast.success('Staff member updated');
      }
      setMode('list');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  // ── Form view ──────────────────────────────────────────────────────────────
  if (mode !== 'list') {
    const p = perms;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setMode('list')}>← Back</Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'add' ? 'Add Staff Member' : `Edit: ${editTarget?.fullName}`}
            </h2>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 max-w-lg">
          {mode === 'add' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Personal Info</p>
              {[
                { label: 'Full Name', key: 'fullName', placeholder: 'e.g. John Banda', type: 'text' },
                { label: 'Username', key: 'username', placeholder: 'e.g. jbanda', type: 'text' },
                { label: 'Email', key: 'email', placeholder: 'john@company.com', type: 'email' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
                  <input type={type} value={(form as any)[key]} placeholder={placeholder}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Password</label>
                <div className="relative mt-1">
                  <input type={showPw ? 'text' : 'password'} value={form.password} placeholder="••••••••"
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {stations.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Assign Station</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" onClick={() => setForm((f) => ({ ...f, stationId: '' }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                        ${!form.stationId ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                      None
                    </button>
                    {stations.map((s) => (
                      <button key={s.id} type="button" onClick={() => setForm((f) => ({ ...f, stationId: s.id }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                          ${form.stationId === s.id ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active toggle + station (edit only) */}
          {mode === 'edit' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Account Status</div>
                  <div className="text-xs text-slate-500">{isActive ? 'Staff member can log in' : 'Login disabled'}</div>
                </div>
                <button type="button" onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isActive ? 'bg-blue-700' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {stations.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Assign Station</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setStationId('')}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                        ${!stationId ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                      None
                    </button>
                    {stations.map((s) => (
                      <button key={s.id} type="button" onClick={() => setStationId(s.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                          ${stationId === s.id ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Permissions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Permissions</p>
            {ALL_PERMISSIONS.map(({ key, label, Icon }) => (
              <button key={key} type="button" onClick={() => togglePerm(key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left
                  ${p[key] ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:bg-white'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                  ${p[key] ? 'bg-blue-100' : 'bg-white border border-slate-200'}`}>
                  <Icon className={`w-4 h-4 ${p[key] ? 'text-blue-700' : 'text-slate-400'}`} />
                </div>
                <span className={`flex-1 text-sm font-medium ${p[key] ? 'text-blue-900' : 'text-slate-700'}`}>{label}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition
                  ${p[key] ? 'bg-blue-700 border-blue-700' : 'border-slate-300'}`}>
                  {p[key] && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setMode('list')}>Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-[2] bg-blue-700 hover:bg-blue-800 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {mode === 'add' ? 'Create Staff Member' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Staff Management</h2>
          <p className="text-slate-500 text-sm mt-1">{staff.length} staff member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-700 hover:bg-blue-800 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Staff
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : staff.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-semibold text-slate-500">No staff members yet</p>
          <Button onClick={openAdd} className="mt-4 bg-blue-700 hover:bg-blue-800 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add First Staff Member
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((s) => {
            const p = parsePerms(s.permissions);
            const count = permCount(p);
            const initials = s.fullName.split(' ').slice(0, 2).map((w: string) => w[0] || '').join('').toUpperCase();
            return (
              <button key={s.id} onClick={() => openEdit(s)}
                className={`w-full bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 text-left hover:border-blue-300 transition ${!s.isActive ? 'opacity-50' : ''}`}>
                <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="font-bold text-indigo-700">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900">{s.fullName}</div>
                  <div className="text-xs text-slate-500">{s.email}</div>
                  {s.station && <div className="text-xs text-blue-600 mt-0.5">📍 {s.station}</div>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${p.super_user ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {p.super_user ? 'Super User' : `${count} perm${count !== 1 ? 's' : ''}`}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
