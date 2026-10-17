"use client";

import React from "react";
import GlowCursor from "@/components/react-bits/GlowCursor";
import { useTheme } from "@/lib/theme-provider";

export function GlowCursorOverlay() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <GlowCursor
        color={isDark ? "#38bdf8" : "#2563eb"}
        secondaryColor={isDark ? "#818cf8" : "#6366f1"}
        intensity={1.35}
        trailWidth={3}
        linger={1.4}
        glow={1.25}
        hotspot={0.8}
        followSpeed={0.65}
        clickBurst={true}
        quality="high"
        theme={theme}
      />
    </div>
  );
}
