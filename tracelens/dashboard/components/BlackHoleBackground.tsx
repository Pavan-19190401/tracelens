"use client";

import React from "react";
import BlackHole from "@/components/react-bits/BlackHole";
import { useTheme } from "@/lib/theme-provider";

export function BlackHoleBackground() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <BlackHole
        speed={0.8}
        zoom={1.75}
        particleCount={16}
        orbSize={0.78}
        glow={isDark ? 0.08 : 0.05}
        contrast={3.2}
        mirrorSplits={2}
        warpEnabled={true}
        distanceFade={0.4}
        bloom={1.3}
        ringIntensity={isDark ? 1.5 : 1.1}
        cursorInteraction={true}
        cursorIntensity={1.2}
        opacity={isDark ? 0.72 : 0.35}
        colors={isDark ? ["#38bdf8", "#c084fc"] : ["#0284c7", "#9333ea"]}
      />
    </div>
  );
}
