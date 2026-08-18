import React, { useState } from 'react';
import { DollarSign, TrendingUp, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlatformRevenue, fmtK } from '@/lib/platformAdminApi';

const PlatformFinance: React.FC = () => {
  const { data: rev, isLoading } = usePlatformRevenue();
  const [expandedSub, setExpandedSub] = useState(true);
  const [expandedComm, setExpandedComm] = useState(true);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>;
  }

  const planColor: Record<string, string> = {
    starter: 'bg-sky-100 text-sky-700',
    growth: 'bg-violet-100 text-violet-700',
    pro: 'bg-indigo-100 text-indigo-700',
    enterprise: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Finance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Revenue breakdown — subscriptions and commissions</p>
      </div>

      {/* Grand total cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-700 rounded-xl p-5 text-white">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-indigo-200 text-xs uppercase tracking-wider mb-1">Subscription Revenue</p>
          <p className="text-3xl font-bold">{fmtK(rev?.totalSubscriptionRevenue ?? 0)}</p>
        </div>
        <div className="bg-emerald-700 rounded-xl p-5 text-white">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-emerald-200 text-xs uppercase tracking-wider mb-1">Commission Revenue</p>
          <p className="text-3xl font-bold">{fmtK(rev?.totalCommissionRevenue ?? 0)}</p>
          <p className="text-emerald-300 text-xs mt-1">
            Online: {fmtK(rev?.totalOnlineCommissionRevenue ?? 0)} ·
            Walk-in: {fmtK(rev?.totalWalkinCommissionRevenue ?? 0)}
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl p-5 text-white">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-slate-300 text-xs uppercase tracking-wider mb-1">Grand Total</p>
          <p className="text-3xl font-bold">{fmtK(rev?.grandTotal ?? 0)}</p>
          <p className="text-slate-400 text-xs mt-1">Booking volume: {fmtK(rev?.totalBookingRevenue ?? 0)}</p>
        </div>
      </div>

      {/* Subscription breakdown */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <button
          className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100"
          onClick={() => setExpandedSub(!expandedSub)}
        >
          <h2 className="font-bold text-slate-800">Subscription Revenue by Company</h2>
          {expandedSub ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {expandedSub && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Company</th>
                  <th className="text-left px-5 py-3">Active Plan</th>
                  <th className="text-left px-5 py-3">Billing</th>
                  <th className="text-right px-5 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(rev?.subscriptionByCompany ?? []).map((row) => (
                  <tr key={row.companyId} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.companyName}</td>
                    <td className="px-5 py-3">
                      {row.activePlan ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${planColor[row.activePlan] ?? 'bg-slate-100 text-slate-600'}`}>
                          {row.activePlan}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500 capitalize">{row.billingCycle ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-bold text-indigo-700">{fmtK(row.subscriptionRevenue)}</td>
                  </tr>
                ))}
                {(rev?.subscriptionByCompany ?? []).length === 0 && (
                  <tr><td colSpan={4} className="text-center text-slate-400 py-8">No subscription data yet</td></tr>
                )}
              </tbody>
              {(rev?.subscriptionByCompany ?? []).length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-indigo-50">
                    <td colSpan={3} className="px-5 py-3 font-bold text-slate-700 text-sm">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-indigo-700 text-sm">{fmtK(rev?.totalSubscriptionRevenue ?? 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Commission breakdown */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <button
          className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100"
          onClick={() => setExpandedComm(!expandedComm)}
        >
          <h2 className="font-bold text-slate-800">Commission Revenue by Company</h2>
          {expandedComm ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {expandedComm && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Company</th>
                  <th className="text-right px-5 py-3">Online Rev</th>
                  <th className="text-right px-5 py-3">Walk-in Rev</th>
                  <th className="text-right px-5 py-3">Online Comm</th>
                  <th className="text-right px-5 py-3">Walk-in Comm</th>
                  <th className="text-right px-5 py-3">Total Comm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(rev?.commissionByCompany ?? []).map((row) => (
                  <tr key={row.companyId} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{row.companyName}</p>
                      <p className="text-slate-400 text-xs">
                        {(row.commissionRateOnline * 100).toFixed(2)}% online · {(row.commissionRateWalkin * 100).toFixed(2)}% walk-in
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{fmtK(row.onlineBookingRevenue)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{fmtK(row.walkinBookingRevenue)}</td>
                    <td className="px-5 py-3 text-right text-emerald-700 font-semibold">{fmtK(row.onlineCommissionRevenue)}</td>
                    <td className="px-5 py-3 text-right text-emerald-700 font-semibold">{fmtK(row.walkinCommissionRevenue)}</td>
                    <td className="px-5 py-3 text-right font-bold text-indigo-700">{fmtK(row.commissionRevenue)}</td>
                  </tr>
                ))}
                {(rev?.commissionByCompany ?? []).length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8">No commission data yet</td></tr>
                )}
              </tbody>
              {(rev?.commissionByCompany ?? []).length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-emerald-50">
                    <td colSpan={3} className="px-5 py-3 font-bold text-slate-700 text-sm">Totals</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700 text-sm">{fmtK(rev?.totalOnlineCommissionRevenue ?? 0)}</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700 text-sm">{fmtK(rev?.totalWalkinCommissionRevenue ?? 0)}</td>
                    <td className="px-5 py-3 text-right font-bold text-indigo-700 text-sm">{fmtK(rev?.totalCommissionRevenue ?? 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformFinance;
