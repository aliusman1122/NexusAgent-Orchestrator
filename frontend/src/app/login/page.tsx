"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import { adminLogin, getAdminSession } from "@/services/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // If already logged in, redirect straight to admin dashboard
  useEffect(() => {
    const session = getAdminSession();
    if (session && session.success) {
      router.replace("/admin");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorNotice("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setErrorNotice(null);

    try {
      const res = await adminLogin(email, password);
      if (res.success) {
        router.push("/admin");
      } else {
        setErrorNotice(res.message || "Invalid email or password.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setErrorNotice(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#0B0F17] text-white selection:bg-[#FF6A00] selection:text-white">
      {/* LEFT SPLIT PANEL: NexusAgent Signature Brand & Privileges */}
      <div className="md:w-[45%] lg:w-[42%] bg-gradient-to-b from-[#181D26] via-[#12161F] to-[#0A0D13] p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
        {/* Enterprise Orange Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#FF6A00]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FF7D20]/10 blur-3xl pointer-events-none" />

        {/* Brand identity header */}
        <div className="relative z-10 flex flex-col items-start">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6A00] to-[#E55F00] shadow-xl shadow-[#FF6A00]/25 flex items-center justify-center text-white mb-6 border border-white/20">
            <Shield className="w-7 h-7 text-white" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            NexusAgent Admin
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1.5">
            Owner &amp; Super Admin Portal
          </p>
        </div>

        {/* Feature Highlights Card */}
        <div className="relative z-10 my-10 max-w-md w-full rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-md shadow-2xl">
          <h2 className="text-sm font-bold text-white mb-4 tracking-wide">
            Admin access lets you:
          </h2>
          <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] mt-2 shrink-0 shadow-sm shadow-[#FF6A00]" />
              <span>Manage all autonomous agent &amp; client accounts</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] mt-2 shrink-0 shadow-sm shadow-[#FF6A00]" />
              <span>Configure universal AI engine &amp; dedicated BYOK keys</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] mt-2 shrink-0 shadow-sm shadow-[#FF6A00]" />
              <span>Ingest &amp; sync knowledge base sources (Docs, Web, Notes)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] mt-2 shrink-0 shadow-sm shadow-[#FF6A00]" />
              <span>Monitor live vector chunks &amp; ChromaDB telemetry</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] mt-2 shrink-0 shadow-sm shadow-[#FF6A00]" />
              <span>Generate &amp; customize 1-line embeddable chat widgets</span>
            </li>
          </ul>
        </div>

        {/* Bottom subtle copyright */}
        <div className="relative z-10 text-[11px] text-slate-500 font-mono">
          &copy; {new Date().getFullYear()} NexusAgent Orchestrator. All rights reserved.
        </div>
      </div>

      {/* RIGHT SPLIT PANEL: Clean Sign In Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 relative bg-[#0B0F17]">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sign in to Admin
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              Restricted to authorized administrators only.
            </p>
          </div>

          {/* Error Banner */}
          {errorNotice && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field with Generic Placeholder */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gmail.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-[#141923] border border-slate-700/80 focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-xs text-slate-500">
                  Forgot password?
                </span>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-[#141923] border border-slate-700/80 focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF6A00] transition-colors p-1 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button in NexusAgent Signature Orange */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7D20] hover:to-[#FF6A00] text-white font-bold text-sm shadow-xl shadow-[#FF6A00]/25 hover:shadow-[#FF6A00]/40 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Verifying credentials...</span>
              ) : (
                <span>Sign in to Admin Panel</span>
              )}
            </button>
          </form>

          {/* Return link */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-[#FF6A00]" />
              <span>Back to public website</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
