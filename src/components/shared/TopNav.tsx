"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DarkModeToggle } from "./DarkModeToggle";
import { Mascot, getMascotTier } from "./Mascot";
import { getActiveUser } from "@/lib/user-profile";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";

export function TopNav() {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [mascotTier, setMascotTier] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    setUserName(getActiveUser());

    const stored = loadAllSkillMasteries();
    if (stored.length > 0) {
      const avg =
        stored.reduce((sum, s) => sum + s.masteryLevel, 0) / stored.length;
      setMascotTier(getMascotTier(avg));
    }
  }, []);

  // Hide on profile picker page
  if (pathname === "/") return null;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tutor/reading", label: "Reading" },
    { href: "/tutor/writing", label: "Writing" },
    { href: "/simulate", label: "Practice Exam" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-surface-200 bg-surface-0/80 backdrop-blur-lg dark:border-surface-800 dark:bg-surface-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo + Brand */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-lg font-bold text-brand-600 dark:text-brand-400"
        >
          <Mascot tier={mascotTier} size="sm" />
          <span className="hidden sm:inline">Hunter Tutor</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400"
                    : "text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-300"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right side: dark mode + avatar */}
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          {userName && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl bg-surface-100 px-3 py-1.5 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-400">
                {userName[0].toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium text-surface-700 dark:text-surface-300 sm:inline">
                {userName}
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
