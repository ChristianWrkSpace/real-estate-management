"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import MoreSheet from "@/components/MoreSheet";

type Role = "owner" | "manager" | "maintenance";

export type BottomNavUser = {
  name: string;
  email: string | null;
  role: Role;
};

const ACTIVE_CLASS =
  "text-zinc-100 [&_svg]:stroke-emerald-400 [&_svg]:fill-emerald-400/[0.08]";
const INACTIVE_CLASS =
  "text-zinc-500 [&_svg]:stroke-zinc-500 hover:text-zinc-300 hover:[&_svg]:stroke-zinc-300";

export default function BottomNav({ user }: { user: BottomNavUser }) {
  const pathname = usePathname() || "";
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Soft top fade so content scrolling under doesn't crash into the bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-28 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
        aria-label="Primary"
      >
        <div className="mx-3 mb-2 flex w-full max-w-md items-stretch justify-between gap-1 rounded-2xl border border-white/[0.06] bg-zinc-950/70 px-2 py-1.5 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.7)] backdrop-blur-2xl supports-[backdrop-filter]:bg-zinc-950/50">
          <Tab href="/dashboard" label="Home" active={isActive("/dashboard")}>
            <IconHome />
          </Tab>
          <Tab href="/units" label="Units" active={isActive("/units")}>
            <IconBuilding />
          </Tab>
          <Tab href="/tenants" label="Tenants" active={isActive("/tenants")}>
            <IconUsers />
          </Tab>
          <Tab href="/finance" label="P&L" active={isActive("/finance") || isActive("/pnl")}>
            <IconChart />
          </Tab>
          <MoreTab onClick={() => setMoreOpen(true)} active={moreOpen}>
            <IconMore />
          </MoreTab>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} user={user} />
    </>
  );
}

function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-300 active:scale-95 ${
        active ? ACTIVE_CLASS : INACTIVE_CLASS
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative flex h-7 w-7 items-center justify-center">
        {children}
        {active && (
          <span className="absolute inset-0 -z-10 rounded-lg bg-emerald-400/10 blur-md" />
        )}
      </span>
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
      {active && (
        <span className="absolute bottom-0 h-[3px] w-7 -translate-y-px rounded-full bg-gradient-to-r from-emerald-400 to-blue-500" />
      )}
    </Link>
  );
}

function MoreTab({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-300 active:scale-95 ${
        active ? ACTIVE_CLASS : INACTIVE_CLASS
      }`}
      aria-haspopup="dialog"
      aria-expanded={active}
    >
      <span className="relative flex h-7 w-7 items-center justify-center">
        {children}
        {active && (
          <span className="absolute inset-0 -z-10 rounded-lg bg-emerald-400/10 blur-md" />
        )}
      </span>
      <span className="text-[10px] font-semibold tracking-wide">More</span>
    </button>
  );
}

// ── Heroicons-style outlines (24x24, stroke 1.75) ───────────────────────────

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconHome() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20a1 1 0 0 0 1 1h3.5v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5H18a1 1 0 0 0 1-1v-9.5" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
      <path d="M10 21v-3h4v3" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.5 20.5c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.5c2.5.4 5.3 1.5 6 5.5" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 21h18" />
      <path d="M6 17V11M10 17V7M14 17V14M18 17V9" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
