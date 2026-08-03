import React from 'react';
import { Bus, Bell, Menu, Ticket, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onLogin: () => void;
  onSignup: () => void;
  isLoggedIn: boolean;
  userName?: string;
  userRole?: 'customer' | 'admin' | 'employee';
  notificationCount: number;
  onNotificationsClick: () => void;
  onMyBookings: () => void;
  onProfile?: () => void;
  onLogout: () => void;
  onNavigate: (section: string) => void;
  onOpenAdmin?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onLogin, onSignup, isLoggedIn, userName, userRole, notificationCount,
  onNotificationsClick, onMyBookings, onProfile, onLogout, onNavigate, onOpenAdmin,
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const canOpenAdmin = userRole === 'admin' || userRole === 'employee';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl flex items-center justify-center">
              <Bus className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-xl text-slate-900 leading-none">BusGo</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Travel Smart</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => onNavigate('home')} className="text-sm font-medium text-slate-700 hover:text-blue-700">Search</button>
            <button onClick={() => onNavigate('routes')} className="text-sm font-medium text-slate-700 hover:text-blue-700">Routes</button>
            <button onClick={() => onNavigate('companies')} className="text-sm font-medium text-slate-700 hover:text-blue-700">Operators</button>
            <button onClick={() => onNavigate('help')} className="text-sm font-medium text-slate-700 hover:text-blue-700">Help</button>
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                {canOpenAdmin && onOpenAdmin && (
                  <Button
                    size="sm"
                    onClick={onOpenAdmin}
                    className="hidden sm:flex bg-blue-700 hover:bg-blue-800 text-white"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-1" />
                    {userRole === 'admin' ? 'Admin Panel' : 'Staff Panel'}
                  </Button>
                )}
                <button
                  onClick={onNotificationsClick}
                  className="relative p-2 rounded-lg hover:bg-slate-100 transition"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-slate-700" />
                  {notificationCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notificationCount}
                    </span>
                  )}
                </button>
                {userRole === 'customer' && (
                  <Button variant="ghost" size="sm" onClick={onMyBookings} className="hidden sm:flex">
                    <Ticket className="w-4 h-4 mr-1" /> My Tickets
                  </Button>
                )}
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
                  <button
                    onClick={userRole === 'customer' ? onProfile : undefined}
                    title={userRole === 'customer' ? 'My Profile' : userName}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold ${userRole === 'customer' ? 'hover:ring-2 hover:ring-orange-400 transition' : ''}`}
                  >
                    {userName?.[0]?.toUpperCase() ?? 'U'}
                  </button>
                  {userRole === 'customer' && onProfile && (
                    <button onClick={onProfile} className="text-sm text-slate-600 hover:text-blue-700 font-medium">Profile</button>
                  )}
                  {userRole !== 'customer' && (
                    <button onClick={onLogout} className="text-sm text-slate-600 hover:text-blue-700">Logout</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onLogin} className="hidden sm:flex">Sign In</Button>
                <Button size="sm" onClick={onSignup} className="bg-orange-500 hover:bg-orange-600 text-white">
                  Sign Up
                </Button>
              </>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-slate-200 flex flex-col gap-2">
            <button onClick={() => { onNavigate('home'); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm">Search</button>
            <button onClick={() => { onNavigate('routes'); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm">Routes</button>
            <button onClick={() => { onNavigate('companies'); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm">Operators</button>
            <button onClick={() => { onNavigate('help'); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm">Help</button>
            {isLoggedIn && userRole === 'customer' && (
              <button onClick={() => { onMyBookings(); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm">My Tickets</button>
            )}
            {isLoggedIn && userRole === 'customer' && onProfile && (
              <button onClick={() => { onProfile(); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm">My Profile</button>
            )}
            {isLoggedIn && (
              <button onClick={() => { onLogout(); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm text-red-600 font-medium">Sign Out</button>
            )}
            {isLoggedIn && canOpenAdmin && onOpenAdmin && (
              <button onClick={() => { onOpenAdmin(); setMobileOpen(false); }} className="text-left px-2 py-2 text-sm font-bold text-blue-700">
                {userRole === 'admin' ? 'Admin Panel' : 'Staff Panel'}
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
