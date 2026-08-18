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

// ── New types ──────────────────────────────────────────────────────────────────

export interface RevenueMonth {
  month: string; // "2025-01"
  subscriptionRevenue: number;
  commissionRevenue: number;
  bookingCount: number;
  bookingRevenue: number;
}
export interface GrowthPoint { month: string; count: number; }
export interface TopCompany { companyId: number; companyName: string; bookingRevenue: number; bookingCount: number; }
export interface TopRoute { routeFrom: string; routeTo: string; bookingCount: number; bookingRevenue: number; }
export interface PlatformAnalytics {
  monthlyRevenue: RevenueMonth[];
  companyGrowth: GrowthPoint[];
  topCompanies: TopCompany[];
  topRoutes: TopRoute[];
}
export interface PlatformBooking {
  id: number;
  referenceCode: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  isWalkin: boolean;
  seats: number[];
  passengerDetails: any[];
  createdAt: string;
  tripId: number;
  routeFrom: string;
  routeTo: string;
  departureTime: string;
  companyName: string;
  companyId: number;
  customerUsername: string;
  customerPhone: string;
}
export interface PlatformCustomer {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  dateJoined: string;
  isActive: boolean;
  bookingCount: number;
  totalSpent: number;
}
export interface CompanyDetail {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  registrationNumber: string;
  isApproved: boolean;
  isSuspended: boolean;
  createdAt: string;
  activePlan: string | null;
  billingCycle: string | null;
  subscriptionEndsAt: string | null;
  totalTrips: number;
  totalEmployees: number;
  totalBuses: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  trips: { id: number; routeFrom: string; routeTo: string; departureTime: string; status: string; price: number }[];
  employees: { id: number; username: string; fullName: string; email: string; role: string; isActive: boolean }[];
  buses: { id: number; plateNumber: string; capacity: number; busType: string }[];
}

// ── New GraphQL documents ──────────────────────────────────────────────────────

const ANALYTICS_QUERY = `
  query PlatformAnalytics {
    analytics {
      monthlyRevenue { month subscriptionRevenue commissionRevenue bookingCount bookingRevenue }
      companyGrowth { month count }
      topCompanies { companyId companyName bookingRevenue bookingCount }
      topRoutes { routeFrom routeTo bookingCount bookingRevenue }
    }
  }
`;

const ALL_BOOKINGS_QUERY = `
  query AllBookings($search: String, $status: String, $companyId: Int, $limit: Int) {
    allBookings(search: $search, status: $status, companyId: $companyId, limit: $limit) {
      id referenceCode status totalAmount paymentMethod isWalkin
      seats passengerDetails createdAt tripId
      routeFrom routeTo departureTime companyName companyId
      customerUsername customerPhone
    }
  }
`;

const CANCEL_BOOKING_MUTATION = `
  mutation CancelBooking($bookingId: Int!, $reason: String) {
    cancelBooking(bookingId: $bookingId, reason: $reason) { ok message }
  }
`;

const ALL_CUSTOMERS_QUERY = `
  query AllCustomers($search: String, $limit: Int) {
    allCustomers(search: $search, limit: $limit) {
      id username email fullName phone dateJoined isActive bookingCount totalSpent
    }
  }
`;

const BAN_CUSTOMER_MUTATION = `
  mutation BanCustomer($customerId: Int!, $ban: Boolean!) {
    banCustomer(customerId: $customerId, ban: $ban) { ok }
  }
`;

const COMPANY_DETAIL_QUERY = `
  query CompanyDetail($companyId: Int!) {
    companyDetail(companyId: $companyId) {
      id name email phone address registrationNumber isApproved isSuspended createdAt
      activePlan billingCycle subscriptionEndsAt
      totalTrips totalEmployees totalBuses totalBookings confirmedBookings totalRevenue
      trips { id routeFrom routeTo departureTime status price }
      employees { id username fullName email role isActive }
      buses { id plateNumber capacity busType }
    }
  }
`;

// ── New React Query hooks ──────────────────────────────────────────────────────

export function usePlatformAnalytics() {
  return useQuery({
    queryKey: ['platform-analytics'],
    queryFn: () => gql<{ analytics: PlatformAnalytics }>(ANALYTICS_QUERY).then(d => d.analytics),
    staleTime: 5 * 60_000,
  });
}

