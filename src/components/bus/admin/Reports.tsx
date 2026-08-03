import React, { useState, useMemo } from 'react';
import { Loader2, DollarSign, Ticket, Banknote, CreditCard, Smartphone, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useCompanySalesReport, type SalesReportBooking } from '@/lib/api';

const PERIODS = [
  { label: 'Today',      days: 0 },
  { label: 'This Week',  days: 6 },
  { label: 'This Month', days: 29 },
];

function fmtK(v: number) {
  return `K ${Number(v).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDt(iso: string) {
  try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
function isoDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const METHOD_META: Record<string, { label: string; color: string; Icon: React.FC<any> }> = {
  cash:         { label: 'Cash',         color: 'text-green-700',  Icon: Banknote },
  card:         { label: 'Card',         color: 'text-blue-700',   Icon: CreditCard },
  mobile_money: { label: 'Mobile Money', color: 'text-violet-700', Icon: Smartphone },
};

const STATUS_CLS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  boarded:   'bg-blue-100 text-blue-700',
  pending:   'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
};

const Reports: React.FC = () => {
  const today = isoDate(0);
  const [period, setPeriod] = useState(0);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const selectPeriod = (idx: number) => {
    setPeriod(idx);
    setDateFrom(isoDate(PERIODS[idx].days));
    setDateTo(today);
  };

  const { data: report, isLoading } = useCompanySalesReport(dateFrom, dateTo);

  const allBookings: SalesReportBooking[] = report?.bookings ?? [];
  const bookings = useMemo(() => {
    if (!filter.trim()) return allBookings;
    const q = filter.toLowerCase();
    return allBookings.filter((b) =>
      (b.route || '').toLowerCase().includes(q) ||
      (b.passengerName || '').toLowerCase().includes(q) ||
      (b.referenceCode || '').toLowerCase().includes(q),
    );
  }, [allBookings, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Sales & Reports</h2>
        <p className="text-slate-500 text-sm mt-1">Revenue, ticket sales, and payment breakdown</p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {PERIODS.map((p, i) => (
          <button key={p.label} onClick={() => selectPeriod(i)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition
              ${period === i ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-amber-400'}`}>
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPeriod(-1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <span className="text-slate-400 text-sm">→</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPeriod(-1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
      ) : !report ? (
        <div className="text-center py-20 text-slate-400">
          <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-slate-500">No data for this period</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-amber-400 rounded-2xl p-5 text-white">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center mb-3">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{fmtK(report.totalRevenue)}</div>
              <div className="text-amber-100 text-xs mt-1 font-semibold">Total Revenue</div>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-500 rounded-2xl p-5 text-white">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center mb-3">
                <Ticket className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{report.totalTickets}</div>
              <div className="text-green-100 text-xs mt-1 font-semibold">Tickets Sold</div>
            </div>
          </div>

          {/* Payment method breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">By Payment Method</p>
            <div className="space-y-3">
              {[
                { method: 'cash',         value: report.cashTotal },
                { method: 'mobile_money', value: report.mobileTotal },
                { method: 'card',         value: report.cardTotal },
              ].map(({ method, value }) => {
                const meta = METHOD_META[method];
                const pct = report.totalRevenue > 0 ? (value / report.totalRevenue) * 100 : 0;
                return (
                  <div key={method} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 shrink-0`}>
                      <meta.Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{meta.label}</span>
                        <span className={`text-sm font-bold ${meta.color}`}>{fmtK(value)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-current ${meta.color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transaction list */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by route, passenger or ref…"
                  className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                {filter && (
                  <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Transactions ({bookings.length}{filter ? ` of ${allBookings.length}` : ''})
            </p>

            {bookings.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{filter ? 'No matches' : 'No sales in this period'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map((b) => {
                  const meta = METHOD_META[b.paymentMethod] || { label: b.paymentMethod, color: 'text-slate-600', Icon: Banknote };
                  const expanded = expandedId === b.bookingId;
                  const statusCls = STATUS_CLS[b.status] || 'bg-slate-100 text-slate-600';
                  const hasDiscount = b.discountAmount && b.discountAmount > 0;
                  const seats = Array.isArray(b.seats) ? b.seats.join(', ') : (b.seats || '—');
                  return (
                    <div key={b.bookingId}
                      className={`bg-white rounded-xl border overflow-hidden ${expanded ? 'border-amber-300' : 'border-slate-200'}`}>
                      <button className="w-full text-left p-4" onClick={() => setExpandedId(expanded ? null : b.bookingId)}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                            <meta.Icon className={`w-4 h-4 ${meta.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900">{b.passengerName}</div>
                            <div className="text-xs text-slate-500">{b.route}</div>
                            <div className="text-xs text-slate-400">Sold by: {b.employeeName}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-slate-900">{fmtK(b.totalAmount)}</div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusCls}`}>
                              {b.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-mono text-slate-400">{b.referenceCode}</span>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            {fmtDt(b.createdAt)}
                            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-amber-100 bg-amber-50 p-4 space-y-2">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-2">Passenger Details</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {[
                              { label: 'Name', value: b.passengerName },
                              { label: 'Phone', value: b.passengerPhone || '—' },
                              { label: 'National ID', value: b.passengerNationalId || '—' },
                              { label: 'Seat(s)', value: seats },
                              { label: 'Payment', value: meta.label },
                              { label: 'Reference', value: b.referenceCode },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <div className="text-[10px] font-semibold text-amber-700 uppercase">{label}</div>
                                <div className="font-medium text-slate-800">{value}</div>
                              </div>
                            ))}
                          </div>
                          {hasDiscount && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                              <div className="text-xs font-bold text-red-600">
                                Discount: {fmtK(b.discountAmount)}
                              </div>
                              {b.discountReason && (
                                <div className="text-xs text-red-500 mt-0.5">Reason: {b.discountReason}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
