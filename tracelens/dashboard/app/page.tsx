"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Clock,
  Coins,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Bell,
  Key,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { KPICard } from "@/components/KPICard";
import { api, getActiveProjectId } from "@/lib/api";
import { useTheme } from "@/lib/theme-provider";
import GlassSurface from "@/components/react-bits/GlassSurface";
import GlassIcons from "@/components/react-bits/GlassIcons";

export default function OverviewPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const pid = getActiveProjectId();
    setProjectId(pid);
    if (!pid) {
      api.getProjects().then((projs) => {
        if (projs.length > 0) {
          setProjectId(projs[0].id);
        }
      });
    }
  }, []);

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["metrics-summary", projectId],
    queryFn: () => (projectId ? api.getMetricsSummary(projectId, 168) : null),
    enabled: !!projectId,
  });

  const { data: timeseries, isLoading: isTimeseriesLoading } = useQuery({
    queryKey: ["metrics-timeseries", projectId],
    queryFn: () => (projectId ? api.getMetricsTimeseries(projectId, 168) : null),
    enabled: !!projectId,
  });

  const quickNavItems = [
    {
      icon: <Activity className="w-5 h-5 text-white" />,
      label: "Traces",
      color: "blue",
      href: "/traces",
    },
    {
      icon: <Sparkles className="w-5 h-5 text-white" />,
      label: "Prompts",
      color: "purple",
      href: "/prompts",
    },
    {
      icon: <CheckCircle2 className="w-5 h-5 text-white" />,
      label: "Evals",
      color: "green",
      href: "/evals",
    },
    {
      icon: <Bell className="w-5 h-5 text-white" />,
      label: "Alerts",
      color: "orange",
      href: "/alerts",
    },
    {
      icon: <Key className="w-5 h-5 text-white" />,
      label: "Projects",
      color: "indigo",
      href: "/projects",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time telemetry, latency percentiles, error rates, and token economics.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/traces"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <span>Explore Traces</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Interactive Launchpad with GlassIcons */}
      <GlassSurface
        width="100%"
        height="auto"
        borderRadius={20}
        distortionScale={-160}
        displace={0.35}
        backgroundOpacity={0.07}
        className="border border-border/70 p-4 shadow-sm"
      >
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 px-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Quick Access</span>
            <h2 className="text-base font-semibold tracking-tight text-foreground mt-0.5">Interactive Launchpad</h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
              Explore traces, configure automated evaluators, version prompts, and review live anomalies.
            </p>
          </div>
          <div className="overflow-x-auto py-2 flex items-center justify-center">
            <GlassIcons
              items={quickNavItems}
              size={54}
              gap={32}
              roundness={0.5}
              plate="tilt"
              hover="lift"
              labels="always"
              theme={theme === "dark" ? "dark" : "light"}
            />
          </div>
        </div>
      </GlassSurface>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Total Traces"
          value={summary?.total_traces?.toLocaleString() ?? (isSummaryLoading ? "..." : "0")}
          subtitle="Recorded executions"
          icon={Activity}
          badge="Live"
          badgeColor="blue"
        />
        <KPICard
          title="Error Rate"
          value={summary ? `${summary.error_rate_pct}%` : "..."}
          subtitle="Status != SUCCESS"
          icon={AlertTriangle}
          badge={summary && summary.error_rate_pct > 5 ? "High" : "Optimal"}
          badgeColor={summary && summary.error_rate_pct > 5 ? "red" : "green"}
        />
        <KPICard
          title="p50 Latency"
          value={summary ? `${summary.p50_latency_ms}ms` : "..."}
          subtitle="Median response time"
          icon={Clock}
          badge="p50"
          badgeColor="neutral"
        />
        <KPICard
          title="p95 Latency"
          value={summary ? `${summary.p95_latency_ms}ms` : "..."}
          subtitle="Tail response latency"
          icon={Clock}
          badge="p95"
          badgeColor="neutral"
        />
        <KPICard
          title="Total Cost"
          value={summary ? `$${summary.total_cost_usd.toFixed(4)}` : "..."}
          subtitle="Calculated LLM cost"
          icon={Coins}
          badge="USD"
          badgeColor="green"
        />
        <KPICard
          title="Total Tokens"
          value={summary?.total_tokens?.toLocaleString() ?? "..."}
          subtitle="Input + output tokens"
          icon={Cpu}
          badge="Tokens"
          badgeColor="neutral"
        />
      </div>

      {/* Timeseries Charts Section wrapped in GlassSurface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trace Volume & Errors */}
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={18}
          distortionScale={-120}
          displace={0.2}
          backgroundOpacity={0.06}
          className="border border-border/70 hover:border-blue-500/30 transition-all shadow-sm"
        >
          <div className="w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm">Trace Volume & Errors</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Execution count per hourly interval</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-muted font-mono">Last 7 Days</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeseries?.points || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none" }}
                    itemStyle={{ fontSize: "12px", color: "#fff" }}
                  />
                  <Bar dataKey="trace_count" name="Traces" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="error_count" name="Errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassSurface>

        {/* Latency Timeseries */}
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={18}
          distortionScale={-120}
          displace={0.2}
          backgroundOpacity={0.06}
          className="border border-border/70 hover:border-purple-500/30 transition-all shadow-sm"
        >
          <div className="w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm">Average Latency (ms)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Mean wall-clock latency per interval</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-muted font-mono">Last 7 Days</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseries?.points || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="ms" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none" }}
                    itemStyle={{ fontSize: "12px", color: "#fff" }}
                  />
                  <Line type="monotone" dataKey="avg_latency_ms" name="Avg Latency" stroke="#a855f7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}