export function useAllBookings(vars?: { search?: string; status?: string; companyId?: number; limit?: number }) {
  return useQuery({
    queryKey: ['platform-bookings', vars],
    queryFn: () => gql<{ allBookings: PlatformBooking[] }>(ALL_BOOKINGS_QUERY, vars ?? {}).then(d => d.allBookings),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { bookingId: number; reason?: string }) => gql(CANCEL_BOOKING_MUTATION, vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-bookings'] }); qc.invalidateQueries({ queryKey: ['platform-stats'] }); },
  });
}

export function useAllCustomers(vars?: { search?: string; limit?: number }) {
  return useQuery({
    queryKey: ['platform-customers', vars],
    queryFn: () => gql<{ allCustomers: PlatformCustomer[] }>(ALL_CUSTOMERS_QUERY, vars ?? {}).then(d => d.allCustomers),
  });
}

export function useBanCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { customerId: number; ban: boolean }) => gql(BAN_CUSTOMER_MUTATION, vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-customers'] }); },
  });
}

export function useCompanyDetail(companyId: number | null) {
  return useQuery({
    queryKey: ['platform-company-detail', companyId],
    queryFn: () => gql<{ companyDetail: CompanyDetail }>(COMPANY_DETAIL_QUERY, { companyId }).then(d => d.companyDetail),
    enabled: companyId !== null,
  });
}

// ── Payout / Announcement / Ticket / Station / Settings types ─────────────────

export interface Payout {
  id: number;
  company: { id: number; name: string };
  amount: number;
  periodStart: string;
  periodEnd: string;
  status: 'pending' | 'paid' | 'cancelled';
  reference: string;
  notes: string;
  paidAt: string | null;
  createdAt: string;
}
export interface Announcement {
  id: number;
  title: string;
  body: string;
  target: string;
  isActive: boolean;
  createdAt: string;
  createdBy: { username: string } | null;
}
export interface SupportTicket {
  id: number;
  company: { id: number; name: string } | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: { username: string } | null;
  resolution: string;
  createdAt: string;
  updatedAt: string;
}
export interface PlatformStationItem {
  id: number;
  name: string;
  city: string;
  province: string;
  country: string;
  address: string;
  isActive: boolean;
  createdAt: string;
}
export interface PlatformSettingItem {
  key: string;
  value: string;
  label: string;
  description: string;
  valueType: string;
}

// ── Payout hooks ───────────────────────────────────────────────────────────────

const PAYOUTS_QUERY = `query Payouts { payouts { id amount periodStart periodEnd status reference notes paidAt createdAt company { id name } } }`;
export function usePayouts() {
  return useQuery({ queryKey: ['platform-payouts'], queryFn: () => gql<{ payouts: Payout[] }>(PAYOUTS_QUERY).then(d => d.payouts) });
}
const CREATE_PAYOUT_MUTATION = `mutation CreatePayout($companyId: Int!, $amount: Float!, $periodStart: String!, $periodEnd: String!, $notes: String) { createPayout(companyId: $companyId, amount: $amount, periodStart: $periodStart, periodEnd: $periodEnd, notes: $notes) { payout { id amount status company { name } } } }`;
export function useCreatePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { companyId: number; amount: number; periodStart: string; periodEnd: string; notes?: string }) => gql(CREATE_PAYOUT_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-payouts'] }),
  });
}
const MARK_PAID_MUTATION = `mutation MarkPayoutPaid($payoutId: Int!, $reference: String) { markPayoutPaid(payoutId: $payoutId, reference: $reference) { payout { id status paidAt reference } } }`;
export function useMarkPayoutPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { payoutId: number; reference?: string }) => gql(MARK_PAID_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-payouts'] }),
  });
}

// ── Announcement hooks ─────────────────────────────────────────────────────────

