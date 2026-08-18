import React, { useState, useEffect } from 'react';
import { Loader2, Save, Edit2, X, Check } from 'lucide-react';
import { useSubscriptionPlans, useUpdatePlan, type SubscriptionPlanConfig } from '@/lib/platformAdminApi';
import { toast } from 'sonner';

const PLAN_COLORS: Record<string, { bg: string; ring: string; badge: string }> = {
  starter:    { bg: 'bg-sky-50', ring: 'ring-sky-200', badge: 'bg-sky-100 text-sky-700' },
  growth:     { bg: 'bg-violet-50', ring: 'ring-violet-200', badge: 'bg-violet-100 text-violet-700' },
  pro:        { bg: 'bg-indigo-50', ring: 'ring-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  enterprise: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
};

type EditState = Partial<Record<keyof SubscriptionPlanConfig, string>>;

const NumField: React.FC<{
  label: string; field: string; value: number;
  editing: boolean; editState: EditState;
  onChange: (field: string, v: string) => void;
  pct?: boolean; prefix?: string;
}> = ({ label, field, value, editing, editState, onChange, pct, prefix }) => {
  const raw = editState[field as keyof SubscriptionPlanConfig];
  const displayVal = raw !== undefined ? raw : (pct ? (value * 100).toFixed(2) : value.toString());

  return (
    <div>
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      {editing ? (
        <div className="relative">
          {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix}</span>}
          <input
            type="number"
            value={displayVal}
            onChange={(e) => onChange(field, e.target.value)}
            className={`w-full border border-slate-200 rounded-lg py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${prefix ? 'pl-5' : 'pl-2'} pr-2`}
          />
          {pct && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>}
        </div>
      ) : (
        <p className="text-sm font-semibold text-slate-800">
          {prefix && <span className="text-slate-400">{prefix}</span>}
          {pct ? `${(value * 100).toFixed(2)}%` : value.toLocaleString()}
        </p>
      )}
    </div>
  );
};

const PlanCard: React.FC<{ plan: SubscriptionPlanConfig }> = ({ plan }) => {
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>({});
  const { mutate: updatePlan, isPending } = useUpdatePlan();
  const colors = PLAN_COLORS[plan.plan] ?? PLAN_COLORS.starter;

  const handleChange = (field: string, val: string) => {
    setEditState((s) => ({ ...s, [field]: val }));
  };

  const handleSave = () => {
    const vars: Record<string, unknown> = { plan: plan.plan };
    const pctFields = new Set(['onlineCommissionRate', 'walkinCommissionRate', 'onlineServiceChargeRate']);

    for (const [field, raw] of Object.entries(editState)) {
      if (raw === '' || raw === undefined) continue;
      const num = parseFloat(raw);
      if (isNaN(num)) continue;
      // pct fields: user enters 3.00 → store 0.03
      vars[field] = pctFields.has(field) ? num / 100 : num;
    }

    updatePlan(vars, {
      onSuccess: () => { toast.success(`${plan.plan} plan updated`); setEditing(false); setEditState({}); },
      onError: (e: any) => toast.error(e.messages?.[0] ?? 'Failed to update plan'),
    });
  };

  const handleCancel = () => { setEditing(false); setEditState({}); };

  return (
    <div className={`rounded-2xl p-6 ring-1 ${colors.bg} ${colors.ring}`}>
      {/* Plan header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${colors.badge}`}>
            {plan.plan}
          </span>
          <p className="mt-2 text-2xl font-black text-slate-900">
            K {Number(plan.monthlyPrice).toLocaleString()}
            <span className="text-sm font-normal text-slate-400">/mo</span>
          </p>
          <p className="text-slate-500 text-xs">K {Number(plan.annualPrice).toLocaleString()} / year</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              disabled={isPending}
              onClick={handleSave}
              className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handleCancel} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Core pricing */}
        {editing && (
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Monthly price (K)" field="monthlyPrice" value={Number(plan.monthlyPrice)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
            <NumField label="Annual price (K)" field="annualPrice" value={Number(plan.annualPrice)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
          </div>
        )}

        {/* Quotas */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Included Quotas</p>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Buses" field="includedBuses" value={plan.includedBuses} editing={editing} editState={editState} onChange={handleChange} />
            <NumField label="Stations" field="includedStations" value={plan.includedStations} editing={editing} editState={editState} onChange={handleChange} />
            <NumField label="Staff" field="includedStaff" value={plan.includedStaff} editing={editing} editState={editState} onChange={handleChange} />
          </div>
          {plan.unlimitedStaff && (
            <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Unlimited staff
            </p>
          )}
        </div>

        {/* Overage fees */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Overage Fees (K/month)</p>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Extra bus" field="extraBusFee" value={Number(plan.extraBusFee)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
            <NumField label="Extra station" field="extraStationFee" value={Number(plan.extraStationFee)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
            <NumField label="Extra staff" field="extraStaffFee" value={Number(plan.extraStaffFee)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
          </div>
        </div>

        {/* Commission rates */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Commission Rates</p>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Online comm." field="onlineCommissionRate" value={Number(plan.onlineCommissionRate)} editing={editing} editState={editState} onChange={handleChange} pct />
            <NumField label="Walk-in comm." field="walkinCommissionRate" value={Number(plan.walkinCommissionRate)} editing={editing} editState={editState} onChange={handleChange} pct />
            <NumField label="Service charge" field="onlineServiceChargeRate" value={Number(plan.onlineServiceChargeRate)} editing={editing} editState={editState} onChange={handleChange} pct />
          </div>
        </div>

        {/* Setup fees */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Setup Fees (K, one-time)</p>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Base fee" field="setupBaseFee" value={Number(plan.setupBaseFee)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
            <NumField label="Per station" field="setupPerStation" value={Number(plan.setupPerStation)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
            <NumField label="Per staff" field="setupPerStaff" value={Number(plan.setupPerStaff)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
            <NumField label="Per bus" field="setupPerBus" value={Number(plan.setupPerBus)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
          </div>
          <div className="mt-2">
            <NumField label="Training fee" field="setupTrainingFee" value={Number(plan.setupTrainingFee)} editing={editing} editState={editState} onChange={handleChange} prefix="K" />
          </div>
        </div>
      </div>
    </div>
  );
};

const SubscriptionPlans: React.FC = () => {
  const { data: plans, isLoading } = useSubscriptionPlans();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Configure pricing, quotas, commission rates, and setup fees for each plan tier.
          Click the edit icon on any plan to modify it.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(plans ?? []).map((p) => <PlanCard key={p.id} plan={p} />)}
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlans;
