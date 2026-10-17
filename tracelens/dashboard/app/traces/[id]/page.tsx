"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Cpu,
  Layers,
  Code2,
} from "lucide-react";
import { api } from "@/lib/api";
import { SpanTreeNode, SpanNodeData } from "@/components/SpanTreeNode";
import { WaterfallTimeline } from "@/components/WaterfallTimeline";

function flattenSpans(spans: any[]): any[] {
  const flat: any[] = [];
  function recurse(list: any[]) {
    for (const item of list) {
      flat.push(item);
      if (item.children && item.children.length > 0) {
        recurse(item.children);
      }
    }
  }
  recurse(spans);
  return flat;
}

export default function TraceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const traceId = params.id as string;
  const [selectedSpan, setSelectedSpan] = useState<any>(null);

  const { data: trace, isLoading } = useQuery({
    queryKey: ["trace-detail", traceId],
    queryFn: () => api.getTraceDetail(traceId),
    enabled: !!traceId,
  });

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground">Loading trace details...</div>;
  }

  if (!trace) {
    return <div className="py-20 text-center text-rose-500 font-semibold">Trace not found.</div>;
  }

  const isError = trace.status === "ERROR";
  const allSpans = flattenSpans(trace.spans || []);
  const activeSpan = selectedSpan || (allSpans.length > 0 ? allSpans[0] : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight">{trace.name}</h1>
              {isError ? (
                <span className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>ERROR</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>SUCCESS</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Trace ID: {trace.id}</p>
          </div>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center space-x-3 font-mono text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{trace.latency_ms?.toFixed(0) || 0} ms</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{trace.total_tokens?.toLocaleString() || 0} tok</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-emerald-600 dark:text-emerald-400 font-semibold">
            <Coins className="w-3.5 h-3.5" />
            <span>${trace.cost_usd?.toFixed(4) || "0.0000"}</span>
          </div>
        </div>
      </div>

      {/* Waterfall Timeline */}
      <WaterfallTimeline
        spans={allSpans}
        totalDurationMs={trace.latency_ms || 100}
        selectedSpanId={activeSpan?.id}
        onSelectSpan={(id) => {
          const found = allSpans.find((s) => s.id === id);
          if (found) setSelectedSpan(found);
        }}
      />

      {/* Main Split: Collapsible Span Tree vs Span Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Collapsible Span Tree */}
        <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-semibold text-sm">Execution Span Hierarchy</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {allSpans.length} spans
            </span>
          </div>
          <div className="space-y-1">
            {trace.spans && trace.spans.length > 0 ? (
              trace.spans.map((rootNode: any) => (
                <SpanTreeNode
                  key={rootNode.id}
                  node={rootNode}
                  selectedSpanId={activeSpan?.id}
                  onSelect={(node) => setSelectedSpan(node)}
                />
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No child spans recorded.</p>
            )}
          </div>
        </div>

        {/* Right: Selected Span Inspector (I/O, Tokens, Errors) */}
        <div className="lg:col-span-6 space-y-4">
          {activeSpan ? (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-semibold text-sm">{activeSpan.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Span ID: {activeSpan.id}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-muted font-medium">
                  {activeSpan.span_kind}
                </span>
              </div>

              {/* Model & Tokens summary */}
              {activeSpan.model && (
                <div className="grid grid-cols-3 gap-2 bg-muted/30 p-3 rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <p className="font-medium text-foreground">{activeSpan.model}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tokens:</span>
                    <p className="font-medium text-foreground">
                      {activeSpan.total_tokens || 0} ({activeSpan.prompt_tokens || 0} / {activeSpan.completion_tokens || 0})
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost:</span>
                    <p className="font-medium text-emerald-500">
                      ${activeSpan.cost_usd ? activeSpan.cost_usd.toFixed(5) : "0.00000"}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Callout if error */}
              {activeSpan.status === "ERROR" && activeSpan.status_message && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-mono whitespace-pre-wrap">
                  <p className="font-semibold mb-1">Exception Details:</p>
                  {activeSpan.status_message}
                </div>
              )}

              {/* Input Inspector */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Span Input
                </span>
                <pre className="mt-1.5 p-3 rounded-lg bg-background border border-border text-xs font-mono overflow-x-auto max-h-52">
                  {JSON.stringify(activeSpan.input || {}, null, 2)}
                </pre>
              </div>

              {/* Output Inspector */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Span Output
                </span>
                <pre className="mt-1.5 p-3 rounded-lg bg-background border border-border text-xs font-mono overflow-x-auto max-h-52">
                  {JSON.stringify(activeSpan.output || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Select a span from the hierarchy to view its input, output, and token counts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