const ANNOUNCEMENTS_QUERY = `query Announcements { announcements { id title body target isActive createdAt createdBy { username } } }`;
export function useAnnouncements() {
  return useQuery({ queryKey: ['platform-announcements'], queryFn: () => gql<{ announcements: Announcement[] }>(ANNOUNCEMENTS_QUERY).then(d => d.announcements) });
}
const CREATE_ANNOUNCEMENT_MUTATION = `mutation CreateAnnouncement($title: String!, $body: String!, $target: String) { createAnnouncement(title: $title, body: $body, target: $target) { announcement { id title body target isActive createdAt } } }`;
export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { title: string; body: string; target?: string }) => gql(CREATE_ANNOUNCEMENT_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-announcements'] }),
  });
}
const DELETE_ANNOUNCEMENT_MUTATION = `mutation DeleteAnnouncement($announcementId: Int!) { deleteAnnouncement(announcementId: $announcementId) { ok } }`;
export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: number) => gql(DELETE_ANNOUNCEMENT_MUTATION, { announcementId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-announcements'] }),
  });
}

// ── Support ticket hooks ───────────────────────────────────────────────────────

const TICKETS_QUERY = `query SupportTickets($status: String) { supportTickets(status: $status) { id subject description status priority resolution createdAt updatedAt company { id name } assignedTo { username } } }`;
export function useSupportTickets(status?: string) {
  return useQuery({ queryKey: ['platform-tickets', status], queryFn: () => gql<{ supportTickets: SupportTicket[] }>(TICKETS_QUERY, { status }).then(d => d.supportTickets) });
}
const CREATE_TICKET_MUTATION = `mutation CreateSupportTicket($subject: String!, $description: String!, $companyId: Int, $priority: String) { createSupportTicket(subject: $subject, description: $description, companyId: $companyId, priority: $priority) { ticket { id subject status priority } } }`;
export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { subject: string; description: string; companyId?: number; priority?: string }) => gql(CREATE_TICKET_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-tickets'] }),
  });
}
const UPDATE_TICKET_MUTATION = `mutation UpdateSupportTicket($ticketId: Int!, $status: String, $resolution: String, $priority: String) { updateSupportTicket(ticketId: $ticketId, status: $status, resolution: $resolution, priority: $priority) { ticket { id subject status priority resolution assignedTo { username } } } }`;
export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { ticketId: number; status?: string; resolution?: string; priority?: string }) => gql(UPDATE_TICKET_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-tickets'] }),
  });
}

// ── Station hooks ──────────────────────────────────────────────────────────────

const STATIONS_QUERY = `query PlatformStations { platformStations { id name city province country address isActive createdAt } }`;
export function usePlatformStations() {
  return useQuery({ queryKey: ['platform-stations'], queryFn: () => gql<{ platformStations: PlatformStationItem[] }>(STATIONS_QUERY).then(d => d.platformStations) });
}
const CREATE_STATION_MUTATION = `mutation CreateStation($name: String!, $city: String!, $province: String, $address: String) { createStation(name: $name, city: $city, province: $province, address: $address) { station { id name city province isActive } } }`;
export function useCreateStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; city: string; province?: string; address?: string }) => gql(CREATE_STATION_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-stations'] }),
  });
}
const UPDATE_STATION_MUTATION = `mutation UpdateStation($stationId: Int!, $name: String, $city: String, $province: String, $address: String, $isActive: Boolean) { updateStation(stationId: $stationId, name: $name, city: $city, province: $province, address: $address, isActive: $isActive) { station { id name city province address isActive } } }`;
export function useUpdateStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { stationId: number; name?: string; city?: string; province?: string; address?: string; isActive?: boolean }) => gql(UPDATE_STATION_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-stations'] }),
  });
}

// ── Settings hooks ─────────────────────────────────────────────────────────────

const SETTINGS_QUERY = `query PlatformSettings { platformSettings { key value label description valueType } }`;
export function usePlatformSettings() {
  return useQuery({ queryKey: ['platform-settings'], queryFn: () => gql<{ platformSettings: PlatformSettingItem[] }>(SETTINGS_QUERY).then(d => d.platformSettings) });
}
const UPDATE_SETTING_MUTATION = `mutation UpdateSetting($key: String!, $value: String!) { updateSetting(key: $key, value: $value) { setting { key value label } } }`;
export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: string; value: string }) => gql(UPDATE_SETTING_MUTATION, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-settings'] }),
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
