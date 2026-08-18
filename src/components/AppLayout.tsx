import React, { useEffect, useState } from 'react';
import Header from './bus/Header';
import Hero from './bus/Hero';
import PopularRoutes from './bus/PopularRoutes';
import Stats from './bus/Stats';
import Features from './bus/Features';
import Footer from './bus/Footer';
import TripResults from './bus/TripResults';
import SeatSelection, { PassengerInfo } from './bus/SeatSelection';
import BookingConfirmation from './bus/BookingConfirmation';
import AuthModal from './bus/AuthModal';
import NotificationsPanel from './bus/NotificationsPanel';
import MyBookings from './bus/MyBookings';
import CustomerProfile from './bus/CustomerProfile';
import ForgotPassword from './bus/ForgotPassword';
import AdminDashboard from './bus/admin/AdminDashboard';
import PlatformAdminDashboard from './bus/platform-admin/PlatformAdminDashboard';
import type { Trip } from './bus/data';
import type { PermissionKey } from './bus/admin/adminData';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useMyPermissions } from '@/lib/api';
import { saveAuth, getToken, REFRESH_KEY } from '@/lib/graphql';
import type { AuthUser } from '@/lib/graphql';

type View =
  | { kind: 'home' }
  | { kind: 'results'; search: { from: string; to: string; date: string; passengers: number } }
  | { kind: 'booking'; trip: Trip; search: { from: string; to: string; date: string; passengers: number } }
  | { kind: 'confirmation'; trip: Trip; passengers: PassengerInfo[]; total: number; bookingRef: string; search: { from: string; to: string; date: string; passengers: number } }
  | { kind: 'mybookings' }
  | { kind: 'admin' };

const seedNotifications = [
  { id: 'n1', type: 'success' as const, title: 'Welcome to BusGo!', body: 'Book your first trip and save with promo BUS10.', time: 'Just now', read: false },
  { id: 'n2', type: 'info' as const, title: 'Track your trip', body: 'Enable notifications to get real-time bus updates.', time: '2h ago', read: false },
];

function userToAppUser(u: AuthUser, livePerms?: string[]) {
  const r = (u.role ?? '').toLowerCase().replace('-', '_');
  const isPlatformAdmin = r === 'platform_admin' || r === 'platformadmin';
  const role: 'customer' | 'admin' | 'employee' | 'platform_admin' =
    isPlatformAdmin ? 'platform_admin'
    : r === 'company_admin' ? 'admin'
    : r === 'employee' ? 'employee'
    : 'customer';
  // Priority: live permissions fetched from API > permissions stored in AuthUser > empty
  const rawPerms: string[] = livePerms ?? u.permissions ?? [];
  const permissions = rawPerms as PermissionKey[];
  return {
    ...u,
    displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username,
    appRole: role,
    companyName: u.company?.name,
    permissions,
  };
}

