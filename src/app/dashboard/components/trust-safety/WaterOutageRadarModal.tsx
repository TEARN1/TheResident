'use client';

import React, { useState } from 'react';
import { 
  Droplets, 
  X, 
  Truck, 
  AlertTriangle, 
  MapPin 
} from 'lucide-react';

interface TankerLocation {
  id: string;
  driverCallsign: string;
  location: string;
  volumeLitres: number;
  estDeparture: string;
  isQueueBusy: boolean;
}

const TANKERS: TankerLocation[] = [
  {
    id: 'tk1',
    driverCallsign: 'Joburg Water Tanker #08',
    location: 'Corner Biccard & De Korte St (Opposite South Point)',
    volumeLitres: 4500,
    estDeparture: 'On site until 17:00',
    isQueueBusy: true
  },
  {
    id: 'tk2',
    driverCallsign: 'Municipal Roaming Tanker #14',
    location: 'Wits University Gate 2 (Jorissen St)',
    volumeLitres: 2800,
    estDeparture: 'Arriving at 15:45',
    isQueueBusy: false
  }
];

interface WaterOutageRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WaterOutageRadarModal({ isOpen, onClose }: WaterOutageRadarModalProps) {
  const [reportsCount, setReportsCount] = useState(14);
  const [reportedByUser, setReportedByUser] = useState(false);
  const jojoReservePercent = 68;

  if (!isOpen) return null;

  const handleReportOutage = () => {
    setReportsCount(r => r + 1);
    setReportedByUser(true);
    setTimeout(() => setReportedByUser(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-cyan-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Droplets className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Water Outage & Tanker Radar
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Crowdsourced Grid
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Real-time tap pressure alerts, municipal water tanker stops, and res JoJo reserves.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Area Status & JoJo Tank gauge */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300">Braamfontein Central Sector</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                LOW PRESSURE / DRY
              </span>
            </div>
            <p className="text-xs text-neutral-300">
              Joburg Water reservoir feeder pipe maintenance ongoing. {reportsCount} local residents confirmed dry taps in last 60 mins.
            </p>
            <div className="text-[11px] text-amber-400 flex items-center gap-1.5 pt-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Boil water advisory in effect once pressure returns.</span>
            </div>
          </div>

          {/* Residence JoJo Reserve */}
          <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-medium">South Point Backup JoJo Tank</span>
              <span className="font-bold text-cyan-400">{jojoReservePercent}% Full</span>
            </div>
            {/* Visual Tank Gauge */}
            <div className="h-3 w-full bg-neutral-800 rounded-full overflow-hidden p-0.5 border border-neutral-700">
              <div
                style={{ width: `${jojoReservePercent}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
              />
            </div>
            <div className="flex justify-between text-[11px] text-neutral-400">
              <span>Estimated reserve: ~14 hours</span>
              <span className="text-emerald-400">Pumps Operational</span>
            </div>
          </div>
        </div>

        {/* Tanker Dispatch Live Locations */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              Municipal Water Tanker Trucks On Site ({TANKERS.length})
            </span>
            <span className="text-[10px] text-neutral-400">Bring clean 5L/20L buckets</span>
          </div>

          <div className="space-y-2.5">
            {TANKERS.map(tanker => (
              <div
                key={tanker.id}
                className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-100">{tanker.driverCallsign}</span>
                    {tanker.isQueueBusy ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Moderate Line (~10 mins)
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        No Queue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{tanker.location}</span>
                  </div>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-cyan-400">{tanker.volumeLitres}L remaining</div>
                  <div className="text-[10px] text-neutral-500">{tanker.estDeparture}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Crowdsource Tap Report */}
        <div className="mt-6 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3">
          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
            Report Current Tap Condition at Your Room
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Taps Dry', color: 'hover:border-rose-500' },
              { label: 'Trickle / Low', color: 'hover:border-amber-500' },
              { label: 'Brown Water', color: 'hover:border-yellow-600' },
              { label: 'Normal Flow', color: 'hover:border-emerald-500' }
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={handleReportOutage}
                className={`py-2 px-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-300 transition ${item.color}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {reportedByUser && (
            <div className="p-2 rounded-lg bg-emerald-950/40 text-emerald-300 text-xs text-center border border-emerald-500/30">
              Thank you! Your tap report has updated the neighborhood radar.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
          >
            Close Radar
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaterOutageRadarModal;

