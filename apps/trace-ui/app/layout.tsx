import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceFoundry",
  description: "Trace explorer for agentic workflows"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background text-foreground antialiased font-sans")}>
        <div className="relative isolate min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(66,105,255,0.12),_transparent_55%),radial-gradient(circle_at_10%_20%,_rgba(14,165,233,0.15),_transparent_40%)]" />
          <div className="relative flex min-h-screen flex-col">
            <header className="border-b border-white/10 bg-white/60 backdrop-blur-xl">
              <div className="container flex items-center justify-between py-5">
                <Link href="/" className="flex items-center gap-3 font-semibold text-slate-900">
                  <span className="h-11 w-11 rounded-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white shadow-brand flex items-center justify-center text-base">
                    TF
                  </span>
                  <div>
                    <p className="text-lg leading-tight">TraceFoundry</p>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Observability Lab</p>
                  </div>
                </Link>
                <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-4 py-2 text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.25)]" />
                    Stack healthy
                  </span>
                  <span className="hidden sm:inline-flex text-slate-400">Agent Telemetry Surface</span>
                </div>
              </div>
            </header>
            <main className="container flex-1 py-10">{children}</main>
            <footer className="border-t border-white/60 bg-white/70 py-4 text-center text-xs text-slate-500">
              Running locally on <code>docker compose</code> · UI powered by Tailwind + shadcn
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
