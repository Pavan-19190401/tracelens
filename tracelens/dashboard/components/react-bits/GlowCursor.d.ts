import React from 'react';

export interface GlowCursorProps {
  color?: string;
  secondaryColor?: string;
  intensity?: number;
  trailWidth?: number;
  linger?: number;
  glow?: number;
  hotspot?: number;
  followSpeed?: number;
  grain?: number;
  clickBurst?: boolean;
  quality?: 'low' | 'medium' | 'high';
  theme?: 'dark' | 'light';
  blendMode?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

declare const GlowCursor: React.FC<GlowCursorProps>;

export default GlowCursor;
