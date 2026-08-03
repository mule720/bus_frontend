import React, { useState, useEffect } from 'react';
import { Users, Bus, Calendar, Search, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useEmployeeTripSearch, useCompanyEmployees, useMyBuses,
  useTripStaffingData, useAssignTripStationStaff, useAssignTripRun,
} from '@/lib/api';

function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtTime(dt: string) {
  try { return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return dt || '—'; }
}

const TripStaffing: React.FC = () => {
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo]     = useState('');
  const [travelDate, setTravelDate] = useState(todayIso());
  const [searchParams, setSearchParams] = useState<any>({ date: todayIso() });
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const [sellerIds, setSellerIds]       = useState<string[]>([]);
  const [busId, setBusId]               = useState<string | null>(null);
  const [driverId, setDriverId]         = useState<string | null>(null);
  const [conductorId, setConductorId]   = useState<string | null>(null);

  const { data: trips = [], isLoading: tripsLoading } = useEmployeeTripSearch(searchParams);
  const { data: employees = [] } = useCompanyEmployees();
  const { data: buses = [] } = useMyBuses();
  const {
    data: staffing, isLoading: staffingLoading, refetch: refetchStaffing,
  } = useTripStaffingData(selectedTrip?.id ?? null, travelDate);

  const assignStaff = useAssignTripStationStaff();
  const assignRun   = useAssignTripRun();

  const activeEmployees = employees.filter((e) => e.isActive);
  const activeBuses     = buses.filter((b) => b.isActive);
  const runStatus = (staffing as any)?.run?.status ?? 'not_started';

  useEffect(() => {
    if (!staffing) return;
    setSellerIds(((staffing as any).stationAssignments ?? []).map((a: any) => a.employeeId));
    setBusId((staffing as any).run?.busId ?? null);
    setDriverId((staffing as any).run?.driverId ?? null);
    setConductorId((staffing as any).run?.conductorId ?? null);
  }, [staffing]);

  const handleSearch = () =>
    setSearchParams({ date: travelDate, routeFrom: routeFrom.trim() || undefined, routeTo: routeTo.trim() || undefined });

  const selectTrip = (t: any) => setSelectedTrip(t);
  const toggleSeller = (id: string) =>
    setSellerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const saveSellers = async () => {
    try {
      await assignStaff.mutateAsync({ tripId: selectedTrip.id, travelDate, employeeIds: sellerIds });
      await refetchStaffing();
      toast.success('Ticket sellers updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save sellers');
    }
  };

  const saveRun = async () => {
    try {
      await assignRun.mutateAsync({ tripId: selectedTrip.id, travelDate, busId, driverId, conductorId });
      await refetchStaffing();
      toast.success('Bus/driver/conductor updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save run assignment');
    }
  };

  const Chip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
        ${active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-teal-400'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {selectedTrip ? `${selectedTrip.routeFrom} → ${selectedTrip.routeTo}` : 'Trip Staffing'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {selectedTrip
              ? `${fmtTime(selectedTrip.departureTime)} · ${travelDate}`
              : 'Assign sellers, bus, driver & conductor per trip/date'}
          </p>
        </div>
        {selectedTrip && (
          <Button variant="outline" onClick={() => setSelectedTrip(null)}>← All Trips</Button>
        )}
      </div>

      {!selectedTrip ? (
        <>
          {/* Search */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)}
                placeholder="From" className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input type="text" value={routeTo} onChange={(e) => setRouteTo(e.target.value)}
                placeholder="To" className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <Button onClick={handleSearch} disabled={tripsLoading} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              {tripsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              {tripsLoading ? 'Searching…' : 'Search Trips'}
            </Button>
          </div>

          {trips.length === 0 && !tripsLoading ? (
            <div className="text-center py-16">
              <Bus className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="font-semibold text-slate-500">No trips found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trips.map((t: any) => (
                <button key={t.id} onClick={() => selectTrip(t)}
                  className="w-full bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-left hover:border-teal-400 transition">
                  <div className="font-bold text-slate-900">{t.routeFrom} → {t.routeTo}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {fmtTime(t.departureTime)} · {t.busNumber}{t.isRecurring ? ' · Recurring' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : staffingLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
      ) : (
        <div className="space-y-5">
          {/* Run status */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3">
            <div className={`w-2.5 h-2.5 rounded-full ${runStatus === 'completed' ? 'bg-slate-400' : runStatus === 'departed' ? 'bg-blue-500' : 'bg-green-500'}`} />
            <span className="font-semibold text-slate-800 capitalize">{runStatus.replace('_', ' ')}</span>
          </div>

          {/* Bus / Driver / Conductor */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bus, Driver & Conductor</p>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">BUS</p>
              <div className="flex flex-wrap gap-2">
                {activeBuses.map((b) => (
                  <Chip key={b.id} label={b.busNumber} active={busId === b.id}
                    onClick={() => setBusId(busId === b.id ? null : b.id)} />
                ))}
                {activeBuses.length === 0 && <span className="text-xs text-slate-400">No active buses</span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">DRIVER</p>
              <div className="flex flex-wrap gap-2">
                {activeEmployees.map((e) => (
                  <Chip key={e.id} label={e.fullName} active={driverId === e.id}
                    onClick={() => setDriverId(driverId === e.id ? null : e.id)} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">CONDUCTOR / ATTENDANT</p>
              <div className="flex flex-wrap gap-2">
                {activeEmployees.map((e) => (
                  <Chip key={e.id} label={e.fullName} active={conductorId === e.id}
                    onClick={() => setConductorId(conductorId === e.id ? null : e.id)} />
                ))}
              </div>
            </div>

            <Button onClick={saveRun} disabled={assignRun.isPending} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              {assignRun.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Bus/Driver/Conductor
            </Button>
          </div>

          {/* Ticket sellers */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ticket Sellers</p>
            <p className="text-xs text-slate-500">
              Select staff who may sell tickets for this trip/date. Unselected staff (without supervisor role) will be blocked from selling once at least one seller is assigned.
            </p>
            <div className="divide-y divide-slate-100">
              {activeEmployees.map((e) => {
                const active = sellerIds.includes(e.id);
                return (
                  <button key={e.id} onClick={() => toggleSeller(e.id)}
                    className="w-full flex items-center justify-between py-3 text-left hover:bg-slate-50 transition px-1">
                    <span className="text-sm font-medium text-slate-800">{e.fullName}</span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition
                      ${active ? 'bg-teal-600 border-teal-600' : 'border-slate-300'}`}>
                      {active && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
              {activeEmployees.length === 0 && (
                <div className="py-6 text-center text-sm text-slate-400">No active employees</div>
              )}
            </div>
            <Button onClick={saveSellers} disabled={assignStaff.isPending} className="w-full bg-teal-600 hover:bg-teal-700 text-white mt-2">
              {assignStaff.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Ticket Sellers
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripStaffing;
