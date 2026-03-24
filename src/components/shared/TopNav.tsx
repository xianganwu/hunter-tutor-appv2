"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DarkModeToggle } from "./DarkModeToggle";
import { getActiveUser } from "@/lib/user-profile";

/* ── Navigation data ────────────────────────────────────────────────── */

type NavLink = { href: string; label: string };
type NavDropdown = { label: string; children: NavLink[] };
type NavItem = NavLink | NavDropdown;

function isDropdown(item: NavItem): item is NavDropdown {
  return "children" in item;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Math",
    children: [
      { href: "/tutor/math", label: "Math Tutor" },
      { href: "/drill", label: "Drills" },
    ],
  },
  {
    label: "Reading",
    children: [
      { href: "/tutor/reading", label: "Reading Tutor" },
      { href: "/vocab", label: "Vocab" },
    ],
  },
  { href: "/tutor/writing", label: "Writing" },
  { href: "/study", label: "Study" },
];

/* ── Style constants ────────────────────────────────────────────────── */

const ACTIVE =
  "bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400";
const INACTIVE =
  "text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-300";
const MOBILE_ACTIVE =
  "bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400";
const MOBILE_INACTIVE =
  "text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800";

/* ── Component ──────────────────────────────────────────────────────── */

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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isGroupActive = (children: NavLink[]) =>
    children.some((c) => isActive(c.href));

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

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            if (isDropdown(item)) {
              const active = isGroupActive(item.children);
              return (
                <div key={item.label} className="group relative">
                  <button
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? ACTIVE : INACTIVE
                    }`}
                  >
                    {item.label}
                    <svg
                      className="h-3 w-3 transition-transform group-hover:rotate-180"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 4.5l3 3 3-3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Dropdown — pt-1 acts as an invisible hover bridge */}
                  <div className="invisible absolute left-0 top-full z-50 pt-1 group-hover:visible group-focus-within:visible">
                    <div className="min-w-[10rem] rounded-xl border border-surface-200 bg-surface-0 py-1 shadow-lg dark:border-surface-700 dark:bg-surface-900">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-4 py-2 text-sm font-medium transition-colors ${
                            isActive(child.href)
                              ? "bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400"
                              : "text-surface-600 hover:bg-surface-50 hover:text-surface-800 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100"
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href) ? ACTIVE : INACTIVE
                }`}
              >
                {item.label}
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-surface-200 bg-surface-0 px-4 pb-4 pt-2 dark:border-surface-800 dark:bg-surface-950 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              if (isDropdown(item)) {
                return (
                  <div key={item.label}>
                    <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
                      {item.label}
                    </p>
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block rounded-lg py-2.5 pl-6 pr-3 text-sm font-medium transition-colors ${
                          isActive(child.href)
                            ? MOBILE_ACTIVE
                            : MOBILE_INACTIVE
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item.href) ? MOBILE_ACTIVE : MOBILE_INACTIVE
                  }`}
                >
                  {item.label}
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
