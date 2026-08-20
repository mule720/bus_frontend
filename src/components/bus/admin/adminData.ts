export type TripStatus = 'Scheduled' | 'Boarding' | 'In Transit' | 'Completed' | 'Cancelled';
export type BusType = 'Standard' | 'Luxury' | 'VIP';

export interface AdminTrip {
  id: string;
  origin: string;
  destination: string;
  departDate: string;
  departTime: string;
  arriveTime: string;
  busType: BusType;
  totalSeats: number;
  bookedSeats: number;
  price: number;
  amenities: string[];
  stops: string[];
  recurring: string; // 'none' | 'daily' | 'weekdays' | 'custom'
  status: TripStatus;
  revenue: number;
}

export type PermissionKey =
  | 'sell_tickets'
  | 'walk_in_sales'
  | 'scan_tickets'
  | 'cancel_bookings'
  | 'reconcile_cash'
  | 'manage_notifications'
  | 'create_trips'
  | 'manage_seats'
  | 'view_reports'
  | 'manage_customers'
  | 'manage_employees'
  | 'manage_trip_staff'
  | 'manage_buses'
  | 'manage_stations'
  | 'manage_subscription'
  | 'super_user';

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; desc: string }> = {
  sell_tickets:          { label: 'Point of Sale',         desc: 'Walk-in POS ticket sales' },
  walk_in_sales:         { label: 'Walk-in Sales',         desc: 'Legacy POS permission key' },
  scan_tickets:          { label: 'Ticket Scanner',        desc: 'Scan and board passengers' },
  cancel_bookings:       { label: 'Cancel Bookings',       desc: 'Cancel any booking on company trips' },
  reconcile_cash:        { label: 'Cash Reconciliation',   desc: 'Record cash collected for walk-in bookings' },
  manage_notifications:  { label: 'Send Notifications',    desc: 'Send announcements and alerts to passengers' },
  create_trips:          { label: 'Trip Management',       desc: 'Schedule and manage trips' },
  manage_seats:          { label: 'Seat Availability',     desc: 'View seat maps and close sales' },
  view_reports:          { label: 'Sales & Reports',       desc: 'Access revenue and sales data' },
  manage_customers:      { label: 'Customer Lookup',       desc: 'Search bookings and reprint tickets' },
  manage_employees:      { label: 'Staff Management',      desc: 'Create and manage staff accounts' },
  manage_trip_staff:     { label: 'Trip Staffing',         desc: 'Assign sellers, bus and driver per trip' },
  manage_buses:          { label: 'Fleet Management',      desc: 'Register and update buses' },
  manage_stations:       { label: 'Station Management',    desc: 'Create and edit departure stations' },
  manage_subscription:   { label: 'Subscription',          desc: 'Manage company subscription' },
  super_user:            { label: 'Super User',            desc: 'Full access to all features' },
};

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive';
  permissions: PermissionKey[];
  createdAt: string;
}

