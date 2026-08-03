import React, { useState } from 'react';
import { MapPin, Plus, Users, Edit2, X, Loader2, ChevronRight, ArrowLeft, ChevronRight as ViewIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCompanyStations, useCompanyEmployees, useEmpCreateStation, useEmpUpdateStation, type CompanyEmployeeFull } from '@/lib/api';

interface Props {
  onViewEmployee?: (emp: CompanyEmployeeFull) => void;
}

const StationManagement: React.FC<Props> = ({ onViewEmployee }) => {
  const { data: stations = [], isLoading } = useCompanyStations();
  const { data: employees = [] } = useCompanyEmployees();
  const createStation = useEmpCreateStation();
  const updateStation = useEmpUpdateStation();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; address: string } | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [selectedStation, setSelectedStation] = useState<{ id: string; name: string; address: string; employeeCount: number } | null>(null);

  const openAdd = () => { setEditTarget(null); setForm({ name: '', address: '' }); setShowForm(true); };
  const openEdit = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(s);
    setForm({ name: s.name, address: s.address || '' });
    setShowForm(true);
  };

  const saving = createStation.isPending || updateStation.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Station name is required'); return; }
    try {
      if (editTarget) {
        await updateStation.mutateAsync({ stationId: editTarget.id, name: form.name.trim(), address: form.address });
        toast.success('Station updated');
      } else {
        await createStation.mutateAsync({ name: form.name.trim(), address: form.address });
        toast.success('Station created');
      }
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save station');
    }
  };

  // ── Station detail view ───────────────────────────────────────────────────
  if (selectedStation) {
    const stationEmployees = employees.filter((e) => e.station === selectedStation.name);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setSelectedStation(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> All Stations
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{selectedStation.name}</h2>
            {selectedStation.address && <p className="text-slate-500 text-sm mt-0.5">{selectedStation.address}</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Staff at this station ({stationEmployees.length})
          </p>
          {stationEmployees.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-200" />
              <p className="text-sm text-slate-500">No staff assigned to this station</p>
              <p className="text-xs text-slate-400 mt-1">Go to Staff Management to assign employees to stations</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stationEmployees.map((emp) => {
                const initials = emp.fullName.split(' ').slice(0, 2).map((w: string) => w[0] || '').join('').toUpperCase();
                return (
                  <button
                    key={emp.id}
                    onClick={() => onViewEmployee?.(emp)}
                    className={`w-full flex items-center gap-3 py-3 text-left transition ${onViewEmployee ? 'hover:bg-slate-50 rounded-lg px-2 -mx-2 cursor-pointer' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="font-bold text-indigo-700 text-sm">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">{emp.fullName}</div>
                      <div className="text-xs text-slate-500">{emp.email}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                      ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {onViewEmployee && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Station Management</h2>
          <p className="text-slate-500 text-sm mt-1">Click a station to see assigned staff</p>
        </div>
        <Button onClick={openAdd} className="bg-violet-700 hover:bg-violet-800 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Station
        </Button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">{editTarget ? 'Edit Station' : 'New Station'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Station Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Lusaka Intercity"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Address (optional)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Cairo Road, Lusaka"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="flex-[2] bg-violet-700 hover:bg-violet-800 text-white">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editTarget ? 'Save Changes' : 'Create Station'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Station list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : stations.length === 0 ? (
        <div className="text-center py-20">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-semibold text-slate-500">No stations yet</p>
          <p className="text-sm text-slate-400 mt-1">Add your first departure station to assign staff</p>
          <Button onClick={openAdd} className="mt-4 bg-violet-700 hover:bg-violet-800 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Station
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedStation(s)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-left hover:border-violet-400 hover:shadow-md transition group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition">
                  <MapPin className="w-6 h-6 text-violet-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900">{s.name}</div>
                  {s.address && <div className="text-xs text-slate-500 mt-0.5">{s.address}</div>}
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                    <Users className="w-3 h-3" />
                    <span>{s.employeeCount} staff assigned</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button onClick={(e) => openEdit(s, e)} className="text-slate-400 hover:text-violet-700 transition">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StationManagement;
