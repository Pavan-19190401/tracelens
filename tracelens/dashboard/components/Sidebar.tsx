"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitCommitVertical,
  FileCode2,
  CheckCircle2,
  BellRing,
  KeyRound,
} from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import BranchedMenu, { BranchedMenuItem } from "@/components/react-bits/BranchedMenu";

const SIDEBAR_ITEMS: BranchedMenuItem[] = [
  {
    label: "Observability",
    children: [
      { value: "/", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
      { value: "/traces", label: "Traces Explorer", icon: <GitCommitVertical className="w-4 h-4" /> },
    ],
  },
  {
    label: "Evaluation & Prompts",
    children: [
      { value: "/prompts", label: "Prompt Registry", icon: <FileCode2 className="w-4 h-4" /> },
      { value: "/evals", label: "Automated Evals", icon: <CheckCircle2 className="w-4 h-4" /> },
    ],
  },
  {
    label: "Platform & Alerts",
    children: [
      { value: "/alerts", label: "Alert Rules", icon: <BellRing className="w-4 h-4" /> },
      { value: "/projects", label: "Projects & Keys", icon: <KeyRound className="w-4 h-4" /> },
    ],
  },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Hide on auth pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const currentActive =
    pathname.startsWith("/traces")
      ? "/traces"
      : pathname.startsWith("/prompts")
      ? "/prompts"
      : pathname.startsWith("/evals")
      ? "/evals"
      : pathname.startsWith("/alerts")
      ? "/alerts"
      : pathname.startsWith("/projects")
      ? "/projects"
      : "/";

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-sm min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between select-none">
      <div className="space-y-4">
        <div className="px-2 pt-1">
          <BranchedMenu
            items={SIDEBAR_ITEMS}
            defaultOpen={[0, 1, 2]}
            defaultActive={currentActive}
            onSelect={(value) => router.push(value)}
            color={isDark ? "#a1a1aa" : "#52525b"}
            accentColor={isDark ? "#60a5fa" : "#2563eb"}
            lineColor={isDark ? "#27272a" : "#e4e4e7"}
            width={230}
            rowHeight={36}
            indent={36}
            trunk={12}
            radius={9}
            lineWidth={1.5}
            fontSize={13}
            drawDuration={350}
            foldDuration={260}
          />
        </div>
      </div>

      <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">TraceLens Open Source</p>
        <p>Telemetry ingest: <code className="text-blue-500 font-mono">/v1/ingest</code></p>
      </div>
    </aside>
  );
}
