"use client";

import React from "react";
import CloudAtlas from "@/components/react-bits/CloudAtlas";
import { useTheme } from "@/lib/theme-provider";

export function CloudAtlasBackground() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <CloudAtlas
        colors={isDark ? ["#60a5fa", "#1e1b4b"] : ["#93c5fd", "#3b82f6"]}
        backgroundColor="transparent"
        anchor="bottom"
        height={0.88}
        coverage={0.46}
        density={0.52}
        scale={1.15}
        towers={1.2}
        opacity={isDark ? 0.72 : 0.45}
        wind={0.12}
        billow={1.25}
        speed={0.65}
        interactive={false}
        className="w-full h-full pointer-events-none"
      />
    </div>
  );
}
