'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, MapPin, Users, Lightbulb, AlertTriangle, X, CheckCircle2,
  Navigation, Eye, PhoneCall, Radio, BatteryCharging
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface SafeBeacon {
  id: string;
  name: string;
  type: 'patrol' | 'blue-light-post' | 'escort-hub';
  distanceMeters: number;
  officerOnDuty: string;
  emergencyContact: string;
  lightingQuality: 'Well Lit' | 'Moderate' | 'Dim';
}

const BEACONS: SafeBeacon[] = [
  {
    id: 'b1',
    name: 'Braamfontein Jorissen Corridor Post',
    type: 'patrol',
    distanceMeters: 140,
    officerOnDuty: 'Officer Khumalo (Wits Campus Protection)',
    emergencyContact: '+27 11 717 4444',
    lightingQuality: 'Well Lit'
  },
  {
    id: 'b2',
    name: 'Hatfield Prospect & Burnett Pillar',
    type: 'blue-light-post',
    distanceMeters: 280,
    officerOnDuty: 'UP SafeZone Automated Intercom Unit 04',
    emergencyContact: '+27 12 420 2310',
    lightingQuality: 'Well Lit'
  },
  {
    id: 'b3',
    name: 'Rondebosch Main Road Student Escort Hub',
    type: 'escort-hub',
    distanceMeters: 410,
    officerOnDuty: 'UCT Campus Patrol Team B',
    emergencyContact: '+27 21 650 2222',
    lightingQuality: 'Moderate'
  }
];

interface WalkingBuddy {
  id: string;
  name: string;
  destination: string;
  etaDepart: string;
  status: 'Ready Now' | 'Departing in 5m';
}

const WALKING_BUDDIES: WalkingBuddy[] = [
  { id: 'wb1', name: 'Thabo M. & 2 others', destination: 'South Point Central', etaDepart: 'Ready Now', status: 'Ready Now' },
  { id: 'wb2', name: 'Naledi K.', destination: 'Apex Res, Hatfield', etaDepart: 'In 5 mins', status: 'Departing in 5m' }
];

interface NightWatchSafeRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NightWatchSafeRouteModal({ isOpen, onClose }: NightWatchSafeRouteModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<'campus-to-res' | 'library-to-station'>('campus-to-res');
  const [distressArmed, setDistressArmed] = useState(false);
  const [escortRequested, setEscortRequested] = useState(false);

  if (!isOpen) return null;

  const handleArmDistress = () => {
    playTactileSound('alert');
    setDistressArmed(!distressArmed);
  };

  const handleRequestEscort = () => {
    playTactileSound('chime');
    setEscortRequested(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Night-Watch Safe Route Navigator</h3>
                <p className="text-xs text-gray-400">Active Streetlights • Security Beacons • Escort Buddies</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Route Selector */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-black border border-white/10">
            <button
              onClick={() => { playTactileSound('tab'); setSelectedRoute('campus-to-res'); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                selectedRoute === 'campus-to-res'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Navigation size={14} />
              <span>Campus ➔ Res Walkway</span>
            </button>
            <button
              onClick={() => { playTactileSound('tab'); setSelectedRoute('library-to-station'); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                selectedRoute === 'library-to-station'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Navigation size={14} />
              <span>Library ➔ Station Hub</span>
            </button>
          </div>

          {/* Real-time Safety Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-neutral-900 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-mono mb-1">
                <Lightbulb size={13} />
                <span>94%</span>
              </div>
              <p className="text-[10px] text-gray-400 uppercase font-black">Streetlights Active</p>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-900 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1 text-gold-primary text-xs font-mono mb-1">
                <Radio size={13} />
                <span>3 Posts</span>
              </div>
              <p className="text-[10px] text-gray-400 uppercase font-black">Patrol Officers</p>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-900 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1 text-sky-400 text-xs font-mono mb-1">
                <Users size={13} />
                <span>2 Groups</span>
              </div>
              <p className="text-[10px] text-gray-400 uppercase font-black">Escort Buddies</p>
            </div>
          </div>

          {/* Active Beacons Along Corridor */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">Verified Security Beacons Along Path</h4>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {BEACONS.map(b => (
                <div key={b.id} className="p-3 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{b.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {b.lightingQuality}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{b.officerOnDuty}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-gold-primary">{b.distanceMeters}m away</span>
                    <p className="text-[10px] text-gray-400">{b.emergencyContact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Walking Escort Buddies */}
          <div className="p-3.5 rounded-2xl bg-black border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Users size={14} className="text-sky-400" />
                Live Walking Escort Groups
              </span>
              <span className="text-sky-400 text-[11px] font-mono">Walk Together for Safety</span>
            </div>
            {WALKING_BUDDIES.map(wb => (
              <div key={wb.id} className="flex items-center justify-between py-1 text-xs text-gray-300 border-t border-white/5 pt-2">
                <div>
                  <span className="font-semibold text-white">{wb.name}</span>
                  <span className="text-gray-400 text-[11px]"> ➔ {wb.destination}</span>
                </div>
                <button
                  onClick={handleRequestEscort}
                  className="px-2.5 py-1 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/30 transition"
                >
                  {escortRequested ? 'Joined Group' : 'Join Walk'}
                </button>
              </div>
            ))}
          </div>

          {/* Distress SOS Button */}
          <div className="pt-2 border-t border-white/10 flex items-center gap-3">
            <button
              onClick={handleArmDistress}
              className={`flex-1 py-3 px-4 rounded-2xl font-black uppercase text-xs tracking-wider transition flex items-center justify-center gap-2 ${
                distressArmed
                  ? 'bg-rose-600 text-white border border-rose-400 animate-pulse'
                  : 'bg-neutral-900 border border-rose-500/40 text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              <AlertTriangle size={16} />
              <span>{distressArmed ? 'Distress Beacon Live • Transmitting' : 'Arm Safe-Walk Distress Pin'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default NightWatchSafeRouteModal;
