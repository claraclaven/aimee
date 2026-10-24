"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  Radar,
  FileDiff,
  Brain,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderStatusBadge } from "./ProviderStatusBadge";

const links = [
  { href: "/", label: "Command", icon: LayoutDashboard },
  { href: "/profile", label: "Profile & CV", icon: UserCog },
  { href: "/radar", label: "Opportunity Radar", icon: Radar },
  { href: "/applications", label: "Review & Diff", icon: FileDiff },
  { href: "/memory", label: "H-MEM Ledger", icon: Brain },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 pr-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-cyan/15 text-neon-cyan shadow-glow">
            <GraduationCap size={18} />
          </span>
          <span className="hidden text-sm font-semibold text-white sm:block">
            Tertiary Planner
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-neon-cyan/15 text-neon-cyan"
                    : "text-gray-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={15} />
                <span className="hidden md:block">{label}</span>
              </Link>
            );
          })}
        </nav>

        <ProviderStatusBadge />
      </div>
    </header>
  );
}
