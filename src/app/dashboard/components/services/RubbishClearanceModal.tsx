'use client';

import React, { useState } from 'react';
import { 
  Trash2, 
  X, 
  CheckCircle2, 
  MapPin, 
  FileText, 
  Leaf
} from 'lucide-react';

interface LoadTier {
  id: string;
  name: string;
  subtitle: string;
  priceZAR: number;
  capacityDesc: string;
  popular?: boolean;
}

const LOAD_TIERS: LoadTier[] = [
  {
    id: 'mini',
    name: 'Mini Refuse Run',
    subtitle: 'Up to 6 heavy-duty refuse bags',
    priceZAR: 150,
    capacityDesc: 'Move-out closet cleanout, unneeded packaging & standard student waste.'
  },
  {
    id: 'quarter',
    name: 'Bulky Item + Bags',
    subtitle: '1 Single/Double Mattress OR Broken Chair + 4 Bags',
    priceZAR: 280,
    popular: true,
    capacityDesc: 'Great for discarded student furniture, bar stools, mini-fridges.'
  },
  {
    id: 'half',
    name: 'Half Bakkie Load',
    subtitle: 'Multiple bulky items & room cleanout pile',
    priceZAR: 480,
    capacityDesc: 'Wardrobe tear-down, bed frame, boxes, electronics and mixed rubble.'
  },
  {
    id: 'full',
    name: 'Full 1-Ton Bakkie Bed',
    subtitle: 'Full unit overhaul or heavy rubble',
    priceZAR: 780,
    capacityDesc: 'Entire flat discard pile, renovation debris, garden refuse, appliances.'
  }
];

interface RubbishClearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RubbishClearanceModal({ isOpen, onClose }: RubbishClearanceModalProps) {
  const [selectedLoadId, setSelectedLoadId] = useState<string>('quarter');
  const [address, setAddress] = useState('South Point Res, 23 Biccard St, Braamfontein');
  const [pickupDate, setPickupDate] = useState('2026-10-06');
  const [pickupTime, setPickupTime] = useState('11:00');
  const [divertRecyclables, setDivertRecyclables] = useState(true);
  const [needsDumpTicket, setNeedsDumpTicket] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const currentTier = LOAD_TIERS.find(t => t.id === selectedLoadId) || LOAD_TIERS[1];
  const dumpTicketFee = needsDumpTicket ? 30 : 0;
  const grandTotal = currentTier.priceZAR + dumpTicketFee;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Rubbish & Clutter Clearance
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Eco-Certified
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Responsible disposal, municipal dump drops & informal waste reclaimer support.
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

        {!submitted ? (
          <div className="mt-6 space-y-6">
            {/* Load Sizing Options */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-3">
                Select Load Volume
              </label>
              <div className="space-y-2.5">
                {LOAD_TIERS.map(tier => {
                  const isSelected = selectedLoadId === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedLoadId(tier.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40'
                          : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-200">{tier.name}</span>
                          {tier.popular && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              MOST POPULAR
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-300">{tier.subtitle}</p>
                        <p className="text-[10px] text-neutral-400">{tier.capacityDesc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-400">R{tier.priceZAR}</div>
                        <div className="text-[10px] text-neutral-400">incl. loader helper</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Address & Scheduling */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-300">Pickup Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div 
                  onClick={() => setDivertRecyclables(!divertRecyclables)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                    divertRecyclables ? 'bg-emerald-950/20 border-emerald-500/50' : 'bg-neutral-800/40 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-medium text-neutral-200">Local Reclaimer Sorting</div>
                      <div className="text-[10px] text-neutral-400">Cardboard & metals given to local pickers</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={divertRecyclables}
                    readOnly
                    className="accent-emerald-500 w-4 h-4"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-300">Pickup Date & Time</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div 
                  onClick={() => setNeedsDumpTicket(!needsDumpTicket)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                    needsDumpTicket ? 'bg-neutral-800/60 border-neutral-700' : 'bg-neutral-800/20 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-medium text-neutral-200">Official Municipal Tip Ticket</div>
                      <div className="text-[10px] text-neutral-400">PDF proof of legal dumping for landlord</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-neutral-300">+R30</span>
                </div>
              </div>
            </div>

            {/* Total breakdown */}
            <div className="p-4 rounded-xl bg-neutral-800/60 border border-neutral-700/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-neutral-400">Clearance & Disposal Total:</span>
                <div className="text-lg font-bold text-emerald-400">R{grandTotal}</div>
              </div>
              <button
                type="button"
                onClick={() => setSubmitted(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 transition"
              >
                Dispatch Clearance Truck
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-100">Clearance Run Dispatched!</h3>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              A bakkie driver has accepted your clearance booking for <span className="text-emerald-400 font-semibold">{pickupDate} at {pickupTime}</span>. 
              Recyclables will be safely sorted and an official dump ticket will be issued.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
              >
                Close & Return
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RubbishClearanceModal;
