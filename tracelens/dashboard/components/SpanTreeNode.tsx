"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, CheckCircle2, XCircle, Clock } from "lucide-react";

export interface SpanNodeData {
  id: string;
  name: string;
  span_kind: string;
  start_time?: string;
  latency_ms: number;
  status: string;
  status_message?: string;
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  input?: any;
  output?: any;
  children?: SpanNodeData[];
}

interface SpanTreeNodeProps {
  node: SpanNodeData;
  selectedSpanId?: string;
  onSelect: (node: SpanNodeData) => void;
  depth?: number;
}

export function SpanTreeNode({
  node,
  selectedSpanId,
  onSelect,
  depth = 0,
}: SpanTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedSpanId === node.id;
  const isError = node.status === "ERROR";

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "llm":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "tool":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "retrieval":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <div className="select-none">
      <div
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        onClick={() => onSelect(node)}
        className={`flex items-center justify-between py-2 pr-3 rounded-lg cursor-pointer text-xs transition-colors ${
          isSelected
            ? "bg-blue-500/15 border border-blue-500/30 font-medium"
            : "hover:bg-muted/60"
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className="p-0.5 rounded hover:bg-muted"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {isError ? (
            <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          )}

          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border uppercase ${getKindBadge(node.span_kind)}`}>
            {node.span_kind}
          </span>

          <span className="truncate font-medium">{node.name}</span>

          {node.model && (
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {node.model}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 flex-shrink-0 font-mono text-[11px] text-muted-foreground">
          {node.total_tokens ? (
            <span>{node.total_tokens.toLocaleString()} tok</span>
          ) : null}
          {node.cost_usd ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              ${node.cost_usd.toFixed(4)}
            </span>
          ) : null}
          <span className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{node.latency_ms?.toFixed(0) || 0}ms</span>
          </span>
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-0.5">
          {node.children!.map((child) => (
            <SpanTreeNode
              key={child.id}
              node={child}
              selectedSpanId={selectedSpanId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
