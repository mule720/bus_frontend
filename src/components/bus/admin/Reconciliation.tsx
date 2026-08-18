/**
 * Reconciliation.tsx — Cash reconciliation panel.
 *
 * Flow: Staff submit cash → Finance collects from staff → Deposits to company → Approved
 *
 * Tabs:
 *   Overview   — pipeline view + aggregate totals
 *   Sellers    — station sellers grouped by person (shift → collect → deposit → approve)
 *   Conductors — conductors grouped by person, each trip listed under them
 *   Expenses   — trip expenses (approve pending)
 */

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, AlertTriangle, Clock,
  RefreshCw, ChevronDown, ChevronUp,
  Check, Bus, Receipt, LayoutGrid, Calendar,
  Upload, ImageIcon, User, ArrowRight, MapPin, Flag,
  Wallet, TrendingUp, Plus, Building2, ShieldAlert, X,
} from 'lucide-react';
import { getToken } from '@/lib/graphql';
import { useMyPermissions } from '@/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

function todayIso() { return new Date().toISOString().split('T')[0]; }

function fmtK(n: number | null | undefined) {
  if (n == null) return '—';
  return `K ${Number(n).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  collected: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  deposited: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  flagged:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const EXPENSE_LABELS: Record<string, string> = {
  toll: 'Toll Gate', fuel: 'Fuel', repair: 'Roadside Repair', food: 'Crew Food', other: 'Other',
};

// ── GraphQL ───────────────────────────────────────────────────────────────────

const SUMMARY_QUERY = `
  query ReconciliationSummary($dateFrom: String, $dateTo: String) {
    companyReconciliationSummary(dateFrom: $dateFrom, dateTo: $dateTo) {
      dateFrom dateTo stationName
      shiftCountPending shiftCountSubmitted shiftCountCollected shiftCountApproved
      shiftExpectedTotal shiftDeclaredTotal shiftDiscrepancy
      tripCountPending tripCountSubmitted tripCountApproved
      tripExpectedTotal tripDeclaredTotal tripDiscrepancy
      expenseTotal expenseApproved expensePending
      shifts {
        id shiftDate status expectedCash declaredCash discrepancy notes
        submittedAt collectedAt depositedAt approvedAt
        sellerName stationName collectedByName collectionNotes receiptImage depositReceipt
      }
      trips {
        id tripId travelDate routeFrom routeTo departureTime status
        expectedCash declaredCash discrepancy grossSales expenseDeducted driverName notes
        submittedAt depositedAt approvedAt conductorName receiptImage depositReceipt
      }
      expenses {
        id tripRunId travelDate routeFrom routeTo expenseType amount description
        approved loggedByName createdAt receiptImage
      }
    }
  }
`;

const COLLECT_SHIFT = `
  mutation CollectShift($id: ID!, $notes: String) {
    collectShiftCash(reconciliationId: $id, collectionNotes: $notes) { ok message }
  }
`;

const APPROVE_RECON = `
  mutation ApproveRecon($id: ID!, $type: String!) {
    approveReconciliation(reconciliationId: $id, reconType: $type) { ok message }
  }
`;

const DEPOSIT_RECON = `
  mutation DepositRecon($id: ID!, $type: String!, $receipt: String) {
    depositReconciliation(reconciliationId: $id, reconType: $type, depositReceiptBase64: $receipt) { ok message }
  }
`;

const APPROVE_EXPENSE = `
  mutation ApproveExpense($id: ID!) {
    approveTripExpense(expenseId: $id) { ok message }
  }
`;

// ── Seller / conductor self-service queries ───────────────────────────────────

const MY_SHIFT_QUERY = `
  query MyShift($date: String) {
    myShiftReconciliation(date: $date) {
      id shiftDate status expectedCash declaredCash discrepancy notes
      submittedAt collectedAt depositedAt approvedAt stationName
    }
  }
`;

const MY_PENDING_TRIP_RUNS_QUERY = `
  query MyPendingTripRuns {
    myPendingTripRuns {
      id tripRunId tripId travelDate routeFrom routeTo departureTime status
      expectedCash declaredCash discrepancy grossSales expenseDeducted
      submittedAt conductorName
    }
  }
`;

const MY_TRIP_RECON_QUERY = `
  query MyTripRecon($tripRunId: ID!) {
    myTripReconciliation(tripRunId: $tripRunId) {
      id status expectedCash declaredCash discrepancy grossSales expenseDeducted
      submittedAt conductorName
    }
  }
`;

const SUBMIT_SHIFT = `
  mutation SubmitShift($declaredCash: Float!, $notes: String, $receipt: String) {
    submitShiftReconciliation(declaredCash: $declaredCash, notes: $notes, receiptBase64: $receipt) {
      ok message reconciliation { id status declaredCash }
    }
  }
`;

const SUBMIT_TRIP = `
  mutation SubmitTrip($tripRunId: ID!, $declaredCash: Float!, $notes: String) {
    submitTripReconciliation(tripRunId: $tripRunId, declaredCash: $declaredCash, notes: $notes) {
      ok message reconciliation { id status declaredCash }
    }
  }
`;

const LOG_EXPENSE = `
  mutation LogExpense($tripRunId: ID!, $expenseType: String!, $amount: Float!, $description: String) {
    logTripExpense(tripRunId: $tripRunId, expenseType: $expenseType, amount: $amount, description: $description) {
      ok expense { id expenseType amount description approved }
    }
  }
`;

const LOG_STATION_EXPENSE = `
  mutation LogStationExpense($expenseType: String!, $amount: Float!, $description: String, $expenseDate: String, $recipientId: ID) {
    logStationExpense(expenseType: $expenseType, amount: $amount, description: $description, expenseDate: $expenseDate, recipientId: $recipientId) {
      ok message expense { id expenseType amount description expenseDate status recipientName recipientConfirmed createdAt }
    }
  }
`;

const CONFIRM_RECEIPT = `
  mutation ConfirmReceipt($id: ID!) {
    confirmStationExpenseReceipt(expenseId: $id) { ok message }
  }
`;

const APPROVE_STATION_EXPENSE = `
  mutation ApproveStationExpense($id: ID!) {
    approveStationExpense(expenseId: $id) { ok message }
  }
`;

const REJECT_STATION_EXPENSE = `
  mutation RejectStationExpense($id: ID!, $reason: String!) {
    rejectStationExpense(expenseId: $id, reason: $reason) { ok message }
  }
`;

const SUBMIT_SUPPLEMENT = `
  mutation SubmitSupplement($shiftId: ID!, $amount: Float!, $notes: String) {
    submitShiftSupplement(shiftReconciliationId: $shiftId, amount: $amount, notes: $notes) {
      ok message supplement { id amount notes status createdAt }
    }
  }
`;

const COLLECT_SUPPLEMENT = `
  mutation CollectSupplement($id: ID!) {
    collectShiftSupplement(supplementId: $id) { ok message }
  }
`;

const APPROVE_SUPPLEMENT = `
  mutation ApproveSupplement($id: ID!) {
    approveShiftSupplement(supplementId: $id) { ok message }
  }
`;

const LOG_SHIFT_EXPENSE = `
  mutation LogShiftExpense($shiftId: ID!, $expenseType: String!, $amount: Float!, $description: String, $receipt: String) {
    logShiftExpense(shiftReconciliationId: $shiftId, expenseType: $expenseType, amount: $amount, description: $description, receiptImage: $receipt) {
      ok message expense { id expenseType amount status createdAt }
    }
  }
`;

const APPROVE_SHIFT_EXPENSE = `
  mutation ApproveShiftExpense($id: ID!) {
    approveShiftExpense(expenseId: $id) { ok message }
  }
`;

const REJECT_SHIFT_EXPENSE = `
  mutation RejectShiftExpense($id: ID!, $reason: String!) {
    rejectShiftExpense(expenseId: $id, reason: $reason) { ok message }
  }
`;

const SHIFT_EXPENSE_FIELDS = `
  id shiftId shiftDate loggedByName expenseType amount description expenseDate receiptImage status rejectionReason approvedAt createdAt
`;

const ADMIN_OVERRIDE = `
  mutation AdminOverride($id: ID!, $type: String!, $newStatus: String!, $reason: String!) {
    adminOverrideReconciliation(reconciliationId: $id, reconType: $type, newStatus: $newStatus, reason: $reason) { ok message }
  }
`;

const MY_PENDING_RECEIPTS_QUERY = `
  query {
    myPendingReceipts {
      id expenseType amount description expenseDate stationName loggedByName
      recipientConfirmed createdAt
    }
  }
`;

const MY_SUPPLEMENTS_QUERY = `
  query {
    myShiftSupplements { id shiftDate amount notes status collectedAt approvedAt createdAt }
  }
`;

const PENDING_STATION_EXPENSES_QUERY = `
  query {
    pendingStationExpenses {
      id expenseType amount description expenseDate status stationName loggedByName
      recipientName recipientConfirmed recipientConfirmedAt createdAt
    }
  }
`;

const PENDING_SUPPLEMENTS_QUERY = `
  query {
    pendingShiftSupplements { id shiftDate amount notes status sellerName collectedByName collectedAt createdAt }
  }
`;

const STATION_SUPPLEMENTS_QUERY = `
  query {
    stationPendingSupplements { id shiftDate amount notes status collectedAt createdAt }
  }
`;

const MY_STATION_EXPENSES_QUERY = `
  query {
    myStationExpenses {
      id expenseType amount description expenseDate status recipientName recipientConfirmed approvedAt rejectionReason createdAt
    }
  }
`;

// ── API hooks ─────────────────────────────────────────────────────────────────

async function gqlFetch(query: string, variables?: object) {
  const token = getToken();
  const res = await fetch('http://127.0.0.1:8002/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function useReconciliationSummary(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['reconciliation-summary', dateFrom, dateTo],
    queryFn: async () => {
      const data = await gqlFetch(SUMMARY_QUERY, { dateFrom, dateTo });
      return data.companyReconciliationSummary;
    },
    staleTime: 30_000,
  });
}

function useCollectShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      gqlFetch(COLLECT_SHIFT, { id, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-summary'] }),
  });
}

function useApproveRecon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      gqlFetch(APPROVE_RECON, { id, type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-summary'] }),
  });
}

function useDepositRecon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, receipt }: { id: string; type: string; receipt?: string }) =>
      gqlFetch(DEPOSIT_RECON, { id, type, receipt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-summary'] }),
  });
}

function useApproveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gqlFetch(APPROVE_EXPENSE, { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-summary'] }),
  });
}

function useMyShift(date: string) {
  return useQuery({
    queryKey: ['my-shift', date],
    queryFn: async () => {
      const d = await gqlFetch(MY_SHIFT_QUERY, { date });
      return d.myShiftReconciliation as any | null;
    },
    staleTime: 15_000,
  });
}

function useMyOpenShifts() {
  return useQuery({
    queryKey: ['my-open-shifts'],
    queryFn: async () => {
      const d = await gqlFetch(`{ myOpenShifts { id shiftDate status expectedCash declaredCash discrepancy notes stationName } }`);
      return (d.myOpenShifts ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function useMyPendingTripRuns() {
  return useQuery({
    queryKey: ['my-pending-trip-runs'],
    queryFn: async () => {
      const d = await gqlFetch(MY_PENDING_TRIP_RUNS_QUERY);
      return (d.myPendingTripRuns ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function useMyTripRecon(tripRunId: string | null) {
  return useQuery({
    queryKey: ['my-trip-recon', tripRunId],
    queryFn: async () => {
      const d = await gqlFetch(MY_TRIP_RECON_QUERY, { tripRunId });
      return d.myTripReconciliation as any | null;
    },
    enabled: !!tripRunId,
    staleTime: 10_000,
  });
}

function useSubmitShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { declaredCash: number; notes?: string; receipt?: string }) =>
      gqlFetch(SUBMIT_SHIFT, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-shift'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-summary'] });
    },
  });
}

function useSubmitTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tripRunId: string; declaredCash: number; notes?: string }) =>
      gqlFetch(SUBMIT_TRIP, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-pending-trip-runs'] });
      qc.invalidateQueries({ queryKey: ['my-trip-recon'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-summary'] });
    },
  });
}

function useLogExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tripRunId: string; expenseType: string; amount: number; description?: string }) =>
      gqlFetch(LOG_EXPENSE, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-trip-recon'] }),
  });
}

function useLogStationExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { expenseType: string; amount: number; description?: string; expenseDate?: string; recipientId?: string }) =>
      gqlFetch(LOG_STATION_EXPENSE, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-station-expenses'] });
      qc.invalidateQueries({ queryKey: ['pending-station-expenses'] });
    },
  });
}

function useConfirmReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gqlFetch(CONFIRM_RECEIPT, { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-pending-receipts'] }),
  });
}

function useApproveStationExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gqlFetch(APPROVE_STATION_EXPENSE, { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-station-expenses'] }),
  });
}

function useRejectStationExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => gqlFetch(REJECT_STATION_EXPENSE, { id, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-station-expenses'] }),
  });
}

function useSubmitSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { shiftId: string; amount: number; notes?: string }) => gqlFetch(SUBMIT_SUPPLEMENT, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-shift'] });
      qc.invalidateQueries({ queryKey: ['my-supplements'] });
    },
  });
}

function useCollectSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gqlFetch(COLLECT_SUPPLEMENT, { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['station-supplements'] }),
  });
}

function useApproveSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gqlFetch(APPROVE_SUPPLEMENT, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-supplements'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-summary'] });
    },
  });
}

function useAdminOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; type: string; newStatus: string; reason: string }) => gqlFetch(ADMIN_OVERRIDE, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-summary'] }),
  });
}

function useMyPendingReceipts() {
  return useQuery({
    queryKey: ['my-pending-receipts'],
    queryFn: async () => {
      const d = await gqlFetch(MY_PENDING_RECEIPTS_QUERY);
      return (d.myPendingReceipts ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function useMySupplements() {
  return useQuery({
    queryKey: ['my-supplements'],
    queryFn: async () => {
      const d = await gqlFetch(MY_SUPPLEMENTS_QUERY);
      return (d.myShiftSupplements ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function usePendingStationExpenses() {
  return useQuery({
    queryKey: ['pending-station-expenses'],
    queryFn: async () => {
      const d = await gqlFetch(PENDING_STATION_EXPENSES_QUERY);
      return (d.pendingStationExpenses ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function usePendingSupplements() {
  return useQuery({
    queryKey: ['pending-supplements'],
    queryFn: async () => {
      const d = await gqlFetch(PENDING_SUPPLEMENTS_QUERY);
      return (d.pendingShiftSupplements ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function useStationSupplements() {
  return useQuery({
    queryKey: ['station-supplements'],
    queryFn: async () => {
      const d = await gqlFetch(STATION_SUPPLEMENTS_QUERY);
      return (d.stationPendingSupplements ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function useMyStationExpenses() {
  return useQuery({
    queryKey: ['my-station-expenses'],
    queryFn: async () => {
      const d = await gqlFetch(MY_STATION_EXPENSES_QUERY);
      return (d.myStationExpenses ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function useLogShiftExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { shiftId: string; expenseType: string; amount: number; description?: string; receipt?: string }) =>
      gqlFetch(LOG_SHIFT_EXPENSE, { shiftId: v.shiftId, expenseType: v.expenseType, amount: v.amount, description: v.description, receipt: v.receipt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-shift-expenses'] }),
  });
}

function useApproveShiftExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gqlFetch(APPROVE_SHIFT_EXPENSE, { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-shift-expenses'] }); qc.invalidateQueries({ queryKey: ['recon-summary'] }); },
  });
}

function useRejectShiftExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => gqlFetch(REJECT_SHIFT_EXPENSE, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-shift-expenses'] }),
  });
}

function useMyShiftExpenses(shiftId?: string) {
  return useQuery({
    queryKey: ['my-shift-expenses', shiftId],
    queryFn: async () => {
      const d = await gqlFetch(`query MyShiftExpenses($shiftId: ID) { myShiftExpenses(shiftId: $shiftId) { ${SHIFT_EXPENSE_FIELDS} } }`, { shiftId });
      return (d.myShiftExpenses ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function usePendingShiftExpenses() {
  return useQuery({
    queryKey: ['pending-shift-expenses'],
    queryFn: async () => {
      const d = await gqlFetch(`{ pendingShiftExpenses { ${SHIFT_EXPENSE_FIELDS} } }`);
      return (d.pendingShiftExpenses ?? []) as any[];
    },
    staleTime: 15_000,
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'stations' | 'conductors' | 'expenses' | 'problems';

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function PipelineStep({ label, count, active, done }: { label: string; count: number; active?: boolean; done?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${
      done ? 'bg-emerald-50 dark:bg-emerald-900/20' :
      active ? 'bg-amber-50 dark:bg-amber-900/20' :
      'bg-slate-50 dark:bg-slate-700/40'
    }`}>
      <span className={`text-xl font-extrabold tabular-nums ${
        done ? 'text-emerald-600' : active ? 'text-amber-600' : 'text-slate-400'
      }`}>{count}</span>
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${
        done ? 'text-emerald-500' : active ? 'text-amber-500' : 'text-slate-400'
      }`}>{label}</span>
    </div>
  );
}

function ReceiptThumb({ label, url }: { label: string; url: string }) {
  const fullUrl = url.startsWith('http') ? url : `http://127.0.0.1:8002${url}`;
  return (
    <a href={fullUrl} target="_blank" rel="noreferrer" className="group flex flex-col items-center gap-1">
      <div className="w-20 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 group-hover:ring-2 group-hover:ring-blue-500 transition">
        <img src={fullUrl} alt={label} className="w-full h-full object-cover" />
      </div>
      <span className="text-[10px] text-slate-500 group-hover:text-blue-600">{label}</span>
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
      <CheckCircle size={40} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function Detail({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className={cls}>
      <div className="text-slate-400 font-medium mb-0.5">{label}</div>
      <div className="text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

// ── Sellers tab — grouped by person ──────────────────────────────────────────

function SellersTab({ data, collectShift, depositRecon, approveRecon }: {
  data: any;
  collectShift: ReturnType<typeof useCollectShift>;
  depositRecon: ReturnType<typeof useDepositRecon>;
  approveRecon: ReturnType<typeof useApproveRecon>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const depositFileRef = useRef<HTMLInputElement>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ id: string } | null>(null);

  // Group shifts by seller name
  const byStaff = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of data.shifts) {
      if (!map[s.sellerName]) map[s.sellerName] = [];
      map[s.sellerName].push(s);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [data.shifts]);

  async function handleDepositFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingDeposit) return;
    const b64 = await fileToBase64(file);
    depositRecon.mutate({ id: pendingDeposit.id, type: 'shift', receipt: b64 });
    setPendingDeposit(null);
    e.target.value = '';
  }

  function triggerDeposit(id: string) {
    setPendingDeposit({ id });
    depositFileRef.current?.click();
  }

  if (data.shifts.length === 0) return <EmptyState label="No seller shift submissions in this period." />;

  return (
    <div className="space-y-3">
      <input ref={depositFileRef} type="file" accept="image/*" className="hidden" onChange={handleDepositFile} />

      {byStaff.map(([sellerName, shifts]) => {
        const totalDeclared = shifts.reduce((s: number, r: any) => s + (r.declaredCash ?? 0), 0);
        const totalExpected = shifts.reduce((s: number, r: any) => s + (r.expectedCash ?? 0), 0);
        const anyPending   = shifts.some((r: any) => ['pending', 'submitted', 'collected', 'deposited'].includes(r.status));
        const allApproved  = shifts.every((r: any) => r.status === 'approved');
        const station      = shifts[0]?.stationName ?? '—';
        const isOpen       = expanded === sellerName;

        return (
          <div key={sellerName} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Staff header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              onClick={() => setExpanded(isOpen ? null : sellerName)}
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <User size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-sm">{sellerName}</div>
                <div className="text-xs text-slate-500 mt-0.5">{station} · {shifts.length} shift{shifts.length !== 1 ? 's' : ''}</div>
              </div>
              {/* Mini pipeline for this seller */}
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                {(['submitted','collected','deposited','approved'] as const).map((st, i) => {
                  const n = shifts.filter((r: any) => r.status === st).length;
                  return n > 0 ? (
                    <span key={st} className={`px-1.5 py-0.5 rounded-full ${STATUS_COLORS[st]}`}>{n} {st}</span>
                  ) : null;
                })}
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtK(totalDeclared)}</div>
                <div className="text-[10px] text-slate-400">declared</div>
              </div>
              {allApproved
                ? <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                : anyPending
                ? <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                : <CheckCircle size={16} className="text-slate-200 dark:text-slate-600 shrink-0" />}
              {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            </button>

            {/* Shifts for this seller */}
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700/50">
                {shifts.map((r: any) => (
                  <ShiftRow
                    key={r.id}
                    shift={r}
                    onCollect={() => collectShift.mutate({ id: r.id })}
                    onDeposit={() => triggerDeposit(r.id)}
                    onApprove={() => approveRecon.mutate({ id: r.id, type: 'shift' })}
                    collectPending={collectShift.isPending}
                    depositPending={depositRecon.isPending}
                  />
                ))}
                {/* Seller subtotal */}
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Seller total</span>
                  <div className="flex items-center gap-4 text-xs tabular-nums">
                    <span className="text-slate-500">Expected <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalExpected)}</span></span>
                    <span className="text-slate-500">Declared <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalDeclared)}</span></span>
                    {Math.abs(totalExpected - totalDeclared) > 0.01
                      ? <span className="text-red-600 font-bold">Gap {fmtK(Math.abs(totalExpected - totalDeclared))}</span>
                      : <span className="text-emerald-600 font-bold">✓ Balanced</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShiftRow({ shift: r, onCollect, onDeposit, onApprove, collectPending, depositPending }: {
  shift: any;
  onCollect: () => void;
  onDeposit: () => void;
  onApprove: () => void;
  collectPending: boolean;
  depositPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const gap = r.discrepancy ?? 0;
  const ok  = Math.abs(gap) < 0.01;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        {/* Date + status */}
        <div className="w-24 shrink-0">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{r.shiftDate}</div>
          <StatusBadge status={r.status} />
        </div>

        {/* Amounts */}
        <div className="flex-1 flex items-center gap-4 text-xs tabular-nums">
          <span className="text-slate-500">Expected <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtK(r.expectedCash)}</span></span>
          <span className="text-slate-500">Declared <span className="font-semibold text-slate-800 dark:text-slate-200">{r.declaredCash != null ? fmtK(r.declaredCash) : '—'}</span></span>
          {r.declaredCash != null && (
            ok
              ? <span className="text-emerald-600 font-bold">✓</span>
              : <span className={`font-bold ${gap > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {gap > 0 ? '−' : '+'}{fmtK(Math.abs(gap))}
                </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Step 1: Collect from staff */}
          {r.status === 'submitted' && (
            <button
              onClick={e => { e.stopPropagation(); onCollect(); }}
              disabled={collectPending}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold hover:bg-blue-200 disabled:opacity-50"
              title="Mark as physically collected from staff"
            >
              <Check size={12} /> Collect
            </button>
          )}
          {/* Step 2: Deposit to company */}
          {(r.status === 'collected' || r.status === 'submitted') && r.status !== 'pending' && (
            <button
              onClick={e => { e.stopPropagation(); onDeposit(); }}
              disabled={depositPending}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-semibold hover:bg-violet-200 disabled:opacity-50"
              title="Attach bank deposit slip"
            >
              <Upload size={12} /> Deposit
            </button>
          )}
          {/* Step 3: Approve */}
          {r.status === 'deposited' && (
            <button
              onClick={e => { e.stopPropagation(); onApprove(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-200"
            >
              <Check size={12} /> Approve
            </button>
          )}
          {open ? <ChevronUp size={14} className="text-slate-400 ml-1" /> : <ChevronDown size={14} className="text-slate-400 ml-1" />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
            <Detail label="Submitted at" value={fmtDate(r.submittedAt)} />
            <Detail label="Collected by" value={r.collectedByName ?? '—'} />
            <Detail label="Collected at" value={fmtDate(r.collectedAt)} />
            <Detail label="Deposited at" value={fmtDate(r.depositedAt)} />
            {r.notes && <Detail label="Seller notes" value={r.notes} cls="col-span-2" />}
            {r.collectionNotes && <Detail label="Collector notes" value={r.collectionNotes} cls="col-span-2" />}
          </div>
          {(r.receiptImage || r.depositReceipt) && (
            <div className="flex gap-3">
              {r.receiptImage && <ReceiptThumb label="Cash count sheet" url={r.receiptImage} />}
              {r.depositReceipt && <ReceiptThumb label="Bank deposit slip" url={r.depositReceipt} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Conductors tab — grouped by person ───────────────────────────────────────

function ConductorsTab({ data, depositRecon, approveRecon }: {
  data: any;
  depositRecon: ReturnType<typeof useDepositRecon>;
  approveRecon: ReturnType<typeof useApproveRecon>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const depositFileRef = useRef<HTMLInputElement>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ id: string } | null>(null);

  // Group trips by conductor name
  const byStaff = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of data.trips) {
      if (!map[t.conductorName]) map[t.conductorName] = [];
      map[t.conductorName].push(t);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [data.trips]);

  async function handleDepositFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingDeposit) return;
    const b64 = await fileToBase64(file);
    depositRecon.mutate({ id: pendingDeposit.id, type: 'trip', receipt: b64 });
    setPendingDeposit(null);
    e.target.value = '';
  }

  function triggerDeposit(id: string) {
    setPendingDeposit({ id });
    depositFileRef.current?.click();
  }

  if (data.trips.length === 0) return <EmptyState label="No conductor trip submissions in this period." />;

  return (
    <div className="space-y-3">
      <input ref={depositFileRef} type="file" accept="image/*" className="hidden" onChange={handleDepositFile} />

      {byStaff.map(([conductorName, trips]) => {
        const totalDeclared = trips.reduce((s: number, r: any) => s + (r.declaredCash ?? 0), 0);
        const totalExpected = trips.reduce((s: number, r: any) => s + (r.expectedCash ?? 0), 0);
        const allApproved   = trips.every((r: any) => r.status === 'approved');
        const anyPending    = trips.some((r: any) => ['submitted', 'deposited'].includes(r.status));
        const isOpen        = expanded === conductorName;

        return (
          <div key={conductorName} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Conductor header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              onClick={() => setExpanded(isOpen ? null : conductorName)}
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <Bus size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-sm">{conductorName}</div>
                <div className="text-xs text-slate-500 mt-0.5">{trips.length} trip{trips.length !== 1 ? 's' : ''}</div>
              </div>
              {/* Status chips */}
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                {(['submitted','deposited','approved'] as const).map(st => {
                  const n = trips.filter((r: any) => r.status === st).length;
                  return n > 0 ? (
                    <span key={st} className={`px-1.5 py-0.5 rounded-full ${STATUS_COLORS[st]}`}>{n} {st}</span>
                  ) : null;
                })}
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtK(totalDeclared)}</div>
                <div className="text-[10px] text-slate-400">declared</div>
              </div>
              {allApproved
                ? <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                : anyPending
                ? <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                : <CheckCircle size={16} className="text-slate-200 dark:text-slate-600 shrink-0" />}
              {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            </button>

            {/* Trips for this conductor */}
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700/50">
                {trips.map((r: any) => (
                  <TripRow
                    key={r.id}
                    trip={r}
                    onDeposit={() => triggerDeposit(r.id)}
                    onApprove={() => approveRecon.mutate({ id: r.id, type: 'trip' })}
                    depositPending={depositRecon.isPending}
                  />
                ))}
                {/* Conductor subtotal */}
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Conductor total</span>
                  <div className="flex items-center gap-4 text-xs tabular-nums">
                    <span className="text-slate-500">Expected <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalExpected)}</span></span>
                    <span className="text-slate-500">Declared <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalDeclared)}</span></span>
                    {Math.abs(totalExpected - totalDeclared) > 0.01
                      ? <span className="text-red-600 font-bold">Gap {fmtK(Math.abs(totalExpected - totalDeclared))}</span>
                      : <span className="text-emerald-600 font-bold">✓ Balanced</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TripRow({ trip: r, onDeposit, onApprove, depositPending }: {
  trip: any;
  onDeposit: () => void;
  onApprove: () => void;
  depositPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const gap = r.discrepancy ?? 0;
  const ok  = Math.abs(gap) < 0.01;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        {/* Route + date */}
        <div className="w-44 shrink-0">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{r.routeFrom} → {r.routeTo}</div>
          <div className="text-[10px] text-slate-400">
            {r.travelDate} {r.departureTime ? `· ${r.departureTime}` : ''}
            {r.driverName ? <span className="ml-1 text-indigo-400">· {r.driverName}</span> : null}
          </div>
        </div>

        {/* Status */}
        <div className="w-24 shrink-0">
          <StatusBadge status={r.status} />
        </div>

        {/* Amounts */}
        <div className="flex-1 flex items-center gap-4 text-xs tabular-nums">
          {r.grossSales != null && r.expenseDeducted != null && r.expenseDeducted > 0 ? (
            <span className="text-slate-500">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtK(r.grossSales)}</span>
              <span className="text-slate-400 mx-1">−</span>
              <span className="font-semibold text-amber-600">{fmtK(r.expenseDeducted)}</span>
              <span className="text-slate-400 mx-1">=</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtK(r.expectedCash)}</span>
              <span className="text-slate-400 ml-1">net</span>
            </span>
          ) : (
            <span className="text-slate-500">Expected <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtK(r.expectedCash)}</span></span>
          )}
          <span className="text-slate-500">Declared <span className="font-semibold text-slate-800 dark:text-slate-200">{r.declaredCash != null ? fmtK(r.declaredCash) : '—'}</span></span>
          {r.declaredCash != null && (
            ok
              ? <span className="text-emerald-600 font-bold">✓</span>
              : <span className={`font-bold ${gap > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {gap > 0 ? '−' : '+'}{fmtK(Math.abs(gap))}
                </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {r.status === 'submitted' && (
            <button
              onClick={e => { e.stopPropagation(); onDeposit(); }}
              disabled={depositPending}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-semibold hover:bg-violet-200 disabled:opacity-50"
            >
              <Upload size={12} /> Deposit
            </button>
          )}
          {r.status === 'deposited' && (
            <button
              onClick={e => { e.stopPropagation(); onApprove(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-200"
            >
              <Check size={12} /> Approve
            </button>
          )}
          {open ? <ChevronUp size={14} className="text-slate-400 ml-1" /> : <ChevronDown size={14} className="text-slate-400 ml-1" />}
        </div>
      </div>

      {open && (
        <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
            <Detail label="Submitted at" value={fmtDate(r.submittedAt)} />
            <Detail label="Deposited at" value={fmtDate(r.depositedAt)} />
            <Detail label="Approved at" value={fmtDate(r.approvedAt)} />
            {r.driverName && <Detail label="Driver" value={r.driverName} />}
            {r.grossSales != null && r.expenseDeducted != null && r.expenseDeducted > 0 && (
              <Detail label="Expenses deducted" value={`${fmtK(r.grossSales)} − ${fmtK(r.expenseDeducted)} = ${fmtK(r.expectedCash)} net`} cls="col-span-2" />
            )}
            {r.notes && <Detail label="Notes" value={r.notes} cls="col-span-4" />}
          </div>
          {(r.receiptImage || r.depositReceipt) && (
            <div className="flex gap-3">
              {r.receiptImage && <ReceiptThumb label="Conductor receipt" url={r.receiptImage} />}
              {r.depositReceipt && <ReceiptThumb label="Bank deposit slip" url={r.depositReceipt} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stations tab — grouped by station → seller → shifts ──────────────────────

function StationsTab({ data, collectShift, depositRecon, approveRecon }: {
  data: any;
  collectShift: ReturnType<typeof useCollectShift>;
  depositRecon: ReturnType<typeof useDepositRecon>;
  approveRecon: ReturnType<typeof useApproveRecon>;
}) {
  const [expandedStation, setExpandedStation] = useState<string | null>(null);
  const [expandedSeller, setExpandedSeller]   = useState<string | null>(null);
  const depositFileRef = useRef<HTMLInputElement>(null);
  const [pendingDeposit, setPendingDeposit]   = useState<{ id: string } | null>(null);

  // Group by station → seller
  const byStation = React.useMemo(() => {
    const stMap: Record<string, { sellers: Record<string, any[]>; stationName: string }> = {};
    for (const s of data.shifts) {
      const stn = s.stationName ?? 'Unknown';
      if (!stMap[stn]) stMap[stn] = { sellers: {}, stationName: stn };
      if (!stMap[stn].sellers[s.sellerName]) stMap[stn].sellers[s.sellerName] = [];
      stMap[stn].sellers[s.sellerName].push(s);
    }
    return Object.entries(stMap).sort(([a], [b]) => a.localeCompare(b));
  }, [data.shifts]);

  async function handleDepositFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingDeposit) return;
    const b64 = await fileToBase64(file);
    depositRecon.mutate({ id: pendingDeposit.id, type: 'shift', receipt: b64 });
    setPendingDeposit(null);
    e.target.value = '';
  }

  if (data.shifts.length === 0) return <EmptyState label="No seller shifts in this period." />;

  return (
    <div className="space-y-4">
      <input ref={depositFileRef} type="file" accept="image/*" className="hidden" onChange={handleDepositFile} />

      {byStation.map(([stationName, { sellers }]) => {
        const allShifts     = Object.values(sellers).flat();
        const totalExpected = allShifts.reduce((s: number, r: any) => s + (r.expectedCash ?? 0), 0);
        const totalDeclared = allShifts.reduce((s: number, r: any) => s + (r.declaredCash ?? 0), 0);
        const hasProblem    = allShifts.some((r: any) => r.status === 'flagged' || (r.status === 'pending' && isOldPending(r.shiftDate)));
        const pending       = allShifts.filter((r: any) => ['submitted','collected','deposited'].includes(r.status)).length;
        const isStOpen      = expandedStation === stationName;

        return (
          <div key={stationName} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Station header */}
            <button
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              onClick={() => { setExpandedStation(isStOpen ? null : stationName); setExpandedSeller(null); }}
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 dark:text-white">{stationName}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {Object.keys(sellers).length} seller{Object.keys(sellers).length !== 1 ? 's' : ''} · {allShifts.length} shifts
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs">
                {pending > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">
                    {pending} pending action
                  </span>
                )}
                {hasProblem && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-semibold">
                    <Flag size={10} /> Issue
                  </span>
                )}
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtK(totalDeclared)}</div>
                <div className="text-[10px] text-slate-400">of {fmtK(totalExpected)}</div>
              </div>
              {isStOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            </button>

            {/* Sellers within station */}
            {isStOpen && (
              <div className="border-t border-slate-100 dark:border-slate-700">
                {Object.entries(sellers).sort(([a],[b]) => a.localeCompare(b)).map(([sellerName, shifts]) => {
                  const stExpected = shifts.reduce((s: number, r: any) => s + (r.expectedCash ?? 0), 0);
                  const stDeclared = shifts.reduce((s: number, r: any) => s + (r.declaredCash ?? 0), 0);
                  const sellerKey  = `${stationName}:${sellerName}`;
                  const isSelOpen  = expandedSeller === sellerKey;

                  return (
                    <div key={sellerName} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                      {/* Seller row */}
                      <button
                        className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                        onClick={() => setExpandedSeller(isSelOpen ? null : sellerKey)}
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <User size={13} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 dark:text-white">{sellerName}</div>
                          <div className="text-[10px] text-slate-500">{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-1">
                          {(['submitted','collected','deposited','approved','flagged'] as const).map(st => {
                            const n = shifts.filter((r: any) => r.status === st).length;
                            return n > 0 ? <span key={st} className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[st]}`}>{n} {st}</span> : null;
                          })}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmtK(stDeclared)}</div>
                          {Math.abs(stExpected - stDeclared) > 0.01 && (
                            <div className="text-[10px] text-red-500 font-semibold">Gap {fmtK(Math.abs(stExpected - stDeclared))}</div>
                          )}
                        </div>
                        {isSelOpen ? <ChevronUp size={13} className="text-slate-400 shrink-0" /> : <ChevronDown size={13} className="text-slate-400 shrink-0" />}
                      </button>

                      {/* Individual shifts */}
                      {isSelOpen && (
                        <div className="divide-y divide-slate-50 dark:divide-slate-700/30 bg-slate-50/60 dark:bg-slate-800/40">
                          {shifts.map((r: any) => (
                            <ShiftRow
                              key={r.id}
                              shift={r}
                              onCollect={() => collectShift.mutate({ id: r.id })}
                              onDeposit={() => { setPendingDeposit({ id: r.id }); depositFileRef.current?.click(); }}
                              onApprove={() => approveRecon.mutate({ id: r.id, type: 'shift' })}
                              collectPending={collectShift.isPending}
                              depositPending={depositRecon.isPending}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Station subtotal */}
                <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{stationName} total</span>
                  <div className="flex items-center gap-4 text-xs tabular-nums">
                    <span className="text-slate-500">Expected <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalExpected)}</span></span>
                    <span className="text-slate-500">Declared <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalDeclared)}</span></span>
                    {Math.abs(totalExpected - totalDeclared) > 0.01
                      ? <span className="text-red-600 font-bold">Gap {fmtK(Math.abs(totalExpected - totalDeclared))}</span>
                      : <span className="text-emerald-600 font-bold">✓ Balanced</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Problems tab — flagged, old pending, discrepancies ────────────────────────

function isOldPending(shiftDate: string) {
  const d = new Date(shiftDate);
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  return d < twoDaysAgo;
}

// ── Pending shift expenses approval (finance Expenses tab) ────────────────────

function PendingShiftExpensesSection() {
  const { data: expenses = [], refetch } = usePendingShiftExpenses();
  const approveShiftExp = useApproveShiftExpense();
  const rejectShiftExp  = useRejectShiftExpense();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div>
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
        Shift Expenses
        {expenses.length > 0 && (
          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">{expenses.length}</span>
        )}
      </div>
      {expenses.length === 0 ? (
        <div className="text-xs text-slate-400 italic py-4">No pending shift expenses.</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                <th className="px-3 py-2 text-left font-semibold">Staff</th>
                <th className="px-3 py-2 text-left font-semibold">Shift</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Description</th>
                <th className="px-3 py-2 text-left font-semibold">Receipt</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{e.loggedByName}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{e.shiftId}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{e.expenseDate}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      {SHIFT_EXPENSE_TYPES.find(t => t.value === e.expenseType)?.label ?? e.expenseType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate text-xs">{e.description || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {e.receiptImage ? (
                      <a href={e.receiptImage.startsWith('http') ? e.receiptImage : `http://127.0.0.1:8002${e.receiptImage}`}
                        target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 flex items-center justify-center" title="View receipt">
                        <ImageIcon size={14} />
                      </a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums text-slate-900 dark:text-white text-right">{fmtK(e.amount)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => { await approveShiftExp.mutateAsync(e.id); refetch(); }}
                        disabled={approveShiftExp.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-200 disabled:opacity-40">
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => { setRejectId(e.id); setRejectReason(''); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-200">
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setRejectId(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <X size={16} className="text-red-500" /> Reject Shift Expense
            </div>
            <textarea
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Reason for rejection…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white resize-none mb-4" />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) return;
                  await rejectShiftExp.mutateAsync({ id: rejectId, reason: rejectReason });
                  setRejectId(null); refetch();
                }}
                disabled={rejectShiftExp.isPending || !rejectReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold">
                {rejectShiftExp.isPending ? 'Rejecting…' : 'Reject'}
              </button>
              <button onClick={() => setRejectId(null)} className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ProblemKind = 'flagged' | 'old_pending' | 'gap';

function ProblemsTab({ data, onOverride, isAdmin }: { data: any; onOverride?: (item: any, type: 'shift' | 'trip') => void; isAdmin?: boolean }) {
  const problems: { kind: ProblemKind; label: string; shift?: any; trip?: any }[] = [];

  for (const s of data.shifts) {
    if (s.status === 'flagged') {
      problems.push({ kind: 'flagged', label: 'Flagged shift', shift: s });
    } else if (s.status === 'pending' && isOldPending(s.shiftDate)) {
      problems.push({ kind: 'old_pending', label: 'Not declared (overdue)', shift: s });
    } else if (s.declaredCash != null && Math.abs(s.discrepancy ?? 0) > 0.01) {
      problems.push({ kind: 'gap', label: 'Cash discrepancy', shift: s });
    }
  }
  for (const t of data.trips) {
    if (t.declaredCash != null && Math.abs(t.discrepancy ?? 0) > 0.01) {
      problems.push({ kind: 'gap', label: 'Trip discrepancy', trip: t });
    }
  }

  if (problems.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-emerald-500 gap-3">
      <CheckCircle size={44} />
      <span className="text-base font-semibold">No problems detected</span>
      <span className="text-xs text-slate-400">All records are clean for this period.</span>
    </div>
  );

  const KIND_META: Record<ProblemKind, { label: string; cls: string; icon: React.ReactNode }> = {
    flagged:     { label: 'Flagged',       cls: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700',    icon: <Flag size={14} className="text-red-500" /> },
    old_pending: { label: 'Overdue',       cls: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700', icon: <Clock size={14} className="text-amber-500" /> },
    gap:         { label: 'Discrepancy',   cls: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700', icon: <AlertTriangle size={14} className="text-orange-500" /> },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 mb-4">
        <Flag size={16} className="text-red-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {problems.length} problem{problems.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {problems.map((p, i) => {
        const meta = KIND_META[p.kind];
        const r = p.shift;
        const t = p.trip;
        return (
          <div key={i} className={`rounded-xl border p-4 ${meta.cls}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{meta.label}</span>
                  <StatusBadge status={r?.status ?? t?.status ?? ''} />
                </div>

                {r && (
                  <>
                    <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {r.sellerName} — {r.stationName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Shift date: {r.shiftDate}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs tabular-nums">
                      <span className="text-slate-500">Expected <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(r.expectedCash)}</span></span>
                      {r.declaredCash != null && (
                        <span className="text-slate-500">Declared <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(r.declaredCash)}</span></span>
                      )}
                      {r.declaredCash != null && Math.abs(r.discrepancy ?? 0) > 0.01 && (
                        <span className="font-bold text-red-600">Gap {fmtK(Math.abs(r.discrepancy))}</span>
                      )}
                    </div>
                    {r.notes && <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic">"{r.notes}"</div>}
                    <ShiftExpenseForm shiftId={r.id} />
                  </>
                )}

                {t && (
                  <>
                    <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t.conductorName} — {t.routeFrom} → {t.routeTo}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Travel date: {t.travelDate}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs tabular-nums">
                      <span className="text-slate-500">Expected <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(t.expectedCash)}</span></span>
                      {t.declaredCash != null && (
                        <span className="text-slate-500">Declared <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(t.declaredCash)}</span></span>
                      )}
                      {t.declaredCash != null && Math.abs(t.discrepancy ?? 0) > 0.01 && (
                        <span className="font-bold text-red-600">Gap {fmtK(Math.abs(t.discrepancy))}</span>
                      )}
                    </div>
                    {t.notes && <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic">"{t.notes}"</div>}
                  </>
                )}
              </div>
              {onOverride && isAdmin && (
                <button
                  onClick={() => onOverride(r ?? t, r ? 'shift' : 'trip')}
                  className="mt-3 ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-600 text-white text-xs font-semibold hover:bg-slate-700 dark:hover:bg-slate-500 transition-colors self-end"
                >
                  <ShieldAlert size={12} /> Override Status
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared expense types for shift expenses ───────────────────────────────────

const SHIFT_EXPENSE_TYPES = [
  { value: 'toll',      label: 'Toll Gate' },
  { value: 'fuel',      label: 'Fuel' },
  { value: 'repair',    label: 'Repair' },
  { value: 'supplies',  label: 'Supplies' },
  { value: 'transport', label: 'Transport' },
  { value: 'food',      label: 'Food' },
  { value: 'other',     label: 'Other' },
];

// ── Shift expense form (used in SellerPanel, PastFlaggedShiftCard, and ProblemsTab) ──

function ShiftExpenseForm({ shiftId, onDone }: { shiftId: string; onDone?: () => void }) {
  const logExp = useLogShiftExpense();
  const { data: expenses = [], refetch } = useMyShiftExpenses(shiftId);
  const receiptRef = useRef<HTMLInputElement>(null);

  const [expType,   setExpType]   = useState('other');
  const [amount,    setAmount]    = useState('');
  const [desc,      setDesc]      = useState('');
  const [receipt,   setReceipt]   = useState<string | undefined>();
  const [receiptName, setRName]   = useState('');
  const [open,      setOpen]      = useState(false);
  const [msg,       setMsg]       = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRName(f.name);
    setReceipt(await fileToBase64(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setMsg('Enter a valid amount'); return; }
    try {
      await logExp.mutateAsync({ shiftId, expenseType: expType, amount: amt, description: desc, receipt });
      setMsg('Expense submitted for finance approval.');
      setAmount(''); setDesc(''); setReceipt(undefined); setRName(''); setOpen(false);
      refetch();
      onDone?.();
    } catch (ex: any) { setMsg(ex.message ?? 'Error'); }
  }

  return (
    <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
      <button onClick={() => { setOpen(o => !o); setMsg(''); }}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
        <Receipt size={12} /> {open ? 'Cancel expense' : 'Declare an expense'}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
            Log expense — reduces expected cash on this shift
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={expType} onChange={e => setExpType(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200">
              {SHIFT_EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Amount (K)" className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200" />
          </div>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description"
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200" />
          <div className="flex items-center gap-2">
            <input ref={receiptRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button type="button" onClick={() => receiptRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-500 hover:bg-slate-50">
              <ImageIcon size={11} /> {receiptName || 'Attach receipt'}
            </button>
            {receiptName && <span className="text-xs text-emerald-600 font-medium truncate max-w-[140px]">{receiptName}</span>}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={logExp.isPending}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold">
              {logExp.isPending ? '…' : 'Submit Expense'}
            </button>
          </div>
          {msg && <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">{msg}</div>}
        </form>
      )}

      {expenses.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-semibold text-slate-500 mb-1">My Expenses on this shift</div>
          {expenses.map((ex: any) => (
            <div key={ex.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
              <span className="text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                {SHIFT_EXPENSE_TYPES.find(t => t.value === ex.expenseType)?.label ?? ex.expenseType}
                {ex.description ? ` — ${ex.description}` : ''}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-semibold tabular-nums">{fmtK(ex.amount)}</span>
                <StatusBadge status={ex.status} />
                {ex.receiptImage && (
                  <a href={ex.receiptImage.startsWith('http') ? ex.receiptImage : `http://127.0.0.1:8002${ex.receiptImage}`}
                    target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                    <ImageIcon size={11} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Past flagged shift card (mini supplement form) ────────────────────────────

function PastFlaggedShiftCard({ shift, onDone }: { shift: any; onDone: () => void }) {
  const submitSupp = useSubmitSupplement();
  const qc = useQueryClient();
  const [amt, setAmt]     = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg]     = useState('');
  const shortfall = Math.abs(shift.discrepancy ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cash = parseFloat(amt);
    if (isNaN(cash) || cash <= 0) { setMsg('Enter a valid amount'); return; }
    try {
      await submitSupp.mutateAsync({ shiftId: shift.id, amount: cash, notes });
      setMsg('Supplement submitted — awaiting collection.');
      setAmt(''); setNotes('');
      qc.invalidateQueries({ queryKey: ['my-supplements'] });
      onDone();
    } catch (ex: any) { setMsg(ex.message ?? 'Error'); }
  }

  return (
    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 space-y-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status="flagged" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{shift.shiftDate}</span>
          {shift.stationName && <span className="text-xs text-slate-400">· {shift.stationName}</span>}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
          <span>Expected <span className="font-semibold">{fmtK(shift.expectedCash)}</span></span>
          <span>Declared <span className="font-semibold">{fmtK(shift.declaredCash ?? 0)}</span></span>
          <span className="font-bold text-red-600">Shortfall {fmtK(shortfall)}</span>
        </div>
        {shift.notes && <div className="mt-1 text-xs text-slate-500 italic">"{shift.notes}"</div>}
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
          Submit additional cash to cover this shortfall
        </div>
        <div className="flex gap-2">
          <input
            type="number" min="0.01" step="0.01" required
            value={amt} onChange={e => setAmt(e.target.value)}
            placeholder={`Amount (max ${fmtK(shortfall)})`}
            className="flex-1 px-3 py-2 rounded-lg border border-red-200 dark:border-red-700 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white"
          />
          <button type="submit" disabled={submitSupp.isPending}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold">
            {submitSupp.isPending ? '…' : 'Submit'}
          </button>
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Notes (optional)"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 resize-none" />
        {msg && <div className="text-xs text-red-600 dark:text-red-400">{msg}</div>}
      </form>
      <ShiftExpenseForm shiftId={shift.id} onDone={onDone} />
    </div>
  );
}

// ── Seller self-service panel ─────────────────────────────────────────────────

function SellerPanel() {
  const today = todayIso();
  const { data: shift, isLoading, refetch } = useMyShift(today);
  const { data: openShifts = [], refetch: refetchOpenShifts } = useMyOpenShifts();
  const submitShift    = useSubmitShift();
  const submitSupp     = useSubmitSupplement();
  const { data: supps = [] } = useMySupplements();
  const { data: pendingReceipts = [], refetch: refetchReceipts } = useMyPendingReceipts();
  const confirmReceipt = useConfirmReceipt();
  const receiptRef  = useRef<HTMLInputElement>(null);

  const [amount, setAmount]   = useState('');
  const [notes,  setNotes]    = useState('');
  const [receipt, setReceipt] = useState<string | undefined>();
  const [receiptName, setReceiptName] = useState('');
  const [err, setErr]         = useState('');
  const [success, setSuccess] = useState('');

  const [suppAmt,   setSuppAmt]   = useState('');
  const [suppNotes, setSuppNotes] = useState('');
  const [suppMsg,   setSuppMsg]   = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceiptName(f.name);
    setReceipt(await fileToBase64(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setSuccess('');
    const cash = parseFloat(amount);
    if (isNaN(cash) || cash < 0) { setErr('Enter a valid amount'); return; }
    try {
      const res = await submitShift.mutateAsync({ declaredCash: cash, notes, receipt });
      if (res.submitShiftReconciliation?.ok) {
        setSuccess('Shift submitted successfully!');
        setAmount(''); setNotes(''); setReceipt(undefined); setReceiptName('');
        refetch();
      } else {
        setErr('Submission failed');
      }
    } catch (ex: any) {
      setErr(ex.message ?? 'Error');
    }
  }

  const canSubmit = !shift || shift.status === 'pending' || shift.status === 'flagged';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20">
        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Wallet size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-slate-900 dark:text-white text-sm">My Shift Reconciliation</div>
          <div className="text-xs text-slate-500 mt-0.5">Declare today's cash sales · {today}</div>
        </div>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 text-slate-400">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="p-5">
        {isLoading && <div className="flex items-center gap-2 text-slate-400 text-sm"><RefreshCw size={14} className="animate-spin" /> Loading…</div>}

        {/* Current status */}
        {!isLoading && shift && (
          <div className="flex items-center gap-4 mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/40 text-sm">
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Status</div>
              <StatusBadge status={shift.status} />
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Expected</div>
              <div className="font-bold tabular-nums text-slate-800 dark:text-white">{fmtK(shift.expectedCash)}</div>
            </div>
            {shift.declaredCash != null && (
              <div>
                <div className="text-slate-500 text-xs mb-0.5">Declared</div>
                <div className="font-bold tabular-nums text-slate-800 dark:text-white">{fmtK(shift.declaredCash)}</div>
              </div>
            )}
            {shift.status === 'submitted' && (
              <div className="ml-auto flex items-center gap-1.5 text-amber-600 text-xs font-semibold">
                <Clock size={13} /> Awaiting collection
              </div>
            )}
            {shift.status === 'collected' && (
              <div className="ml-auto flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
                <Check size={13} /> Cash collected — awaiting deposit
              </div>
            )}
            {shift.status === 'deposited' && (
              <div className="ml-auto flex items-center gap-1.5 text-violet-600 text-xs font-semibold">
                <Check size={13} /> Deposited — awaiting approval
              </div>
            )}
            {shift.status === 'approved' && (
              <div className="ml-auto flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                <CheckCircle size={13} /> Approved ✓
              </div>
            )}
          </div>
        )}

        {!isLoading && !shift && (
          <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-xs text-slate-500">
            No shift record yet for today — submit below to start.
          </div>
        )}

        {/* Declaration form */}
        {canSubmit && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Cash amount (ZMW)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">K</span>
                <input
                  type="number" min="0" step="0.01" required
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any remarks about the shift…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <input ref={receiptRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button type="button" onClick={() => receiptRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition text-xs">
                <ImageIcon size={13} />
                {receiptName || 'Attach receipt photo (optional)'}
              </button>
            </div>

            {err     && <div className="text-xs text-red-600 font-semibold">{err}</div>}
            {success && <div className="text-xs text-emerald-600 font-semibold">{success}</div>}

            <button
              type="submit" disabled={submitShift.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm transition"
            >
              {submitShift.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Submit Cash Declaration
            </button>
          </form>
        )}

        {!canSubmit && shift && shift.status !== 'flagged' && (
          <div className="text-xs text-slate-500 italic mt-2">
            Shift already {shift.status} — no further action needed from you.
          </div>
        )}

        {/* Any staff can declare an expense against their shift */}
        {shift && <ShiftExpenseForm shiftId={shift.id} onDone={refetch} />}

        {/* Shortfall supplement — shown when shift is flagged with a gap */}
        {shift && shift.status === 'flagged' && (shift.discrepancy ?? 0) > 0 && (
          <div className="mt-4 border-t border-red-100 dark:border-red-900/30 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                Shortfall of {fmtK(shift.discrepancy)} — submit additional cash
              </span>
            </div>
            <form
              onSubmit={async e => {
                e.preventDefault(); setSuppMsg('');
                const amt = parseFloat(suppAmt);
                if (isNaN(amt) || amt <= 0) { setSuppMsg('Enter a valid amount'); return; }
                try {
                  const res = await submitSupp.mutateAsync({ shiftId: shift.id, amount: amt, notes: suppNotes });
                  if (res.submitShiftSupplement?.ok) {
                    setSuppMsg('Supplement submitted — awaiting collection'); setSuppAmt(''); setSuppNotes(''); refetch();
                  } else setSuppMsg('Failed');
                } catch (ex: any) { setSuppMsg(ex.message ?? 'Error'); }
              }}
              className="space-y-3 bg-red-50 dark:bg-red-900/10 rounded-xl p-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount (ZMW)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">K</span>
                    <input type="number" min="0.01" step="0.01" required value={suppAmt} onChange={e => setSuppAmt(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-red-400 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Notes</label>
                  <input type="text" value={suppNotes} onChange={e => setSuppNotes(e.target.value)} placeholder="Explanation…"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm" />
                </div>
              </div>
              {suppMsg && <div className={`text-xs font-semibold ${suppMsg.includes('submitted') ? 'text-emerald-600' : 'text-red-600'}`}>{suppMsg}</div>}
              <button type="submit" disabled={submitSupp.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold">
                {submitSupp.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                Submit Shortfall Payment
              </button>
            </form>
          </div>
        )}

        {/* Previous supplements */}
        {supps.length > 0 && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">My Shortfall Supplements</div>
            {supps.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                <span className="text-slate-600 dark:text-slate-300">{s.shiftDate} · {fmtK(s.amount)}</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[s.status] ?? 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Flagged past shifts — each can receive a supplement */}
        {openShifts.filter((s: any) => s.status === 'flagged' && s.shiftDate !== today).length > 0 && (
          <div className="mt-4 border-t border-red-100 dark:border-red-900/30 pt-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Flag size={14} className="text-red-500" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">Flagged Past Shifts</span>
            </div>
            {openShifts.filter((s: any) => s.status === 'flagged' && s.shiftDate !== today).map((s: any) => (
              <PastFlaggedShiftCard key={s.id} shift={s} onDone={() => { refetchOpenShifts(); }} />
            ))}
          </div>
        )}

        {/* Pending receipt confirmations */}
        {pendingReceipts.length > 0 && (
          <div className="mt-4 border-t border-amber-100 dark:border-amber-900/30 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Check size={14} className="text-amber-500" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Confirm funds received ({pendingReceipts.length})
              </span>
            </div>
            <div className="space-y-2">
              {pendingReceipts.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{e.loggedByName} — {e.stationName}</div>
                    <div className="text-xs text-slate-500">{e.expenseDate} · {e.expenseType.replace('_', ' ')} · {fmtK(e.amount)}</div>
                    {e.description && <div className="text-xs text-slate-400 italic">{e.description}</div>}
                  </div>
                  <button
                    onClick={async () => {
                      await confirmReceipt.mutateAsync(e.id);
                      refetchReceipts();
                    }}
                    disabled={confirmReceipt.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    <Check size={12} /> Confirm
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Conductor self-service panel ──────────────────────────────────────────────

const EXPENSE_TYPES = [
  { value: 'toll',   label: 'Toll Gate' },
  { value: 'fuel',   label: 'Fuel' },
  { value: 'repair', label: 'Roadside Repair' },
  { value: 'food',   label: 'Crew Food' },
  { value: 'other',  label: 'Other' },
];

function TripSubmitCard({ run }: { run: any }) {
  // run.tripRunId = actual TripRunAssignment id (for mutations)
  // run.id = recon id (or synthetic "run-N" for bare runs)
  const runId = run.tripRunId ?? run.id;
  const { data: recon, refetch } = useMyTripRecon(run.status !== 'pending' ? run.id : null);
  const submitTrip = useSubmitTrip();
  const logExpense = useLogExpense();

  const [declaredAmount, setDeclaredAmount] = useState('');
  const [tripNotes, setTripNotes]           = useState('');
  const [expType, setExpType]               = useState('toll');
  const [expAmt,  setExpAmt]                = useState('');
  const [expDesc, setExpDesc]               = useState('');
  const [showExpForm, setShowExpForm]       = useState(false);
  const [open, setOpen]                     = useState(false);
  const [msg, setMsg]                       = useState('');

  const canSubmit = !recon || recon.status === 'pending' || recon.status === 'flagged';

  async function handleSubmitTrip(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const cash = parseFloat(declaredAmount);
    if (isNaN(cash) || cash < 0) { setMsg('Enter a valid amount'); return; }
    try {
      const res = await submitTrip.mutateAsync({ tripRunId: runId, declaredCash: cash, notes: tripNotes });
      if (res.submitTripReconciliation?.ok) {
        setMsg('Trip submitted!');
        setDeclaredAmount(''); setTripNotes('');
        refetch();
      } else {
        setMsg('Failed');
      }
    } catch (ex: any) {
      setMsg(ex.message ?? 'Error');
    }
  }

  async function handleLogExpense(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const amt = parseFloat(expAmt);
    if (isNaN(amt) || amt <= 0) { setMsg('Enter a valid expense amount'); return; }
    try {
      const res = await logExpense.mutateAsync({ tripRunId: runId, expenseType: expType, amount: amt, description: expDesc });
      if (res.logTripExpense?.ok) {
        setMsg('Expense logged — awaiting approval');
        setExpAmt(''); setExpDesc(''); setShowExpForm(false);
      } else {
        setMsg('Failed to log expense');
      }
    } catch (ex: any) {
      setMsg(ex.message ?? 'Error');
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
          <Bus size={15} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 dark:text-white text-sm">
            {run.routeFrom} → {run.routeTo}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {run.travelDate ?? todayIso()} · {run.departureTime}
            {run.walkinRevenue > 0 && <span className="ml-2 font-semibold text-emerald-600">{fmtK(run.walkinRevenue)} walk-in</span>}
          </div>
        </div>
        <div className="shrink-0">
          {recon ? <StatusBadge status={recon.status} /> : <StatusBadge status="pending" />}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-5 space-y-5">
          {/* Current recon status */}
          {recon && (
            <div className="flex items-center gap-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 text-xs">
              <div><div className="text-slate-400 mb-0.5">Expected</div><div className="font-bold tabular-nums">{fmtK(recon.expectedCash)}</div></div>
              {recon.declaredCash != null && (
                <div><div className="text-slate-400 mb-0.5">Declared</div><div className="font-bold tabular-nums">{fmtK(recon.declaredCash)}</div></div>
              )}
              {recon.expenseDeducted > 0 && (
                <div className="text-amber-600">
                  <div className="text-slate-400 mb-0.5">Expenses deducted</div>
                  <div className="font-bold tabular-nums">{fmtK(recon.expenseDeducted)}</div>
                </div>
              )}
              {recon.declaredCash != null && Math.abs(recon.discrepancy ?? 0) < 0.01 && (
                <span className="text-emerald-600 font-bold">✓ Balanced</span>
              )}
            </div>
          )}

          {/* Log expense button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExpForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 transition"
            >
              <Plus size={12} /> Log Expense
            </button>
            <span className="text-xs text-slate-400">(conductor + driver can log expenses on this trip)</span>
          </div>

          {showExpForm && (
            <form onSubmit={handleLogExpense} className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Trip Expense</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <select value={expType} onChange={e => setExpType(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white">
                    {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount (ZMW)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">K</span>
                    <input type="number" min="0.01" step="0.01" required value={expAmt} onChange={e => setExpAmt(e.target.value)}
                      className="w-full pl-6 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white" />
                  </div>
                </div>
              </div>
              <input type="text" placeholder="Description (optional)" value={expDesc} onChange={e => setExpDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white" />
              <div className="flex gap-2">
                <button type="submit" disabled={logExpense.isPending}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-50">
                  {logExpense.isPending ? 'Logging…' : 'Log Expense'}
                </button>
                <button type="button" onClick={() => setShowExpForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Cash declaration form */}
          {canSubmit && (
            <form onSubmit={handleSubmitTrip} className="space-y-3">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Declare Cash Collected</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cash amount (ZMW)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">K</span>
                    <input type="number" min="0" step="0.01" required value={declaredAmount}
                      onChange={e => setDeclaredAmount(e.target.value)}
                      className="w-full pl-6 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Notes</label>
                  <input type="text" value={tripNotes} onChange={e => setTripNotes(e.target.value)}
                    placeholder="Optional…"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white" />
                </div>
              </div>
              <button type="submit" disabled={submitTrip.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition">
                {submitTrip.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                Submit Trip Declaration
              </button>
            </form>
          )}

          {msg && <div className={`text-xs font-semibold ${msg.includes('!') || msg.includes('logged') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

function ConductorPanel() {
  const { data: runs = [], isLoading, refetch } = useMyPendingTripRuns();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/20">
        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
          <TrendingUp size={16} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-slate-900 dark:text-white text-sm">My Trip Reconciliations</div>
          <div className="text-xs text-slate-500 mt-0.5">Pending trips needing cash declaration (last 14 days)</div>
        </div>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 text-slate-400">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="p-5 space-y-3">
        {isLoading && <div className="flex items-center gap-2 text-slate-400 text-sm"><RefreshCw size={14} className="animate-spin" /> Loading…</div>}
        {!isLoading && runs.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">No trips assigned today.</div>
        )}
        {runs.map((run: any) => <TripSubmitCard key={run.id} run={run} />)}
      </div>
    </div>
  );
}

// ── Station Manager self-service panel ───────────────────────────────────────

const STATION_EXPENSE_TYPES = [
  { value: 'station_fee', label: 'Station Fee / Rent' },
  { value: 'staff_lunch', label: 'Staff Lunch' },
  { value: 'maintenance', label: 'Station Maintenance' },
  { value: 'supplies',    label: 'Office Supplies' },
  { value: 'transport',   label: 'Staff Transport' },
  { value: 'other',       label: 'Other' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
};

function StationManagerPanel() {
  const logExpense       = useLogStationExpense();
  const collectSupp      = useCollectSupplement();
  const { data: expenses = [], refetch: refetchExpenses } = useMyStationExpenses();
  const { data: supplements = [], refetch: refetchSupps } = useStationSupplements();

  const [expType,    setExpType]    = useState('station_fee');
  const [expAmt,     setExpAmt]     = useState('');
  const [expDesc,    setExpDesc]    = useState('');
  const [expDate,    setExpDate]    = useState(todayIso());
  const [recipId,    setRecipId]    = useState('');
  const [msg,        setMsg]        = useState('');
  const [showForm,   setShowForm]   = useState(false);

  async function handleLogExpense(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const amt = parseFloat(expAmt);
    if (isNaN(amt) || amt <= 0) { setMsg('Enter a valid amount'); return; }
    try {
      const res = await logExpense.mutateAsync({
        expenseType: expType, amount: amt, description: expDesc,
        expenseDate: expDate, recipientId: recipId || undefined,
      });
      if (res.logStationExpense?.ok) {
        setMsg('Expense logged — awaiting finance approval');
        setExpAmt(''); setExpDesc(''); setRecipId(''); setShowForm(false);
        refetchExpenses();
      } else setMsg('Failed');
    } catch (ex: any) { setMsg(ex.message ?? 'Error'); }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/20">
        <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
          <Building2 size={16} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-slate-900 dark:text-white text-sm">Station Expenses</div>
          <div className="text-xs text-slate-500 mt-0.5">Log operational expenses · pending finance approval</div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold"
        >
          <Plus size={12} /> Log Expense
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleLogExpense} className="border-b border-slate-100 dark:border-slate-700 p-5 bg-violet-50/50 dark:bg-violet-900/10 space-y-4">
          <div className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">New Station Expense</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Expense Type</label>
              <select value={expType} onChange={e => setExpType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white">
                {STATION_EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount (ZMW)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">K</span>
                <input type="number" min="0.01" step="0.01" required value={expAmt} onChange={e => setExpAmt(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Date</label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Recipient Employee ID <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input type="text" value={recipId} onChange={e => setRecipId(e.target.value)} placeholder="Leave blank if not staff-directed"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Description (optional)</label>
            <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="E.g. Lunch for 3 staff members"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white" />
          </div>
          {msg && <div className={`text-xs font-semibold ${msg.includes('logged') ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={logExpense.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold">
              {logExpense.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Submit Expense
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Pending supplements to collect */}
      {supplements.length > 0 && (
        <div className="border-b border-slate-100 dark:border-slate-700 p-5">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={13} />
            Shortfall supplements awaiting collection ({supplements.length})
          </div>
          <div className="space-y-2">
            {supplements.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{s.shiftDate} · {fmtK(s.amount)}</div>
                  {s.notes && <div className="text-xs text-slate-400 italic">{s.notes}</div>}
                </div>
                <button
                  onClick={async () => { await collectSupp.mutateAsync(s.id); refetchSupps(); }}
                  disabled={collectSupp.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Check size={12} /> Collected
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My expenses history */}
      <div className="p-5">
        <div className="text-xs font-semibold text-slate-500 mb-3">My Expense History</div>
        {expenses.length === 0 ? (
          <div className="text-xs text-slate-400 italic">No expenses logged yet.</div>
        ) : (
          <div className="space-y-1">
            {expenses.slice(0, 10).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-700/30 last:border-0 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{e.expenseDate}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-600 dark:text-slate-300">{STATION_EXPENSE_TYPES.find(t => t.value === e.expenseType)?.label ?? e.expenseType}</span>
                  {e.description && <span className="ml-1 text-slate-400 italic">— {e.description}</span>}
                  {e.recipientName && <span className="ml-1 text-slate-400">→ {e.recipientName}</span>}
                  {e.recipientName && !e.recipientConfirmed && <span className="ml-1 text-amber-500 font-semibold">(awaiting confirmation)</span>}
                </div>
                <span className="font-bold tabular-nums text-slate-800 dark:text-white">{fmtK(e.amount)}</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${
                  e.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  e.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>{STATUS_LABELS[e.status] ?? e.status}</span>
                {e.status === 'rejected' && e.rejectionReason && (
                  <span className="text-red-500 text-[10px] italic" title={e.rejectionReason}>Reason: {e.rejectionReason.slice(0, 40)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin override modal ──────────────────────────────────────────────────────

function OverrideModal({ item, type, onClose, onDone }: {
  item: any; type: 'shift' | 'trip'; onClose: () => void; onDone: () => void;
}) {
  const override = useAdminOverride();
  const SHIFT_STATUSES = ['pending', 'submitted', 'collected', 'deposited', 'approved', 'flagged'];
  const TRIP_STATUSES  = ['pending', 'submitted', 'deposited', 'approved', 'flagged'];
  const statuses = type === 'shift' ? SHIFT_STATUSES : TRIP_STATUSES;

  const [newStatus, setNewStatus] = useState(statuses[0]);
  const [reason, setReason]       = useState('');
  const [msg, setMsg]             = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (!reason.trim()) { setMsg('Reason is required'); return; }
    try {
      const res = await override.mutateAsync({ id: item.id, type, newStatus, reason: reason.trim() });
      if (res.adminOverrideReconciliation?.ok) {
        setMsg('Override applied'); onDone();
        setTimeout(onClose, 800);
      } else setMsg('Failed');
    } catch (ex: any) { setMsg(ex.message ?? 'Error'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-500" />
            <span className="font-bold text-slate-900 dark:text-white">Admin Override</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 text-xs space-y-1">
          <div className="font-semibold text-slate-800 dark:text-white">
            {type === 'shift' ? `${item.sellerName} — ${item.stationName ?? '—'}` : `${item.conductorName} — ${item.routeFrom} → ${item.routeTo}`}
          </div>
          <div className="text-slate-500">
            {type === 'shift' ? `Shift: ${item.shiftDate}` : `Trip: ${item.travelDate}`}
            <span className="ml-2"><StatusBadge status={item.status} /></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">New Status</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white">
              {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required
              placeholder="Explain why this override is necessary…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white resize-none focus:ring-2 focus:ring-red-400 outline-none" />
          </div>
          {msg && <div className={`text-xs font-semibold ${msg === 'Override applied' ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={override.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold">
              {override.isPending ? <RefreshCw size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
              Apply Override
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Reconciliation() {
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo,   setDateTo]   = useState(todayIso());
  const [overrideTarget, setOverrideTarget] = useState<{ item: any; type: 'shift' | 'trip' } | null>(null);

  const { data: perms = [] } = useMyPermissions();
  const isSeller         = perms.includes('sell_tickets') || perms.includes('walk_in_sales');
  const isConductor      = perms.includes('scan_tickets');
  const isFinance        = perms.includes('view_reports');
  const isStationManager = perms.includes('manage_stations');
  const isAdmin          = perms.includes('super_user');

  const { data, isLoading, refetch } = useReconciliationSummary(dateFrom, dateTo);
  const collectShift    = useCollectShift();
  const approveRecon    = useApproveRecon();
  const depositRecon    = useDepositRecon();
  const approveExpense  = useApproveExpense();
  const approveStExp    = useApproveStationExpense();
  const rejectStExp     = useRejectStationExpense();
  const approveSupplement = useApproveSupplement();
  const { data: pendingStationExps = [], refetch: refetchStExp } = usePendingStationExpenses();
  const { data: pendingSupps = [],       refetch: refetchSupps  } = usePendingSupplements();
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null);

  // Tab definitions
  const stationsPending   = data ? data.shiftCountSubmitted + data.shiftCountCollected : 0;
  const conductorsPending = data ? data.tripCountSubmitted : 0;

  const problemCount = React.useMemo(() => {
    if (!data) return 0;
    let n = 0;
    for (const s of data.shifts) {
      if (s.status === 'flagged') n++;
      else if (s.status === 'pending' && isOldPending(s.shiftDate)) n++;
      else if (s.declaredCash != null && Math.abs(s.discrepancy ?? 0) > 0.01) n++;
    }
    for (const t of data.trips) {
      if (t.declaredCash != null && Math.abs(t.discrepancy ?? 0) > 0.01) n++;
    }
    return n;
  }, [data]);

  const TABS: { key: ActiveTab; label: string; icon: React.FC<any>; badge?: number | string; danger?: boolean }[] = [
    { key: 'overview',    label: 'Overview',    icon: LayoutGrid },
    { key: 'stations',    label: 'Stations',    icon: MapPin,  badge: stationsPending || undefined },
    { key: 'conductors',  label: 'Conductors',  icon: Bus,     badge: conductorsPending || undefined },
    { key: 'expenses',    label: 'Expenses',    icon: Receipt, badge: data?.expensePending > 0 ? `K${data.expensePending.toFixed(0)}` : undefined },
    { key: 'problems',    label: 'Problems',    icon: Flag,    badge: problemCount || undefined, danger: true },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Cash Reconciliation</h1>
          {data?.stationName ? (
            <p className="text-xs mt-0.5 flex items-center gap-1.5">
              <MapPin size={11} className="text-indigo-500" />
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{data.stationName}</span>
              <span className="text-slate-400">· Station view</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Staff → Collect → Deposit → Company</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          />
          <button onClick={() => refetch()} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tab bar — only shown for finance/manager roles */}
      {isFinance ? (
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <t.icon size={14} />
              {t.label}
              {t.badge !== undefined && (
                <span className={`ml-1 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 ${t.danger ? 'bg-red-500' : 'bg-amber-500'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">

        {/* Self-service panels for seller / conductor / station manager */}
        {(isSeller || isConductor || isStationManager) && (
          <div className="mb-6 space-y-4">
            {isSeller         && <SellerPanel />}
            {isConductor      && <ConductorPanel />}
            {isStationManager && <StationManagerPanel />}
          </div>
        )}

        {/* Finance / management view — only if user has view_reports */}
        {!isFinance && !isSeller && !isConductor && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <AlertTriangle size={28} />
            <span className="text-sm">You don't have access to the reconciliation overview.</span>
          </div>
        )}

        {isLoading && isFinance && (
          <div className="flex items-center justify-center h-40">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        )}

        {isFinance && !isLoading && !data && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <AlertTriangle size={28} />
            <span className="text-sm">Could not load reconciliation data.</span>
          </div>
        )}

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {isFinance && !isLoading && data && tab === 'overview' && (
          <div className="space-y-6">
            {/* Cash flow pipeline — sellers */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Station Sellers · Cash Pipeline
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <PipelineStep label="Pending" count={data.shiftCountPending} />
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <PipelineStep label="Submitted" count={data.shiftCountSubmitted} active={data.shiftCountSubmitted > 0} />
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <PipelineStep label="Collected" count={data.shiftCountCollected} active={data.shiftCountCollected > 0} />
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <PipelineStep label="Deposited" count={0} />
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <PipelineStep label="Approved" count={data.shiftCountApproved} done={data.shiftCountApproved > 0} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs">
                <div><div className="text-slate-500">Expected</div><div className="text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtK(data.shiftExpectedTotal)}</div></div>
                <div><div className="text-slate-500">Declared</div><div className="text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtK(data.shiftDeclaredTotal)}</div></div>
                <div className={`rounded-lg p-2 ${Math.abs(data.shiftDiscrepancy) < 0.01 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className={`text-xs font-semibold ${Math.abs(data.shiftDiscrepancy) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.abs(data.shiftDiscrepancy) < 0.01 ? 'Balanced' : 'Gap'}
                  </div>
                  <div className={`text-base font-extrabold tabular-nums ${Math.abs(data.shiftDiscrepancy) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.abs(data.shiftDiscrepancy) < 0.01 ? '✓' : fmtK(Math.abs(data.shiftDiscrepancy))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cash flow pipeline — conductors */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Conductors · Cash Pipeline
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <PipelineStep label="Pending" count={data.tripCountPending} />
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <PipelineStep label="Submitted" count={data.tripCountSubmitted} active={data.tripCountSubmitted > 0} />
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <PipelineStep label="Deposited" count={0} />
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <PipelineStep label="Approved" count={data.tripCountApproved} done={data.tripCountApproved > 0} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs">
                <div><div className="text-slate-500">Expected</div><div className="text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtK(data.tripExpectedTotal)}</div></div>
                <div><div className="text-slate-500">Declared</div><div className="text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtK(data.tripDeclaredTotal)}</div></div>
                <div className={`rounded-lg p-2 ${Math.abs(data.tripDiscrepancy) < 0.01 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className={`text-xs font-semibold ${Math.abs(data.tripDiscrepancy) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.abs(data.tripDiscrepancy) < 0.01 ? 'Balanced' : 'Gap'}
                  </div>
                  <div className={`text-base font-extrabold tabular-nums ${Math.abs(data.tripDiscrepancy) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.abs(data.tripDiscrepancy) < 0.01 ? '✓' : fmtK(Math.abs(data.tripDiscrepancy))}
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses summary */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Trip Expenses</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total logged',    value: data.expenseTotal,    cls: 'text-slate-900 dark:text-white' },
                  { label: 'Approved',        value: data.expenseApproved, cls: 'text-emerald-600' },
                  { label: 'Pending approval',value: data.expensePending,  cls: 'text-amber-600' },
                ].map(r => (
                  <div key={r.label}>
                    <div className="text-xs text-slate-500">{r.label}</div>
                    <div className={`text-lg font-extrabold tabular-nums ${r.cls}`}>{fmtK(r.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STATIONS ─────────────────────────────────────────────────────── */}
        {isFinance && !isLoading && data && tab === 'stations' && (
          <StationsTab
            data={data}
            collectShift={collectShift}
            depositRecon={depositRecon}
            approveRecon={approveRecon}
          />
        )}

        {/* ── CONDUCTORS ───────────────────────────────────────────────────── */}
        {isFinance && !isLoading && data && tab === 'conductors' && (
          <ConductorsTab
            data={data}
            depositRecon={depositRecon}
            approveRecon={approveRecon}
          />
        )}

        {/* ── PROBLEMS ─────────────────────────────────────────────────────── */}
        {isFinance && !isLoading && data && tab === 'problems' && (
          <ProblemsTab data={data} onOverride={(item, type) => setOverrideTarget({ item, type })} isAdmin={isAdmin} />
        )}

        {/* ── EXPENSES ─────────────────────────────────────────────────────── */}
        {isFinance && !isLoading && data && tab === 'expenses' && (
          <div className="space-y-6">
            {/* Trip expenses */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Trip Expenses</div>
              {data.expenses.length === 0 ? (
                <EmptyState label="No trip expenses in this period." />
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                        <th className="px-3 py-2 text-left font-semibold">Staff</th>
                        <th className="px-3 py-2 text-left font-semibold">Trip</th>
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-left font-semibold">Type</th>
                        <th className="px-3 py-2 text-left font-semibold">Description</th>
                        <th className="px-3 py-2 text-left font-semibold">Amount</th>
                        <th className="px-3 py-2 text-left font-semibold">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenses.map((e: any) => (
                        <tr key={e.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{e.loggedByName}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{e.routeFrom} → {e.routeTo}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{e.travelDate}</td>
                          <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{EXPENSE_LABELS[e.expenseType] ?? e.expenseType}</span></td>
                          <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate text-xs">{e.description || '—'}</td>
                          <td className="px-3 py-2 font-semibold tabular-nums text-slate-900 dark:text-white">{fmtK(e.amount)}</td>
                          <td className="px-3 py-2">
                            {e.approved
                              ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle size={12} /> Approved</span>
                              : <span className="flex items-center gap-1 text-amber-600 text-xs font-semibold"><Clock size={12} /> Pending</span>}
                          </td>
                          <td className="px-3 py-2">
                            {!e.approved && (
                              <button onClick={() => approveExpense.mutate(e.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-200">
                                <Check size={12} /> Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Station expenses */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                Station Expenses
                {pendingStationExps.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pendingStationExps.length}</span>
                )}
              </div>
              {pendingStationExps.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-4">No pending station expenses.</div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                        <th className="px-3 py-2 text-left font-semibold">Manager</th>
                        <th className="px-3 py-2 text-left font-semibold">Station</th>
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-left font-semibold">Type</th>
                        <th className="px-3 py-2 text-left font-semibold">Description</th>
                        <th className="px-3 py-2 text-left font-semibold">Recipient</th>
                        <th className="px-3 py-2 text-left font-semibold">Amount</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingStationExps.map((e: any) => (
                        <tr key={e.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{e.loggedByName}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{e.stationName}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{e.expenseDate}</td>
                          <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">{STATION_EXPENSE_TYPES.find(t => t.value === e.expenseType)?.label ?? e.expenseType}</span></td>
                          <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate text-xs">{e.description || '—'}</td>
                          <td className="px-3 py-2 text-xs">
                            {e.recipientName
                              ? <span className={e.recipientConfirmed ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                                  {e.recipientName} {e.recipientConfirmed ? '✓' : '(pending)'}
                                </span>
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2 font-semibold tabular-nums text-slate-900 dark:text-white">{fmtK(e.amount)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={async () => { await approveStExp.mutateAsync(e.id); refetchStExp(); }}
                                disabled={approveStExp.isPending || (e.recipientName && !e.recipientConfirmed)}
                                title={e.recipientName && !e.recipientConfirmed ? 'Recipient must confirm first' : 'Approve'}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-200 disabled:opacity-40">
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => setRejectModal({ id: e.id, reason: '' })}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-200">
                                <X size={12} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Shift expenses (pending approval) */}
            <PendingShiftExpensesSection />

            {/* Shortfall supplements */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                Shortfall Supplements
                {pendingSupps.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pendingSupps.length}</span>
                )}
              </div>
              {pendingSupps.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-4">No pending supplements.</div>
              ) : (
                <div className="space-y-2">
                  {pendingSupps.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-white">{s.shiftDate} · {fmtK(s.amount)}</div>
                        {s.notes && <div className="text-xs text-slate-400 italic">{s.notes}</div>}
                        <div className="text-xs text-slate-500 mt-0.5">
                          Status: <StatusBadge status={s.status} />
                          {s.collectedByName && <span className="ml-2">Collected by {s.collectedByName}</span>}
                        </div>
                      </div>
                      {s.status === 'collected' && (
                        <button
                          onClick={async () => { await approveSupplement.mutateAsync(s.id); refetchSupps(); }}
                          disabled={approveSupplement.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-200 disabled:opacity-50">
                          <Check size={12} /> Approve
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject station expense modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <X size={16} className="text-red-500" /> Reject Station Expense
            </div>
            <textarea
              value={rejectModal.reason}
              onChange={e => setRejectModal(m => m ? { ...m, reason: e.target.value } : m)}
              rows={3} placeholder="Reason for rejection…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white resize-none mb-4" />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!rejectModal.reason.trim()) return;
                  await rejectStExp.mutateAsync({ id: rejectModal.id, reason: rejectModal.reason });
                  setRejectModal(null); refetchStExp();
                }}
                disabled={rejectStExp.isPending || !rejectModal.reason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold">
                {rejectStExp.isPending ? 'Rejecting…' : 'Reject'}
              </button>
              <button onClick={() => setRejectModal(null)} className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin override modal */}
      {overrideTarget && (
        <OverrideModal
          item={overrideTarget.item}
          type={overrideTarget.type}
          onClose={() => setOverrideTarget(null)}
          onDone={() => refetch()}
        />
      )}
    </div>
  );
}
