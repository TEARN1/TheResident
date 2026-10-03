'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ShieldCheck, 
  CheckSquare, 
  Clock, 
  FileCheck, 
  CheckCircle2
} from 'lucide-react';

interface CleaningTier {
  id: string;
  name: string;
  priceZAR: number;
  estHours: number;
  cleanersCount: number;
  description: string;
}

const TIERS: CleaningTier[] = [
  { id: 'single', name: 'Res Room / Bachelor Pad', priceZAR: 450, estHours: 2.5, cleanersCount: 1, description: 'Bedroom, en-suite bathroom, study desk, interior windows, skirting boards.' },
  { id: 'one-bed', name: '1-Bedroom Apartment', priceZAR: 650, estHours: 3.5, cleanersCount: 2, description: '1 Bed, 1 Bath, kitchen (oven degrease), lounge, interior windows, balcony sweep.' },
  { id: 'two-bed', name: '2-Bedroom Apartment', priceZAR: 950, estHours: 4.5, cleanersCount: 2, description: '2 Beds, 1-2 Baths, full kitchen scrub, tile grout steam, wall scuff treatment.' },
  { id: 'house', name: '3-Bedroom+ / Student House', priceZAR: 1350, estHours: 6.0, cleanersCount: 3, description: 'Complete deep overhaul: all rooms, multiple baths, patio, oven, light fixtures.' },
];

const AUDIT_CHECKLIST = [
  'Heavy-duty oven degreasing & stove burner deep clean',
  'Bathroom limescale removal & grout sterilization',
  'Eraser sponge treatment on minor wall scuffs and tape residue',
  'Inside kitchen cupboards, shelves & cutlery drawers vacuumed & wiped',
  'Interior window glass and tracks cleaned free of dust & grime',
  'Skirting boards, light switches, and door handles disinfected',
  'Deep carpet stain extraction or vacuuming & floor sanitization'
];

interface DepositSaverCleaningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositSaverCleaningModal({ isOpen, onClose }: DepositSaverCleaningModalProps) {
  const [selectedTierId, setSelectedTierId] = useState<string>('single');
  const [scheduledDate, setScheduledDate] = useState('2026-10-06');
  const [timeSlot, setTimeSlot] = useState('09:00');
  const [includeSteamCarpet, setIncludeSteamCarpet] = useState(false);
  const [landlordEmail, setLandlordEmail] = useState('');
  const [step, setStep] = useState<'plan' | 'audit' | 'confirmed'>('plan');

  if (!isOpen) return null;

  const currentTier = TIERS.find(t => t.id === selectedTierId) || TIERS[0];
  const steamExtra = includeSteamCarpet ? 180 : 0;
  const totalPrice = currentTier.priceZAR + steamExtra;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Deposit-Saver Move-Out Cleaning
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  100% Deposit Guarantee
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                SARS & RHA Act 50 compliant inspection-ready deep cleans with certified handover signoff.
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

        {step === 'plan' && (
          <div className="mt-6 space-y-6">
            {/* Guarantee Callout */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-semibold text-emerald-400">Zero-Deduction Guarantee</div>
                <div className="text-neutral-300">
                  If your landlord disputes cleanliness after our audit, we send our rapid crew back within 24 hours free of charge, or refund your cleaning fee.
                </div>
              </div>
            </div>

            {/* Property Tier Selection */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-3">
                Select Residence Unit Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIERS.map(tier => {
                  const isSelected = selectedTierId === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40'
                          : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-200">{tier.name}</span>
                        <span className="text-sm font-bold text-emerald-400">R{tier.priceZAR}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-2 line-clamp-2">{tier.description}</p>
                      <div className="flex items-center gap-3 mt-3 text-[10px] text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400" /> ~{tier.estHours} hrs
                        </span>
                        <span>•</span>
                        <span>{tier.cleanersCount} Pro Cleaner{tier.cleanersCount > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add-ons & Scheduling */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-300">Add-On Deep Treatments</label>
                <div 
                  onClick={() => setIncludeSteamCarpet(!includeSteamCarpet)}
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                    includeSteamCarpet ? 'bg-emerald-950/20 border-emerald-500/50' : 'bg-neutral-800/40 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-neutral-200">Industrial Carpet Steam Vacuum</div>
                      <div className="text-[11px] text-neutral-400">Lifts stubborn stains & odor elimination</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">+R180</span>
                </div>

                <div>
                  <label className="text-xs text-neutral-400">Landlord / Agent Email (Optional for direct report)</label>
                  <input
                    type="email"
                    placeholder="agent@realtysa.co.za"
                    value={landlordEmail}
                    onChange={(e) => setLandlordEmail(e.target.value)}
                    className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-300">Move-Out Inspection Date</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="time"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-neutral-800/40 border border-neutral-700/60 text-xs space-y-1.5">
                  <div className="flex justify-between text-neutral-400">
                    <span>Base Deep Clean</span>
                    <span>R{currentTier.priceZAR}</span>
                  </div>
                  {includeSteamCarpet && (
                    <div className="flex justify-between text-neutral-400">
                      <span>Steam Carpet Add-on</span>
                      <span>R180</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-neutral-100 pt-1.5 border-t border-neutral-700">
                    <span>Total Deposit Saver Price</span>
                    <span className="text-emerald-400">R{totalPrice}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('audit')}
                className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-neutral-600"
              >
                View 7-Point Landlord Audit List
              </button>
              <button
                type="button"
                onClick={() => setStep('confirmed')}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 transition"
              >
                Book Deposit-Saver Clean
              </button>
            </div>
          </div>
        )}

        {step === 'audit' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Included Handover Standard Protocol</span>
            </div>
            <div className="space-y-2.5 bg-neutral-800/30 p-4 rounded-xl border border-neutral-800">
              {AUDIT_CHECKLIST.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-neutral-300">
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setStep('plan')}
                className="px-6 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
              >
                Back to Booking
              </button>
            </div>
          </div>
        )}

        {step === 'confirmed' && (
          <div className="mt-8 text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-100">Deep Clean Dispatch Booked!</h3>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              Our vetted crew will arrive on <span className="text-emerald-400 font-semibold">{scheduledDate} at {timeSlot}</span> with high-grade eco chemicals and equipment.
              You will receive an official Landlord Handover Cleanliness Certificate with high-res timestamped photos upon job completion.
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

export default DepositSaverCleaningModal;
