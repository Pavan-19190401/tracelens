"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getActiveProjectId } from "@/lib/api";

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const projectId = getActiveProjectId();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [metricType, setMetricType] = useState("error_rate");
  const [threshold, setThreshold] = useState<number>(0.05);
  const [windowMinutes, setWindowMinutes] = useState<number>(15);
  const [webhookUrl, setWebhookUrl] = useState("");

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["alert-rules", projectId],
    queryFn: () => (projectId ? api.getAlertRules(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["alert-events", projectId],
    queryFn: () => (projectId ? api.getAlertEvents(projectId) : Promise.resolve([])),
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const createRuleMutation = useMutation({
    mutationFn: (payload: { name: string; metric_type: string; threshold: number; window_minutes?: number; webhook_url?: string }) =>
      api.createAlertRule(projectId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", projectId] });
      setIsModalOpen(false);
      setName("");
      setWebhookUrl("");
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => api.deleteAlertRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", projectId] });
    },
  });

  const formatMetricDisplay = (type: string, val: number) => {
    if (type === "error_rate") return `${(val * 100).toFixed(1)}%`;
    if (type === "latency_p95") return `${val.toFixed(0)} ms`;
    if (type === "cost_hourly") return `$${val.toFixed(4)}/hr`;
    return String(val);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Alert Rules & Incident Dispatch
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Automated monitoring rules evaluating error spikes, p95 latency breaches, and budget overruns with Slack/webhook dispatch.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          + Create Alert Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Active Rules
          </h2>
          <span className="text-xs text-zinc-500">{rules?.length || 0} rules configured</span>
        </div>

        {rulesLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading alert rules...</div>
        ) : !rules || rules.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No alert rules configured</p>
            <p className="text-xs text-zinc-500 mt-1">
              Add a rule to automatically notify your team when error rate, latency, or hourly spend breaches bounds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-6 py-3">Rule Name</th>
                  <th className="px-6 py-3">Metric</th>
                  <th className="px-6 py-3">Threshold</th>
                  <th className="px-6 py-3">Evaluation Window</th>
                  <th className="px-6 py-3">Webhook Dispatch</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {rule.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {rule.metric_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {formatMetricDisplay(rule.metric_type, rule.threshold)}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400">
                      Last {rule.window_minutes} minutes
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-500 max-w-xs truncate">
                      {rule.webhook_url || "In-app only"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Delete alert rule "${rule.name}"?`)) {
                            deleteRuleMutation.mutate(rule.id);
                          }
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 dark:hover:text-rose-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Triggered Events Timeline */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Alert Events Log
          </h2>
          <span className="text-xs text-zinc-500">{events?.length || 0} incidents triggered</span>
        </div>

        {eventsLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading incident events...</div>
        ) : !events || events.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All systems normal</p>
            <p className="text-xs text-zinc-500 mt-1">
              No alert thresholds have breached within the active monitoring windows.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-6 py-3">Triggered Time</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Observed Metric Value</th>
                  <th className="px-6 py-3">Configured Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {new Date(event.triggered_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {event.metric_value}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-500">
                      {event.threshold_value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Create Alert Rule
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRuleMutation.mutate({
                  name,
                  metric_type: metricType,
                  threshold,
                  window_minutes: windowMinutes,
                  webhook_url: webhookUrl || undefined,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Error Spike (> 10%)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Metric Type
                </label>
                <select
                  value={metricType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setMetricType(t);
                    if (t === "error_rate") setThreshold(0.05);
                    else if (t === "latency_p95") setThreshold(1500);
                    else if (t === "cost_hourly") setThreshold(5.0);
                  }}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="error_rate">Error Rate (ratio 0.0 - 1.0, e.g. 0.05 = 5%)</option>
                  <option value="latency_p95">Latency p95 (milliseconds)</option>
                  <option value="cost_hourly">Cost per Hour (USD $)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Threshold Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Window (Minutes)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1440}
                    value={windowMinutes}
                    onChange={(e) => setWindowMinutes(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Slack-Compatible Webhook URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
                >
                  {createRuleMutation.isPending ? "Saving..." : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
