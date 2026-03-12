"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DarkModeToggle } from "./DarkModeToggle";
import { getActiveUser } from "@/lib/user-profile";

export function TopNav() {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setUserName(getActiveUser());
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Hide on profile picker page
  if (pathname === "/") return null;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tutor/math", label: "Math" },
    { href: "/tutor/reading", label: "Reading" },
    { href: "/tutor/writing", label: "Writing" },
    { href: "/vocab", label: "Vocab" },
    { href: "/study", label: "Study" },
    { href: "/drill", label: "Drill" },
    { href: "/simulate", label: "Practice Exam" },
    { href: "/progress", label: "Progress" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-surface-200 bg-surface-0/80 backdrop-blur-lg dark:border-surface-800 dark:bg-surface-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo + Brand */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-lg font-bold text-brand-600 dark:text-brand-400"
        >
          Hunter Tutor
        </Link>

        {/* Desktop Nav Links */}
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

        {/* Right side: hamburger (mobile) + dark mode + avatar */}
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          {userName && (
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-xl bg-surface-100 px-3 py-1.5 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 sm:flex"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-400">
                {userName[0].toUpperCase()}
              </span>
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                {userName}
              </span>
            </Link>
          )}

          {/* Hamburger button — mobile only */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-surface-500 transition-colors hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="border-t border-surface-200 bg-surface-0 px-4 pb-4 pt-2 dark:border-surface-800 dark:bg-surface-950 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400"
                      : "text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          {userName && (
            <div className="mt-3 border-t border-surface-200 pt-3 dark:border-surface-800">
              <div className="flex items-center gap-2 px-3 py-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-400">
                  {userName[0].toUpperCase()}
                </span>
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  {userName}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
