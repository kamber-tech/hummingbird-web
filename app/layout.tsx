import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hummingbird Sim",
  description: "Wireless Power Transmission for Defense Logistics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-mono text-lg font-bold">⚡ HUMMINGBIRD</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-gray-300 hover:text-green-400 transition-colors font-medium">
                Simulator
              </Link>
              <Link href="/sweep" className="text-gray-300 hover:text-green-400 transition-colors font-medium">
                Range Sweep
              </Link>
              <Link href="/financial" className="text-gray-300 hover:text-green-400 transition-colors font-medium">
                Financial
              </Link>
            </div>
            <div className="ml-auto text-xs text-gray-500 font-mono">
              WPT DEFENSE LOGISTICS SIM v1.0
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
