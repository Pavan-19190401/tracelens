import React from 'react';

export interface GlassIconItem {
  id?: string | number;
  icon: React.ReactNode;
  label?: string;
  color?: string;
  href?: string;
  target?: string;
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
}

export interface GlassIconsProps {
  items: GlassIconItem[];
  size?: number;
  gap?: number;
  columns?: number;
  roundness?: number;
  refraction?: number;
  bevel?: number;
  dispersion?: number;
  frost?: number;
  shine?: number;
  tint?: string;
  tintOpacity?: number;
  iconColor?: string;
  plate?: 'tilt' | 'offset' | 'circle' | 'none';
  tilt?: number;
  spread?: number;
  hover?: 'lift' | 'float' | 'press' | 'none';
  parallax?: number;
  labels?: 'hover' | 'always' | 'none';
  intro?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
  style?: React.CSSProperties;
}

declare const GlassIcons: React.FC<GlassIconsProps>;
export default GlassIcons;
