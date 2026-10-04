'use client';

import React, { useState } from 'react';
import { 
  Wrench, 
  X, 
  Plus, 
  Minus, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  Star, 
  Drill 
} from 'lucide-react';

interface FurnitureItem {
  id: string;
  name: string;
  category: 'Desks & Tables' | 'Beds & Frames' | 'Storage & Wardrobes' | 'Chairs & Shelving';
  priceZAR: number;
  estMinutes: number;
  iconName: string;
}

interface Assembler {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  jobsCompleted: number;
  badge: string;
  hasOwnTools: boolean;
  distanceKm: number;
}

const CATALOG: FurnitureItem[] = [
  { id: 'desk-study', name: 'Ergonomic Study Desk / Computer Table', category: 'Desks & Tables', priceZAR: 180, estMinutes: 45, iconName: 'desk' },
  { id: 'dining-table', name: '4-Seater Dining Table', category: 'Desks & Tables', priceZAR: 220, estMinutes: 50, iconName: 'table' },
  { id: 'bed-single', name: 'Single / Three-Quarter Bed Frame', category: 'Beds & Frames', priceZAR: 240, estMinutes: 55, iconName: 'bed' },
  { id: 'bed-double', name: 'Double / Queen Platform Bed with Headboard', category: 'Beds & Frames', priceZAR: 320, estMinutes: 75, iconName: 'bed' },
  { id: 'wardrobe-2door', name: '2-Door Flatpack Wardrobe with Drawers', category: 'Storage & Wardrobes', priceZAR: 380, estMinutes: 90, iconName: 'wardrobe' },
  { id: 'wardrobe-3door', name: '3-Door Large Wardrobe with Mirror', category: 'Storage & Wardrobes', priceZAR: 520, estMinutes: 120, iconName: 'wardrobe' },
  { id: 'chest-drawers', name: '4-Tier Chest of Drawers (IKEA/Decofurn)', category: 'Storage & Wardrobes', priceZAR: 260, estMinutes: 60, iconName: 'drawers' },
  { id: 'bookcase-5shelf', name: '5-Shelf Bookcase / Display Unit', category: 'Chairs & Shelving', priceZAR: 160, estMinutes: 35, iconName: 'shelf' },
  { id: 'ergonomic-chair', name: 'High-Back Executive Mesh Office Chair', category: 'Chairs & Shelving', priceZAR: 140, estMinutes: 30, iconName: 'chair' },
];

const MOCK_ASSEMBLERS: Assembler[] = [
  { id: 'a1', name: 'Kagiso M.', avatar: 'KM', rating: 4.96, jobsCompleted: 84, badge: 'Master Guild Guildsman', hasOwnTools: true, distanceKm: 1.4 },
  { id: 'a2', name: 'Sipho N.', avatar: 'SN', rating: 4.88, jobsCompleted: 42, badge: 'Certified Tech Assembler', hasOwnTools: true, distanceKm: 2.1 },
  { id: 'a3', name: 'Thabo D.', avatar: 'TD', rating: 4.92, jobsCompleted: 67, badge: 'Flatpack Specialist', hasOwnTools: true, distanceKm: 3.5 },
];

