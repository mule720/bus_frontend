import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Loader2, Check } from 'lucide-react';
import {
  usePlatformSettings, useUpdateSetting,
  type PlatformSettingItem,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

// ── Category grouping ──────────────────────────────────────────────────────────
const CATEGORY_KEYS: Record<string, string[]> = {
  Operations: ['maintenance_mode', 'online_booking_enabled', 'walkin_pos_enabled'],
  Payments:   ['payment_gateway'],
  Bookings:   ['booking_expiry_minutes', 'max_seats_per_booking'],
  Branding:   ['platform_name', 'support_email'],
};

function categoryFor(key: string): string {
  for (const [cat, keys] of Object.entries(CATEGORY_KEYS)) {
    if (keys.includes(key)) return cat;
  }
  return 'Other';
}

function orderFor(key: string): number {
  for (const keys of Object.values(CATEGORY_KEYS)) {
    const i = keys.indexOf(key);
    if (i !== -1) return i;
  }
  return 99;
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: () => void; isPending: boolean }> = ({ checked, onChange, isPending }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={isPending}
    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
  >
    {isPending ? (
      <Loader2 className="absolute top-1 left-1 w-4 h-4 text-white animate-spin" />
    ) : (
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    )}
  </button>
);

// ── Saved indicator ────────────────────────────────────────────────────────────
function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return { saved, flash };
}

// ── Individual setting row ─────────────────────────────────────────────────────
const SettingRow: React.FC<{ setting: PlatformSettingItem }> = ({ setting }) => {
  const [localVal, setLocalVal] = useState(setting.value);
  const [dirty, setDirty] = useState(false);
  const { mutate, isPending } = useUpdateSetting();
  const { saved, flash } = useSavedFlash();

  // keep in sync when fresh data arrives
  useEffect(() => {
    setLocalVal(setting.value);
    setDirty(false);
  }, [setting.value]);

  const isBool = setting.valueType === 'bool';
  const boolVal = localVal === 'true' || localVal === '1';

  const save = (overrideVal?: string) => {
    const val = overrideVal ?? localVal;
    mutate({ key: setting.key, value: val }, {
      onSuccess: () => { flash(); setDirty(false); toast.success(`${setting.label} updated`); },
      onError: () => toast.error(`Failed to update ${setting.label}`),
    });
  };

  const handleToggle = () => {
    const next = boolVal ? 'false' : 'true';
    setLocalVal(next);
    save(next);
  };

  const handleChange = (v: string) => {
    setLocalVal(v);
    setDirty(v !== setting.value);
  };

  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm">{setting.label}</p>
        {setting.description && (
          <p className="text-xs text-slate-400 mt-0.5">{setting.description}</p>
        )}
        <p className="text-xs text-slate-300 font-mono mt-0.5">{setting.key}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
        {isBool ? (
          <Toggle checked={boolVal} onChange={handleToggle} isPending={isPending} />
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={localVal}
              onChange={e => handleChange(e.target.value)}
              type={setting.valueType === 'int' ? 'number' : 'text'}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
            />
            {dirty && (
              <button
                onClick={() => save()}
                disabled={isPending}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const PlatformSettingsPage: React.FC = () => {
  const { data: settings = [], isLoading } = usePlatformSettings();

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformSettingItem[]>();
    settings.forEach(s => {
      const cat = categoryFor(s.key);
      const arr = map.get(cat) ?? [];
      arr.push(s);
      map.set(cat, arr);
    });
    // Sort within each group by key order
    map.forEach((items, cat) => {
      items.sort((a, b) => orderFor(a.key) - orderFor(b.key));
      map.set(cat, items);
    });
    // Sort categories: known first, then Other
    const knownOrder = Object.keys(CATEGORY_KEYS);
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = knownOrder.indexOf(a);
      const ib = knownOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [settings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Configure global platform behaviour and branding</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : settings.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No settings available.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <div key={category} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{category}</h2>
              </div>
              <div className="px-5">
                {items.map(s => <SettingRow key={s.key} setting={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlatformSettingsPage;
