"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getActiveProjectId, setActiveProjectId } from "@/lib/api";

export default function ProjectsAndKeysPage() {
  const queryClient = useQueryClient();
  const [activeProjectId, setLocalActiveProjectId] = useState<string | null>(getActiveProjectId());

  // Modal States
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Queries
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  const currentProjectId = activeProjectId || projects?.[0]?.id || "";

  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ["api-keys", currentProjectId],
    queryFn: () => (currentProjectId ? api.getApiKeys(currentProjectId) : Promise.resolve([])),
    enabled: !!currentProjectId,
  });

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) => api.createProject(payload),
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setActiveProjectId(newProj.id);
      setLocalActiveProjectId(newProj.id);
      setIsProjectModalOpen(false);
      setProjectName("");
      setProjectDesc("");
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.createApiKey(currentProjectId, name),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", currentProjectId] });
      setGeneratedKey(res.raw_key);
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) => api.revokeApiKey(currentProjectId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", currentProjectId] });
    },
  });

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setLocalActiveProjectId(id);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Projects & Ingestion API Keys
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage workspace isolation and generate API keys for the Python SDK to stream traces.
        </p>
      </div>

      {/* Projects Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Projects
          </h2>
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            + New Project
          </button>
        </div>

        {projectsLoading ? (
          <div className="p-6 text-center text-sm text-zinc-500">Loading projects...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {projects?.map((p) => {
              const isSelected = p.id === currentProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProject(p.id)}
                  className={`cursor-pointer rounded-xl border p-5 transition-all ${
                    isSelected
                      ? "border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/20 dark:bg-indigo-950/20"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</h3>
                    {isSelected && (
                      <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 font-mono">slug: {p.slug}</p>
                  {p.description && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* API Keys Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              API Keys for Active Project
            </h2>
            <p className="text-xs text-zinc-500">
              Provide these keys to <code className="font-mono text-zinc-700 dark:text-zinc-300">tracelens.init(api_key=&quot;...&quot;)</code> in your LLM applications.
            </p>
          </div>
          <button
            onClick={() => {
              setGeneratedKey(null);
              setIsKeyModalOpen(true);
            }}
            disabled={!currentProjectId}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            + Create API Key
          </button>
        </div>

        {keysLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading API keys...</div>
        ) : !apiKeys || apiKeys.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No API keys found</p>
            <p className="text-xs text-zinc-500 mt-1">
              Create an API key to allow your Python SDK to ingest spans into this project.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Key Prefix</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {key.name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {key.key_prefix}...
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {key.revoked_at ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!key.revoked_at && (
                        <button
                          onClick={() => {
                            if (confirm(`Revoke API key "${key.name}"? This action cannot be undone.`)) {
                              revokeKeyMutation.mutate(key.id);
                            }
                          }}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800 dark:hover:text-rose-400"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Create New Project
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createProjectMutation.mutate({ name: projectName, description: projectDesc || undefined });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Copilot"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Primary customer support bot traces..."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Generate API Key
            </h2>

            {generatedKey ? (
              <div className="space-y-4 mt-4">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ Save this key safely now! You will never be able to see it again after closing this window.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Raw API Secret Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={generatedKey}
                      className="w-full font-mono text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedKey)}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors whitespace-nowrap"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createKeyMutation.mutate(keyName);
                }}
                className="space-y-4 mt-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Key Identifier / Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. backend-worker-prod"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createKeyMutation.isPending}
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
                  >
                    {createKeyMutation.isPending ? "Generating..." : "Generate Key"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
