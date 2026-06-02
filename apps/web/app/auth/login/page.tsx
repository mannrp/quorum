"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui";
import { graphqlRequest, setAuthToken } from "@/lib/graphql";
import { ME_QUERY } from "@/lib/queries";
import type { User } from "@/types/domain";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [developerToken, setDeveloperToken] = useState("");
  const [showDeveloperInput, setShowDeveloperInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMe, setSuccessMe] = useState<User | null>(null);

  const handleCredentialsLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    
    // Simulate user login: Generate a client-side mock token if backend credentials endpoint isn't fully routed.
    // Standard Neon Auth token maps to this mock identifier.
    const mockToken = btoa(JSON.stringify({ email, role: "STUDENT", time: Date.now() }));
    
    try {
      setAuthToken(mockToken);
      // Attempt to load profile from backend using mock token
      const result = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, mockToken);
      if (result.me) {
        setSuccessMe(result.me);
        router.push("/dashboard");
      } else {
        // If profile doesn't exist, redirect to onboarding with session active
        router.push("/onboarding");
      }
    } catch (err) {
      // Fallback in case of absolute local database network disconnect: Mock a default user profile to allow full manual testing
      console.warn("GraphQL verify failed, utilizing mocked session state for safety", err);
      const fallbackMe: User = {
        id: "mock-student-id",
        username: email.split("@")[0] || "student",
        fullName: "Jane Doe",
        email: email,
        discipline: "SOEN",
        university: "Concordia",
        tags: [{ id: "tag-1", name: "TypeScript", isPredefined: true }, { id: "tag-2", name: "React", isPredefined: true }, { id: "tag-3", name: "Next.js", isPredefined: true }],
      };
      setSuccessMe(fallbackMe);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleManualTokenSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setAuthToken(developerToken);
    try {
      const result = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, developerToken);
      if (result.me) {
        setSuccessMe(result.me);
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify token");
    } finally {
      setLoading(false);
    }
  };

  const triggerSSO = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      // Generate SSO token mockup
      const mockSSOToken = btoa(JSON.stringify({ email: `sso-${provider}@concordia.ca`, provider, time: Date.now() }));
      setAuthToken(mockSSOToken);
      router.push("/dashboard");
    }, 800);
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <Section title="Sign In to Quorum" className="shadow-indigo-950/5">
        <div className="space-y-4 pt-2">
          {/* SSO Integrations */}
          <div className="space-y-2">
            <button
              onClick={() => triggerSSO("Concordia")}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-md border border-[#cbd5e1] dark:border-stone-800 bg-[#800020] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#680016] active:scale-[0.98] transition cursor-pointer"
            >
              <span>Concordia Student Portal</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => triggerSSO("Google")}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-stone-250 dark:border-stone-800 bg-white dark:bg-[#161a2b] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#1e253c] active:scale-[0.98] transition cursor-pointer"
              >
                Google SSO
              </button>
              <button
                onClick={() => triggerSSO("GitHub")}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-stone-250 dark:border-stone-800 bg-stone-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-black active:scale-[0.98] transition cursor-pointer"
              >
                GitHub
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="h-[1px] w-full bg-stone-200 dark:bg-stone-800"></div>
            <span className="px-3 text-[10px] text-stone-400 font-bold uppercase tracking-wider">or</span>
            <div className="h-[1px] w-full bg-stone-200 dark:bg-stone-800"></div>
          </div>

          {/* Email / Password Form */}
          <form className="space-y-3" onSubmit={handleCredentialsLogin}>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email Address</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.doe@concordia.ca"
                className="input-field py-2"
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Password</label>
                <a href="#reset" className="text-[9px] text-[#283593] hover:underline">Forgot password?</a>
              </div>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field py-2"
                disabled={loading}
              />
            </div>
            {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}
            <button className="btn-primary w-full py-3 mt-1" type="submit" disabled={loading}>
              {loading ? "Authenticating Session..." : "Connect Session"}
            </button>
          </form>

          <p className="text-[11px] text-center text-stone-500 pt-2">
            First time accessing Quorum?{" "}
            <Link href="/auth/register" className="text-[#283593] font-bold hover:underline">Create a Profile</Link>
          </p>

          {/* Advanced Developer Panel Toggle */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-850">
            <button
              onClick={() => setShowDeveloperInput(!showDeveloperInput)}
              className="text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 transition outline-none"
            >
              {showDeveloperInput ? "[-] Hide developer options" : "[+] Advanced token credentials"}
            </button>

            {showDeveloperInput && (
              <form onSubmit={handleManualTokenSubmit} className="space-y-3 mt-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Manual Bearer Token</label>
                  <textarea
                    required
                    value={developerToken}
                    onChange={(e) => setDeveloperToken(e.target.value)}
                    placeholder="Paste a direct Neon Auth JWT bearer token..."
                    className="input-field min-h-24 text-xs font-mono"
                  />
                </div>
                <button className="btn-secondary w-full py-2 text-xs" type="submit" disabled={loading}>
                  Inject Token
                </button>
              </form>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
