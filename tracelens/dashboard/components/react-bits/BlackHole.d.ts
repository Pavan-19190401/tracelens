import React from 'react';

export interface BlackHoleProps {
  width?: string | number;
  height?: string | number;
  speed?: number;
  zoom?: number;
  particleCount?: number;
  orbSize?: number;
  glow?: number;
  contrast?: number;
  mirrorSplits?: number;
  warpEnabled?: boolean;
  distanceFade?: number;
  colorShiftR?: number;
  colorShiftG?: number;
  colorShiftB?: number;
  colorSpeed?: number;
  colors?: [string, string];
  backgroundColor?: string;
  opacity?: number;
  bloom?: number;
  ringIntensity?: number;
  cursorInteraction?: boolean;
  cursorIntensity?: number;
  intro?: boolean;
  paused?: boolean;
  dpr?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

declare const BlackHole: React.FC<BlackHoleProps>;
export default BlackHole;
