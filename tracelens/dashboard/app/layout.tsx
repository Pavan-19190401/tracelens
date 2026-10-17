import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/lib/theme-provider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { TargetCursorOverlay } from "@/components/TargetCursorOverlay";
import { CloudAtlasBackground } from "@/components/CloudAtlasBackground";

export const metadata: Metadata = {
  title: "TraceLens — Open-source LLM Tracing & Evaluation Platform",
  description: "Developer-centric observability, tracing, prompt versioning, and evals for LLM applications.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased flex flex-col relative overflow-x-hidden">
        <QueryProvider>
          <ThemeProvider>
            <CloudAtlasBackground />
            <TargetCursorOverlay />
            <div className="relative z-10 flex flex-col min-h-screen">
              <Navbar />
              <div className="flex-1 flex">
                <Sidebar />
                <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
                  {children}
                </main>
              </div>
            </div>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
