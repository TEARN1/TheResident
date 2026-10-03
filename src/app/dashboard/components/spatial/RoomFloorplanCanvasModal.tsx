'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid, X, Trash2, RotateCcw
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface PlacedFurniture {
  id: string;
  name: string;
  widthCm: number;
  lengthCm: number;
  x: number; // grid units
  y: number;
  rotation: 0 | 90;
  color: string;
}

const FURNITURE_CATALOG = [
  { name: 'Double Bed', widthCm: 137, lengthCm: 188, color: '#3b82f6', icon: '🛏️' },
  { name: '3/4 Bed', widthCm: 107, lengthCm: 188, color: '#6366f1', icon: '🛏️' },
  { name: 'Study Desk', widthCm: 120, lengthCm: 60, color: '#10b981', icon: '🖥️' },
  { name: 'Wardrobe', widthCm: 100, lengthCm: 60, color: '#f59e0b', icon: '🚪' },
  { name: 'Bar Fridge', widthCm: 50, lengthCm: 50, color: '#ec4899', icon: '🧊' }
];

interface RoomFloorplanCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
}

export function RoomFloorplanCanvasModal({
  isOpen,
  onClose,
  roomName = 'Standard Ensuite Room 4B'
}: RoomFloorplanCanvasModalProps) {
  const [roomLengthM] = useState(3.8);
  const [roomWidthM] = useState(3.2);
  const [placedItems, setPlacedItems] = useState<PlacedFurniture[]>([
    { id: 'item-1', name: 'Double Bed', widthCm: 137, lengthCm: 188, x: 2, y: 2, rotation: 0, color: '#3b82f6' },
    { id: 'item-2', name: 'Study Desk', widthCm: 120, lengthCm: 60, x: 18, y: 2, rotation: 90, color: '#10b981' }
  ]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>('item-1');

  const handleAddItem = (item: typeof FURNITURE_CATALOG[0]) => {
    playTactileSound('pop');
    const newId = `item-${placedItems.length + 1}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newItem: PlacedFurniture = {
      id: newId,
      name: item.name,
      widthCm: item.widthCm,
      lengthCm: item.lengthCm,
      x: 10 + (placedItems.length * 2) % 15,
      y: 10 + (placedItems.length * 2) % 15,
      rotation: 0,
      color: item.color
    };
    setPlacedItems(prev => [...prev, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handleRotateSelected = () => {
    if (!selectedItemId) return;
    playTactileSound('click');
    setPlacedItems(prev =>
      prev.map(item =>
        item.id === selectedItemId
          ? { ...item, rotation: item.rotation === 0 ? 90 : 0 }
          : item
      )
    );
  };

  const handleRemoveSelected = () => {
    if (!selectedItemId) return;
    playTactileSound('pop');
    setPlacedItems(prev => prev.filter(item => item.id !== selectedItemId));
    setSelectedItemId(null);
  };

  const totalAreaM2 = (roomLengthM * roomWidthM).toFixed(1);
  const occupiedAreaM2 = placedItems
    .reduce((acc, curr) => acc + (curr.widthCm * curr.lengthCm) / 10000, 0)
    .toFixed(2);
  const freeAreaM2 = (Number(totalAreaM2) - Number(occupiedAreaM2)).toFixed(1);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <Grid size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">2.5D Room Floorplan & Spatial Layout</h3>
                <p className="text-xs text-gray-400">{roomName} • Dimensions: {roomLengthM}m × {roomWidthM}m ({totalAreaM2} m²)</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Add Furniture:</span>
              {FURNITURE_CATALOG.map(f => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => handleAddItem(f)}
                  className="px-2.5 py-1 rounded-xl bg-neutral-900 border border-white/10 hover:border-gold-primary/40 text-gray-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <span>{f.icon}</span>
                  <span>{f.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedItemId}
                onClick={handleRotateSelected}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 text-gray-300 disabled:opacity-40 flex items-center gap-1.5 font-bold"
              >
                <RotateCcw size={13} />
                <span>Rotate 90°</span>
              </button>
              <button
                type="button"
                disabled={!selectedItemId}
                onClick={handleRemoveSelected}
                className="px-3 py-1.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 disabled:opacity-40 flex items-center gap-1.5 font-bold"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            </div>
          </div>

          {/* Interactive Grid Canvas */}
          <div className="relative aspect-[16/9] sm:aspect-[2/1] rounded-3xl bg-neutral-900 border border-white/15 overflow-hidden p-6 flex items-center justify-center">
            {/* Architectural Grid Lines */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            {/* Room Boundary Walls */}
            <div className="relative w-full h-full border-4 border-dashed border-gold-primary/40 rounded-2xl p-4 bg-black/40">
              {/* Doorway Indicator */}
              <div className="absolute bottom-0 left-10 w-16 h-1.5 bg-emerald-400 font-mono text-[9px] text-emerald-400 -bottom-3">
                Entrance Door (80cm)
              </div>

              {/* Window Indicator */}
              <div className="absolute top-0 right-12 w-24 h-1.5 bg-cyan-400 font-mono text-[9px] text-cyan-400 -top-3">
                Window (North Sunlight)
              </div>

              {/* Placed Furniture Items */}
              {placedItems.map(item => {
                const isSelected = item.id === selectedItemId;
                const widthPx = item.rotation === 0 ? item.widthCm * 0.7 : item.lengthCm * 0.7;
                const lengthPx = item.rotation === 0 ? item.lengthCm * 0.7 : item.widthCm * 0.7;

                return (
                  <motion.div
                    key={item.id}
                    drag
                    dragMomentum={false}
                    onClick={() => { playTactileSound('tab'); setSelectedItemId(item.id); }}
                    className={`absolute p-2 rounded-xl text-center select-none cursor-move transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-gold-primary border border-gold-primary'
                        : 'border border-white/20'
                    }`}
                    style={{
                      left: `${item.x * 3}%`,
                      top: `${item.y * 3}%`,
                      width: `${Math.max(60, widthPx)}px`,
                      height: `${Math.max(50, lengthPx)}px`,
                      backgroundColor: `${item.color}33`,
                      color: item.color
                    }}
                  >
                    <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                    <p className="text-[8px] font-mono opacity-80">{item.widthCm}×{item.lengthCm}cm</p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Spatial Area Metrics & Footer */}
          <div className="grid grid-cols-3 gap-3 p-3.5 bg-black/60 rounded-2xl border border-white/10 text-xs text-center font-mono">
            <div>
              <span className="text-gray-500 uppercase text-[9px] block">Total Room Area</span>
              <span className="text-white font-bold">{totalAreaM2} m²</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase text-[9px] block">Furniture Footprint</span>
              <span className="text-amber-400 font-bold">{occupiedAreaM2} m²</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase text-[9px] block">Free Walking Clearance</span>
              <span className="text-emerald-400 font-bold">{freeAreaM2} m² (Safe)</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default RoomFloorplanCanvasModal;
