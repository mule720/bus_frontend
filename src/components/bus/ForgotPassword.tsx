import React, { useState } from 'react';
import { X, Mail, CheckCircle2, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { gql } from '@/lib/graphql';

interface Props {
  onClose: () => void;
  onBackToLogin: () => void;
}

type Step = 'request' | 'sent' | 'reset' | 'done';

function scorePassword(p: string): { label: string; color: string; width: string } {
  if (p.length === 0) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { label: 'Weak', color: 'text-red-500', width: '20%' };
  if (score <= 2) return { label: 'Fair', color: 'text-orange-500', width: '40%' };
  if (score <= 3) return { label: 'Good', color: 'text-yellow-600', width: '65%' };
  return { label: 'Strong', color: 'text-green-600', width: '100%' };
}

const ForgotPassword: React.FC<Props> = ({ onClose, onBackToLogin }) => {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = scorePassword(password);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { toast.error('Enter your email or phone number'); return; }
    setLoading(true);
    try {
      await gql(
        `mutation RequestReset($identifier: String!) {
           requestPasswordReset(identifier: $identifier) { ok }
         }`,
        { identifier: identifier.trim() },
        false,
      );
      setStep('sent');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { toast.error('Enter the code or token from your email/SMS'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await gql(
        `mutation ConfirmReset($token: String!, $newPassword: String!) {
           confirmPasswordReset(token: $token, newPassword: $newPassword) { ok }
         }`,
        { token: code.trim(), newPassword: password },
        false,
      );
      setStep('done');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="relative p-6 bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-3">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold">
            {step === 'request' && 'Forgot password?'}
            {step === 'sent' && 'Check your inbox'}
            {step === 'reset' && 'Set new password'}
            {step === 'done' && 'Password reset!'}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {step === 'request' && 'Enter your email or phone and we\'ll send reset instructions'}
            {step === 'sent' && 'Instructions sent — check your email or SMS'}
            {step === 'reset' && 'Enter the code you received and your new password'}
            {step === 'done' && 'You can now sign in with your new password'}
          </p>
        </div>

        <div className="p-6">

          {/* Step: Request */}
          {step === 'request' && (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Email or phone number</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or +260 97..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send Reset Instructions'}
              </Button>
              <button type="button" onClick={onBackToLogin}
                className="w-full text-center text-sm text-blue-700 font-semibold hover:underline mt-1">
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* Step: Sent */}
          {step === 'sent' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-slate-700 text-sm">
                  If an account matches <span className="font-bold text-slate-900">{identifier}</span>, we've sent a reset link (email) and/or a 6-digit code (SMS).
                </p>
                <p className="text-slate-400 text-xs mt-2">Didn't receive it? Check your spam folder or try again.</p>
              </div>
              <div className="space-y-2">
                <Button onClick={() => setStep('reset')} className="w-full bg-blue-700 hover:bg-blue-800 text-white">
                  I Have a Code / Token
                </Button>
                <button onClick={() => setStep('request')}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
                  Try a different address
                </button>
                <button onClick={onBackToLogin}
                  className="w-full text-center text-sm text-blue-700 font-semibold hover:underline">
                  ← Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* Step: Reset */}
          {step === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Reset code or token</label>
                <input
                  type="text"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code or email token"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">New password</label>
                <div className="relative mt-1">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-1.5">
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-current rounded-full transition-all duration-300" style={{ width: strength.width }} />
                    </div>
                    <span className={`text-xs font-semibold ${strength.color}`}>{strength.label}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Confirm new password</label>
                <div className="relative mt-1">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-red-500 font-semibold mt-1">Passwords do not match</p>
                )}
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reset Password'}
              </Button>
              <button type="button" onClick={() => setStep('sent')}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
                ← Back
              </button>
            </form>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-slate-600 text-sm">
                Your password has been changed. Sign in with your new password.
              </p>
              <Button onClick={onBackToLogin} className="w-full bg-blue-700 hover:bg-blue-800 text-white">
                Go to Sign In
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
