import React, { useState } from 'react';
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp, PartyPopper, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOnboardingStatus } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OnboardingStepKey =
  | 'account_created'
  | 'email_verified'
  | 'logo_added'
  | 'bus_added'
  | 'employee_added'
  | 'trip_created'
  | 'subscribed';

interface StepDef {
  key: OnboardingStepKey;
  label: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

const STEPS: StepDef[] = [
  {
    key: 'account_created',
    label: 'Account created',
    description: 'Your company account is set up and ready.',
  },
  {
    key: 'email_verified',
    label: 'Verify email address',
    description: 'Confirm your email to secure your account.',
    actionLabel: 'Resend verification',
    actionHref: '/company/settings?action=resend_verification',
  },
  {
    key: 'logo_added',
    label: 'Add company logo',
    description: 'Upload a logo so passengers recognise your brand.',
    actionLabel: 'Go to settings',
    actionHref: '/company/settings',
  },
  {
    key: 'bus_added',
    label: 'Add at least one bus',
    description: 'Register your fleet before creating trips.',
    actionLabel: 'Add a bus',
    actionHref: '/company/buses/new',
  },
  {
    key: 'employee_added',
    label: 'Add a driver or employee',
    description: 'Staff your trips with drivers and conductors.',
    actionLabel: 'Add employee',
    actionHref: '/company/employees/new',
  },
  {
    key: 'trip_created',
    label: 'Create your first trip',
    description: 'Schedule a route and start selling tickets.',
    actionLabel: 'Create trip',
    actionHref: '/company/trips/new',
  },
  {
    key: 'subscribed',
    label: 'Subscribe to a plan',
    description: 'Choose a subscription plan to unlock all features.',
    actionLabel: 'View plans',
    actionHref: '/company/billing',
  },
];

const DISMISS_KEY = 'onboarding_dismissed';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Override completed steps (useful when the backend query is unavailable). */
  completedSteps?: OnboardingStepKey[];
}

const OnboardingChecklist: React.FC<Props> = ({ completedSteps: completedStepsProp }) => {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [collapsed, setCollapsed] = useState(false);

  // Fetch from backend; fall back gracefully on error.
  const { data: statusData, isError } = useOnboardingStatus();

  // Resolve which steps are done, merging backend data with prop override.
  const resolvedCompleted: OnboardingStepKey[] = React.useMemo(() => {
    if (completedStepsProp) return completedStepsProp;
    if (!statusData || isError) return ['account_created'];
    const done: OnboardingStepKey[] = [];
    if (statusData.accountCreated)  done.push('account_created');
    if (statusData.emailVerified)   done.push('email_verified');
    if (statusData.logoAdded)       done.push('logo_added');
    if (statusData.busAdded)        done.push('bus_added');
    if (statusData.employeeAdded)   done.push('employee_added');
    if (statusData.tripCreated)     done.push('trip_created');
    if (statusData.subscribed)      done.push('subscribed');
    return done;
  }, [completedStepsProp, statusData, isError]);

  const completedSet = new Set(resolvedCompleted);
  const doneCount = resolvedCompleted.length;
  const totalCount = STEPS.length;
  const allDone = doneCount === totalCount;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  if (dismissed) return null;

  // ── All done: congratulations banner ──────────────────────────────────────
  if (allDone) {
    return (
      <div className="relative bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl px-6 py-5 flex items-center gap-4 shadow-sm">
        <PartyPopper className="w-8 h-8 text-green-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-green-800 text-sm">You're all set!</div>
          <div className="text-green-700 text-xs mt-0.5">
            Your company profile is complete. Everything is ready to go.
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg hover:bg-green-100 text-green-500 transition"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ── Checklist ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-blue-100 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm">Complete your company setup</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {doneCount} of {totalCount} steps complete
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-32 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-blue-600">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-4 shrink-0">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
            aria-label="Dismiss checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steps list */}
      {!collapsed && (
        <ul className="divide-y divide-slate-50">
          {STEPS.map((step) => {
            const done = completedSet.has(step.key);
            return (
              <li
                key={step.key}
                className={`flex items-center gap-4 px-5 py-3.5 transition ${done ? 'opacity-60' : 'hover:bg-slate-50'}`}
              >
                {/* Icon */}
                <div className="shrink-0">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {step.label}
                  </div>
                  {!done && (
                    <div className="text-xs text-slate-400 mt-0.5">{step.description}</div>
                  )}
                </div>

                {/* Action link */}
                {!done && step.actionHref && (
                  <Link
                    to={step.actionHref}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {step.actionLabel}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default OnboardingChecklist;
