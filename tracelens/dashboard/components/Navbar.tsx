"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Moon, Sun, Layers, LogOut } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { api, getActiveProjectId, setActiveProjectId, removeToken } from "@/lib/api";
import CardNav from "@/components/react-bits/CardNav";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [activeProject, setActiveProject] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    api.getProjects()
      .then((data) => {
        setProjects(data);
        if (data.length > 0) {
          const current = getActiveProjectId() || data[0].id;
          setActiveProject(current);
          setActiveProjectId(current);
        }
      })
      .catch(() => {});

    api.getMe()
      .then((u) => setUserEmail(u.email))
      .catch(() => {});
  }, []);

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActiveProject(val);
    setActiveProjectId(val);
    window.location.reload();
  };

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const navItems = [
    {
      label: "Observability",
      description: "Real-time traces, waterfall timelines, spans & metrics.",
      links: [
        { label: "Dashboard Overview", href: "/" },
        { label: "Traces Explorer", href: "/traces" },
      ]
    },
    {
      label: "Evaluation & Prompts",
      description: "Automated scoring rules and prompt version control.",
      links: [
        { label: "Evaluations & Benchmarks", href: "/evals" },
        { label: "Prompt Management", href: "/prompts" },
      ]
    },
    {
      label: "Settings & Alerts",
      description: "Manage projects, API keys and alerting rules.",
      links: [
        { label: "Projects & Keys", href: "/projects" },
        { label: "Alert Rules", href: "/alerts" },
      ]
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-card/75 border-b border-border/60 px-4 py-2 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* CardNav floating navigation */}
        <div className="flex-1 max-w-2xl">
          <CardNav
            items={navItems}
            linkComponent={Link}
            theme={theme === "dark" ? "dark" : "light"}
            surface="glass"
            cardEffect="rise"
            maxWidth={640}
            logo={
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                  TL
                </div>
                <span className="font-bold text-base tracking-tight hidden sm:inline">TraceLens</span>
              </div>
            }
            cta={{
              label: "Traces ↗",
              href: "/traces",
            }}
          />
        </div>

        {/* Global Controls: Project Selector, Theme Toggle, Auth */}
        <div className="flex items-center space-x-3 shrink-0">
          {!isAuthPage && projects.length > 0 && (
            <div className="flex items-center bg-card/60 backdrop-blur-md border border-border/80 rounded-xl px-2.5 py-1.5 shadow-sm">
              <Layers className="w-3.5 h-3.5 text-blue-500 mr-2" />
              <select
                value={activeProject}
                onChange={handleProjectChange}
                className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-foreground">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-2 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md hover:bg-card text-muted-foreground hover:text-foreground transition-all shadow-sm"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
          </button>

          {userEmail && (
            <div className="flex items-center space-x-2 pl-2 border-l border-border/60">
              <span className="text-xs text-muted-foreground font-mono hidden md:inline">{userEmail}</span>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-2 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
