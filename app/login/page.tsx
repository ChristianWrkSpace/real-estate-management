"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/app/actions/auth";

const DEMO_EMAIL = "admin@propman.com";
const DEMO_PASSWORD = "AdminTest123!";

export default function LoginPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const performSignIn = (em: string, pw: string) => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("email", em);
      fd.set("password", pw);
      const result = await signIn(fd);
      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error || "Authentication failed");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    performSignIn(email, password);
  };

  const oneClickAdmin = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    performSignIn(DEMO_EMAIL, DEMO_PASSWORD);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950 px-4 text-white">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="w-full rounded-2xl border border-white/10 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-md">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20">
              <span className="text-xl">🏠</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">PropMan OS</h1>
            <p className="mt-1 text-xs text-white/50">
              1304 Rosario St · Laredo, TX 78040
            </p>
          </div>

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 transition focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 transition focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-60"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* 1-Click Admin Auto-Login Badge */}
          <button
            type="button"
            onClick={oneClickAdmin}
            disabled={isPending}
            className="mt-5 block w-full rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-blue-500/10 p-3.5 text-left backdrop-blur-md transition hover:border-emerald-400/60 hover:from-emerald-500/20 hover:to-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-base">
                  ⚡
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                    1-Click Demo Sign-In
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-white/55">
                    {DEMO_EMAIL}
                  </p>
                </div>
              </div>
              <span className="text-emerald-300 transition group-hover:translate-x-0.5">
                →
              </span>
            </div>
          </button>

          {/* Signup link */}
          <p className="mt-5 text-center text-xs text-white/40">
            Need an account?{" "}
            <a
              href="/signup"
              className="font-semibold text-emerald-300/90 transition hover:text-emerald-200"
            >
              Sign up
            </a>
          </p>
        </div>

        <p className="mt-5 text-center text-[10px] text-white/30">
          Supabase Auth · Model-agnostic AI · Vercel
        </p>
      </div>
    </div>
  );
}
