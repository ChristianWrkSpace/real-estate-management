// Shared design primitives — Industrial Glassmorphism.
// Extracted from CommandCenterShell so other pages can adopt the look
// incrementally without re-implementing the same Tailwind soup.
//
// Tokens (see also CommandCenterShell):
//   • Foundation:  bg-[#0E1012] page background
//   • Surface:     bg-white/[0.03] backdrop-blur-2xl
//   • Edge:        border-white/[0.06] hairline
//   • Healing Blue: #6B8AD9
//   • Safety Teal:  #5FBDB0
//   • Intervention: amber-400
//   • Body text:   text-white/[0.92]

import type { ReactNode } from "react";

export function Glass({
  children,
  className = "",
  accent = "neutral",
  subtle = false,
}: {
  children: ReactNode;
  className?: string;
  accent?: "neutral" | "teal" | "amber" | "blue";
  subtle?: boolean;
}) {
  const ring =
    accent === "teal"
      ? "ring-[#5FBDB0]/15"
      : accent === "amber"
        ? "ring-amber-400/20"
        : accent === "blue"
          ? "ring-[#6B8AD9]/15"
          : "ring-white/[0.04]";
  const shadow = subtle
    ? "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]"
    : "shadow-[0_12px_48px_-16px_rgba(0,0,0,0.8)]";
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl ring-1 ${ring} ${shadow} ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  sub,
  right,
  emoji,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  emoji?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-white/95">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {title}
        </h2>
        {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0E1012] text-white/[0.92]">
      {/* Soft radial glows */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(107,138,217,0.14) 0%, transparent 38%), radial-gradient(circle at 82% 88%, rgba(95,189,176,0.12) 0%, transparent 42%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>\")",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CountChip({
  count,
  label,
  tone = "teal",
}: {
  count: number;
  label: string;
  tone?: "teal" | "amber" | "blue" | "neutral";
}) {
  const c =
    tone === "amber"
      ? "bg-amber-400/10 text-amber-300 ring-amber-400/20"
      : tone === "blue"
        ? "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20"
        : tone === "neutral"
          ? "bg-white/5 text-white/60 ring-white/10"
          : "bg-[#5FBDB0]/10 text-[#A8DCD3] ring-[#5FBDB0]/20";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ring-1 text-[10px] uppercase tracking-wide ${c}`}
    >
      <span className="font-mono text-xs">{count}</span>
      <span>{label}</span>
    </span>
  );
}
