/**
 * Platform Admin API — GraphQL queries + mutations + React Query hooks
 * for the BusGo platform operator dashboard.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlatformStats {
  totalCompanies: number;
  pendingCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalTrips: number;
  activeTrips: number;
  totalBookings: number;
  confirmedBookings: number;
  revenueTotal: number;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  registrationNumber: string;
  isApproved: boolean;
  isSuspended: boolean;
  rejectionComment: string;
  createdAt: string;
}

export interface PlatformStaff {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: { id: string; username: string; email: string; firstName: string; lastName: string };
}

export interface AuditLog {
  id: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; username: string } | null;
}

export interface SubscriptionPlanConfig {
  id: string;
  plan: string;
  monthlyPrice: number;
  annualPrice: number;
  includedBuses: number;
  includedStations: number;
  includedStaff: number;
  unlimitedStaff: boolean;
  extraBusFee: number;
  extraStationFee: number;
  extraStaffFee: number;
  onlineCommissionRate: number;
  walkinCommissionRate: number;
  onlineServiceChargeRate: number;
  setupBaseFee: number;
  setupPerStation: number;
  setupPerStaff: number;
  setupPerBus: number;
  setupTrainingFee: number;
}

export interface PlatformRevenue {
  subscriptionByCompany: {
    companyId: number;
    companyName: string;
    subscriptionRevenue: number;
    activePlan: string | null;
    billingCycle: string | null;
  }[];
  totalSubscriptionRevenue: number;
  commissionByCompany: {
    companyId: number;
    companyName: string;
    onlineBookingRevenue: number;
    walkinBookingRevenue: number;
    bookingRevenue: number;
    onlineCommissionRevenue: number;
    walkinCommissionRevenue: number;
    commissionRevenue: number;
    commissionRateOnline: number;
    commissionRateWalkin: number;
  }[];
  totalOnlineCommissionRevenue: number;
  totalWalkinCommissionRevenue: number;
  totalCommissionRevenue: number;
  totalBookingRevenue: number;
  grandTotal: number;
}

// ── GraphQL documents ──────────────────────────────────────────────────────────

const COMPANY_FIELDS = `
  id name email phone address registrationNumber
  isApproved isSuspended rejectionComment createdAt
`;

const PLATFORM_STATS_QUERY = `
  query PlatformStats {
    platformStats {
      totalCompanies pendingCompanies activeCompanies suspendedCompanies
      totalTrips activeTrips totalBookings confirmedBookings revenueTotal
    }
  }
`;

const ALL_COMPANIES_QUERY = `
  query AllCompanies {
    allCompaniesList { ${COMPANY_FIELDS} }
  }
`;

const STAFF_QUERY = `
  query PlatformStaff {
    staff {
      id role isActive createdAt
      user { id username email firstName lastName }
    }
  }
`;

const AUDIT_LOGS_QUERY = `
  query AuditLogs {
    auditLogsList {
      id action details ipAddress createdAt
      user { id username }
    }
  }
`;

const SUBSCRIPTION_PLANS_QUERY = `
  query SubscriptionPlans {
    subscriptionPlans {
      id plan monthlyPrice annualPrice
      includedBuses includedStations includedStaff unlimitedStaff
      extraBusFee extraStationFee extraStaffFee
      onlineCommissionRate walkinCommissionRate onlineServiceChargeRate
      setupBaseFee setupPerStation setupPerStaff setupPerBus setupTrainingFee
    }
  }
`;

const PLATFORM_REVENUE_QUERY = `
  query PlatformRevenue {
    platformRevenue {
      subscriptionByCompany { companyId companyName subscriptionRevenue activePlan billingCycle }
      totalSubscriptionRevenue
      commissionByCompany {
        companyId companyName
        onlineBookingRevenue walkinBookingRevenue bookingRevenue
        onlineCommissionRevenue walkinCommissionRevenue commissionRevenue
        commissionRateOnline commissionRateWalkin
      }
      totalOnlineCommissionRevenue totalWalkinCommissionRevenue
      totalCommissionRevenue totalBookingRevenue grandTotal
    }
  }
`;

const APPROVE_COMPANY_MUTATION = `
  mutation ApproveCompany($companyId: Int!) {
    approveCompany(companyId: $companyId) { company { ${COMPANY_FIELDS} } }
  }
`;

const SUSPEND_COMPANY_MUTATION = `
  mutation SuspendCompany($companyId: Int!, $comment: String) {
    suspendCompany(companyId: $companyId, comment: $comment) { company { ${COMPANY_FIELDS} } }
  }
`;

const REACTIVATE_COMPANY_MUTATION = `
  mutation ReactivateCompany($companyId: Int!) {
    reactivateCompany(companyId: $companyId) { company { ${COMPANY_FIELDS} } }
  }
`;

const CREATE_STAFF_MUTATION = `
  mutation CreateStaff($username: String!, $email: String!, $password: String!, $role: String!) {
    createStaff(username: $username, email: $email, password: $password, role: $role) {
      staff { id role isActive user { id username email } }
    }
  }
`;

const UPDATE_PLAN_MUTATION = `
  mutation UpdateSubscriptionPlan(
    $plan: String!
    $monthlyPrice: Float $annualPrice: Float
    $includedBuses: Int $includedStations: Int $includedStaff: Int $unlimitedStaff: Boolean
    $extraBusFee: Float $extraStationFee: Float $extraStaffFee: Float
    $onlineCommissionRate: Float $walkinCommissionRate: Float $onlineServiceChargeRate: Float
    $setupBaseFee: Float $setupPerStation: Float $setupPerStaff: Float $setupPerBus: Float $setupTrainingFee: Float
  ) {
    updateSubscriptionPlan(
      plan: $plan
      monthlyPrice: $monthlyPrice annualPrice: $annualPrice
      includedBuses: $includedBuses includedStations: $includedStations includedStaff: $includedStaff unlimitedStaff: $unlimitedStaff
      extraBusFee: $extraBusFee extraStationFee: $extraStationFee extraStaffFee: $extraStaffFee
      onlineCommissionRate: $onlineCommissionRate walkinCommissionRate: $walkinCommissionRate onlineServiceChargeRate: $onlineServiceChargeRate
      setupBaseFee: $setupBaseFee setupPerStation: $setupPerStation setupPerStaff: $setupPerStaff setupPerBus: $setupPerBus setupTrainingFee: $setupTrainingFee
    ) { ok config { id plan monthlyPrice annualPrice onlineCommissionRate walkinCommissionRate } }
  }
`;

// ── React Query hooks ──────────────────────────────────────────────────────────

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => gql<{ platformStats: PlatformStats }>(PLATFORM_STATS_QUERY).then((d) => d.platformStats),
    refetchInterval: 30_000,
  });
}

export function useAllCompanies() {
  return useQuery({
    queryKey: ['platform-companies'],
    queryFn: () => gql<{ allCompaniesList: Company[] }>(ALL_COMPANIES_QUERY).then((d) => d.allCompaniesList),
  });
}

export function usePlatformStaff() {
  return useQuery({
    queryKey: ['platform-staff'],
    queryFn: () => gql<{ staff: PlatformStaff[] }>(STAFF_QUERY).then((d) => d.staff),
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ['platform-audit-logs'],
    queryFn: () => gql<{ auditLogsList: AuditLog[] }>(AUDIT_LOGS_QUERY).then((d) => d.auditLogsList),
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['platform-subscription-plans'],
    queryFn: () => gql<{ subscriptionPlans: SubscriptionPlanConfig[] }>(SUBSCRIPTION_PLANS_QUERY).then((d) => d.subscriptionPlans),
  });
}

export function usePlatformRevenue() {
  return useQuery({
    queryKey: ['platform-revenue'],
    queryFn: () => gql<{ platformRevenue: PlatformRevenue }>(PLATFORM_REVENUE_QUERY).then((d) => d.platformRevenue),
  });
}

export function useApproveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: number) =>
      gql(APPROVE_COMPANY_MUTATION, { companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-companies'] }); qc.invalidateQueries({ queryKey: ['platform-stats'] }); },
  });
}

export function useSuspendCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, comment }: { companyId: number; comment?: string }) =>
      gql(SUSPEND_COMPANY_MUTATION, { companyId, comment }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-companies'] }); qc.invalidateQueries({ queryKey: ['platform-stats'] }); },
  });
}

export function useReactivateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: number) =>
      gql(REACTIVATE_COMPANY_MUTATION, { companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-companies'] }); qc.invalidateQueries({ queryKey: ['platform-stats'] }); },
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { username: string; email: string; password: string; role: string }) =>
      gql(CREATE_STAFF_MUTATION, vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-staff'] }); },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Record<string, unknown>) => gql(UPDATE_PLAN_MUTATION, vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-subscription-plans'] }); },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function fmtK(v: number) {
  return `K ${(v ?? 0).toLocaleString('en-ZM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function companyStatus(c: Company): 'active' | 'pending' | 'suspended' {
  if (c.isSuspended) return 'suspended';
  if (c.isApproved) return 'active';
  return 'pending';
}
