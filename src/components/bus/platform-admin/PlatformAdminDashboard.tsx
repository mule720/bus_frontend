import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Building2, DollarSign, CreditCard, Users,
  Activity, LogOut, Menu, ChevronDown, Shield, Bell,
  BarChart2, Ticket, Megaphone, HeadphonesIcon, MapPin, Settings,
  Wallet,
} from 'lucide-react';
import PlatformOverview from './PlatformOverview';
import CompanyManagement from './CompanyManagement';
import PlatformFinance from './PlatformFinance';
import SubscriptionPlans from './SubscriptionPlans';
import PlatformStaffMgmt from './PlatformStaffMgmt';
import PlatformAuditLog from './PlatformAuditLog';
import AnalyticsDashboard from './AnalyticsDashboard';
import BookingManagement from './BookingManagement';
import CustomerManagement from './CustomerManagement';
import PayoutManagement from './PayoutManagement';
import AnnouncementsPanel from './AnnouncementsPanel';
import SupportTickets from './SupportTickets';
import StationRegistry from './StationRegistry';
import PlatformSettingsPage from './PlatformSettingsPage';
import { usePlatformStats } from '@/lib/platformAdminApi';

type Section =
  | 'overview' | 'analytics' | 'companies' | 'bookings' | 'customers'
  | 'finance' | 'payouts' | 'plans' | 'staff' | 'announcements'
  | 'tickets' | 'stations' | 'settings' | 'audit';

interface Props {
  userName: string;
  staffRole?: string;
  onLogout: () => void;
}

type NavGroup = {
  label: string;
  items: {
    key: Section;
    label: string;
    icon: React.ReactNode;
    badge?: (stats: any) => string | null;
  }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { key: 'overview',   label: 'Dashboard',      icon: <LayoutDashboard className="w-4 h-4" /> },
      { key: 'analytics',  label: 'Analytics',       icon: <BarChart2 className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Operators',
    items: [
      {
        key: 'companies', label: 'Companies', icon: <Building2 className="w-4 h-4" />,
        badge: (s) => s?.pendingCompanies > 0 ? String(s.pendingCompanies) : null,
      },
      { key: 'bookings',   label: 'Bookings',        icon: <Ticket className="w-4 h-4" /> },
      { key: 'customers',  label: 'Customers',        icon: <Users className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'finance',   label: 'Revenue',           icon: <DollarSign className="w-4 h-4" /> },
      { key: 'payouts',   label: 'Payouts',            icon: <Wallet className="w-4 h-4" /> },
      { key: 'plans',     label: 'Subscription Plans', icon: <CreditCard className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Platform',
    items: [
      { key: 'staff',         label: 'Platform Staff',  icon: <Shield className="w-4 h-4" /> },
      { key: 'announcements', label: 'Announcements',   icon: <Megaphone className="w-4 h-4" /> },
      { key: 'tickets',       label: 'Support Tickets', icon: <HeadphonesIcon className="w-4 h-4" /> },
      { key: 'stations',      label: 'Station Registry',icon: <MapPin className="w-4 h-4" /> },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'audit',    label: 'Audit Log',    icon: <Activity className="w-4 h-4" /> },
      { key: 'settings', label: 'Settings',     icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

const SECTION_LABEL: Record<Section, string> = {
  overview: 'Dashboard', analytics: 'Analytics', companies: 'Companies',
  bookings: 'Bookings', customers: 'Customers', finance: 'Revenue',
  payouts: 'Payouts', plans: 'Subscription Plans', staff: 'Platform Staff',
  announcements: 'Announcements', tickets: 'Support Tickets',
  stations: 'Station Registry', audit: 'Audit Log', settings: 'Settings',
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', ops_manager: 'Ops Manager',
  finance: 'Finance', support: 'Support', moderator: 'Moderator',
};

const PlatformAdminDashboard: React.FC<Props> = ({ userName, staffRole, onLogout }) => {
  const [section, setSection] = useState<Section>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const { data: stats } = usePlatformStats();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (s: Section) => { setSection(s); setMobileOpen(false); };

  const initials = userName
    .split(' ').map((n) => n[0]?.toUpperCase() ?? '').slice(0, 2).join('');

  const Sidebar = (
    <aside className="flex flex-col h-full w-64 bg-slate-900 text-white overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">BusGo Admin</p>
          <p className="text-slate-400 text-xs">Platform Control</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const badge = item.badge?.(stats);
                const active = section === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => go(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition group
                      ${active
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/8'
                      }`}
                  >
                    <span className={active ? 'text-white' : 'text-slate-500 group-hover:text-white'}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge && (
                      <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{userName}</p>
            <p className="text-slate-500 text-xs">{ROLE_LABEL[staffRole ?? ''] ?? 'Platform Admin'}</p>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col h-full">{Sidebar}</div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col h-full z-10">{Sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 h-14 bg-white border-b border-slate-100 flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <h2 className="text-slate-800 font-semibold text-sm">
              {SECTION_LABEL[section]}
            </h2>
          </div>

          {(stats?.pendingCompanies ?? 0) > 0 && (
            <button
              onClick={() => go('companies')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition"
            >
              <Bell className="w-3.5 h-3.5" />
              {stats!.pendingCompanies} pending {stats!.pendingCompanies === 1 ? 'approval' : 'approvals'}
            </button>
          )}

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-slate-800 font-semibold text-xs">{userName}</p>
                  <p className="text-slate-400 text-xs">{ROLE_LABEL[staffRole ?? ''] ?? 'Platform Admin'}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 text-sm transition"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-6">
          {section === 'overview'      && <PlatformOverview onNavigate={(s) => go(s as Section)} />}
          {section === 'analytics'     && <AnalyticsDashboard />}
          {section === 'companies'     && <CompanyManagement />}
          {section === 'bookings'      && <BookingManagement />}
          {section === 'customers'     && <CustomerManagement />}
          {section === 'finance'       && <PlatformFinance />}
          {section === 'payouts'       && <PayoutManagement />}
          {section === 'plans'         && <SubscriptionPlans />}
          {section === 'staff'         && <PlatformStaffMgmt />}
          {section === 'announcements' && <AnnouncementsPanel />}
          {section === 'tickets'       && <SupportTickets />}
          {section === 'stations'      && <StationRegistry />}
          {section === 'audit'         && <PlatformAuditLog />}
          {section === 'settings'      && <PlatformSettingsPage />}
        </main>
      </div>
    </div>
  );
};

export default PlatformAdminDashboard;
