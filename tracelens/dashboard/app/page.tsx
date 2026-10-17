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
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
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

function formatTimestamp(value: string) {
  if (!value) return "";
  try {
    const parts = value.split(" ");
    if (parts.length === 2) {
      const [, month, day] = parts[0].split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(month, 10) - 1;
      const mName = monthNames[mIdx] || month;
      return `${mName} ${parseInt(day, 10)}`;
    }
    return value;
  } catch {
    return value;
  }
}

export default function OverviewPage() {
  const [projectId, setProjectId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
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

      {/* Timeseries Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trace Volume & Errors */}
        <div className="bg-card/75 dark:bg-card/50 backdrop-blur-md border border-border/80 rounded-xl p-5 shadow-sm hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Trace Volume & Errors</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Execution count per hourly interval</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-3 text-xs font-medium">
                <span className="flex items-center space-x-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Traces</span>
                </span>
                <span className="flex items-center space-x-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Errors</span>
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono">
                Last 7 Days
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            {isTimeseriesLoading ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                Loading timeseries telemetry...
              </div>
            ) : (!timeseries?.points || timeseries.points.length === 0) ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
                <Activity className="w-7 h-7 opacity-30" />
                <span>No timeseries recorded for this project yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeseries.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTimestamp}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={{ stroke: "#334155" }}
                    minTickGap={45}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(59, 130, 246, 0.08)", rx: 4 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-lg p-3 shadow-2xl text-xs space-y-2 min-w-[170px]">
                          <p className="font-semibold text-slate-300 font-mono border-b border-slate-800 pb-1">{label}</p>
                          {payload.map((entry: any, i: number) => (
                            <div key={i} className="flex items-center justify-between space-x-3">
                              <span className="flex items-center space-x-1.5 text-slate-400">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span>{entry.name}:</span>
                              </span>
                              <span className="font-mono font-semibold text-white">{entry.value?.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="trace_count" name="Traces" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="error_count" name="Errors" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Latency Timeseries */}
        <div className="bg-card/75 dark:bg-card/50 backdrop-blur-md border border-border/80 rounded-xl p-5 shadow-sm hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Average Latency (ms)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Mean wall-clock latency per interval</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono">
              Last 7 Days
            </span>
          </div>
          <div className="h-64 w-full">
            {isTimeseriesLoading ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                Loading latency telemetry...
              </div>
            ) : (!timeseries?.points || timeseries.points.length === 0) ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
                <Clock className="w-7 h-7 opacity-30" />
                <span>No latency data recorded yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTimestamp}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={{ stroke: "#334155" }}
                    minTickGap={45}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    unit="ms"
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(168, 85, 247, 0.4)", strokeWidth: 1, strokeDasharray: "3 3" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-lg p-3 shadow-2xl text-xs space-y-1.5 min-w-[160px]">
                          <p className="font-semibold text-slate-300 font-mono border-b border-slate-800 pb-1">{label}</p>
                          <div className="flex items-center justify-between space-x-3">
                            <span className="flex items-center space-x-1.5 text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-purple-500" />
                              <span>Avg Latency:</span>
                            </span>
                            <span className="font-mono font-semibold text-purple-300">{payload[0]?.value} ms</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_latency_ms"
                    name="Avg Latency"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
