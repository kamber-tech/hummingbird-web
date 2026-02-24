import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aether Sim",
  description: "Wireless Power Transmission for Defense Logistics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen`} style={{ background: "var(--bg)", color: "var(--text)" }}>
        <nav className="backdrop-blur sticky top-0 z-50" style={{ borderBottom: "1px solid var(--border)", background: "rgba(17,17,24,0.9)" }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold" style={{ color: "var(--accent)" }}>⚡ AETHER</span>
            </div>
            <div className="flex gap-4 sm:gap-6 text-sm whitespace-nowrap">
              <Link href="/" className="transition-colors font-medium" style={{ color: "var(--text-muted)" }}>
                Simulator
              </Link>
              <Link href="/sweep" className="transition-colors font-medium" style={{ color: "var(--text-muted)" }}>
                Range Sweep
              </Link>
              <Link href="/financial" className="transition-colors font-medium" style={{ color: "var(--text-muted)" }}>
                Financial
              </Link>
            </div>
            <div className="ml-auto text-xs text-gray-500 font-mono hidden sm:block">
              WPT DEFENSE LOGISTICS SIM v1.0
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
