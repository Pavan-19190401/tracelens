"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFirebaseConfig, saveFirebaseConfig, isFirebaseConfigured } from "@/lib/firebase";
import CodeSlots from "@/components/react-bits/CodeSlots";

type AuthTab = "email" | "phone";
type OtpStatus = "idle" | "error" | "success";

interface CountryCode {
  code: string;
  country: string;
  flag: string;
  name: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+1", country: "US", flag: "🇺🇸", name: "United States" },
  { code: "+91", country: "IN", flag: "🇮🇳", name: "India" },
  { code: "+44", country: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+1", country: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "+61", country: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "+49", country: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "+33", country: "FR", flag: "🇫🇷", name: "France" },
  { code: "+971", country: "AE", flag: "🇦🇪", name: "UAE" },
  { code: "+65", country: "SG", flag: "🇸🇬", name: "Singapore" },
  { code: "+81", country: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "+55", country: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "+966", country: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+27", country: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "+92", country: "PK", flag: "🇵🇰", name: "Pakistan" },
  { code: "+880", country: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+62", country: "ID", flag: "🇮🇩", name: "Indonesia" },
  { code: "+60", country: "MY", flag: "🇲🇾", name: "Malaysia" },
  { code: "+63", country: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "+39", country: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "+34", country: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "+31", country: "NL", flag: "🇳🇱", name: "Netherlands" },
  { code: "+41", country: "CH", flag: "🇨🇭", name: "Switzerland" },
  { code: "+46", country: "SE", flag: "🇸🇪", name: "Sweden" },
  { code: "+64", country: "NZ", flag: "🇳🇿", name: "New Zealand" },
  { code: "+353", country: "IE", flag: "🇮🇪", name: "Ireland" },
  { code: "+82", country: "KR", flag: "🇰🇷", name: "South Korea" },
  { code: "+234", country: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "+254", country: "KE", flag: "🇰🇪", name: "Kenya" },
  { code: "+20", country: "EG", flag: "🇪🇬", name: "Egypt" },
  { code: "+90", country: "TR", flag: "🇹🇷", name: "Turkey" },
  { code: "+52", country: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "+54", country: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "+7", country: "RU", flag: "🇷🇺", name: "Russia" },
];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>("email");

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Phone state with country code selector
  const [selectedCountry, setSelectedCountry] = useState<string>("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [provisionedOtp, setProvisionedOtp] = useState<string | null>(null);

  // General state
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Real Auth Setup Modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [authDomain, setAuthDomain] = useState("");
  const [projectId, setProjectId] = useState("");
  const [appId, setAppId] = useState("");
  const [rawSnippet, setRawSnippet] = useState("");

  useEffect(() => {
    const cfg = getFirebaseConfig();
    if (cfg.apiKey) setApiKey(cfg.apiKey);
    if (cfg.authDomain) setAuthDomain(cfg.authDomain);
    if (cfg.projectId) setProjectId(cfg.projectId);
    if (cfg.appId) setAppId(cfg.appId);

    // Process Direct GitHub OAuth Callback
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      if (code) {
        setOauthLoading("github");
        fetch("/api/auth/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirect_uri: `${window.location.origin}/login` }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.error) {
              setError(data.error);
            } else {
              if (data.email) localStorage.setItem("tracelens_user_email", data.email);
              if (data.name) localStorage.setItem("tracelens_user_name", data.name);
              localStorage.setItem("tracelens_token", data.access_token);
              window.location.href = "/";
            }
          })
          .catch((err) => {
            setError(err.message || "Failed to complete GitHub sign-in.");
          })
          .finally(() => {
            setOauthLoading(null);
          });
      }

      // Process Direct Google OAuth Callback
      const hash = window.location.hash;
      if (hash && hash.includes("access_token=")) {
        setOauthLoading("google");
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const accessToken = params.get("access_token");
        if (accessToken) {
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then((res) => res.json())
            .then((userInfo) => {
              if (userInfo.email) localStorage.setItem("tracelens_user_email", userInfo.email);
              if (userInfo.name) localStorage.setItem("tracelens_user_name", userInfo.name);
              localStorage.setItem("tracelens_token", `tl_google_${Date.now()}`);
              window.location.href = "/";
            })
            .catch(() => {
              setError("Failed to fetch Google profile.");
            })
            .finally(() => {
              setOauthLoading(null);
            });
        }
      }
    }
  }, []);

  const fullPhoneNumber = `${selectedCountry} ${phoneNumber.trim()}`;

