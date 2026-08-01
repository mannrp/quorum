"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState, useEffect, useCallback } from "react";
import { clearGraphQLCache, graphqlRequest, userFacingError } from "@/lib/graphql";
import { signOut } from "@/lib/auth-v2/client-actions";
import { SHELL_AUTH_QUERY, SHELL_COUNTS_QUERY } from "@/lib/queries";
import type { AuthState, User } from "@/types/domain";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [adminAccess, setAdminAccess] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

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
    try {
      setSessionError(null);
      const res = await graphqlRequest<{ authState: AuthState }>(SHELL_AUTH_QUERY, {}, { auth: "optional", cacheMs: 60_000 });
      if (res.authState.profile) {
        setMe(res.authState.profile);
      } else {
        setMe(null);
        setAdminAccess(false);
        setUnreadNotif(0);
        setUnreadMsg(0);
      }

      if (res.authState.profileComplete) {
        const counts = await graphqlRequest<{
          dashboardContext: { unreadMessages: number; unreadNotifications: number; isAdmin: boolean };
        }>(SHELL_COUNTS_QUERY, {}, { auth: true });

        setUnreadNotif(counts.dashboardContext.unreadNotifications);
        setUnreadMsg(counts.dashboardContext.unreadMessages);
        setAdminAccess(counts.dashboardContext.isAdmin);
      } else {
        setAdminAccess(false);
        setUnreadNotif(0);
        setUnreadMsg(0);
      }
    } catch (err) {
      setSessionError(userFacingError(err));
      setMe(null);
      setAdminAccess(false);
      setUnreadNotif(0);
      setUnreadMsg(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load shell state once; mutations that change auth/persona explicitly refresh it.
  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const handleLogout = async () => {
    await signOut().catch(() => undefined);
    clearGraphQLCache();
    setMe(null);
    setAdminAccess(false);
    router.push("/");
  };


  const navLinks = me
    ? [
        { name: "Dashboard", href: "/dashboard" },
        { name: "Teams", href: "/teams" },
        { name: "Projects", href: "/projects" },
        { name: "Inbox", href: "/inbox", badge: unreadMsg },
        { name: "Notifications", href: "/notifications", badge: unreadNotif },
      ]
    : [
        { name: "Home", href: "/" },
        { name: "Teams", href: "/teams" },
        { name: "Projects", href: "/projects" },
      ];

  return (
    <div className="min-h-screen pb-12 transition-colors duration-150">
      <header className="w-full max-w-6xl mx-auto px-4 pt-4">
        <nav className="glass-nav flex items-center justify-between gap-4 border border-[var(--border-subtle)] px-6 py-4 bg-[var(--surface-app)]">
          <div className="flex items-center gap-6">
            <Link className="group flex items-center gap-2 border-0 text-xl font-bold tracking-tight text-[var(--text-app)]" href={me ? "/dashboard" : "/"}>
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--action-app)] transition-transform duration-200 group-hover:scale-125" />
              <span className="transition-colors group-hover:text-[var(--accent-app)]">Quorum</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-1.5">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative rounded-md border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? "border-[var(--border-subtle)] bg-[var(--accent-soft)] text-[var(--accent-app)]"
                        : "border-transparent text-[var(--muted-app)] hover:bg-[var(--bg-app)] hover:text-[var(--text-app)]"
                    }`}
                  >
                    {link.name}
                    {!!link.badge && (
                      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-[var(--accent-app)] px-1.5 py-0.5 text-[8px] font-bold text-white">
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
              {isDark ? "Light" : "Dark"}
            </button>

            {loading ? (
              <span className="skeleton-block h-7 w-24" role="status" aria-label="Loading account" />
            ) : me ? (
              <div className="flex items-center gap-2.5">
                <Link href={`/profile/${me.username}`} className="flex items-center gap-2 px-2 py-1 border border-transparent hover:border-[var(--border-subtle)] bg-transparent transition">
                  <div className="h-6 w-6 rounded-none bg-[var(--accent-app)] text-white flex items-center justify-center font-mono font-bold text-xs uppercase">
                    {me.fullName.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-app)] hidden sm:inline">{me.fullName}</span>
                </Link>
                <div className="h-4 w-[1px] bg-[var(--border-subtle)]"></div>
                <button onClick={handleLogout} className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-650 hover:underline">
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
      {sessionError && (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="rounded-none border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-danger)]">
            {sessionError}
          </div>
        </div>
      )}
      {/* Mobile nav bar visible on smaller screens */}
      {me && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-50 border border-[var(--border-app)] py-2 px-4 flex justify-around bg-[var(--surface-app)]">
          {navLinks.slice(0, 5).map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative p-2 text-[10px] font-mono font-bold uppercase tracking-wider transition ${
                  isActive ? "text-[var(--accent-app)]" : "text-stone-500 hover:text-stone-850"
                }`}
              >
                {link.name.substring(0, 5)}
                {!!link.badge && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-none bg-[var(--accent-app)]" />
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
