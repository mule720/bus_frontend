import React, { useState } from 'react';
import { Search, User, Phone, MapPin, CreditCard, Printer, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCustomerSearch, type CustomerBookingResult } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  boarded:   'bg-blue-100 text-blue-700',
  pending:   'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const METHOD_LABEL: Record<string, string> = {
  cash: '💵 Cash', card: '💳 Card', mobile_money: '📱 Mobile Money',
};

function fmtK(v: number) { return `K ${Number(v).toFixed(2)}`; }
function fmtDt(iso: string) {
  try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

const CustomerLookup: React.FC = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CustomerBookingResult[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const search = useCustomerSearch();

  const run = async () => {
    const query = q.trim();
    if (query.length < 2) { toast.error('Enter at least 2 characters'); return; }
    try {
      const res = await search.mutateAsync(query);
      setResults(res);
      if (res.length === 0) toast.info('No results found');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    }
  };

  const printTicket = async (b: CustomerBookingResult) => {
    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) { toast.error('Pop-up blocked — allow pop-ups and try again'); return; }
    const qrData = b.qrCode || b.referenceCode;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
    } catch { /* no QR if generation fails */ }
    win.document.write(`
      <html><head><title>Ticket ${b.referenceCode}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:sans-serif;padding:24px;max-width:380px;margin:auto;color:#111}
        h2{margin:0 0 2px;font-size:18px}
        p{margin:4px 0;font-size:13px}
        .label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.5px}
        .route{font-size:15px;font-weight:700;margin:4px 0}
        .ref{font-size:18px;font-weight:800;letter-spacing:2px;margin:8px 0;font-family:monospace}
        hr{border:none;border-top:1px dashed #ccc;margin:10px 0}
        .qr-wrap{text-align:center;margin:14px 0}
        .qr-wrap img{border:1px solid #eee;border-radius:8px;padding:8px;width:180px;height:180px}
        .row{display:flex;justify-content:space-between;margin:4px 0}
        .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#e8f5e9;color:#2e7d32}
      </style></head>
      <body>
        <h2>${b.companyName}</h2>
        <p class="label">E-Ticket</p>
        <hr/>
        <p class="label">Route</p>
        <p class="route">${b.routeFrom} → ${b.routeTo}</p>
        <p style="font-size:12px;color:#555">${new Date(b.departureTime).toLocaleString('en-GB')}</p>
        <hr/>
        <p class="label">Passenger</p>
        <p style="font-weight:600">${b.passengerName || 'Walk-in'}</p>
        ${b.passengerPhone ? `<p style="font-size:12px;color:#555">${b.passengerPhone}</p>` : ''}
        <div class="row" style="margin-top:6px">
          <div><p class="label">Seats</p><p style="font-weight:600">${(b.seats || []).join(', ') || '—'}</p></div>
          <div style="text-align:right"><p class="label">Amount</p><p style="font-weight:700;font-size:15px">K ${Number(b.totalAmount).toFixed(2)}</p></div>
        </div>
        <div class="row">
          <div><p class="label">Payment</p><p>${(b.paymentMethod || '').replace(/_/g, ' ')}</p></div>
          <div style="text-align:right"><p class="label">Travel Date</p><p>${b.travelDate}</p></div>
        </div>
        <hr/>
        <div class="qr-wrap">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code"/>` : ''}
          <p class="ref">${b.referenceCode}</p>
          <span class="badge">${b.status}</span>
        </div>
        <p style="font-size:10px;color:#aaa;text-align:center;margin-top:12px">Scan QR code at boarding gate</p>
        <script>window.print();window.close();<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Customer Lookup</h2>
        <p className="text-slate-500 text-sm mt-1">Search by passenger name, phone number, or booking reference</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Name, phone or booking reference…"
            className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {q.length > 0 && (
            <button onClick={() => { setQ(''); setResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button onClick={run} disabled={search.isPending} className="bg-blue-700 hover:bg-blue-800 text-white px-6">
          {search.isPending ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {/* Results */}
      {results === null && !search.isPending && (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-slate-500">Search for a customer</p>
          <p className="text-sm mt-1">Reprint a lost ticket directly from the results</p>
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-slate-500">No results found</p>
          <p className="text-sm mt-1">Try a different name or reference code</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((b) => {
            const expanded = expandedId === b.bookingId;
            const statusCls = STATUS_COLOR[b.status] || 'bg-slate-100 text-slate-600';
            return (
              <div key={b.bookingId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : b.bookingId)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                      <span className="font-bold text-pink-700 text-sm">
                        {(b.passengerName || 'W').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{b.passengerName || 'Walk-in'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>
                          {b.status}
                        </span>
                      </div>
                      {b.passengerPhone && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{b.passengerPhone}</span>
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-0.5">
                        {b.routeFrom} → {b.routeTo}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900">{fmtK(b.totalAmount)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{b.travelDate}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{METHOD_LABEL[b.paymentMethod] || b.paymentMethod}</span>
                      <span>· Seat{(b.seats || []).length !== 1 ? 's' : ''} {(b.seats || []).join(', ')}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{b.referenceCode}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        { icon: MapPin, label: 'Route', value: `${b.routeFrom} → ${b.routeTo}` },
                        { icon: CreditCard, label: 'Reference', value: b.referenceCode },
                        { icon: Phone, label: 'Phone', value: b.passengerPhone || '—' },
                        { icon: User, label: 'Created', value: fmtDt(b.createdAt) },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label}>
                          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase mb-0.5">
                            <Icon className="w-3 h-3" /> {label}
                          </div>
                          <div className="font-medium text-slate-700">{value}</div>
                        </div>
                      ))}
                    </div>
                    {b.qrCode && (
                      <Button
                        size="sm"
                        onClick={() => printTicket(b)}
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                      >
                        <Printer className="w-4 h-4 mr-2" /> Reprint Ticket
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerLookup;
