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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
