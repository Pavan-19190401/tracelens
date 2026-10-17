import React from 'react';

export interface CursorGridProps {
  color?: string;
  gridColor?: string;
  cellSize?: number;
  highlight?: 'area' | 'cell';
  gridStyle?: 'lines' | 'dashed' | 'dots' | 'crosses';
  radius?: number;
  falloff?: 'smooth' | 'linear' | 'sharp';
  holdTime?: number;
  fadeDuration?: number;
  lineWidth?: number;
  maxOpacity?: number;
  fillOpacity?: number;
  gridOpacity?: number;
  spotlight?: number;
  cellGap?: number;
  cellRadius?: number;
  clickPulse?: boolean;
  pulseSpeed?: number;
  ambient?: number;
  edgeFade?: number;
  intro?: boolean;
  lightMode?: boolean;
  dpr?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

declare const CursorGrid: React.FC<CursorGridProps>;
export default CursorGrid;
