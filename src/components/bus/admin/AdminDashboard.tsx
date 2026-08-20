import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Bus, Users, BarChart3, LogOut, X, Building2, Settings,
  ShoppingCart, ScanLine, Menu, Search, MapPin, Grid3x3, UserCog, CreditCard,
  ChevronDown, ChevronRight, User, Wallet,
} from 'lucide-react';
import DashboardOverview from './DashboardOverview';
import TripManagement from './TripManagement';
import EmployeeManagement from './EmployeeManagement';
import BusManagement from './BusManagement';
import Reports from './Reports';
import POS from './POS';
import TicketScanner from './TicketScanner';
import CustomerLookup from './CustomerLookup';
import StationManagement from './StationManagement';
import SeatAvailability from './SeatAvailability';
import TripStaffing from './TripStaffing';
import Subscription from './Subscription';
import Reconciliation from './Reconciliation';
import type { PermissionKey } from './adminData';
import type { CompanyEmployeeFull } from '@/lib/api';

export type AdminRole = 'admin' | 'employee';

interface Props {
  role: AdminRole;
  userName: string;
  companyName?: string;
  permissions: PermissionKey[];
  onExit: () => void;
  onLogout: () => void;
}

type Section =
  | 'overview' | 'pos' | 'scanner' | 'trips' | 'seat-avail'
  | 'trip-staffing' | 'customers' | 'employees' | 'buses'
  | 'stations' | 'reports' | 'reconciliation' | 'subscription';

