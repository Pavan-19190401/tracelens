"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { api, getActiveProjectId } from "@/lib/api";

export default function TracesPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    const pid = getActiveProjectId();
    setProjectId(pid);
    if (!pid) {
      api.getProjects().then((projs) => {
        if (projs.length > 0) setProjectId(projs[0].id);
      });
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["traces-list", projectId, search, statusFilter, modelFilter, page],
    queryFn: () => {
      if (!projectId) return null;
      const params: Record<string, any> = {
        limit,
        offset: page * limit,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (modelFilter) params.model = modelFilter;
      return api.getTraces(projectId, params);
    },
    enabled: !!projectId,
  });

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trace Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inspect individual LLM execution traces, token consumption, and errors.
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
          Total Traces: {data?.total?.toLocaleString() ?? 0}
        </span>
      </div>

      {/* Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search trace name or error message..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="bg-background border border-border text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success Only</option>
          <option value="ERROR">Errors Only</option>
        </select>

        <select
          value={modelFilter}
          onChange={(e) => {
            setModelFilter(e.target.value);
            setPage(0);
          }}
          className="bg-background border border-border text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Models</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Status</th>
                <th className="py-3 px-4">Trace Name</th>
                <th className="py-3 px-4">Session / User</th>
                <th className="py-3 px-4 text-right">Tokens</th>
                <th className="py-3 px-4 text-right">Cost (USD)</th>
                <th className="py-3 px-4 text-right">Latency</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Loading telemetry traces...
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((t) => {
                  const isError = t.status === "ERROR";
                  return (
                    <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 text-center">
                        {isError ? (
                          <XCircle className="w-4 h-4 text-rose-500 inline-block" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <Link href={`/traces/${t.id}`} className="hover:text-blue-500 transition-colors">
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {t.session_id || t.user_id || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">
                        {t.total_tokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        ${t.cost_usd.toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">
                        {t.latency_ms ? `${t.latency_ms.toFixed(0)}ms` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground font-mono">
                        {new Date(t.start_time).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/traces/${t.id}`}
                          className="px-2.5 py-1 text-xs rounded bg-muted hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No traces matched your filter query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {data?.items.length ?? 0} of {data?.total ?? 0} records
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">
              Page {page + 1} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page + 1 >= totalPages}
              className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
