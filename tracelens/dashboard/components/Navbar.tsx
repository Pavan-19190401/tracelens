"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Moon, Sun, Layers, LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { api, getActiveProjectId, setActiveProjectId, removeToken } from "@/lib/api";

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

  return (
    <header className="h-16 border-b border-border/80 bg-card/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-zinc-900/80 border border-zinc-700/50 p-1 shadow-sm">
            <img src="/logo.png" alt="TraceLens" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-xl tracking-tight">TraceLens</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
            v0.1.0
          </span>
        </Link>

        {!isAuthPage && projects.length > 0 && (
          <div className="relative flex items-center">
            <Layers className="w-4 h-4 text-muted-foreground mr-2" />
            <select
              value={activeProject}
              onChange={handleProjectChange}
              className="bg-background border border-border text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-md hover:bg-border/40 text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        {userEmail ? (
          <div className="flex items-center space-x-3 pl-3 border-l border-border">
            <span className="text-xs text-muted-foreground font-mono">{userEmail}</span>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : !isAuthPage ? (
          <div className="flex items-center space-x-2 pl-3 border-l border-border/80">
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-800/60 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
            >
              Register
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
