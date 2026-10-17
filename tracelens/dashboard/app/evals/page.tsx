"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getActiveProjectId } from "@/lib/api";

export default function EvalsPage() {
  const queryClient = useQueryClient();
  const projectId = getActiveProjectId();

  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [runName, setRunName] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [scorerName, setScorerName] = useState("exact_match");

  // Comparison State
  const [compareRunA, setCompareRunA] = useState<string>("");
  const [compareRunB, setCompareRunB] = useState<string>("");
  const [isComparing, setIsComparing] = useState(false);

  // Queries
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["eval-runs", projectId],
    queryFn: () => (projectId ? api.getEvalRuns(projectId) : Promise.resolve([])),
    enabled: !!projectId,
    refetchInterval: 3000, // auto-refresh running evals
  });

  const { data: datasets } = useQuery({
    queryKey: ["datasets", projectId],
    queryFn: () => (projectId ? api.getDatasets(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const { data: prompts } = useQuery({
    queryKey: ["prompts", projectId],
    queryFn: () => (projectId ? api.getPrompts(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const { data: comparisonData, isLoading: compareLoading, error: compareError } = useQuery({
    queryKey: ["eval-compare", compareRunA, compareRunB],
    queryFn: () => api.compareEvalRuns(compareRunA, compareRunB),
    enabled: isComparing && !!compareRunA && !!compareRunB,
  });

  // Trigger Mutation
  const triggerMutation = useMutation({
    mutationFn: (payload: { name: string; dataset_id: string; prompt_version_id?: string; scorer_name: string }) =>
      api.triggerEvalRun(projectId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eval-runs", projectId] });
      setIsTriggerModalOpen(false);
      setRunName("");
    },
  });

  const handleStartComparison = (e: React.FormEvent) => {
    e.preventDefault();
    if (compareRunA && compareRunB) {
      if (compareRunA === compareRunB) {
        alert("Please select two different runs to compare.");
        return;
      }
      setIsComparing(true);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            LLM Evaluations
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Benchmark prompt versions, measure accuracy with deterministic and LLM-as-judge scorers, and compare side-by-side win rates.
          </p>
        </div>
        <button
          onClick={() => setIsTriggerModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          + New Evaluation Run
        </button>
      </div>

      {/* Comparison Drawer / Control */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Side-by-Side Win/Loss Comparison
        </h2>
        <form onSubmit={handleStartComparison} className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-1/3">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Baseline (Run A)
            </label>
            <select
              value={compareRunA}
              onChange={(e) => setCompareRunA(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Baseline Run A</option>
              {runs?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.scorer_name} - {r.average_score != null ? `${(r.average_score * 100).toFixed(0)}%` : r.status})
                </option>
              ))}
            </select>
          </div>

          <div className="text-zinc-400 font-bold self-center pt-5 hidden sm:block">VS</div>

          <div className="w-full sm:w-1/3">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Candidate (Run B)
            </label>
            <select
              value={compareRunB}
              onChange={(e) => setCompareRunB(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Candidate Run B</option>
              {runs?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.scorer_name} - {r.average_score != null ? `${(r.average_score * 100).toFixed(0)}%` : r.status})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-5 w-full sm:w-auto">
            <button
              type="submit"
              disabled={!compareRunA || !compareRunB}
              className="w-full sm:w-auto rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              Compare Runs
            </button>
          </div>
        </form>

        {/* Comparison Results */}
        {isComparing && (
          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            {compareLoading ? (
              <div className="text-center py-6 text-sm text-zinc-500">Computing win/loss delta...</div>
            ) : compareError ? (
              <div className="text-center py-6 text-sm text-rose-500">
                Failed to compare runs. Ensure both runs completed successfully.
              </div>
            ) : comparisonData ? (
              <div className="space-y-6">
                {/* Score Summary Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-center">
                    <p className="text-xs uppercase font-semibold text-emerald-700 dark:text-emerald-400">Wins A (Baseline)</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">{comparisonData.wins_a}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400/80">
                      {comparisonData.total_items ? ((comparisonData.wins_a / comparisonData.total_items) * 100).toFixed(0) : 0}% win rate
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-center">
                    <p className="text-xs uppercase font-semibold text-blue-700 dark:text-blue-400">Wins B (Candidate)</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">{comparisonData.wins_b}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400/80">
                      {comparisonData.total_items ? ((comparisonData.wins_b / comparisonData.total_items) * 100).toFixed(0) : 0}% win rate
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-center">
                    <p className="text-xs uppercase font-semibold text-zinc-600 dark:text-zinc-400">Ties</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{comparisonData.ties}</p>
                    <p className="text-xs text-zinc-500">Equivalent scores</p>
                  </div>
                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-center">
                    <p className="text-xs uppercase font-semibold text-zinc-600 dark:text-zinc-400">Evaluated Items</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{comparisonData.total_items}</p>
                    <p className="text-xs text-zinc-500">Dataset samples</p>
                  </div>
                </div>

                {/* Per-item Breakdown */}
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Sample Input</th>
                        <th className="px-4 py-3">Expected Output</th>
                        <th className="px-4 py-3">Score A</th>
                        <th className="px-4 py-3">Score B</th>
                        <th className="px-4 py-3">Winner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {comparisonData.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="px-4 py-3 font-mono text-xs max-w-xs truncate text-zinc-800 dark:text-zinc-200">
                            {JSON.stringify(item.input)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs max-w-xs truncate text-zinc-600 dark:text-zinc-400">
                            {JSON.stringify(item.expected_output)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.score_a !== undefined && item.score_a !== null ? (item.score_a * 100).toFixed(0) + "%" : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.score_b !== undefined && item.score_b !== null ? (item.score_b * 100).toFixed(0) + "%" : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                item.winner === "A"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : item.winner === "B"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {item.winner === "A" ? "Run A Win" : item.winner === "B" ? "Run B Win" : "Tie"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Historical Evaluation Runs Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Evaluation Runs
          </h2>
          <span className="text-xs text-zinc-500">{runs?.length || 0} total runs</span>
        </div>

        {runsLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading evaluation runs...</div>
        ) : !runs || runs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No evaluation runs yet</p>
            <p className="text-xs text-zinc-500 mt-1">
              Trigger a benchmark run against a dataset using exact match, regex, json valid, or LLM-as-judge.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-6 py-3">Run Name</th>
                  <th className="px-6 py-3">Scorer</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Average Score</th>
                  <th className="px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {run.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {run.scorer_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          run.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : run.status === "FAILED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {run.average_score !== null && run.average_score !== undefined
                        ? `${(run.average_score * 100).toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trigger Modal */}
      {isTriggerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Trigger New Evaluation Run
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!runName || !selectedDatasetId) {
                  alert("Please provide a run name and select a dataset.");
                  return;
                }
                triggerMutation.mutate({
                  name: runName,
                  dataset_id: selectedDatasetId,
                  prompt_version_id: selectedPromptId || undefined,
                  scorer_name: scorerName,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Run Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Baseline - Summarizer v2"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Dataset
                </label>
                <select
                  required
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a Dataset</option>
                  {datasets?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.item_count} items)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Prompt Version (Optional)
                </label>
                <select
                  value={selectedPromptId}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None (Use hardcoded application logic)</option>
                  {prompts?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (v{p.version})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Scorer Algorithm
                </label>
                <select
                  value={scorerName}
                  onChange={(e) => setScorerName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="exact_match">exact_match (Deterministic 1.0 or 0.0)</option>
                  <option value="contains">contains (Substring substring verification)</option>
                  <option value="regex">regex (Pattern matching)</option>
                  <option value="json_valid">json_valid (Valid JSON schema verification)</option>
                  <option value="llm_judge">llm_judge (LLM-as-judge graded 0.0 to 1.0)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsTriggerModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={triggerMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
                >
                  {triggerMutation.isPending ? "Starting Run..." : "Execute Run"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
