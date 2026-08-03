import React, { useState } from 'react';
import { Plus, X, Loader2, Bus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useMyBuses, useRegisterBus, useUpdateBus, useDeleteBus } from '@/lib/api';
import type { BackendBus } from '@/lib/api';

const AMENITY_OPTS = ['WiFi', 'AC', 'USB', 'Meals', 'TV', 'Restroom'];
const BUS_TYPES = ['Standard', 'Luxury', 'VIP'];

function parseAmenities(raw: string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try { return JSON.parse(raw); } catch { return []; }
}

interface BusForm {
  registrationNumber: string; busNumber: string;
  busType: string; totalSeats: string; amenities: string[];
}
const emptyForm = (): BusForm => ({
  registrationNumber: '', busNumber: '', busType: 'Standard', totalSeats: '40', amenities: [],
});

function busToForm(b: BackendBus): BusForm {
  return {
    registrationNumber: b.registrationNumber ?? '',
    busNumber: b.busNumber ?? '',
    busType: b.busType ?? 'Standard',
    totalSeats: String(b.totalSeats),
    amenities: parseAmenities(b.amenities),
  };
}

// ── Shared form ──────────────────────────────────────────────────────────────

function BusForm({
  form, setForm, onSubmit, onCancel, isPending, submitLabel,
}: {
  form: BusForm;
  setForm: React.Dispatch<React.SetStateAction<BusForm>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const toggleAmenity = (a: string) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Registration Number *', key: 'registrationNumber', placeholder: 'e.g. ABC 1234 ZM' },
          { label: 'Bus Number / Name *', key: 'busNumber', placeholder: 'e.g. BUS-001' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
            <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={(form as Record<string, string>)[key]} placeholder={placeholder} required
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          </div>
        ))}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Bus Type</label>
          <select className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.busType} onChange={(e) => setForm((f) => ({ ...f, busType: e.target.value }))}>
            {BUS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Total Seats</label>
          <input type="number" min="1" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.totalSeats} onChange={(e) => setForm((f) => ({ ...f, totalSeats: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Amenities</label>
        <div className="flex flex-wrap gap-2">
          {AMENITY_OPTS.map((a) => (
            <button key={a} type="button" onClick={() => toggleAmenity(a)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${form.amenities.includes(a) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="bg-blue-700 hover:bg-blue-800 text-white">
          {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const BusManagement: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [editBus, setEditBus] = useState<BackendBus | null>(null);
  const [editForm, setEditForm] = useState<BusForm>(emptyForm());

  const { data: buses = [], isLoading } = useMyBuses();
  const registerBus = useRegisterBus();
  const updateBus = useUpdateBus();
  const deleteBus = useDeleteBus();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.registrationNumber || !createForm.busNumber) {
      toast.error('Registration number and bus number are required.'); return;
    }
    try {
      await registerBus.mutateAsync({
        registrationNumber: createForm.registrationNumber,
        busNumber: createForm.busNumber,
        busType: createForm.busType,
        totalSeats: parseInt(createForm.totalSeats, 10),
        amenities: createForm.amenities,
      });
      toast.success('Bus registered!');
      setShowCreate(false);
      setCreateForm(emptyForm());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Register failed');
    }
  };

  const openEdit = (bus: BackendBus) => {
    setEditBus(bus);
    setEditForm(busToForm(bus));
    setShowCreate(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBus) return;
    try {
      await updateBus.mutateAsync({
        busId: editBus.id,
        busNumber: editForm.busNumber,
        busType: editForm.busType,
        totalSeats: parseInt(editForm.totalSeats, 10),
        amenities: editForm.amenities,
      });
      toast.success('Bus updated!');
      setEditBus(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDelete = async (bus: BackendBus) => {
    if (!confirm(`Delete bus "${bus.busNumber}" (${bus.registrationNumber})? This cannot be undone.`)) return;
    try {
      await deleteBus.mutateAsync(bus.id);
      toast.success('Bus deleted.');
      if (editBus?.id === bus.id) setEditBus(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleToggleActive = async (bus: BackendBus) => {
    try {
      await updateBus.mutateAsync({ busId: bus.id, isActive: !bus.isActive });
      toast.success(bus.isActive ? 'Bus deactivated.' : 'Bus activated.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fleet</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your bus fleet</p>
        </div>
        <Button onClick={() => { setShowCreate((v) => !v); setEditBus(null); }}
          className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> Register Bus
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Register New Bus</h3>
            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
          </div>
          <BusForm
            form={createForm} setForm={setCreateForm}
            onSubmit={handleCreate} onCancel={() => setShowCreate(false)}
            isPending={registerBus.isPending} submitLabel="Register Bus"
          />
        </div>
      )}

      {/* Edit form */}
      {editBus && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Edit Bus: {editBus.busNumber}</h3>
            <button onClick={() => setEditBus(null)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
          </div>
          <BusForm
            form={editForm} setForm={setEditForm}
            onSubmit={handleEdit} onCancel={() => setEditBus(null)}
            isPending={updateBus.isPending} submitLabel="Save Changes"
          />
        </div>
      )}

      {/* Bus list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : buses.length === 0 ? (
          <div className="p-12 text-center">
            <Bus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No buses registered yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {buses.map((bus) => {
              const amenities = parseAmenities(bus.amenities);
              const isEditing = editBus?.id === bus.id;
              return (
                <div key={bus.id} className={`p-5 transition ${isEditing ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shrink-0">
                        <Bus className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{bus.busNumber}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {bus.registrationNumber} · {bus.busType} · {bus.totalSeats} seats
                        </div>
                        {amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {amenities.map((a) => (
                              <span key={a} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleActive(bus)}
                        disabled={updateBus.isPending}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${bus.isActive ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700'}`}>
                        {bus.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button onClick={() => isEditing ? setEditBus(null) : openEdit(bus)}
                        title="Edit bus"
                        className={`p-1.5 transition rounded ${isEditing ? 'text-blue-600 bg-blue-100' : 'text-slate-400 hover:text-blue-600'}`}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(bus)}
                        disabled={deleteBus.isPending}
                        title="Delete bus"
                        className="p-1.5 text-slate-400 hover:text-red-600 transition rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusManagement;
