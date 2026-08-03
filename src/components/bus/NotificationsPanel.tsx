import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkAllRead: () => void;
}

const iconFor = (t: string) => {
  if (t === 'success') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
  if (t === 'warning') return <AlertTriangle className="w-5 h-5 text-orange-500" />;
  return <Info className="w-5 h-5 text-blue-600" />;
};

const NotificationsPanel: React.FC<Props> = ({ notifications, onClose, onMarkAllRead }) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm bg-white shadow-2xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-700" />
            <h3 className="font-bold text-slate-900">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onMarkAllRead} className="text-xs text-blue-700 font-semibold hover:underline">Mark all read</button>
            <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">No notifications yet</div>
          ) : notifications.map((n) => (
            <div key={n.id} className={`p-4 flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}>
              <div className="shrink-0 mt-0.5">{iconFor(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-slate-900 text-sm truncate">{n.title}</h4>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.body}</p>
                <div className="text-[11px] text-slate-400 mt-1">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPanel;
