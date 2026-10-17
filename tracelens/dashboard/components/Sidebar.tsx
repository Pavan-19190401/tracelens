"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitCommitVertical,
  FileCode2,
  CheckCircle2,
  BellRing,
  KeyRound,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Traces", href: "/traces", icon: GitCommitVertical },
  { name: "Prompts", href: "/prompts", icon: FileCode2 },
  { name: "Evaluations", href: "/evals", icon: CheckCircle2 },
  { name: "Alerts", href: "/alerts", icon: BellRing },
  { name: "Project & Keys", href: "/projects", icon: KeyRound },
];

export function Sidebar() {
  const pathname = usePathname();

  // Hide on auth pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-sm min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <nav className="space-y-1.5">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Observability
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-border/50 hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">TraceLens Open Source</p>
        <p>Telemetry ingest: <code className="text-blue-500 font-mono">/v1/ingest</code></p>
      </div>
    </aside>
  );
}
