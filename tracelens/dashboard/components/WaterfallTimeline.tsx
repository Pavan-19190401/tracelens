"use client";

import React from "react";

interface SpanWaterfallItem {
  id: string;
  name: string;
  span_kind: string;
  latency_ms: number;
  offset_ms: number;
  status: string;
  model?: string;
}

interface WaterfallTimelineProps {
  spans: SpanWaterfallItem[];
  totalDurationMs: number;
  selectedSpanId?: string;
  onSelectSpan?: (id: string) => void;
}

export function WaterfallTimeline({
  spans,
  totalDurationMs,
  selectedSpanId,
  onSelectSpan,
}: WaterfallTimelineProps) {
  const maxDuration = Math.max(totalDurationMs || 1, 100);

  const getKindColor = (kind: string, isError: boolean) => {
    if (isError) return "bg-rose-500 border-rose-600";
    switch (kind) {
      case "llm":
        return "bg-purple-500 border-purple-600";
      case "tool":
        return "bg-blue-500 border-blue-600";
      case "retrieval":
        return "bg-amber-500 border-amber-600";
      default:
        return "bg-emerald-500 border-emerald-600";
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Waterfall Timeline</h3>
        <span className="text-xs text-muted-foreground font-mono">
          Total Duration: {totalDurationMs.toFixed(1)} ms
        </span>
      </div>

      {/* Axis Scale Markers */}
      <div className="flex justify-between border-b border-border pb-1 mb-3 text-[11px] text-muted-foreground font-mono">
        <span>0 ms</span>
        <span>{(maxDuration * 0.25).toFixed(0)} ms</span>
        <span>{(maxDuration * 0.5).toFixed(0)} ms</span>
        <span>{(maxDuration * 0.75).toFixed(0)} ms</span>
        <span>{maxDuration.toFixed(0)} ms</span>
      </div>

      <div className="space-y-2">
        {spans.map((s) => {
          const leftPct = Math.min(Math.max((s.offset_ms / maxDuration) * 100, 0), 98);
          const rawWidthPct = (s.latency_ms / maxDuration) * 100;
          const widthPct = Math.max(Math.min(rawWidthPct, 100 - leftPct), 2);
          const isSelected = selectedSpanId === s.id;
          const isError = s.status === "ERROR";

          return (
            <div
              key={s.id}
              onClick={() => onSelectSpan && onSelectSpan(s.id)}
              className={`group flex items-center text-xs py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                isSelected ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-muted/50"
              }`}
            >
              {/* Span Label */}
              <div className="w-52 flex-shrink-0 flex items-center space-x-2 truncate pr-3">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold text-white ${
                    s.span_kind === "llm"
                      ? "bg-purple-600"
                      : s.span_kind === "tool"
                      ? "bg-blue-600"
                      : s.span_kind === "retrieval"
                      ? "bg-amber-600"
                      : "bg-emerald-600"
                  }`}
                >
                  {s.span_kind}
                </span>
                <span className="truncate font-medium" title={s.name}>
                  {s.name}
                </span>
              </div>

              {/* Bar track */}
              <div className="flex-1 relative h-5 bg-muted/40 rounded overflow-hidden">
                <div
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute h-full rounded transition-all opacity-85 group-hover:opacity-100 flex items-center px-1 text-[10px] text-white font-mono shadow-sm ${getKindColor(
                    s.span_kind,
                    isError
                  )}`}
                >
                  {widthPct > 8 && <span className="truncate">{s.latency_ms.toFixed(0)}ms</span>}
                </div>
              </div>

              {/* Latency text */}
              <div className="w-20 flex-shrink-0 text-right font-mono text-muted-foreground pl-3">
                {s.latency_ms.toFixed(0)} ms
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
