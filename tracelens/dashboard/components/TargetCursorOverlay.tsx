"use client";

import React from "react";
import TargetCursor from "@/components/react-bits/TargetCursor";
import { useTheme } from "@/lib/theme-provider";

export function TargetCursorOverlay() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <TargetCursor
      targetSelector="a, button, [role='button'], input, select, textarea, .cursor-target, [data-cursor-label]"
      cursorColor={isDark ? "#ffffff" : "#09090b"}
      cursorColorOnTarget={isDark ? "#38bdf8" : "#2563eb"}
      spinDuration={2.2}
      hoverDuration={0.18}
      parallaxOn={true}
      hideDefaultCursor={true}
      size={32}
      cornerSize={10}
      thickness={2}
      padding={5}
      matchRadius={true}
      dotSize={4}
      blendMode="difference"
      showLabel={true}
      clickEffect={true}
    />
  );
}
