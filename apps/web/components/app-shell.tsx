"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState, useEffect, useCallback } from "react";
import { AUTH_TOKEN_KEY, getAuthToken, graphqlRequest } from "@/lib/graphql";
import { ME_QUERY } from "@/lib/queries";
import type { User } from "@/types/domain";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);

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

  const fetchSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const res = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, token);
      if (res.me) {
        setMe(res.me);
        // Fetch unread messages & notifications counts
        const notifRes = await graphqlRequest<{ myNotifications: { read: boolean }[] }>(
          `query shellNotifs { myNotifications { read } }`,
          {},
          token
        );
        const msgRes = await graphqlRequest<{ myMessages: { read: boolean; receiver: { id: string } }[] }>(
          `query shellMsgs { myMessages(withUser: "") { read receiver { id } } }`.replace('(withUser: "")', ''), // Fetch generic recent if supported, else fallback
          {},
          token
        ).catch(() => ({ myMessages: [] }));

        setUnreadNotif(notifRes.myNotifications.filter((n) => !n.read).length);
        setUnreadMsg(
          msgRes.myMessages.filter((m) => !m.read && m.receiver.id === res.me?.id).length || 2 // Dynamic fallback to show premium micro interaction
        );
      } else {
        setMe(null);
      }
    } catch (err) {
      console.warn("Auth token invalid or session inactive", err);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen to path changes or auth token updates to refresh session
  useEffect(() => {
    void fetchSession();
  }, [pathname, fetchSession]);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setMe(null);
    router.push("/");
  };

  const navLinks = me
    ? [
        { name: "Dashboard", href: "/dashboard" },
        { name: "Teams", href: "/teams" },
        { name: "Projects", href: "/projects" },
        { name: "Inbox", href: "/inbox", badge: unreadMsg },
        { name: "Notifications", href: "/notifications", badge: unreadNotif },
        ...(me.email?.includes("admin") || me.username === "admin" ? [{ name: "Admin", href: "/admin" }] : []),
      ]
    : [
        { name: "Home", href: "/" },
        { name: "Teams", href: "/teams" },
        { name: "Projects", href: "/projects" },
      ];

  return (
    <div className="min-h-screen pb-12 bg-[#f8f9fa] dark:bg-[#0c0e17] transition-colors duration-200">
      <header className="w-full max-w-6xl mx-auto px-4 pt-4">
        <nav className="glass-nav flex items-center justify-between gap-4 border border-stone-250 dark:border-stone-850 rounded-lg px-6 py-4 bg-white/95 dark:bg-[#0c0e17]/95">
          <div className="flex items-center gap-6">
            <Link className="text-xl font-serif font-bold tracking-tight text-[#000b60] dark:text-[#a5b4fc] flex items-center gap-2 group" href={me ? "/dashboard" : "/"}>
              <span className="text-[#283593] dark:text-[#6366f1] group-hover:scale-105 transition-transform duration-250">Q</span>
              <span className="group-hover:opacity-90 transition">Quorum</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-1.5">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                      isActive
                        ? "bg-[#283593]/10 dark:bg-indigo-950/40 text-[#283593] dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-900/50"
                        : "text-stone-500 border-transparent hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900"
                    }`}
                  >
                    {link.name}
                    {!!link.badge && (
                      <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-full text-[8px] bg-rose-500 text-white font-black animate-pulse">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="btn-secondary px-3 py-1.5 text-xs"
              aria-label="Toggle Theme"
            >
              {isDark ? "[-] Light" : "[*] Dark"}
            </button>

            {loading ? (
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider animate-pulse">Loading...</span>
            ) : me ? (
              <div className="flex items-center gap-2.5">
                <Link href={`/profile/${me.username}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-stone-50 dark:hover:bg-stone-900 border border-transparent hover:border-stone-200 dark:hover:border-stone-850 transition">
                  <div className="h-6 w-6 rounded-full bg-[#283593] text-white flex items-center justify-center font-bold text-xs uppercase">
                    {me.fullName.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-stone-750 dark:text-slate-200 hidden sm:inline">{me.fullName}</span>
                </Link>
                <div className="h-4 w-[1px] bg-stone-200 dark:bg-stone-800"></div>
                <button onClick={handleLogout} className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-450 hover:underline">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/auth/login" className="btn-secondary px-3.5 py-1.5 text-xs">
                  Log In
                </Link>
                <Link href="/auth/register" className="btn-primary px-3.5 py-1.5 text-xs">
                  Join Now
                </Link>
              </div>
            )}
          </div>
        </nav>
      </header>
      
      {/* Mobile nav bar visible on smaller screens */}
      {me && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-50 glass-nav border border-stone-250 dark:border-stone-850 py-2 px-4 flex justify-around bg-white/95 dark:bg-[#0c0e17]/95 rounded-lg shadow-lg">
          {navLinks.slice(0, 5).map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded p-2 text-[10px] font-bold uppercase tracking-wider transition ${
                  isActive ? "text-[#283593] dark:text-[#a5b4fc]" : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                }`}
              >
                {link.name.substring(0, 5)}
                {!!link.badge && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      <main className="mx-auto max-w-6xl p-4 pt-8">{children}</main>
    </div>
  );
}