  // Parse Firebase SDK config snippet
  const handleParseSnippet = (text: string) => {
    setRawSnippet(text);
    try {
      const apiMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
      const domainMatch = text.match(/authDomain:\s*["']([^"']+)["']/);
      const projectMatch = text.match(/projectId:\s*["']([^"']+)["']/);
      const appMatch = text.match(/appId:\s*["']([^"']+)["']/);
      if (apiMatch) setApiKey(apiMatch[1]);
      if (domainMatch) setAuthDomain(domainMatch[1]);
      if (projectMatch) setProjectId(projectMatch[1]);
      if (appMatch) setAppId(appMatch[1]);
    } catch {
      // ignore
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !authDomain || !projectId) {
      setError("Please provide at least apiKey, authDomain, and projectId.");
      return;
    }
    saveFirebaseConfig({ apiKey, authDomain, projectId, appId });
    setConfigSuccess("Real Authentication Credentials activated! You can now log in with your genuine Google account or send live SMS OTPs.");
    setShowConfigModal(false);
    setError(null);
  };

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
    const cleanDigits = phoneNumber.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 5) {
      setError("Please enter a valid phone number for your selected country code.");
      return;
    }
    setError(null);
    setOtpLoading(true);

    try {
      const formatted = `${selectedCountry}${cleanDigits}`;
      const res = await api.sendPhoneOtp(formatted, "recaptcha-container");
      if (res && res.otp) {
        setProvisionedOtp(res.otp);
      }
      setOtpSent(true);
      setOtpStatus("idle");
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      if (err.message && err.message.includes("REAL_AUTH_REQUIRED")) {
        setShowConfigModal(true);
        setError("To deliver real SMS OTPs to mobile phones, please connect your Firebase credentials below.");
      } else {
        setError(err.message || "Failed to send verification code. Please check the number and try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify Phone OTP via CodeSlots
  const handleOtpComplete = async (code: string) => {
    setError(null);
    try {
      const cleanDigits = phoneNumber.replace(/\D/g, "");
      const formatted = `${selectedCountry}${cleanDigits}`;
      await api.verifyPhoneOtp(formatted, code);
      setOtpStatus("success");
      setTimeout(() => {
        router.push("/");
        window.location.href = "/";
      }, 850);
    } catch (err: any) {
      setOtpStatus("error");
      setError(err.message || "Incorrect verification code. Please check your SMS and re-enter.");
    }
  };

  // Real OAuth login (Google & GitHub)
  const handleOAuthLogin = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    try {
      const res = await api.loginWithOAuth(provider);
      if (res && (res as any).redirecting) {
        // Direct OAuth navigation initiated; wait for provider redirect
        return;
      }
      router.push("/");
      window.location.href = "/";
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed" || (err.message && err.message.includes("operation-not-allowed"))) {
        setError(`The ${provider === "github" ? "GitHub" : "Google"} provider requires a registered Client ID & Secret in Firebase.`);
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("The sign-in popup was closed before completing authentication.");
      } else if (err.message && err.message.includes("REAL_AUTH_REQUIRED")) {
        setShowConfigModal(true);
        setError(`To authenticate with your real ${provider.toUpperCase()} account, connect your Firebase project credentials below.`);
      } else {
        setError(err.message || `Failed to sign in with ${provider}.`);
      }
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
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-800 p-2 flex items-center justify-center shadow-xl mb-3 backdrop-blur-md">
            <img src="/logo.png" alt="TraceLens Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome to TraceLens
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Enterprise LLM Observability & Evaluation Platform
          </p>
        </div>

        {/* Success toast if credentials saved */}
        {configSuccess && (
          <div className="mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-400 flex items-start justify-between gap-2">
            <span>{configSuccess}</span>
            <button
              type="button"
              onClick={() => setConfigSuccess(null)}
              className="text-emerald-400 font-bold hover:text-emerald-300"
            >
              ✕
            </button>
          </div>
        )}

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

        {/* Tab Switcher: Email vs Mobile Number */}
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
            Mobile Number
          </button>
        </div>

        {/* Error Feedback with quick setup link */}
        {error && (
          <div className="mb-5 rounded-xl bg-rose-500/10 border border-rose-500/25 p-3 text-xs text-rose-400 flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
            {!isFirebaseConfigured() && (
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="cursor-target text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline self-start ml-6"
                data-cursor-label="Setup Auth"
              >
                Click here to connect Firebase credentials →
              </button>
            )}
          </div>
        )}

        {/* TAB 1: EMAIL LOGIN */}
        {tab === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Email Address / Gmail
              </label>
              <input
                type="email"
                required
                placeholder="developer@example.com"
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

        {/* TAB 2: MOBILE NUMBER LOGIN */}
        {tab === "phone" && (
          <div>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Mobile Phone Number
                  </label>
                  
                  {/* Country Code Selector + Number Input */}
                  <div className="flex gap-2">
                    <div className="relative w-36 shrink-0">
                      <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="cursor-target w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/90 pl-3 pr-8 py-2.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        data-cursor-label="Country Code"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={`${c.country}-${c.code}`} value={c.code} className="bg-zinc-900 text-zinc-100 py-1">
                            {c.flag} {c.code} ({c.country})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                    <div className="relative flex-1">
                      <input
                        type="tel"
                        required
                        placeholder="98765 43210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    We will send a 6-digit real-time verification code to {fullPhoneNumber || "your phone"}.
                  </p>
                  {/* Hidden / Invisible reCAPTCHA container for Firebase Phone Auth */}
                  <div id="recaptcha-container" />
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
                        <span>Sending SMS verification code...</span>
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
                    <span className="text-zinc-400">Code sent to: </span>
                    <span className="font-mono text-zinc-100 font-medium">{fullPhoneNumber}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpStatus("idle");
                    }}
                    className="cursor-target text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    data-cursor-label="Change Phone"
                  >
                    Change Number
                  </button>
                </div>

                {/* Provisioned Verification Code Notice */}
                {provisionedOtp && (
                  <div className="rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-blue-950/40 border border-blue-500/30 p-3.5 text-center shadow-lg">
                    <div className="text-[11px] text-zinc-300 font-medium mb-1.5 flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Security Verification Code:</span>
                    </div>
                    <div className="inline-flex items-center gap-3 bg-zinc-900/90 border border-blue-500/50 rounded-xl px-4 py-1.5 shadow-inner">
                      <span className="text-xl font-mono font-extrabold tracking-[0.25em] text-blue-400 pl-1">
                        {provisionedOtp}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(provisionedOtp);
                        }}
                        className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-md transition-all"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
                      Enter this 6-digit code in the slots below to authenticate your mobile number.
                    </p>
                  </div>
                )}

                {/* React Bits CodeSlots Component */}
                <div className="py-2 flex flex-col items-center justify-center">
                  <label className="text-xs font-medium text-zinc-400 mb-3">
                    Enter 6-digit verification code:
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

                {/* Resend actions with timer */}
                <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/80">
                  <span>Didn&apos;t receive SMS?</span>
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={otpLoading || resendCooldown > 0}
                    className="cursor-target font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    data-cursor-label="Resend SMS"
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : otpLoading
                      ? "Sending..."
                      : "Resend Code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Link & Setup Trigger */}
        <div className="mt-8 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800/60 pt-4">
          <Link href="/register" className="cursor-target font-semibold text-blue-400 hover:text-blue-300" data-cursor-label="Sign Up">
            Create an account
          </Link>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="cursor-target text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            data-cursor-label="Auth Settings"
          >
            <span>⚙️</span>
            <span>Real Auth Keys</span>
          </button>
        </div>
      </div>

      {/* REAL AUTH CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h2 className="text-lg font-bold text-white">Connect Firebase Project</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              To send <strong>real-time SMS OTPs</strong> to mobile phones and trigger <strong>genuine Google/GitHub popups</strong> without mock logins, link your free Firebase project credentials below.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* Quick Paste Snippet */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Option 1: Paste Firebase SDK snippet (Auto-detects keys)
                </label>
                <textarea
                  rows={3}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "project.firebaseapp.com",\n  projectId: "project-id"\n};`}
                  value={rawSnippet}
                  onChange={(e) => handleParseSnippet(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-zinc-800 w-full" />
                <span className="bg-zinc-950 px-2 text-[10px] uppercase text-zinc-500 font-bold absolute">
                  or enter fields manually
                </span>
              </div>

              {/* Individual Fields */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    API Key (apiKey)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Auth Domain (authDomain)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="your-project.firebaseapp.com"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Project ID (projectId)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="your-project-id"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    App ID (appId - Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="1:123456789:web:abcdef"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                >
                  Open Firebase Console (Free) ↗
                </a>

                <button
                  type="submit"
                  className="cursor-target px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md transition-all"
                  data-cursor-label="Save Keys"
                >
                  Save & Activate Real Auth
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