const AppLayout: React.FC = () => {
  const { user, setUser, logout } = useApp();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [authModal, setAuthModal] = useState<null | 'login' | 'signup'>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(seedNotifications);

  // For employees: fetch live permissions on mount so sidebar shows the right sections.
  // The query only runs when a JWT token is present and the user is an employee.
  const isEmployee = (user?.role ?? '').toLowerCase() === 'employee';
  const { data: livePerms } = useMyPermissions();

  // When live permissions arrive for an employee, persist them into the stored user
  // so they survive a page refresh without a re-fetch.
  useEffect(() => {
    if (isEmployee && livePerms && user) {
      const token = getToken();
      const refresh = localStorage.getItem(REFRESH_KEY) ?? '';
      if (token) {
        const updated = { ...user, permissions: livePerms };
        saveAuth(token, refresh, updated);
        setUser(updated);
      }
    }
  }, [livePerms, isEmployee]);

  useEffect(() => {
    if (view.kind !== 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  // Pass live permissions so the dashboard reflects the real DB state immediately.
  const appUser = user ? userToAppUser(user, isEmployee ? (livePerms ?? user.permissions) : undefined) : null;
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Auto-redirect admins/employees/platform_admin to the right panel on page load
  useEffect(() => {
    if (appUser && (appUser.appRole === 'admin' || appUser.appRole === 'employee' || appUser.appRole === 'platform_admin')) {
      setView({ kind: 'admin' });
    }
  }, []);

  const handleSearch = (search: { from: string; to: string; date: string; passengers: number }) => {
    setView({ kind: 'results', search });
  };

  const handleSelectTrip = (trip: Trip) => {
    if (view.kind === 'results') {
      setView({ kind: 'booking', trip, search: view.search });
    }
  };

  const handleConfirm = (seats: string[], passengers: PassengerInfo[], total: number, bookingRef: string) => {
    if (view.kind !== 'booking') return;
    setNotifications((prev) => [{
      id: 'n' + Date.now(), type: 'success', title: 'Booking confirmed',
      body: `Ref ${bookingRef}: ${view.trip.from} → ${view.trip.to}`,
      time: 'Just now', read: false,
    }, ...prev]);
    setView({ kind: 'confirmation', trip: view.trip, passengers, total, bookingRef, search: view.search });
  };

  const onSelectRoute = (from: string, to: string) => {
    const date = new Date().toISOString().split('T')[0];
    handleSearch({ from, to, date, passengers: 1 });
  };

  const handleNavigate = (section: string) => {
    if (section === 'home') setView({ kind: 'home' });
    else if (section === 'routes') {
      setView({ kind: 'home' });
      setTimeout(() => document.getElementById('popular-routes')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else if (section === 'companies') {
      toast.info('Operator directory coming soon');
    } else if (section === 'help') {
      toast.info('Help: support@busgo.com');
    }
  };

  const openAdmin = () => {
    if (!appUser || (appUser.appRole !== 'admin' && appUser.appRole !== 'employee' && appUser.appRole !== 'platform_admin')) {
      toast.error('Admin access required');
      return;
    }
    setView({ kind: 'admin' });
  };

  const handleAuthSuccess = (authUser: AuthUser) => {
    setUser(authUser);
    setAuthModal(null);
    const au = userToAppUser(authUser);
    if (au.appRole === 'platform_admin') {
      toast.success(`Welcome! Opening platform admin…`);
      setTimeout(() => setView({ kind: 'admin' }), 400);
    } else if (au.appRole === 'admin' || au.appRole === 'employee') {
      toast.success(`Welcome! Opening admin panel…`);
      setTimeout(() => setView({ kind: 'admin' }), 400);
    } else {
      toast.success(`Welcome, ${au.displayName}!`);
    }
  };

  const handleLogout = () => {
    logout();
    setView({ kind: 'home' });
    toast.success('Signed out');
  };

  // Platform admin — full-screen experience
  if (view.kind === 'admin' && appUser?.appRole === 'platform_admin') {
    return (
      <PlatformAdminDashboard
        userName={appUser.displayName}
        staffRole={(appUser as any).staffRole}
        onLogout={handleLogout}
      />
    );
  }

  // Company admin / employee — full-screen experience
  if (view.kind === 'admin' && appUser && (appUser.appRole === 'admin' || appUser.appRole === 'employee')) {
    return (
      <AdminDashboard
        role={appUser.appRole as 'admin' | 'employee'}
        userName={appUser.displayName}
        companyName={appUser.companyName}
        permissions={appUser.permissions}
        onExit={() => setView({ kind: 'home' })}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header
        isLoggedIn={!!user}
        userName={appUser?.displayName}
        userRole={appUser?.appRole}
        notificationCount={unreadCount}
        onLogin={() => setAuthModal('login')}
        onSignup={() => setAuthModal('signup')}
        onNotificationsClick={() => setNotifOpen(true)}
        onMyBookings={() => {
          if (!user) { setAuthModal('login'); return; }
          setView({ kind: 'mybookings' });
        }}
        onProfile={() => setProfileOpen(true)}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onOpenAdmin={openAdmin}
      />

      <main className="flex-1">
        {view.kind === 'home' && (
          <>
            <Hero onSearch={handleSearch} />
            <Stats />
            <div id="popular-routes">
              <PopularRoutes onSelectRoute={onSelectRoute} />
            </div>
            <Features />
            {appUser?.appRole === 'admin' && (
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-6 md:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-orange-300 font-bold mb-1">Bus Operator</div>
                    <h3 className="text-2xl font-bold">Manage your trips, employees & revenue</h3>
                    <p className="text-blue-100 text-sm mt-1">Schedule trips, onboard staff, and view reports.</p>
                  </div>
                  <button onClick={openAdmin}
                    className="shrink-0 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg">
                    Open Admin Panel →
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {view.kind === 'results' && (
          <TripResults
            search={view.search}
            onSelect={handleSelectTrip}
            onClose={() => setView({ kind: 'home' })}
          />
        )}

        {view.kind === 'booking' && (
          <SeatSelection
            trip={view.trip}
            passengers={view.search.passengers}
            travelDate={view.search.date}
            onBack={() => setView({ kind: 'results', search: view.search })}
            onConfirm={handleConfirm}
          />
        )}

        {view.kind === 'confirmation' && (
          <BookingConfirmation
            trip={view.trip}
            passengers={view.passengers}
            total={view.total}
            bookingRef={view.bookingRef}
            onDone={() => setView({ kind: 'home' })}
            onViewBookings={() => {
              if (!user) return;
              setView({ kind: 'mybookings' });
            }}
          />
        )}

        {view.kind === 'mybookings' && (
          <MyBookings
            onClose={() => setView({ kind: 'home' })}
          />
        )}
      </main>

      <Footer />

      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onSuccess={handleAuthSuccess}
          onForgotPassword={() => { setAuthModal(null); setForgotOpen(true); }}
        />
      )}

      {profileOpen && appUser?.appRole === 'customer' && user && (
        <CustomerProfile
          user={user}
          onClose={() => setProfileOpen(false)}
          onLogout={handleLogout}
        />
      )}

      {forgotOpen && (
        <ForgotPassword
          onClose={() => setForgotOpen(false)}
          onBackToLogin={() => { setForgotOpen(false); setAuthModal('login'); }}
        />
      )}

      {notifOpen && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setNotifOpen(false)}
          onMarkAllRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
        />
      )}
    </div>
  );
};

export default AppLayout;
