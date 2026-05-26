"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import type { BottomNavUser } from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";

type Item = { href: string; label: string; hint?: string; icon: React.ReactNode };

const OPERATIONS: Item[] = [
  { href: "/rent", label: "Rent", hint: "Collect · history", icon: <IconWallet /> },
  { href: "/work-orders", label: "Work Orders", hint: "Kanban · dispatch", icon: <IconWrench /> },
  { href: "/contractors", label: "Contractors", hint: "Directory", icon: <IconBriefcase /> },
];

const MANAGEMENT: Item[] = [
  { href: "/contracts", label: "Contracts", hint: "Template library", icon: <IconFile /> },
  { href: "/equity", label: "Equity", hint: "Net worth · LTV", icon: <IconBank /> },
];

const ADMIN: Item[] = [
  { href: "/approvals", label: "Approvals", hint: "HITL queue", icon: <IconCheck /> },
];

export default function MoreSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: BottomNavUser;
}) {
  const pathname = usePathname() || "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const initials =
    user.name
      .split(/\s+/)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "U";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="More"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/65"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-xl rounded-t-3xl border border-b-0 border-zinc-200 bg-white/95 px-5 pb-8 pt-3 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:border-white/[0.06] dark:bg-zinc-950/90 dark:shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.7)]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.75rem)" }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-white/10" />

        {/* User + theme row */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-emerald-500/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {user.name}
            </p>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-500">
              {user.email ?? "no email"} · {user.role}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:border-white/15 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Appearance */}
        <section className="mb-4">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-100/70 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Appearance
              </p>
              <p className="mt-0.5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Theme
              </p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <SectionGroup label="Operations" items={OPERATIONS} isActive={isActive} onNavigate={onClose} />
        <SectionGroup label="Management" items={MANAGEMENT} isActive={isActive} onNavigate={onClose} />
        <SectionGroup label="Admin" items={ADMIN} isActive={isActive} onNavigate={onClose} />
      </div>
    </div>
  );
}

function SectionGroup({
  label,
  items,
  isActive,
  onNavigate,
}: {
  label: string;
  items: Item[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  return (
    <section className="mb-4 last:mb-0">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </p>
      <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 dark:border-white/[0.06] dark:bg-white/[0.02]">
        {items.map((item, i) => {
          const active = isActive(item.href);
          return (
            <li
              key={item.href}
              className={i > 0 ? "border-t border-zinc-200 dark:border-white/[0.04]" : ""}
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99] ${
                  active
                    ? "bg-emerald-500/[0.10] text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.03] dark:hover:text-zinc-100"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-400"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-tight">{item.label}</p>
                  {item.hint && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                      {item.hint}
                    </p>
                  )}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">
                  <IconChevron />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

const I = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconWallet() {
  return (
    <svg {...I}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconWrench() {
  return (
    <svg {...I}>
      <path d="M14.7 6.3a4 4 0 0 1 4.95 4.95l-9.27 9.27a2.83 2.83 0 0 1-4-4L15.65 7.25" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg {...I}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg {...I}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}
function IconBank() {
  return (
    <svg {...I}>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
      <path d="M3 20h18" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...I}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg {...I} width={14} height={14}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
