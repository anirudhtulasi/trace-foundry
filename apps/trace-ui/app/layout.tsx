import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceFoundry",
  description: "Trace explorer for agentic workflows"
};

type NavItem = {
  label: string;
  icon: string;
  href: string;
  active?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Platform",
    items: [
      { label: "Dashboard", icon: "dashboard", href: "/", active: true },
      { label: "Traces", icon: "timeline", href: "/?view=errors" },
      { label: "Ingestion", icon: "monitoring", href: "/?view=slow" }
    ]
  },
  {
    title: "Configuration",
    items: [
      { label: "Settings", icon: "settings", href: "#" },
      { label: "Team", icon: "group", href: "#" }
    ]
  }
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "antialiased h-screen overflow-hidden flex font-sans bg-[#050507] text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200"
        )}
      >
        <div className="flex h-full w-full">
          <aside className="w-72 bg-[#050507] border-r border-white/5 flex flex-col flex-shrink-0 z-20">
            <div className="h-20 flex items-center px-8">
              <div className="flex items-center gap-3 text-white tracking-tight">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                  <span className="material-symbols-outlined text-[20px] text-cyan-400">hub</span>
                </div>
                <span className="font-light text-lg tracking-wide text-slate-200">
                  Trace<span className="font-semibold text-white">Foundry</span>
                </span>
              </div>
            </div>
            <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto">
              {navSections.map((section) => (
                <div key={section.title} className="pb-3 pt-4 first:pt-0">
                  <p className="px-4 pb-3 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-600 font-mono">
                    {section.title}
                  </p>
                  {section.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={cn(
                        "nav-item relative flex items-center gap-3.5 px-4 py-2.5 text-sm font-medium rounded-r-lg transition-all group",
                        item.active
                          ? "active text-cyan-100"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                      )}
                    >
                      <span
                        className={cn(
                          "material-symbols-outlined text-[20px]",
                          item.active ? "text-cyan-400" : "group-hover:text-cyan-400 text-slate-500"
                        )}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="p-4 border-t border-white/5">
              <button className="flex items-center gap-3 w-full px-3 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors group">
                <div className="relative">
                  <Image
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqzeTOLKxAp0j_TCPrPDLpsjgBO30Br8ogmGb4L3dmAtpoz_xgvREFLPdwMXjMRJ23PT6CknUnTnjrNo-yFblUowYGcswUzE_xtk0abwNgKtQ3xmkHe9kzpRe00FAMWjJiWwstG8XnOvJLGDkE7Uf-0Yp7M2FAR3O7f1yenDUNWoxWx5QHQr94j_1f31GJxeKILN3CZbAUtchW5rKWgfcVUzlXo53Im5KdNeNO3ra9QwRfRrGXyV3UBm6aMi2fXLsTPPkWHadmmXgX"
                    alt="Operator avatar"
                    width={40}
                    height={40}
                    className="w-8 h-8 rounded-full ring-2 ring-[#0f1115] grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-cyan-500 rounded-full border border-[#0f1115] shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-xs text-slate-200 truncate font-mono">Alex Dev</p>
                  <p className="text-[10px] text-slate-600 truncate font-mono">alex@tracefoundry.com</p>
                </div>
              </button>
            </div>
          </aside>
          <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#050507] bg-grid-pattern">
            <header className="h-20 flex items-center justify-between px-10 sticky top-0 z-30 backdrop-blur-sm bg-[#050507]/60 border-b border-white/5">
              <div className="relative group w-full max-w-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-500 text-[20px]">search</span>
                </div>
                <input
                  type="text"
                  placeholder="Search traces, metrics, logs..."
                  className="block w-full pl-10 pr-12 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 focus:ring-1 focus:ring-cyan-500/20 transition-all shadow-lg shadow-black/20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-[10px] text-slate-500 font-mono border border-white/10 rounded px-1.5 py-0.5 bg-white/5">
                    ⌘K
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6 pl-6">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-500/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
                  <span className="tracking-widest uppercase">System Operational</span>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <button className="text-slate-500 hover:text-slate-200 transition-colors relative">
                  <span className="material-symbols-outlined">notifications</span>
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                </button>
                <button className="text-slate-500 hover:text-slate-200 transition-colors">
                  <span className="material-symbols-outlined">help</span>
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-10 pb-10">
              <div className="max-w-[1600px] mx-auto space-y-8">{children}</div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
