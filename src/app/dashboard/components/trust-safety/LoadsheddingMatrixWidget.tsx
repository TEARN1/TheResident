'use client';

import React, { useState } from 'react';
import { 
  Zap, 
  MapPin, 
  Wifi, 
  BatteryCharging 
} from 'lucide-react';

interface OutageZone {
  id: string;
  suburb: string;
  city: string;
  blockCode: string;
  stage: number;
  currentStatus: 'Power ON' | 'Load Shedding Active';
  nextSlot: string;
  timeUntilNext: string;
  generatorStudyHubs: { name: string; distance: string; hasWifi: boolean }[];
}

const ZONES: OutageZone[] = [
  {
    id: 'z1',
    suburb: 'Braamfontein / Hillbrow',
    city: 'City Power Johannesburg',
    blockCode: 'Block 3B',
    stage: 2,
    currentStatus: 'Power ON',
    nextSlot: '16:00 - 18:30 today',
    timeUntilNext: '02h 45m',
    generatorStudyHubs: [
      { name: 'Wits Cullen Library 24/7 Floor', distance: '400m', hasWifi: true },
      { name: 'South Point Study Lounge', distance: '120m', hasWifi: true }
    ]
  },
  {
    id: 'z2',
    suburb: 'Auckland Park / Kingsway',
    city: 'City Power Johannesburg',
    blockCode: 'Block 7',
    stage: 2,
    currentStatus: 'Power ON',
    nextSlot: '20:00 - 22:30 tonight',
    timeUntilNext: '06h 45m',
    generatorStudyHubs: [
      { name: 'UJ Sanlam Auditorium Foyer', distance: '350m', hasWifi: true },
      { name: 'Campus Square Generator Cafe', distance: '600m', hasWifi: true }
    ]
  },
  {
    id: 'z3',
    suburb: 'Hatfield / Hillcrest',
    city: 'City of Tshwane',
    blockCode: 'Block 2',
    stage: 1,
    currentStatus: 'Load Shedding Active',
    nextSlot: 'Ends at 15:30',
    timeUntilNext: '42m remaining',
    generatorStudyHubs: [
      { name: 'UP Merensky II 24-Hour Study Centre', distance: '500m', hasWifi: true },
      { name: 'Hatfield Plaza Study Desk Hub', distance: '300m', hasWifi: true }
    ]
  }
];

export function LoadsheddingMatrixWidget() {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('z1');
  const nationalStage = 2;

  const activeZone = ZONES.find(z => z.id === selectedZoneId) || ZONES[0];

  return (
    <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-100 shadow-xl space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-100">National Grid & Eskom Matrix</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                STAGE {nationalStage} ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">Live suburban outage schedules & study power stations</p>
          </div>
        </div>

        {/* Inverter Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-xs text-neutral-300">
          <BatteryCharging className="w-4 h-4 text-emerald-400" />
          <span>Building UPS: <span className="font-bold text-emerald-400">94%</span></span>
        </div>
      </div>

      {/* Suburb Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ZONES.map(zone => (
          <button
            key={zone.id}
            type="button"
            onClick={() => setSelectedZoneId(zone.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedZoneId === zone.id
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-neutral-800/40 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {zone.suburb.split('/')[0]} ({zone.blockCode})
          </button>
        ))}
      </div>

      {/* Active Zone Detail Card */}
      <div className="p-4 rounded-xl bg-neutral-800/30 border border-neutral-800 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-200">{activeZone.suburb}</span>
              <span className="text-[10px] text-neutral-500">• {activeZone.city}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeZone.currentStatus === 'Power ON' ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
                }`}
              />
              <span
                className={`text-xs font-bold ${
                  activeZone.currentStatus === 'Power ON' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeZone.currentStatus}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-neutral-400">Next Scheduled Cut</span>
            <div className="text-xs font-mono font-bold text-amber-400">{activeZone.nextSlot}</div>
            <span className="text-[10px] text-neutral-400">In {activeZone.timeUntilNext}</span>
          </div>
        </div>

        {/* Generator Lounge List */}
        <div className="pt-2 border-t border-neutral-800/80">
          <span className="text-[11px] font-semibold text-neutral-400 block mb-2">
            Backup Generator & Wi-Fi Study Hubs Nearby:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeZone.generatorStudyHubs.map((hub, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-neutral-200">{hub.name}</div>
                  <div className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-amber-400" /> {hub.distance}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                  <Wifi className="w-3 h-3" /> Backup UPS
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadsheddingMatrixWidget;

