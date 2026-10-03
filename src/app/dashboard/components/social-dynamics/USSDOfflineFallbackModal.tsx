'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, Hash, Send, X, RefreshCw, CheckCircle2, AlertOctagon,
  PhoneCall, ShieldAlert, Zap, WifiOff
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface USSDScreen {
  prompt: string;
  options: { key: string; label: string; action: string }[];
}

const ROOT_SCREEN: USSDScreen = {
  prompt: 'Welcome to The Resident Zero-Rated Offline Portal (*120*737#):\n1. Log Emergency Maintenance\n2. Security / Panic Dispatch\n3. Prepaid Electricity Token Check\n4. Resident Package Lockbox Status\n0. Exit',
  options: [
    { key: '1', label: '1. Maintenance Emergency', action: 'maint' },
    { key: '2', label: '2. Security Dispatch', action: 'security' },
    { key: '3', label: '3. Prepaid Meter Token', action: 'power' },
    { key: '4', label: '4. Package Lockbox', action: 'parcel' },
    { key: '0', label: '0. Exit', action: 'exit' }
  ]
};

interface USSDOfflineFallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function USSDOfflineFallbackModal({ isOpen, onClose }: USSDOfflineFallbackModalProps) {
  const [ussdInput, setUssdInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<string>(ROOT_SCREEN.prompt);
  const [isDialed, setIsDialed] = useState(true);

  if (!isOpen) return null;

  const handleSendOption = (val?: string) => {
    const inputVal = (val ?? ussdInput).trim();
    if (!inputVal) return;

    playTactileSound('tab');
    setHistory(prev => [...prev, `> ${inputVal}`]);

    if (inputVal === '0') {
      setCurrentPrompt('Session Ended. Standard zero-rated USSD session terminated.\nDial *120*737# to start again.');
      setUssdInput('');
      return;
    }

    if (inputVal === '1') {
      setCurrentPrompt('Emergency Maintenance Logged:\nPriority Ticket #MN-4819 dispatched to Building Caretaker on standby.\nSMS confirmation sent to your registered phone.\nPress 0 to exit.');
      setUssdInput('');
      playTactileSound('chime');
      return;
    }

    if (inputVal === '2') {
      setCurrentPrompt('SECURITY ALERT ACTIVE:\nWits/UP Campus Protection unit alerted with your last known location.\nStay indoors.\nEmergency desk: 011 717 4444.\nPress 0 to exit.');
      setUssdInput('');
      playTactileSound('chime');
      return;
    }

    if (inputVal === '3') {
      setCurrentPrompt('Prepaid Electricity Token:\nMeter 0419-2819-3312\nRemaining Balance: 42.6 kWh (Est. 3 days remaining).\nPress 0 to exit.');
      setUssdInput('');
      playTactileSound('chime');
      return;
    }

    if (inputVal === '4') {
      setCurrentPrompt('Parcel Lockbox Safe:\nLockbox #B04 contains Takealot shipment.\nOffline PIN: 8392 (Valid for next 12h without internet).\nPress 0 to exit.');
      setUssdInput('');
      playTactileSound('chime');
      return;
    }

    // Default
    setCurrentPrompt(`Command "${inputVal}" acknowledged.\nZero-rated gateway synchronised.\nPress 0 to exit or 1-4 for main menu.`);
    setUssdInput('');
  };

  const handleResetSession = () => {
    playTactileSound('pop');
    setCurrentPrompt(ROOT_SCREEN.prompt);
    setHistory([]);
    setUssdInput('');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <WifiOff size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Zero-Rated USSD / SMS Fallback</h3>
                <p className="text-xs text-gray-400">Works During Total Grid Outage & Data Blackouts (*120*737#)</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* GSM Terminal Screen */}
          <div className="p-4 rounded-2xl bg-black border border-white/10 space-y-3 font-mono">
            <div className="flex items-center justify-between text-[11px] text-gray-400 border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                SIM 1: Vodacom/MTN 0-Rated
              </span>
              <span>*120*737#</span>
            </div>

            <div className="min-h-[120px] max-h-48 overflow-y-auto whitespace-pre-line text-xs text-amber-300/90 leading-relaxed font-mono">
              {currentPrompt}
            </div>

            {/* Quick Option Buttons */}
            <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-white/10">
              {['1', '2', '3', '4', '0'].map(digit => (
                <button
                  key={digit}
                  onClick={() => handleSendOption(digit)}
                  className="py-2 rounded-xl bg-neutral-900 border border-white/10 text-white font-mono font-bold text-xs hover:border-gold-primary/50 transition"
                >
                  {digit}
                </button>
              ))}
            </div>
          </div>

          {/* Input & Action Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={ussdInput}
                onChange={e => setUssdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendOption()}
                placeholder="Type reply (e.g. 1 or 2)..."
                className="w-full py-2.5 px-3.5 rounded-2xl bg-neutral-900 border border-white/10 text-white text-xs font-mono placeholder-gray-500 focus:outline-none focus:border-gold-primary"
              />
            </div>
            <button
              onClick={() => handleSendOption()}
              className="px-4 py-2.5 rounded-2xl bg-gold-primary text-black font-black uppercase text-xs tracking-wider transition hover:bg-gold-secondary flex items-center gap-1.5"
            >
              <Send size={13} />
              <span>Send</span>
            </button>
            <button
              onClick={handleResetSession}
              className="p-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition"
              title="Reset USSD Session"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] text-gray-400 font-mono text-center">
            Zero data charges apply. Even when your cellular bundle expires, dialling *120*737# connects directly to residence control.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default USSDOfflineFallbackModal;
