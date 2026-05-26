import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropMan OS",
  description: "Property management for 1304 Rosario St, Laredo TX",
};

// Inlined synchronously BEFORE first paint so the page never flashes
// the wrong theme. Reads localStorage.theme ("light" | "dark") and
// falls back to the OS preference.
const NO_FLASH_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (!t) {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.style.colorScheme = t;
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
