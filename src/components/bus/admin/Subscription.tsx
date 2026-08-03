import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, CheckCircle2, Loader2, Calendar, Zap, Shield, Star,
  RefreshCw, ExternalLink, Bus, MapPin, Users, TrendingUp, Ticket,
  Smartphone, Building2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useMyActiveSubscription, useAvailableSubscriptionPlans,
  useSubscribeCompany, useMyLatestSubscription,
  type SubscriptionPlan,
} from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }); }
  catch { return iso; }
}
function fmtPct(rate: number) { return `${(rate * 100).toFixed(2)}%`; }
function fmtK(n: number) { return n === 0 ? 'Free' : `K${n.toLocaleString()}`; }

const PLAN_META: Record<string, { icon: React.ReactNode; gradient: string; badge?: string }> = {
  starter:    { icon: <Zap className="w-6 h-6" />,        gradient: 'from-blue-500 to-blue-700' },
  growth:     { icon: <TrendingUp className="w-6 h-6" />, gradient: 'from-teal-500 to-teal-700', badge: 'Most Popular' },
  pro:        { icon: <Star className="w-6 h-6" />,        gradient: 'from-orange-500 to-orange-700' },
  enterprise: { icon: <Shield className="w-6 h-6" />,      gradient: 'from-purple-600 to-purple-800' },
};

type BillingCycle = 'monthly' | 'annually';

interface FleetCounts { buses: number; stations: number; staff: number }

function calcOverage(p: SubscriptionPlan, counts: FleetCounts) {
  const extraBuses    = Math.max(0, counts.buses    - p.includedBuses);
  const extraStations = Math.max(0, counts.stations - p.includedStations);
  const extraStaff    = p.unlimitedStaff ? 0 : Math.max(0, counts.staff - p.includedStaff);
  return {
    extraBuses, extraStations, extraStaff,
    overageCost: extraBuses * p.extraBusFee + extraStations * p.extraStationFee + extraStaff * p.extraStaffFee,
  };
}

function calcSetup(p: SubscriptionPlan, counts: FleetCounts) {
  const staffCost = p.unlimitedStaff ? 0 : counts.staff * p.setupPerStaff;
  return (
    p.setupBaseFee +
    counts.stations * p.setupPerStation +
    staffCost +
    counts.buses * p.setupPerBus +
    p.setupTrainingFee
  );
}

