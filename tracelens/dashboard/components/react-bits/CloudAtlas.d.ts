import React from 'react';

export interface CloudAtlasProps {
  colors?: [string, string];
  backgroundColor?: string;
  anchor?: 'bottom' | 'top';
  height?: number;
  coverage?: number;
  density?: number;
  scale?: number;
  towers?: number;
  opacity?: number;
  wind?: number;
  billow?: number;
  speed?: number;
  resolution?: number;
  interactive?: boolean;
  cursorStrength?: number;
  cursorRadius?: number;
  seed?: number;
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export declare const CLOUD_ATLAS_PRESETS: Record<
  string,
  {
    colors: [string, string];
    background: string;
    opacity: number;
    height: number;
    coverage: number;
    towers: number;
  }
>;

declare const CloudAtlas: React.FC<CloudAtlasProps>;

export default CloudAtlas;
