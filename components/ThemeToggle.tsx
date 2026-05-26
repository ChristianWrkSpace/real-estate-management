"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
  (document.documentElement.style as CSSStyleDeclaration).colorScheme = t;
  localStorage.setItem("theme", t);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("dark");
  useEffect(() => {
    setThemeState(readTheme());
  }, []);
  const setTheme = (t: Theme) => {
    applyTheme(t);
    setThemeState(t);
  };
  return [theme, setTheme];
}

/**
 * Slick segmented Light · Dark switch — Apple Settings style.
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useTheme();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-zinc-300 bg-white/70 p-0.5 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] ${
        compact ? "" : "shadow-sm"
      }`}
      role="radiogroup"
      aria-label="Theme"
    >
      <Segment
        active={theme === "light"}
        onClick={() => setTheme("light")}
        label="Light"
        compact={compact}
      >
        <IconSun />
      </Segment>
      <Segment
        active={theme === "dark"}
        onClick={() => setTheme("dark")}
        label="Dark"
        compact={compact}
      >
        <IconMoon />
      </Segment>
    </div>
  );
}

function Segment({
  active,
  onClick,
  label,
  compact,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 active:scale-95 ${
        active
          ? "bg-zinc-900 text-zinc-900 dark:text-white shadow-md dark:bg-white dark:text-zinc-900"
          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      <span className="h-4 w-4">{children}</span>
      {!compact && <span>{label}</span>}
    </button>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}
