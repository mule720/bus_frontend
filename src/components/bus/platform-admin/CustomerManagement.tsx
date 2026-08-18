import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, CheckCircle2, XCircle, ShieldOff, ShieldCheck, Calendar, BookOpen } from 'lucide-react';
import {
  useAllCustomers, useBanCustomer, fmtK, type PlatformCustomer,
} from '@/lib/platformAdminApi';
import { toast } from 'sonner';

// ── Confirm Dialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  customer: PlatformCustomer;
  ban: boolean;
  onClose: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ customer, ban, onClose }) => {
  const { mutate: banCustomer, isPending } = useBanCustomer();

  const handleConfirm = () => {
    banCustomer({ customerId: customer.id, ban }, {
      onSuccess: () => {
        toast.success(`${customer.fullName || customer.username} ${ban ? 'banned' : 'unbanned'}`);
        onClose();
      },
      onError: (e: any) => toast.error(e.messages?.[0] ?? 'Action failed'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ban ? 'bg-red-100' : 'bg-emerald-100'}`}>
          {ban ? <ShieldOff className="w-5 h-5 text-red-600" /> : <ShieldCheck className="w-5 h-5 text-emerald-600" />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{ban ? 'Ban Customer' : 'Unban Customer'}</h3>
          <p className="text-sm text-slate-600 mt-1">
            {ban
              ? `Ban ${customer.fullName || customer.username}? They will no longer be able to make bookings.`
              : `Restore access for ${customer.fullName || customer.username}?`}
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={isPending}
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition ${
              ban ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isPending ? 'Processing…' : ban ? 'Ban Customer' : 'Unban Customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Customer Card ─────────────────────────────────────────────────────────────

const getInitials = (fullName: string, username: string) => {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  }
  return username.slice(0, 2);
};

const CustomerCard: React.FC<{ customer: PlatformCustomer }> = ({ customer }) => {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ ban: boolean } | null>(null);

  const initials = getInitials(customer.fullName, customer.username).toUpperCase();
  const avatarColor = customer.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500';

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          customer={customer}
          ban={showConfirm.ban}
          onClose={() => setShowConfirm(null)}
        />
      )}

      <div className={`border rounded-xl overflow-hidden bg-white transition ${
        expanded ? 'border-indigo-200' : 'border-slate-100'
      }`}>
        {/* Card header */}
        <div
          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Avatar */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor}`}>
            {initials}
          </div>

          {/* Name + username */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">
              {customer.fullName || customer.username}
            </p>
            <p className="text-slate-400 text-xs truncate">@{customer.username}</p>
          </div>

          {/* Email */}
          <p className="hidden md:block text-xs text-slate-500 truncate max-w-[160px]">{customer.email}</p>

          {/* Booking badge */}
          <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            <BookOpen className="w-3 h-3" />
            {customer.bookingCount}
          </span>

          {/* Spent */}
          <span className="text-sm font-bold text-slate-700 hidden sm:block">{fmtK(customer.totalSpent)}</span>

          {/* Status pill */}
          {customer.isActive ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              <XCircle className="w-3 h-3" /> Banned
            </span>
          )}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Email</p>
                <p className="text-slate-700 font-semibold break-all">{customer.email || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Phone</p>
                <p className="text-slate-700 font-semibold">{customer.phone || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Joined
                </p>
                <p className="text-slate-700 font-semibold">
                  {customer.dateJoined
                    ? new Date(customer.dateJoined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Total Spent</p>
                <p className="text-slate-700 font-semibold">{fmtK(customer.totalSpent)}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 text-xs">
              <div className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-center">
                <p className="text-2xl font-bold text-indigo-600">{customer.bookingCount}</p>
                <p className="text-slate-400 mt-0.5">Total Bookings</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-center">
                <p className="text-2xl font-bold text-emerald-600">{fmtK(customer.totalSpent)}</p>
                <p className="text-slate-400 mt-0.5">Lifetime Spend</p>
              </div>
            </div>

            {/* Action */}
            <div>
              {customer.isActive ? (
                <button
                  onClick={() => setShowConfirm({ ban: true })}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition"
                >
                  <ShieldOff className="w-3.5 h-3.5" /> Ban Customer
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirm({ ban: false })}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-50 transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Unban Customer
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3 bg-white">
    <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="h-4 bg-slate-100 rounded animate-pulse w-32" />
      <div className="h-3 bg-slate-100 rounded animate-pulse w-20" />
    </div>
    <div className="w-16 h-5 bg-slate-100 rounded-full animate-pulse" />
    <div className="w-20 h-5 bg-slate-100 rounded-full animate-pulse" />
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const CustomerManagement: React.FC = () => {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 300ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(input), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const { data: customers = [], isLoading } = useAllCustomers({
    search: search || undefined,
    limit: 100,
  });

  const activeCount = customers.filter(c => c.isActive).length;
  const bannedCount = customers.filter(c => !c.isActive).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isLoading ? 'Loading…' : (
              <>
                <span className="font-semibold text-slate-700">{customers.length}</span> customers
                {' · '}
                <span className="text-emerald-600 font-medium">{activeCount} active</span>
                {bannedCount > 0 && <>, <span className="text-red-500 font-medium">{bannedCount} banned</span></>}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, username, email, or phone…"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No customers found</p>
          <p className="text-xs mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map(c => <CustomerCard key={c.id} customer={c} />)}
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
