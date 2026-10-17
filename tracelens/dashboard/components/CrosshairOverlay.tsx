"use client";

import React from "react";
import Crosshair from "@/components/react-bits/Crosshair";
import { useTheme } from "@/lib/theme-provider";

export function CrosshairOverlay() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Crosshair
      color={isDark ? "#38bdf8" : "#2563eb"}
      targetEffect="lock"
      thickness={1}
      opacity={0.6}
      smoothing={0.2}
      showCoordinates={true}
      clickPulse={true}
      targetSelector="a, button, [role='button'], select, input, [data-crosshair-target]"
    />
  );
}