export const SAMPLE_ADMIN_TRIPS: AdminTrip[] = [
  {
    id: 'TR-1001', origin: 'New York', destination: 'Boston',
    departDate: '2026-04-20', departTime: '06:30', arriveTime: '10:45',
    busType: 'Luxury', totalSeats: 40, bookedSeats: 28, price: 45,
    amenities: ['WiFi', 'AC', 'USB', 'Meals'], stops: ['Hartford'],
    recurring: 'daily', status: 'Scheduled', revenue: 1260,
  },
  {
    id: 'TR-1002', origin: 'New York', destination: 'Boston',
    departDate: '2026-04-20', departTime: '16:00', arriveTime: '20:15',
    busType: 'Luxury', totalSeats: 40, bookedSeats: 22, price: 42,
    amenities: ['WiFi', 'AC', 'USB', 'Meals'], stops: ['Hartford'],
    recurring: 'daily', status: 'Boarding', revenue: 924,
  },
  {
    id: 'TR-1003', origin: 'Boston', destination: 'New York',
    departDate: '2026-04-20', departTime: '11:00', arriveTime: '15:15',
    busType: 'Standard', totalSeats: 44, bookedSeats: 35, price: 29,
    amenities: ['WiFi', 'AC'], stops: [],
    recurring: 'daily', status: 'In Transit', revenue: 1015,
  },
  {
    id: 'TR-1004', origin: 'New York', destination: 'Washington DC',
    departDate: '2026-04-19', departTime: '08:00', arriveTime: '12:30',
    busType: 'VIP', totalSeats: 28, bookedSeats: 28, price: 69,
    amenities: ['WiFi', 'AC', 'USB', 'Meals', 'Entertainment'], stops: [],
    recurring: 'weekdays', status: 'Completed', revenue: 1932,
  },
  {
    id: 'TR-1005', origin: 'New York', destination: 'Philadelphia',
    departDate: '2026-04-18', departTime: '14:30', arriveTime: '17:00',
    busType: 'Standard', totalSeats: 44, bookedSeats: 10, price: 22,
    amenities: ['AC'], stops: [],
    recurring: 'none', status: 'Cancelled', revenue: 0,
  },
  {
    id: 'TR-1006', origin: 'Boston', destination: 'Washington DC',
    departDate: '2026-04-21', departTime: '07:00', arriveTime: '14:30',
    busType: 'Luxury', totalSeats: 40, bookedSeats: 12, price: 55,
    amenities: ['WiFi', 'AC', 'USB'], stops: ['New York'],
    recurring: 'daily', status: 'Scheduled', revenue: 660,
  },
];

export const SAMPLE_EMPLOYEES: Employee[] = [
  {
    id: 'EMP-001', fullName: 'Sarah Johnson', email: 'sarah@swiftline.com', phone: '+1 555-0101',
    role: 'Operations Manager', status: 'active',
    permissions: ['create_trips', 'manage_seats', 'view_reports'], createdAt: '2025-11-14',
  },
  {
    id: 'EMP-002', fullName: 'Marcus Chen', email: 'marcus@swiftline.com', phone: '+1 555-0102',
    role: 'Counter Agent', status: 'active',
    permissions: ['sell_tickets', 'manage_customers'], createdAt: '2025-12-02',
  },
  {
    id: 'EMP-003', fullName: 'Priya Patel', email: 'priya@swiftline.com', phone: '+1 555-0103',
    role: 'Financial Analyst', status: 'active',
    permissions: ['view_reports'], createdAt: '2026-01-10',
  },
  {
    id: 'EMP-004', fullName: 'David Okonkwo', email: 'david@swiftline.com', phone: '+1 555-0104',
    role: 'Dispatcher', status: 'inactive',
    permissions: ['create_trips', 'manage_seats'], createdAt: '2026-02-05',
  },
  {
    id: 'EMP-005', fullName: 'Elena Rodriguez', email: 'elena@swiftline.com', phone: '+1 555-0105',
    role: 'Counter Agent', status: 'active',
    permissions: ['sell_tickets'], createdAt: '2026-03-12',
  },
];

export const REVENUE_BY_DAY = [
  { day: 'Mon', revenue: 3200, tickets: 82 },
  { day: 'Tue', revenue: 2850, tickets: 71 },
  { day: 'Wed', revenue: 4100, tickets: 104 },
  { day: 'Thu', revenue: 3650, tickets: 91 },
  { day: 'Fri', revenue: 5800, tickets: 145 },
  { day: 'Sat', revenue: 6900, tickets: 172 },
  { day: 'Sun', revenue: 4950, tickets: 124 },
];

export const REVENUE_BY_MONTH = [
  { month: 'Nov', revenue: 82000 },
  { month: 'Dec', revenue: 95000 },
  { month: 'Jan', revenue: 88000 },
  { month: 'Feb', revenue: 102000 },
  { month: 'Mar', revenue: 115000 },
  { month: 'Apr', revenue: 78000 },
];

export const OCCUPANCY_BY_ROUTE = [
  { route: 'NY → Boston', occupancy: 82 },
  { route: 'Boston → NY', occupancy: 76 },
  { route: 'NY → DC', occupancy: 91 },
  { route: 'NY → Philly', occupancy: 64 },
  { route: 'Boston → DC', occupancy: 58 },
];
