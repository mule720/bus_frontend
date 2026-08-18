import React, { useState, useMemo } from 'react';
import { MapPin, Plus, X, Loader2, Search, Pencil, Check } from 'lucide-react';
import {
  usePlatformStations, useCreateStation, useUpdateStation,
  type PlatformStationItem,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

// ── Station card ───────────────────────────────────────────────────────────────
const StationCard: React.FC<{ station: PlatformStationItem }> = ({ station }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: station.name,
    city: station.city,
    province: station.province ?? '',
    address: station.address ?? '',
    isActive: station.isActive,
  });
  const { mutate, isPending } = useUpdateStation();
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    mutate({ stationId: station.id, ...form }, {
      onSuccess: () => { toast.success('Station updated'); setEditing(false); },
      onError: () => toast.error('Failed to update station'),
    });
  };

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-indigo-200 shadow-md p-4 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {(['name', 'city', 'province', 'address'] as const).map(k => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5 block">{k}</label>
              <input
                value={form[k]}
                onChange={e => set(k, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-xs text-slate-600">{form.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save} disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{station.name}</p>
          <p className="text-slate-500 text-xs mt-0.5">{station.city}{station.province ? `, ${station.province}` : ''}</p>
          {station.address && <p className="text-slate-400 text-xs mt-0.5 truncate">{station.address}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${station.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {station.isActive ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Add station form ───────────────────────────────────────────────────────────
const AddStationForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [form, setForm] = useState({ name: '', city: '', province: '', address: '' });
  const { mutate, isPending } = useCreateStation();
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.city) { toast.error('Name and city are required'); return; }
    mutate({
      name: form.name,
      city: form.city,
      province: form.province || undefined,
      address: form.address || undefined,
    }, {
      onSuccess: () => { toast.success('Station added'); onClose(); },
      onError: () => toast.error('Failed to add station'),
    });
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-600" /> Add Station</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { k: 'name', label: 'Station Name', placeholder: 'e.g. Lusaka Intercity' },
            { k: 'city', label: 'City', placeholder: 'e.g. Lusaka' },
            { k: 'province', label: 'Province (optional)', placeholder: 'e.g. Lusaka Province' },
            { k: 'address', label: 'Address (optional)', placeholder: 'e.g. Cairo Road, CBD' },
          ].map(({ k, label, placeholder }) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
              <input
                value={form[k as keyof typeof form]}
                onChange={e => set(k, e.target.value)}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="submit" disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            Add Station
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      </form>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const StationRegistry: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const { data: stations = [], isLoading } = usePlatformStations();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? stations.filter(s => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q))
      : stations;
  }, [stations, search]);

  const byCity = useMemo(() => {
    const map = new Map<string, PlatformStationItem[]>();
    filtered.forEach(s => {
      const arr = map.get(s.city) ?? [];
      arr.push(s);
      map.set(s.city, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Station Registry</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {stations.length} station{stations.length !== 1 ? 's' : ''} registered on the platform
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" /> Add Station
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or city…"
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {showForm && <AddStationForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : stations.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No stations registered</p>
          <p className="text-sm mt-1">Add your first station to get started.</p>
        </div>
      ) : byCity.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No stations match your search.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {byCity.map(([city, items]) => (
            <div key={city}>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> {city}
                <span className="font-normal text-slate-300 normal-case tracking-normal">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map(s => <StationCard key={s.id} station={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StationRegistry;
