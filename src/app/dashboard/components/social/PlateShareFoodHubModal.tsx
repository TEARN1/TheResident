'use client';

import React, { useState } from 'react';
import { 
  Utensils, 
  X, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Plus, 
  ShieldCheck, 
  ChefHat 
} from 'lucide-react';

interface MealOffer {
  id: string;
  cookName: string;
  cookAvatar: string;
  residenceLocation: string;
  mealTitle: string;
  description: string;
  priceZAR: number;
  portionsRemaining: number;
  readyInMinutes: number;
  dietary: string[];
  isHalal: boolean;
  hygienePledged: boolean;
}

const MOCK_MEALS: MealOffer[] = [
  {
    id: 'm1',
    cookName: 'Lerato K.',
    cookAvatar: 'LK',
    residenceLocation: 'South Point Biccard, Floor 5 Kitchen',
    mealTitle: 'Sunday 7-Colours Feast Plate',
    description: 'Slow-roasted beef short rib, creamy potato salad, beetroot, yellow rice, chakalaka & steamed pumpkin.',
    priceZAR: 65,
    portionsRemaining: 4,
    readyInMinutes: 15,
    dietary: ['Gluten-Free Option', 'Nut-Free'],
    isHalal: true,
    hygienePledged: true
  },
  {
    id: 'm2',
    cookName: 'Sizwe N.',
    cookAvatar: 'SN',
    residenceLocation: 'Varsity Village, House 4B',
    mealTitle: 'Traditional Mogodu & Fluffy Pap with Salsa',
    description: 'Slow-simmered tender tripe served with buttery braai pap and spicy tomato chili salsa relish.',
    priceZAR: 50,
    portionsRemaining: 2,
    readyInMinutes: 5,
    dietary: ['Authentic Recipe'],
    isHalal: true,
    hygienePledged: true
  },
  {
    id: 'm3',
    cookName: 'Aminah M.',
    cookAvatar: 'AM',
    residenceLocation: 'Auckland Park Academy House, Unit 12',
    mealTitle: 'Smoky Nigerian-Style Jollof Rice with Fried Plantain',
    description: 'Woodsmoke-scented jollof rice topped with seasoned peppered grilled chicken quarter and sweet dodo.',
    priceZAR: 55,
    portionsRemaining: 6,
    readyInMinutes: 20,
    dietary: ['Halaal Certified Meat', 'Spicy'],
    isHalal: true,
    hygienePledged: true
  }
];

interface PlateShareFoodHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlateShareFoodHubModal({ isOpen, onClose }: PlateShareFoodHubModalProps) {
  const [meals, setMeals] = useState<MealOffer[]>(MOCK_MEALS);
  const [activeTab, setActiveTab] = useState<'browse' | 'host'>('browse');
  const [reservedMeal, setReservedMeal] = useState<MealOffer | null>(null);

  // Host Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState(45);
  const [newPortions, setNewPortions] = useState(4);
  const [newLocation, setNewLocation] = useState('My Residence Floor Kitchen');
  const [hostSuccess, setHostSuccess] = useState(false);

  if (!isOpen) return null;

  const handleReserve = (meal: MealOffer) => {
    setMeals(prev =>
      prev.map(m => (m.id === meal.id ? { ...m, portionsRemaining: Math.max(0, m.portionsRemaining - 1) } : m))
    );
    setReservedMeal(meal);
  };

  const handleCreatePlate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const newOffer: MealOffer = {
      id: `m-${Date.now()}`,
      cookName: 'You (Host Chef)',
      cookAvatar: 'ME',
      residenceLocation: newLocation,
      mealTitle: newTitle,
      description: newDesc,
      priceZAR: newPrice,
      portionsRemaining: newPortions,
      readyInMinutes: 25,
      dietary: ['Freshly Prepared'],
      isHalal: true,
      hygienePledged: true
    };

    setMeals(prev => [newOffer, ...prev]);
    setHostSuccess(true);
    setTimeout(() => {
      setHostSuccess(false);
      setActiveTab('browse');
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-orange-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Utensils className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  PlateShare Res Food Hub
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  Home Cooked
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Share excess home-cooked meals with floor mates or claim delicious student-priced plates.
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

        {/* Tab switcher */}
        <div className="flex gap-2 mt-6 border-b border-neutral-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'browse'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Available Hot Plates ({meals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('host')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'host'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Share Your Extra Food
          </button>
        </div>

        {/* Tab 1: Browse Available */}
        {activeTab === 'browse' && !reservedMeal && (
          <div className="mt-6 space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {meals.map(meal => (
              <div
                key={meal.id}
                className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-300 font-bold text-xs flex items-center justify-center">
                        {meal.cookAvatar}
                      </div>
                      <span className="text-xs font-semibold text-neutral-300">{meal.cookName}</span>
                      {meal.hygienePledged && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3" /> Clean Kitchen Pledge
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-neutral-100">{meal.mealTitle}</h3>
                    <p className="text-xs text-neutral-400">{meal.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-orange-400">R{meal.priceZAR}</div>
                    <div className="text-[10px] text-neutral-400">{meal.portionsRemaining} portions left</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80 text-xs">
                  <div className="flex items-center gap-4 text-neutral-400">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Clock className="w-3.5 h-3.5" /> Ready in {meal.readyInMinutes}m
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {meal.residenceLocation}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleReserve(meal)}
                    disabled={meal.portionsRemaining === 0}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-bold text-xs hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    {meal.portionsRemaining > 0 ? 'Claim Plate' : 'Sold Out'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Claimed Modal View */}
        {activeTab === 'browse' && reservedMeal && (
          <div className="mt-8 text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-100">Plate Reserved!</h3>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              You reserved a plate of <span className="text-orange-400 font-semibold">{reservedMeal.mealTitle}</span> for R{reservedMeal.priceZAR}. 
              Head to <span className="text-neutral-100 font-semibold">{reservedMeal.residenceLocation}</span> in ~{reservedMeal.readyInMinutes} minutes. Pay via PayShap or Cash at handover.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setReservedMeal(null)}
                className="px-6 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
              >
                Back to Plates
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-orange-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:bg-orange-400 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Host / Post Meal */}
        {activeTab === 'host' && (
          <form onSubmit={handleCreatePlate} className="mt-6 space-y-4">
            {hostSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Meal broadcast to your residence building!</span>
              </div>
            )}

            <div>
              <label className="text-xs text-neutral-400">Dish Name</label>
              <input
                type="text"
                placeholder="e.g. Grandma's Sunday Beef Stew with Dumplings"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400">Description & Ingredients</label>
              <textarea
                placeholder="Freshly prepared today, hearty beef, carrots, herbs..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-neutral-400">Price per Plate (ZAR)</label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={e => setNewPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400">Portions to Share</label>
                <input
                  type="number"
                  value={newPortions}
                  onChange={e => setNewPortions(Number(e.target.value))}
                  className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400">Pickup Spot</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-800/30 border border-neutral-800 flex items-center gap-2.5 text-xs text-neutral-300">
              <ChefHat className="w-4 h-4 text-orange-400 shrink-0" />
              <span>By sharing, you affirm that the meal is freshly prepared with sanitary food handling practices.</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 transition"
              >
                Post Plates to Residence
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default PlateShareFoodHubModal;