interface FlatpackAssemblyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FlatpackAssemblyModal({ isOpen, onClose }: FlatpackAssemblyModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedAssemblerId, setSelectedAssemblerId] = useState<string>(MOCK_ASSEMBLERS[0].id);
  const [bringOwnDrill, setBringOwnDrill] = useState(true);
  const [scheduleDate, setScheduleDate] = useState('2026-10-05');
  const [scheduleTime, setScheduleTime] = useState('14:00');
  const [address, setAddress] = useState('South Point Res, 23 Biccard St, Braamfontein');
  const [step, setStep] = useState<'items' | 'checkout' | 'confirmed'>('items');

  if (!isOpen) return null;

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const totalItemsCount = Object.values(quantities).reduce((acc, q) => acc + q, 0);
  const totalSubtotal = Object.entries(quantities).reduce((acc, [id, qty]) => {
    const item = CATALOG.find(c => c.id === id);
    return acc + (item ? item.priceZAR * qty : 0);
  }, 0);
  const totalEstTimeMin = Object.entries(quantities).reduce((acc, [id, qty]) => {
    const item = CATALOG.find(c => c.id === id);
    return acc + (item ? item.estMinutes * qty : 0);
  }, 0);

  const platformFee = totalSubtotal > 0 ? 25 : 0;
  const grandTotal = totalSubtotal + platformFee;

  const handleBook = () => {
    setStep('confirmed');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Drill className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Flatpack Assembly Guild
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Fixed Rate
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Vetted student & local trades assemblers with power tools and a zero-wobble guarantee.
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

        {step === 'items' && (
          <div className="mt-6 space-y-6">
            {/* Catalog Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-300">Select Items to Assemble</span>
                <span className="text-xs text-neutral-400">Standard rates per unit</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                {CATALOG.map((item) => {
                  const qty = quantities[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                        qty > 0 
                          ? 'bg-amber-950/20 border-amber-500/40' 
                          : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-neutral-200 line-clamp-1">{item.name}</div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                            <span className="text-amber-400 font-semibold">R{item.priceZAR}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> ~{item.estMinutes}m
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800/60">
                        <span className="text-[11px] text-neutral-400">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, -1)}
                            disabled={qty === 0}
                            className="p-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white disabled:opacity-40 disabled:hover:text-neutral-300 transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-neutral-100 min-w-[16px] text-center">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1)}
                            className="p-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Bar */}
            <div className="p-4 rounded-xl bg-neutral-800/60 border border-neutral-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-neutral-400">Total Items:</span>{' '}
                  <span className="font-bold text-neutral-100">{totalItemsCount}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Est. Time:</span>{' '}
                  <span className="font-bold text-amber-400">
                    {Math.floor(totalEstTimeMin / 60)}h {totalEstTimeMin % 60}m
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Subtotal:</span>{' '}
                  <span className="font-bold text-emerald-400 text-sm">R{totalSubtotal}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('checkout')}
                disabled={totalItemsCount === 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Choose Assembler & Date
              </button>
            </div>
          </div>
        )}

        {step === 'checkout' && (
          <div className="mt-6 space-y-6">
            {/* Assembler Selection */}
            <div>
              <span className="text-sm font-medium text-neutral-300">Choose Available Specialist</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {MOCK_ASSEMBLERS.map(assembler => {
                  const isSelected = selectedAssemblerId === assembler.id;
                  return (
                    <div
                      key={assembler.id}
                      onClick={() => setSelectedAssemblerId(assembler.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-950/30 border-amber-500 text-neutral-100 ring-1 ring-amber-500/50'
                          : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-xs text-amber-300">
                          {assembler.avatar}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{assembler.name}</div>
                          <div className="flex items-center gap-1 text-[11px] text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{assembler.rating}</span>
                            <span className="text-neutral-400">({assembler.jobsCompleted} builds)</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-neutral-400 flex items-center justify-between">
                        <span>{assembler.badge}</span>
                        <span className="text-emerald-400">{assembler.distanceKm} km away</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logistics & Tools */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-xs text-neutral-400">Assembly Location</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                />

                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 border border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-medium text-neutral-200">Cordless Drill & Hex Bits</div>
                      <div className="text-[11px] text-neutral-400">Assembler brings high-torque tools</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={bringOwnDrill}
                    onChange={(e) => setBringOwnDrill(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-neutral-400">Preferred Date</label>
                    <div className="relative mt-1">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Time Slot</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-[11px] text-neutral-300">
                    <span className="font-semibold text-emerald-400">Zero-Wobble Escrow:</span> Payment held safely until you inspect drawers, doors, and bed bolts.
                  </div>
                </div>
              </div>
            </div>

            {/* Total breakdown */}
            <div className="p-4 rounded-xl bg-neutral-800/80 border border-neutral-700 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Items Subtotal ({totalItemsCount} items)</span>
                <span>R{totalSubtotal}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Platform Trust & Insurance Fee</span>
                <span>R{platformFee}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-neutral-100 pt-2 border-t border-neutral-700">
                <span>Total Escrow Deposit</span>
                <span className="text-amber-400">R{grandTotal}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('items')}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition"
              >
                Back to Items
              </button>
              <button
                type="button"
                onClick={handleBook}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 transition"
              >
                Confirm & Lock Escrow
              </button>
            </div>
          </div>
        )}

        {step === 'confirmed' && (
          <div className="mt-8 text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-100">Assembly Request Dispatched!</h3>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              Your specialist has been booked for <span className="text-amber-400 font-semibold">{scheduleDate} at {scheduleTime}</span>. 
              R{grandTotal} is securely held in TheResident Guild Escrow until you approve the finished build.
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

export default FlatpackAssemblyModal;
