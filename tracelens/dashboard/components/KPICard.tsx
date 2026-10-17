"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import GlassSurface from "@/components/react-bits/GlassSurface";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: "green" | "red" | "blue" | "neutral";
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeColor = "neutral",
}: KPICardProps) {
  const badgeClasses = {
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    red: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    neutral: "bg-muted text-muted-foreground border-border",
  }[badgeColor];

  return (
    <GlassSurface
      width="100%"
      height="100%"
      borderRadius={16}
      distortionScale={-180}
      displace={0.25}
      backgroundOpacity={0.06}
      className="border border-border/70 hover:border-blue-500/50 transition-all duration-200 hover:shadow-md"
    >
      <div className="w-full p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeClasses}`}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
    </GlassSurface>
  );
}
