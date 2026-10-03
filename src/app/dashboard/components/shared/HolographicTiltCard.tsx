'use client';

import React, { useState, useRef, useEffect } from 'react';

interface HolographicTiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTiltAngle?: number;
  sheenOpacity?: number;
}

export function HolographicTiltCard({
  children,
  className = '',
  maxTiltAngle = 14,
  sheenOpacity = 0.35
}: HolographicTiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [sheenX, setSheenX] = useState(50);
  const [sheenY, setSheenY] = useState(50);
  const [isHovered, setIsHovered] = useState(false);

  // Desktop Mouse Move Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = -((y - centerY) / centerY) * maxTiltAngle;
    const tiltY = ((x - centerX) / centerX) * maxTiltAngle;

    setRotateX(tiltX);
    setRotateY(tiltY);
    setSheenX((x / rect.width) * 100);
    setSheenY((y / rect.height) * 100);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
    setSheenX(50);
    setSheenY(50);
  };

  // Mobile Device Orientation Gyroscope
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      // gamma: left to right (-90 to 90)
      // beta: front to back (-180 to 180)
      const clampedGamma = Math.max(-25, Math.min(25, e.gamma));
      const clampedBeta = Math.max(15, Math.min(65, e.beta)) - 40; // calibrated for typical 40 deg viewing tilt

      setRotateY((clampedGamma / 25) * maxTiltAngle);
      setRotateX(-(clampedBeta / 25) * maxTiltAngle);
      setSheenX(50 + (clampedGamma / 25) * 40);
      setSheenY(50 + (clampedBeta / 25) * 40);
      setIsHovered(true);
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }
    return () => {
      if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, [maxTiltAngle]);

  return (
    <div
      style={{ perspective: '1000px' }}
      className="inline-block w-full"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) ${
            isHovered ? 'scale3d(1.02, 1.02, 1.02)' : 'scale3d(1, 1, 1)'
          }`,
          transformStyle: 'preserve-3d',
          transition: isHovered ? 'transform 100ms ease-out' : 'transform 500ms ease-out'
        }}
        className={`relative overflow-hidden transition-all duration-300 ${className}`}
      >
        {/* Child Content */}
        <div style={{ transform: 'translateZ(10px)' }} className="relative z-10 w-full h-full">
          {children}
        </div>

        {/* Dynamic Holographic Specular Sheen Overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-300"
          style={{
            opacity: isHovered ? sheenOpacity : 0,
            background: `radial-gradient(
              circle at ${sheenX}% ${sheenY}%,
              rgba(255, 255, 255, 0.45) 0%,
              rgba(251, 191, 36, 0.25) 25%,
              rgba(168, 85, 247, 0.2) 45%,
              rgba(6, 182, 212, 0.15) 70%,
              transparent 90%
            )`,
            mixBlendMode: 'color-dodge'
          }}
        />

        {/* Metallic Foil Edge Reflection */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-20 border border-white/20 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.6 : 0.15
          }}
        />
      </div>
    </div>
  );
}

export default HolographicTiltCard;

