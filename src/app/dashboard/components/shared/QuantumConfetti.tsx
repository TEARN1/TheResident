'use client';

import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  opacity: number;
}

interface QuantumConfettiProps {
  active: boolean;
  onComplete?: () => void;
  durationMs?: number;
}

const GOLD_EMERALD_PALETTE = [
  '#d4af37', // Gold Primary
  '#f59e0b', // Amber 500
  '#10b981', // Emerald 500
  '#059669', // Emerald 600
  '#34d399', // Mint Emerald
  '#fbbf24', // Warm Gold
  '#ffffff'  // Crystal White
];

export function QuantumConfetti({ active, onComplete, durationMs = 2400 }: QuantumConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    // Generate initial particle burst from screen center top
    const count = 55;
    const initialParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI / 180) * (30 + ((i * 120) / count) + ((i % 5) * 10));
      const speed = 4 + (i % 7);
      initialParticles.push({
        id: i,
        x: 50 + (((i % 9) - 4) * 3), // around center X%
        y: 20, // top 20%
        vx: Math.cos(angle) * speed * (i % 2 === 0 ? 1 : -0.9),
        vy: -Math.sin(angle) * speed * 0.6,
        size: 5 + (i % 6),
        color: GOLD_EMERALD_PALETTE[i % GOLD_EMERALD_PALETTE.length],
        rotation: (i * 35) % 360,
        vRot: (i % 10) - 5,
        opacity: 1
      });
    }

    let animFrame: number;
    let startTime: number;

    animFrame = requestAnimationFrame(() => {
      setParticles(initialParticles);
      startTime = Date.now();

      const tick = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > durationMs) {
          setParticles([]);
          if (onComplete) onComplete();
          return;
        }

        setParticles(prev =>
          prev.map(p => ({
            ...p,
            x: p.x + p.vx * 0.15,
            y: p.y + p.vy * 0.2 + 0.35, // gravity
            vy: p.vy + 0.12, // gravity acceleration
            rotation: p.rotation + p.vRot,
            opacity: Math.max(0, 1 - (elapsed / durationMs))
          }))
        );

        animFrame = requestAnimationFrame(tick);
      };

      animFrame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(animFrame);
  }, [active, durationMs, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[350] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.4}px`,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: p.id % 3 === 0 ? '50%' : '2px',
            boxShadow: `0 0 6px ${p.color}88`,
            transition: 'opacity 100ms linear'
          }}
        />
      ))}
    </div>
  );
}

export default QuantumConfetti;
