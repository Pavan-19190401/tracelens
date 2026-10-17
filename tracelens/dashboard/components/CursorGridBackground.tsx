"use client";

import React from "react";
import CursorGrid from "@/components/react-bits/CursorGrid";
import { useTheme } from "@/lib/theme-provider";

export function CursorGridBackground() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <CursorGrid
        cellSize={54}
        color={isDark ? "#60a5fa" : "#2563eb"}
        gridColor={isDark ? "#27272a" : "#e4e4e7"}
        highlight="area"
        gridStyle="lines"
        radius={150}
        holdTime={400}
        fadeDuration={750}
        fillOpacity={isDark ? 0.06 : 0.03}
        gridOpacity={isDark ? 0.08 : 0.06}
        spotlight={0.55}
        clickPulse={true}
        pulseSpeed={650}
        ambient={0.06}
        edgeFade={0.15}
        lightMode={!isDark}
      />
    </div>
  );
}
