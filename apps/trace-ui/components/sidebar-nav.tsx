"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  icon: string;
  href: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

type SidebarNavProps = {
  sections: NavSection[];
};

export function SidebarNav({ sections }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto">
      {sections.map((section, idx) => (
        <div key={section.title} className={cn("pb-3", idx === 0 ? "" : "pt-4")}>
          <p className="px-4 pb-3 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-600 font-mono">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "nav-item relative flex items-center gap-3.5 px-4 py-2.5 text-sm font-medium rounded-r-lg transition-all group",
                  active ? "active text-cyan-100" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[20px]",
                    active ? "text-cyan-400" : "group-hover:text-cyan-400 text-slate-500"
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
