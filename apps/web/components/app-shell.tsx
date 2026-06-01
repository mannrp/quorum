"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const links = [
  { name: "Home", href: "/" },
  { name: "Teams", href: "/teams" },
  { name: "Projects", href: "/projects" },
  { name: "Inbox", href: "/inbox" },
  { name: "Notifications", href: "/notifications" },
  { name: "Admin", href: "/admin" },
];

import { useState, useEffect } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from document class
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      setIsDark(true);
    }
  };

  return (
    <div className="min-h-screen pb-12 bg-white dark:bg-stone-950 transition-colors duration-200">
      <header className="w-full max-w-6xl mx-auto px-4 pt-4">
        <nav className="glass-nav flex items-center justify-between gap-4 border-t border-b border-stone-300 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 px-2 py-4">
          <div className="flex items-center gap-6">
            <Link className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2 group" href="/">
              <span className="text-amber-700 dark:text-amber-500 group-hover:brightness-110 transition">Q</span>
              <span className="text-stone-800 dark:text-stone-200 group-hover:text-stone-950 dark:group-hover:text-white transition">Quorum</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-1.5">
              {links.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                      isActive
                        ? "bg-[#F1F5F0] dark:bg-[#1E2520] text-[#344237] dark:text-[#C5D3C3] border-[#A8BAA5] dark:border-[#384A3B]"
                        : "text-stone-500 border-transparent hover:text-stone-850 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="btn-secondary px-3 py-1.5 text-xs border border-stone-300 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900"
              aria-label="Toggle Theme"
            >
              {isDark ? "[-] Light Mode" : "[*] Dark Mode"}
            </button>
            <div className="flex gap-2">
              <Link href="/auth/login" className="btn-secondary px-3.5 py-1.5 text-xs">
                Log In
              </Link>
              <Link href="/auth/register" className="btn-primary px-3.5 py-1.5 text-xs">
                Join Now
              </Link>
            </div>
          </div>
        </nav>
      </header>
      
      {/* Mobile nav bar visible on smaller screens */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50 glass-nav border-t border-stone-350 dark:border-stone-800 py-2 px-4 flex justify-around bg-white/95 dark:bg-stone-950/95 shadow-lg">
        {links.slice(0, 5).map((link) => {
          const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded p-2 text-xs font-bold uppercase tracking-wider transition ${
                isActive ? "text-amber-700 dark:text-amber-500" : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </div>

      <main className="mx-auto max-w-6xl p-4 pt-8">{children}</main>
    </div>
  );
}

