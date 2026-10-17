import React from 'react';

export interface CrosshairProps {
  color?: string;
  containerRef?: React.RefObject<HTMLElement> | null;
  thickness?: number;
  opacity?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  gap?: number;
  fade?: number;
  smoothing?: number;
  showCoordinates?: boolean;
  targetEffect?: 'lock' | 'glitch' | 'none';
  targetSelector?: string;
  clickPulse?: boolean;
  hideCursor?: boolean;
  blendMode?: 'normal' | 'difference';
  className?: string;
  style?: React.CSSProperties;
}

declare const Crosshair: React.FC<CrosshairProps>;
export default Crosshair;
