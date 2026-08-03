import React, { useState } from 'react';
import {
  User, Mail, Phone, IdCard, Lock, Bell, HelpCircle, FileText,
  LogOut, X, ChevronRight, Loader2, CheckCircle2, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useMyBookings } from '@/lib/api';
import { gql } from '@/lib/graphql';
import type { AuthUser } from '@/lib/graphql';

interface Props {
  user: AuthUser;
  onClose: () => void;
  onLogout: () => void;
}

type Panel = null | 'edit' | 'password' | 'notifications' | 'help' | 'terms';

// ── Change-password panel ───────────────────────────────────────────────────

const ChangePassword: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (k: string) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (form.next !== form.confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await gql(
        `mutation ChangePassword($current: String!, $newPassword: String!) {
           changePassword(currentPassword: $current, newPassword: $newPassword) { ok }
         }`,
        { current: form.current, newPassword: form.next },
      );
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-900 mb-1">Password changed!</h3>
        <p className="text-slate-500 text-sm mb-6">Your new password is active.</p>
        <Button onClick={onBack} className="bg-blue-700 hover:bg-blue-800 text-white">Back to Profile</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="font-bold text-slate-900 text-lg mb-1">Change Password</h3>
      {[
        { label: 'Current password', key: 'current' },
        { label: 'New password', key: 'next' },
        { label: 'Confirm new password', key: 'confirm' },
      ].map(({ label, key }) => (
        <div key={key}>
          <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
          <div className="relative mt-1">
            <input
              type={show[key] ? 'text' : 'password'}
              value={(form as Record<string, string>)[key]}
              onChange={f(key as keyof typeof form)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => toggle(key)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {key === 'next' && form.next.length > 0 && (
            <div className={`text-xs mt-1 font-semibold ${form.next.length >= 12 ? 'text-green-600' : form.next.length >= 8 ? 'text-yellow-600' : 'text-red-500'}`}>
              {form.next.length >= 12 ? 'Strong' : form.next.length >= 8 ? 'Good' : 'Too short (min 8)'}
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="bg-blue-700 hover:bg-blue-800 text-white">
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Save Password
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
      </div>
    </form>
  );
};

// ── Edit profile panel ──────────────────────────────────────────────────────

const EditProfile: React.FC<{ user: AuthUser; onBack: () => void }> = ({ user, onBack }) => {
  const [form, setForm] = useState({
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone ?? '',
    nationalId: '',
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await gql(
        `mutation UpdateProfile($firstName: String, $lastName: String, $phone: String, $nationalId: String) {
           updateProfile(firstName: $firstName, lastName: $lastName, phone: $phone, nationalId: $nationalId) { ok }
         }`,
        form,
      );
      setDone(true);
      toast.success('Profile updated!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-900 mb-1">Profile updated!</h3>
        <p className="text-slate-500 text-sm mb-6">Your changes have been saved.</p>
        <Button onClick={onBack} className="bg-blue-700 hover:bg-blue-800 text-white">Back to Profile</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-slate-900 text-lg">Edit Profile</h3>
      </div>
      {([
        { key: 'firstName', label: 'First Name', icon: <User className="w-4 h-4 text-blue-600" /> },
        { key: 'lastName', label: 'Last Name', icon: <User className="w-4 h-4 text-blue-600" /> },
        { key: 'phone', label: 'Phone Number', icon: <Phone className="w-4 h-4 text-blue-600" /> },
        { key: 'nationalId', label: 'National ID / NRC', icon: <IdCard className="w-4 h-4 text-blue-600" /> },
      ] as { key: keyof typeof form; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
        <div key={key}>
          <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
            <input
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form[key]} onChange={f(key)}
              placeholder={label}
            />
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
        Email and username cannot be changed here. Contact support if you need to update them.
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 text-white">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
      </Button>
    </form>
  );
};

// ── Main profile component ──────────────────────────────────────────────────

const CustomerProfile: React.FC<Props> = ({ user, onClose, onLogout }) => {
  const [panel, setPanel] = useState<Panel>(null);
  const { data: bookings = [] } = useMyBookings();

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  const initials = displayName.slice(0, 2).toUpperCase();
  const upcoming = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length;

  const menuItems = [
    { icon: User, label: 'Edit Profile', panel: 'edit' as Panel },
    { icon: Lock, label: 'Change Password', panel: 'password' as Panel },
    { icon: Bell, label: 'Notification Preferences', panel: 'notifications' as Panel },
    { icon: HelpCircle, label: 'Help & Support', panel: 'help' as Panel },
    { icon: FileText, label: 'Terms & Privacy', panel: 'terms' as Panel },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">My Profile</h2>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {initials}
            </div>
            <div>
              <div className="font-bold text-xl">{displayName}</div>
              <div className="text-blue-200 text-sm">{user.email}</div>
            </div>
          </div>
          <div className="flex gap-6 mt-5">
            <div className="text-center">
              <div className="font-bold text-lg">{bookings.length}</div>
              <div className="text-blue-200 text-xs">Total Bookings</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{upcoming}</div>
              <div className="text-blue-200 text-xs">Upcoming</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">4.8 ★</div>
              <div className="text-blue-200 text-xs">Rating</div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Sub-panels */}
          {panel === 'edit' && <EditProfile user={user} onBack={() => setPanel(null)} />}
          {panel === 'password' && <ChangePassword onBack={() => setPanel(null)} />}

          {panel === 'notifications' && (
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-4">Notification Preferences</h3>
              {[
                { label: 'Booking confirmations', sub: 'When your booking is confirmed' },
                { label: 'Trip reminders', sub: '24 hours before departure' },
                { label: 'Cancellation alerts', sub: 'When a trip is cancelled' },
                { label: 'Promotional offers', sub: 'Discounts and deals' },
              ].map(({ label, sub }) => (
                <label key={label} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg mb-2 cursor-pointer hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{label}</div>
                    <div className="text-xs text-slate-500">{sub}</div>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-blue-700" />
                </label>
              ))}
              <Button variant="outline" className="mt-3" onClick={() => setPanel(null)}>Back</Button>
            </div>
          )}

          {panel === 'help' && (
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-4">Help & Support</h3>
              <div className="space-y-3 text-sm text-slate-700">
                {[
                  { q: 'How do I cancel a booking?', a: 'Go to My Bookings, find the upcoming booking and tap Cancel. Refunds process in 3–5 business days.' },
                  { q: 'Can I change my seat after booking?', a: 'Contact support at support@busgo.com with your booking reference.' },
                  { q: 'What payment methods are accepted?', a: 'We accept cash (walk-in), card, and mobile money.' },
                  { q: 'How do I get my e-ticket?', a: 'After booking, go to My Bookings and tap View Ticket to see your QR code.' },
                ].map(({ q, a }) => (
                  <details key={q} className="border border-slate-200 rounded-lg p-3">
                    <summary className="font-semibold cursor-pointer text-slate-900">{q}</summary>
                    <p className="mt-2 text-slate-600 text-sm">{a}</p>
                  </details>
                ))}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-1">Contact Support</div>
                  <div className="text-sm text-blue-700">📧 support@busgo.com</div>
                  <div className="text-sm text-blue-700">📞 +260 97 000 0000</div>
                </div>
              </div>
              <Button variant="outline" className="mt-4" onClick={() => setPanel(null)}>Back</Button>
            </div>
          )}

          {panel === 'terms' && (
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-4">Terms & Privacy</h3>
              <div className="text-sm text-slate-600 space-y-3">
                <p>By using BusGo, you agree to our Terms of Service and Privacy Policy.</p>
                <p>We collect only the information necessary to process your bookings: name, contact details, and payment references. We never sell your personal data.</p>
                <p>Cancellation policy: full refund if cancelled 24h+ before departure; 50% refund within 24h; no refund for no-shows.</p>
                <p>For the full terms, contact support@busgo.com.</p>
              </div>
              <Button variant="outline" className="mt-4" onClick={() => setPanel(null)}>Back</Button>
            </div>
          )}

          {/* Default view */}
          {panel === null && (
            <>
              {/* Account details card */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Account Details</div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-medium">{displayName}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{user.email || '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{user.phone || 'Not set'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <IdCard className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-slate-400">@{user.username}</span>
                </div>
              </div>

              {/* Menu */}
              <div className="space-y-1">
                {menuItems.map(({ icon: Icon, label, panel: p }) => (
                  <button key={label} onClick={() => setPanel(p)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 transition text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-blue-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-800">{label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <button onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition text-red-600">
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-semibold">Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;
