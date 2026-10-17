import React, { RefObject } from 'react';

export interface TargetCursorProps {
  targetSelector?: string;
  cursorColor?: string;
  cursorColorOnTarget?: string;
  spinDuration?: number;
  hoverDuration?: number;
  parallaxOn?: boolean;
  hideDefaultCursor?: boolean;
  size?: number;
  cornerSize?: number;
  thickness?: number;
  padding?: number;
  matchRadius?: boolean;
  dotSize?: number;
  blendMode?: string;
  showLabel?: boolean;
  clickEffect?: boolean;
  container?: RefObject<HTMLElement> | HTMLElement | null;
}

declare const TargetCursor: React.FC<TargetCursorProps>;

export default TargetCursor;
