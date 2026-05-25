import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropMan OS",
  description: "Property management for 1304 Rosario St, Laredo TX",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}
