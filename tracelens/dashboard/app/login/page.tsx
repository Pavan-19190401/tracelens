"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import CodeSlots from "@/components/react-bits/CodeSlots";

type AuthTab = "email" | "phone";
type OtpStatus = "idle" | "error" | "success";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>("email");

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Phone OTP state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [otpNotification, setOtpNotification] = useState<string | null>(null);

  // General state
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Email login submit
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailLoading(true);

    try {
      await api.login(email, password);
      router.push("/");
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setEmailLoading(false);
    }
  };

  // Send Phone OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone || phone.trim().length < 6) {
      setError("Please enter a valid phone number with country code (e.g. +1 555-0199 or +91 9876543210).");
      return;
    }
    setError(null);
    setOtpLoading(true);

    try {
      const res = await api.sendPhoneOtp(phone);
      setOtpSent(true);
      setOtpStatus("idle");
      setOtpNotification(`OTP sent! For testing, use code: ${res.testCode || "748291"}`);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify Phone OTP via CodeSlots
  const handleOtpComplete = async (code: string) => {
    setError(null);
    try {
      await api.verifyPhoneOtp(phone, code);
      setOtpStatus("success");
      setTimeout(() => {
        router.push("/");
        window.location.href = "/";
      }, 900);
    } catch (err: any) {
      setOtpStatus("error");
      setError(err.message || "Incorrect verification code. Please try again.");
    }
  };

  // OAuth login
  const handleOAuthLogin = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    try {
      await api.loginWithOAuth(provider);
      router.push("/");
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}.`);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/85 backdrop-blur-xl p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent blur-sm pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700/60 flex items-center justify-center text-white font-extrabold text-xl shadow-lg mb-3">
            <span className="bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">TL</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome to TraceLens
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Enterprise LLM Observability & Evaluation Platform
          </p>
        </div>

        {/* Social Authentication */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            disabled={oauthLoading !== null}
            className="cursor-target flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition-all duration-150 disabled:opacity-50"
            data-cursor-label="Google"
          >
            {oauthLoading === "google" ? (
              <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin("github")}
            disabled={oauthLoading !== null}
            className="cursor-target flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition-all duration-150 disabled:opacity-50"
            data-cursor-label="GitHub"
          >
            {oauthLoading === "github" ? (
              <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            )}
            GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-zinc-950 px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold absolute">
            or continue with
          </span>
        </div>

        {/* Tab Switcher: Email vs Phone */}
        <div className="flex rounded-xl bg-zinc-900/90 p-1 border border-zinc-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setTab("email");
              setError(null);
            }}
            className={`cursor-target flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
              tab === "email"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            data-cursor-label="Email"
          >
            Email Address
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("phone");
              setError(null);
            }}
            className={`cursor-target flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
              tab === "phone"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            data-cursor-label="Phone"
          >
            Mobile Number (OTP)
          </button>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="mb-5 rounded-xl bg-rose-500/10 border border-rose-500/25 p-3 text-xs text-rose-400 flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: EMAIL LOGIN */}
        {tab === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Password
                </label>
                <Link href="#" className="text-[11px] text-zinc-500 hover:text-zinc-400">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={emailLoading}
                className="cursor-target w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2"
                data-cursor-label="Sign In"
              >
                {emailLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: MOBILE NUMBER (OTP) LOGIN */}
        {tab === "phone" && (
          <div>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Mobile Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="+1 (555) 234-5678 or +91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    We will send a 6-digit one-time verification code via SMS.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="cursor-target w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2"
                    data-cursor-label="Send OTP"
                  >
                    {otpLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending verification code...</span>
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                {/* Phone details header */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs">
                  <div>
                    <span className="text-zinc-400">Verifying phone: </span>
                    <span className="font-mono text-zinc-100 font-medium">{phone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpNotification(null);
                      setOtpStatus("idle");
                    }}
                    className="cursor-target text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    data-cursor-label="Change Phone"
                  >
                    Change
                  </button>
                </div>

                {otpNotification && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 flex items-center justify-between">
                    <span>{otpNotification}</span>
                    <button
                      type="button"
                      onClick={() => handleOtpComplete("748291")}
                      className="cursor-target text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                      data-cursor-label="Auto-enter"
                    >
                      Fill
                    </button>
                  </div>
                )}

                {/* React Bits CodeSlots Component */}
                <div className="py-2 flex flex-col items-center justify-center">
                  <label className="text-xs font-medium text-zinc-400 mb-3">
                    Enter the 6-digit verification code:
                  </label>
                  <CodeSlots
                    length={6}
                    status={otpStatus}
                    onChange={() => {
                      if (otpStatus !== "idle") setOtpStatus("idle");
                    }}
                    onComplete={handleOtpComplete}
                    accentColor="#3b82f6"
                    inkColor="#3b82f6"
                    slotColor="#18181b"
                    digitColor="#ffffff"
                    dangerColor="#ef4444"
                    slotSize={46}
                    gap={8}
                    radius={12}
                    bounce={0.2}
                    settle={0.3}
                    rise={8}
                    cascade={20}
                    autoFocus
                  />
                </div>

                {/* Resend actions */}
                <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/80">
                  <span>Didn&apos;t receive code?</span>
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={otpLoading}
                    className="cursor-target font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    data-cursor-label="Resend OTP"
                  >
                    {otpLoading ? "Sending..." : "Resend SMS"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-8 text-center text-xs text-zinc-500 border-t border-zinc-800/60 pt-4">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="cursor-target font-semibold text-blue-400 hover:text-blue-300" data-cursor-label="Sign Up">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
