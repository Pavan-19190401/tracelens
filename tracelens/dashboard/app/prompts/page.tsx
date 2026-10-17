"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, History, GitCompare, Code2, Check, Sparkles } from "lucide-react";
import { api, getActiveProjectId } from "@/lib/api";

export default function PromptsPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [compareVersionId, setCompareVersionId] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New prompt form state
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [newCommitMsg, setNewCommitMsg] = useState("");

  useEffect(() => {
    const pid = getActiveProjectId();
    setProjectId(pid);
    if (!pid) {
      api.getProjects().then((projs) => {
        if (projs.length > 0) setProjectId(projs[0].id);
      });
    }
  }, []);

  const { data: prompts, refetch } = useQuery({
    queryKey: ["prompts-list", projectId],
    queryFn: () => (projectId ? api.getPrompts(projectId) : []),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (prompts && prompts.length > 0 && !selectedPrompt) {
      setSelectedPrompt(prompts[0]);
    }
  }, [prompts, selectedPrompt]);

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newName || !newTemplate) return;
    await api.createPromptVersion(projectId, {
      name: newName,
      template: newTemplate,
      commit_message: newCommitMsg || "Version update",
    });
    setIsCreateOpen(false);
    setNewName("");
    setNewTemplate("");
    setNewCommitMsg("");
    refetch();
  };

  const comparePrompt = prompts?.find((p) => p.id === compareVersionId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prompt Versioning</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track template iterations, variables, commit messages, and diff versions side by side.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Prompt Version</span>
        </button>
      </div>

      {/* Main Grid: Prompts sidebar list vs Prompt Editor & Diff */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-4 bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-sm px-1">Prompt Templates</h3>
          <div className="space-y-1.5">
            {prompts && prompts.length > 0 ? (
              prompts.map((p) => {
                const isSelected = selectedPrompt?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPrompt(p)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/30 shadow-sm"
                        : "border-border/60 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{p.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono font-bold">
                        v{p.version}
                      </span>
                    </div>
                    {p.commit_message && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{p.commit_message}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono mt-2 block">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No prompt versions yet.</p>
            )}
          </div>
        </div>

        {/* Right: Selected Prompt Viewer & Version Diff */}
        <div className="lg:col-span-8 space-y-4">
          {selectedPrompt ? (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold">{selectedPrompt.name}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded bg-blue-600 text-white font-mono font-bold">
                      v{selectedPrompt.version}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedPrompt.commit_message || "No commit message provided"}
                  </p>
                </div>

                {/* Compare dropdown */}
                <div className="flex items-center space-x-2">
                  <GitCompare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">Compare with:</span>
                  <select
                    value={compareVersionId}
                    onChange={(e) => setCompareVersionId(e.target.value)}
                    className="text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select version...</option>
                    {prompts
                      ?.filter((p) => p.name === selectedPrompt.name && p.id !== selectedPrompt.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          v{p.version} ({p.commit_message || "update"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Template View / Diff View */}
              {comparePrompt ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Current (v{selectedPrompt.version})
                    </span>
                    <pre className="p-3 bg-muted/30 border border-border rounded-lg text-xs font-mono whitespace-pre-wrap h-72 overflow-y-auto">
                      {selectedPrompt.template}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Comparison (v{comparePrompt.version})
                    </span>
                    <pre className="p-3 bg-muted/30 border border-border rounded-lg text-xs font-mono whitespace-pre-wrap h-72 overflow-y-auto">
                      {comparePrompt.template}
                    </pre>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Template Content
                  </span>
                  <pre className="p-4 bg-muted/20 border border-border rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto min-h-[160px]">
                    {selectedPrompt.template}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
              Select or create a prompt to view details.
            </div>
          )}
        </div>
      </div>

      {/* Create Prompt Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-lg">Create Prompt Version</h3>
            <form onSubmit={handleCreatePrompt} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Prompt Name</label>
                <input
                  type="text"
                  placeholder="e.g., support_orchestrator"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full mt-1 p-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Template</label>
                <textarea
                  placeholder="Write prompt template with {{variables}}..."
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  required
                  rows={5}
                  className="w-full mt-1 p-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Commit Message</label>
                <input
                  type="text"
                  placeholder="e.g., Add safety guidelines"
                  value={newCommitMsg}
                  onChange={(e) => setNewCommitMsg(e.target.value)}
                  className="w-full mt-1 p-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Save Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