function PlanCard({
  plan, billingCycle, counts, isCurrent, isFirstTime, onSubscribe, isPending,
}: {
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  counts: FleetCounts;
  isCurrent: boolean;
  isFirstTime: boolean;
  onSubscribe: () => void;
  isPending: boolean;
}) {
  const key  = plan.plan.toLowerCase();
  const meta = PLAN_META[key] ?? { icon: <CreditCard className="w-6 h-6" />, gradient: 'from-slate-500 to-slate-700' };

  const basePrice = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
  const { extraBuses, extraStations, extraStaff, overageCost } = calcOverage(plan, counts);
  const monthlyOverage = overageCost;
  const totalMonthly   = billingCycle === 'monthly'
    ? plan.monthlyPrice + monthlyOverage
    : plan.annualPrice  + monthlyOverage * 12;

  const setupCost = calcSetup(plan, counts);
  const [showSetup, setShowSetup] = useState(false);

  const hasOverage = extraBuses > 0 || extraStations > 0 || extraStaff > 0;

  return (
    <div className={`relative bg-white rounded-2xl border-2 flex flex-col transition ${
      isCurrent ? 'border-green-400 shadow-lg' : key === 'growth' ? 'border-teal-400 shadow-lg' : 'border-slate-200 hover:border-slate-300'
    }`}>
      {meta.badge && !isCurrent && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap bg-gradient-to-r ${meta.gradient}`}>
          {meta.badge}
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
          Current Plan
        </div>
      )}

      {/* Header */}
      <div className={`bg-gradient-to-br ${meta.gradient} rounded-t-2xl p-5 text-white`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">{meta.icon}</div>
          <h3 className="text-lg font-bold capitalize">{plan.plan}</h3>
        </div>

        {/* Pricing */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">K{totalMonthly.toLocaleString()}</span>
            <span className="text-sm opacity-80">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
          </div>
          {billingCycle === 'annually' && (
            <p className="text-xs opacity-70 mt-0.5">
              saves K{((plan.monthlyPrice + monthlyOverage) * 12 - totalMonthly).toLocaleString()} vs monthly
            </p>
          )}
        </div>
      </div>

      {/* Included quotas */}
      <div className="p-4 space-y-3 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Included in plan</p>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { icon: Bus,    label: 'Buses',    included: plan.includedBuses,    actual: counts.buses    },
            { icon: MapPin, label: 'Stations', included: plan.includedStations, actual: counts.stations },
            { icon: Users,  label: 'Staff',    included: plan.unlimitedStaff ? Infinity : plan.includedStaff, actual: counts.staff },
          ].map(({ icon: Icon, label, included, actual }) => {
            const over = actual > included;
            return (
              <div key={label} className={`rounded-xl p-2 ${over ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${over ? 'text-amber-500' : 'text-slate-400'}`} />
                <div className={`text-base font-bold ${over ? 'text-amber-700' : 'text-slate-800'}`}>
                  {included === Infinity ? '∞' : included}
                </div>
                <div className="text-[9px] text-slate-500">{label}</div>
                {over && <div className="text-[9px] text-amber-600 font-semibold">+{actual - included} extra</div>}
              </div>
            );
          })}
        </div>

        {/* Overage breakdown — only if applicable */}
        {hasOverage && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Monthly overage charges</p>
            {extraBuses > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">{extraBuses} extra bus{extraBuses > 1 ? 'es' : ''}</span>
                <span className="font-semibold text-slate-800">K{(extraBuses * plan.extraBusFee).toLocaleString()}</span>
              </div>
            )}
            {extraStations > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">{extraStations} extra station{extraStations > 1 ? 's' : ''}</span>
                <span className="font-semibold text-slate-800">K{(extraStations * plan.extraStationFee).toLocaleString()}</span>
              </div>
            )}
            {extraStaff > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">{extraStaff} extra staff</span>
                <span className="font-semibold text-slate-800">K{(extraStaff * plan.extraStaffFee).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-bold text-amber-800 border-t border-amber-200 pt-1">
              <span>Total overage</span>
              <span>K{monthlyOverage.toLocaleString()}/mo</span>
            </div>
          </div>
        )}

        {/* Commission & service charge */}
        <div className="space-y-1 border-t border-slate-100 pt-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Commissions & Charges</p>
          {[
            { icon: Smartphone, label: 'Online commission',   value: fmtPct(plan.onlineCommissionRate) },
            { icon: Ticket,     label: 'Walk-in commission',  value: fmtPct(plan.walkinCommissionRate) },
            { icon: Building2,  label: 'Passenger svc charge',value: fmtPct(plan.onlineServiceChargeRate) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-slate-600"><Icon className="w-3 h-3 text-slate-400" />{label}</span>
              <span className="font-semibold text-slate-800">{value}</span>
            </div>
          ))}
        </div>

        {/* Setup cost — first-time subscribers only */}
        {isFirstTime && (
          <div className="border-t border-slate-100 pt-2">
            <button
              onClick={() => setShowSetup(v => !v)}
              className="flex items-center justify-between w-full text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              <span>One-time setup: <span className="text-slate-800">K{setupCost.toLocaleString()}</span></span>
              {showSetup ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showSetup && (
              <div className="mt-2 bg-slate-50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs"><span className="text-slate-500">Base fee</span><span className="font-semibold">K{plan.setupBaseFee.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">{counts.stations}× station{counts.stations !== 1 ? 's' : ''}</span><span className="font-semibold">K{(counts.stations * plan.setupPerStation).toLocaleString()}</span></div>
                {!plan.unlimitedStaff
                  ? <div className="flex justify-between text-xs"><span className="text-slate-500">{counts.staff}× staff</span><span className="font-semibold">K{(counts.staff * plan.setupPerStaff).toLocaleString()}</span></div>
                  : <div className="flex justify-between text-xs"><span className="text-slate-500">Staff (unlimited)</span><span className="font-semibold text-green-600">Free</span></div>
                }
                <div className="flex justify-between text-xs"><span className="text-slate-500">{counts.buses}× bus{counts.buses !== 1 ? 'es' : ''}</span><span className="font-semibold">K{(counts.buses * plan.setupPerBus).toLocaleString()}</span></div>
                <div className="flex justify-between text-xs border-t border-slate-200 pt-1"><span className="text-slate-500">Training</span><span className="font-semibold">K{plan.setupTrainingFee.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs font-bold text-slate-800 border-t border-slate-200 pt-1"><span>Total setup</span><span>K{setupCost.toLocaleString()}</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="p-4 pt-0">
        <Button
          onClick={() => !isCurrent && onSubscribe()}
          disabled={isCurrent || isPending}
          className={`w-full font-semibold text-sm ${
            isCurrent
              ? 'bg-green-100 text-green-700 cursor-default'
              : `bg-gradient-to-r ${meta.gradient} text-white hover:opacity-90`
          }`}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
           isCurrent ? <><CheckCircle2 className="w-4 h-4 mr-1" />Current Plan</> :
           'Get started'}
        </Button>
      </div>
    </div>
  );
}

const Subscription: React.FC = () => {
  const { data: active, isLoading: loadingActive, refetch: refetchActive } = useMyActiveSubscription();
  const { data: plans = [], isLoading: loadingPlans } = useAvailableSubscriptionPlans();
  const subscribe = useSubscribeCompany();
  const { refetch: refetchLatest } = useMyLatestSubscription();
  const qc = useQueryClient();

  const [billingCycle, setBillingCycle]     = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan]     = useState<string | null>(null);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);
  const [polling, setPolling]               = useState(false);

  // Fleet size inputs — shared across all plan cards
  const [buses,    setBuses]    = useState(5);
  const [stations, setStations] = useState(1);
  const [staff,    setStaff]    = useState(5);

  const counts: FleetCounts = { buses, stations, staff };
  const isFirstTime = !active;

  const annualSavingPct = useMemo(() => {
    if (!plans.length) return 17;
    const savings = plans.map(p => ((p.monthlyPrice * 12 - p.annualPrice) / (p.monthlyPrice * 12)) * 100);
    return Math.round(savings.reduce((a, b) => a + b, 0) / savings.length);
  }, [plans]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const result = await refetchLatest();
      if (result.data?.status === 'active') {
        setPolling(false);
        setPendingCheckoutUrl(null);
        qc.invalidateQueries({ queryKey: ['myActiveSubscription'] });
        toast.success('Subscription activated! Welcome to ' + result.data.plan);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [polling]);

  const handleSubscribe = async (plan: string) => {
    setSelectedPlan(plan);
    try {
      const result = await subscribe.mutateAsync({
        plan, billingCycle, autoRenew: true,
        actualBuses: buses, actualStations: stations, actualStaff: staff,
      });
      if (result.checkoutUrl) {
        setPendingCheckoutUrl(result.checkoutUrl);
        setPolling(true);
        window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer');
      } else {
        await refetchActive();
        toast.success('Subscription activated!');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start subscription');
    } finally {
      setSelectedPlan(null);
    }
  };

  if (loadingActive || loadingPlans) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const activePlanKey = active?.plan?.toLowerCase();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your company's plan. Pricing grows with your business.</p>
      </div>

      {/* Active subscription banner */}
      {active && (
        <div className={`rounded-2xl p-6 text-white bg-gradient-to-r ${PLAN_META[activePlanKey ?? '']?.gradient ?? 'from-blue-600 to-blue-800'}`}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">Active Plan</div>
              <div className="text-3xl font-bold capitalize">{active.plan}</div>
              <div className="text-sm opacity-80 mt-1 capitalize">{active.billingCycle} billing</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">K{Number(active.amount).toLocaleString()}</div>
              <div className="text-xs opacity-75">per {active.billingCycle === 'monthly' ? 'month' : 'year'}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><span className="opacity-70">Started</span><div className="font-semibold">{fmtDate(active.startsAt)}</div></div>
            <div><span className="opacity-70">Renews / Expires</span><div className="font-semibold">{fmtDate(active.endsAt)}</div></div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
              active.status === 'active' ? 'bg-white/20' : 'bg-red-400/30'
            }`}>
              <CheckCircle2 className="w-3 h-3" />
              {active.status.replace('_', ' ').toUpperCase()}
            </span>
            {active.autoRenew && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-white/10">
                <RefreshCw className="w-3 h-3" /> Auto-renew on
              </span>
            )}
          </div>
        </div>
      )}

      {/* Checkout waiting state */}
      {pendingCheckoutUrl && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            <span className="font-semibold text-amber-900">Waiting for payment confirmation…</span>
          </div>
          <p className="text-sm text-amber-700">Your payment page was opened in a new tab. This page updates automatically once payment is complete.</p>
          <div className="flex gap-3 items-center">
            <a href={pendingCheckoutUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 hover:underline">
              <ExternalLink className="w-4 h-4" /> Open payment page again
            </a>
            <button onClick={() => { setPolling(false); setPendingCheckoutUrl(null); }}
              className="text-sm text-slate-500 hover:text-slate-700 ml-auto">Cancel</button>
          </div>
        </div>
      )}

      {/* Controls row */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            {active ? 'Upgrade or change plan' : 'Choose a plan'}
          </h2>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {([
              { key: 'monthly',  label: 'Monthly' },
              { key: 'annually', label: `Annual (save ~${annualSavingPct}%)` },
            ] as { key: BillingCycle; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setBillingCycle(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  billingCycle === key ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Fleet size inputs — affects overage + setup cost on all cards */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
            {isFirstTime ? 'Enter your fleet size — pricing updates instantly' : 'Adjust fleet size to see new plan costs'}
          </p>
          <div className="grid grid-cols-3 gap-4">
            {([
              { label: 'Buses',    icon: Bus,    value: buses,    set: setBuses,    min: 1 },
              { label: 'Stations', icon: MapPin, value: stations, set: setStations, min: 1 },
              { label: 'Staff',    icon: Users,  value: staff,    set: setStaff,    min: 1 },
            ] as const).map(({ label, icon: Icon, value, set, min }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-1">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </label>
                <input
                  type="number" min={min} value={value}
                  onChange={e => set(Math.max(min, Number(e.target.value)))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Numbers above each plan's limit are billed as monthly overage. {isFirstTime && 'Setup cost is a one-time onboarding fee.'}
          </p>
        </div>
      </div>

      {/* Plan cards */}
      {plans.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No plans available right now.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <PlanCard
              key={plan.plan}
              plan={plan}
              billingCycle={billingCycle}
              counts={counts}
              isCurrent={activePlanKey === plan.plan.toLowerCase()}
              isFirstTime={isFirstTime}
              onSubscribe={() => handleSubscribe(plan.plan)}
              isPending={selectedPlan === plan.plan && subscribe.isPending}
            />
          ))}
        </div>
      )}

      {/* FAQ */}
      <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" /> Billing & FAQ
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
          {[
            { q: 'What counts as an "extra" bus or station?',
              a: 'If your active fleet or station count exceeds your plan\'s included quota, the overage units are billed at the per-unit monthly rate shown on each card.' },
            { q: 'What is the passenger service charge?',
              a: 'This is added to online ticket prices paid by the passenger. The bus company receives only the base fare — the platform earns the service charge.' },
            { q: 'What is online vs. walk-in commission?',
              a: 'Online bookings attract a higher commission because the platform drives those sales digitally. Walk-in (POS) tickets carry a lower rate since the customer visited the station directly.' },
            { q: 'Can I switch plans at any time?',
              a: 'Yes — switching takes effect immediately. You are credited for unused time on your current plan and your fleet size is re-evaluated against the new plan\'s quotas.' },
            { q: 'What does the one-time setup fee cover?',
              a: 'System configuration, data migration, staff training, and go-live support. It is charged once at onboarding and scales with the number of stations, staff, and buses you register.' },
            { q: 'How is my first bill calculated?',
              a: 'First month = base plan price + any monthly overage for fleet above your plan\'s limit + the one-time setup fee (first-time only).' },
          ].map(({ q, a }) => (
            <div key={q}>
              <div className="font-semibold text-slate-800">{q}</div>
              <div className="text-slate-500 mt-0.5">{a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Subscription;