const AdminDashboard: React.FC<Props> = ({ role, userName, companyName, permissions, onExit, onLogout }) => {
  const [section, setSection] = useState<Section>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Cross-section state: employee to open in EmployeeManagement
  const [pendingEmployee, setPendingEmployee] = useState<CompanyEmployeeFull | null>(null);
  // Cross-section state: trip+seat to pre-fill in POS
  const [pendingPOSTripId, setPendingPOSTripId] = useState<string | null>(null);
  const [pendingPOSSeat, setPendingPOSSeat] = useState<number | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAdmin = role === 'admin';
  const hasPerm = (...keys: string[]) => isAdmin || keys.some((k) => permissions.includes(k as PermissionKey));

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const navGroups = [
    {
      label: 'Operations',
      items: [
        { id: 'pos'           as Section, label: 'Point of Sale',    icon: ShoppingCart,    show: hasPerm('sell_tickets', 'walk_in_sales') },
        { id: 'scanner'       as Section, label: 'Ticket Scanner',   icon: ScanLine,        show: hasPerm('scan_tickets') },
        { id: 'seat-avail'    as Section, label: 'Seat Availability',icon: Grid3x3,         show: hasPerm('manage_seats') },
        { id: 'customers'     as Section, label: 'Customer Lookup',  icon: Search,          show: hasPerm('manage_customers') },
      ].filter((i) => i.show),
    },
    {
      label: 'Management',
      items: [
        { id: 'trips'         as Section, label: 'Trips',             icon: Bus,             show: hasPerm('create_trips', 'manage_seats') },
        { id: 'trip-staffing' as Section, label: 'Trip Staffing',     icon: UserCog,         show: hasPerm('manage_trip_staff') },
        { id: 'employees'     as Section, label: 'Staff',             icon: Users,           show: isAdmin || hasPerm('manage_employees') },
        { id: 'buses'         as Section, label: 'Fleet',             icon: Bus,             show: isAdmin || hasPerm('manage_buses') },
        { id: 'stations'      as Section, label: 'Stations',          icon: MapPin,          show: isAdmin || hasPerm('manage_stations') },
      ].filter((i) => i.show),
    },
    {
      label: 'Analytics',
      items: [
        { id: 'reports'        as Section, label: 'Reports',           icon: BarChart3, show: hasPerm('view_reports') },
        { id: 'reconciliation' as Section, label: 'Reconciliation',    icon: Wallet,    show: hasPerm('view_reports') || hasPerm('sell_tickets') || hasPerm('walk_in_sales') || hasPerm('scan_tickets') || hasPerm('reconcile_cash') },
      ].filter((i) => i.show),
    },
    {
      label: 'Account',
      items: [
        { id: 'subscription'  as Section, label: 'Subscription',      icon: CreditCard,      show: isAdmin },
      ].filter((i) => i.show),
    },
  ].filter((g) => g.items.length > 0);

  const allNavItems = navGroups.flatMap((g) => g.items);

  React.useEffect(() => {
    if (!allNavItems.find((n) => n.id === section)) setSection('overview');
  }, []);

  const nav = (s: Section) => {
    setSection(s);
    setMobileOpen(false);
    // Clear cross-section pre-fills when navigating away from their target
    if (s !== 'employees') setPendingEmployee(null);
    if (s !== 'pos') { setPendingPOSTripId(null); setPendingPOSSeat(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        fixed md:sticky top-0 left-0 z-40 w-64 h-screen bg-slate-950 text-slate-300 flex flex-col transition-transform duration-200`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm truncate max-w-[130px]">{companyName ?? 'BusGo'}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Operator portal</div>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* Standalone Dashboard link */}
          <button
            onClick={() => nav('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition mb-3 ${
              section === 'overview' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            Dashboard
          </button>

          {navGroups.map((group) => {
            const collapsed = collapsedGroups.has(group.label);
            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded hover:bg-slate-800 transition group"
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-400">
                    {group.label}
                  </span>
                  {collapsed
                    ? <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                    : <ChevronDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                  }
                </button>
                {!collapsed && (
                  <div className="space-y-0.5 mt-0.5">
                    {group.items.map((item) => {
                      const active = section === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => nav(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                            active ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
          <div className="p-3 bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {userName[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{userName}</div>
                <div className="text-[10px] text-slate-400 uppercase">{isAdmin ? 'Company Admin' : 'Employee'}</div>
              </div>
            </div>
          </div>
          <button onClick={onExit} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
            <Settings className="w-4 h-4" /> Back to site
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:block text-sm text-slate-500 capitalize">
            {allNavItems.find((n) => n.id === section)?.label ?? 'Dashboard'}
            <span className="mx-2 text-slate-300">•</span>
            {isAdmin ? 'Company Admin' : 'Employee'} view
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <span className="hidden sm:inline text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">● Online</span>

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {userName[0]?.toUpperCase() ?? 'A'}
                </div>
                <span className="hidden sm:block text-sm font-semibold text-slate-800 max-w-[120px] truncate">{userName}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="font-semibold text-slate-900 truncate">{userName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{companyName ?? 'BusGo'}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                      {isAdmin ? 'Company Admin' : 'Employee'}
                    </div>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); nav('subscription'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Account Settings
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); onExit(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Back to site
                  </button>
                  <div className="border-t border-slate-100 mt-1" />
                  <button
                    onClick={() => { setProfileOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {section === 'overview'      && <DashboardOverview onNavigate={(s) => nav(s as any)} />}
          {section === 'pos'           && (
            <POS
              preselectedTripId={pendingPOSTripId}
              preselectedSeat={pendingPOSSeat}
              key={`pos-${pendingPOSTripId ?? 'default'}-${pendingPOSSeat ?? 0}`}
            />
          )}
          {section === 'scanner'       && <TicketScanner />}
          {section === 'seat-avail'    && (
            <SeatAvailability
              onGoToPOS={hasPerm('sell_tickets') ? (tripId, seatNumber) => {
                setPendingPOSTripId(tripId);
                setPendingPOSSeat(seatNumber);
                nav('pos');
              } : undefined}
            />
          )}
          {section === 'customers'     && <CustomerLookup />}
          {section === 'trips'         && <TripManagement canCreate={isAdmin || hasPerm('create_trips')} />}
          {section === 'trip-staffing' && <TripStaffing />}
          {section === 'employees'     && (
            <EmployeeManagement
              initialEmployee={pendingEmployee}
              key={pendingEmployee?.id ?? 'emp-list'}
            />
          )}
          {section === 'buses'         && <BusManagement />}
          {section === 'stations'      && (
            <StationManagement
              onViewEmployee={hasPerm('manage_employees') ? (emp) => {
                setPendingEmployee(emp);
                nav('employees');
              } : undefined}
            />
          )}
          {section === 'reports'        && <Reports />}
          {section === 'reconciliation' && <Reconciliation />}
          {section === 'subscription'  && <Subscription />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
