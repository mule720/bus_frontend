import React, { useState } from 'react';
import { X, Bus, Building2, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLogin, useSignUpCustomer, useSignUpCompany } from '@/lib/api';
import type { AuthUser } from '@/lib/graphql';

interface Props {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  onForgotPassword?: () => void;
}

const AuthModal: React.FC<Props> = ({ mode: initialMode, onClose, onSuccess, onForgotPassword }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [role, setRole] = useState<'customer' | 'admin'>('customer');
  const [form, setForm] = useState({
    name: '', email: '', username: '', phone: '', password: '',
    company: '', companyAddress: '', companyPhone: '', companyEmail: '',
  });

  const login = useLogin();
  const signUpCustomer = useSignUpCustomer();
  const signUpCompany = useSignUpCompany();

  const loading = login.isPending || signUpCustomer.isPending || signUpCompany.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        if (!form.username || !form.password) { toast.error('Enter username and password'); return; }
        const user = await login.mutateAsync({ username: form.username, password: form.password });
        toast.success('Welcome back!');
        onSuccess(user);
      } else {
        if (!form.username || !form.email || !form.password) { toast.error('Fill all required fields'); return; }
        if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        const [firstName, ...rest] = (form.name || '').trim().split(' ');
        const lastName = rest.join(' ');
        let user: AuthUser;
        if (role === 'admin') {
          if (!form.company) { toast.error('Enter your company name'); return; }
          if (!form.companyAddress) { toast.error('Enter your company address'); return; }
          if (!form.companyPhone) { toast.error('Enter your company phone'); return; }
          if (!form.companyEmail) { toast.error('Enter your company email'); return; }
          user = await signUpCompany.mutateAsync({
            username: form.username, email: form.email, password: form.password,
            companyName: form.company, firstName, lastName, phone: form.phone,
            companyAddress: form.companyAddress,
            companyPhone: form.companyPhone,
            companyEmail: form.companyEmail,
          });
        } else {
          user = await signUpCustomer.mutateAsync({
            username: form.username, email: form.email, password: form.password,
            firstName, lastName, phone: form.phone,
          });
        }
        toast.success('Account created!');
        onSuccess(user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(msg);
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative p-6 bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Bus className="w-6 h-6" />
            </div>
            <span className="font-bold text-lg">BusGo</span>
          </div>
          <h2 className="text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="text-blue-100 text-sm mt-1">
            {mode === 'login' ? 'Sign in to manage bookings' : 'Start booking in under a minute'}
          </p>
        </div>

        <div className="p-6">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([
                { id: 'customer', label: 'Traveller', sub: 'Book tickets', Icon: User },
                { id: 'admin', label: 'Bus Company', sub: 'Manage trips', Icon: Building2 },
              ] as const).map(({ id, label, sub, Icon }) => (
                <button key={id} onClick={() => setRole(id)}
                  className={`p-3 rounded-lg border-2 text-left transition ${role === id ? 'border-blue-700 bg-blue-50' : 'border-slate-200'}`}>
                  <Icon className="w-4 h-4 mb-1 text-blue-700" />
                  <div className="text-sm font-bold">{label}</div>
                  <div className="text-xs text-slate-500">{sub}</div>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <input type="text" placeholder="Full name" value={form.name} onChange={f('name')}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                {role === 'admin' && (
                  <>
                    <input type="text" placeholder="Company name *" value={form.company} onChange={f('company')}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    <input type="text" placeholder="Company address *" value={form.companyAddress} onChange={f('companyAddress')}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    <input type="tel" placeholder="Company phone *" value={form.companyPhone} onChange={f('companyPhone')}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    <input type="email" placeholder="Company email *" value={form.companyEmail} onChange={f('companyEmail')}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </>
                )}
                <input type="tel" placeholder="Phone number" value={form.phone} onChange={f('phone')}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <input type="email" placeholder="Email address" value={form.email} onChange={f('email')}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </>
            )}
            <input
              type="text"
              placeholder={mode === 'login' ? 'Username' : 'Choose a username'}
              value={form.username}
              onChange={f('username')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <input type="password" placeholder="Password" value={form.password} onChange={f('password')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            {mode === 'login' && onForgotPassword && (
              <div className="text-right -mt-1">
                <button type="button" onClick={onForgotPassword}
                  className="text-xs text-blue-700 hover:underline font-semibold">
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="text-center mt-4 text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-blue-700 font-semibold hover:underline">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
