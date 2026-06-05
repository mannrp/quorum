"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui";
import { graphqlRequest, setAuthToken, userFacingError } from "@/lib/graphql";
import { signInWithNeonEmail, signInWithNeonOAuth } from "@/lib/neon-auth";
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

  const routeAfterToken = async (token: string) => {
    const result = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, token);
    if (result.me) {
      setSuccessMe(result.me);
      router.push("/dashboard");
    } else {
      router.push("/onboarding");
    }
  };

  const handleCredentialsLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token = await signInWithNeonEmail(email, password);
      await routeAfterToken(token);
    } catch (err) {
      setAuthToken("");
      setError(userFacingError(err));
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
      await routeAfterToken(developerToken);
    } catch (err) {
      setAuthToken("");
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  const triggerSSO = async (provider: string) => {
    setError(null);
    setLoading(true);
    try {
      if (provider !== "google" && provider !== "github") {
        throw new Error("Unsupported OAuth provider.");
      }
      await signInWithNeonOAuth(provider, "/dashboard");
    } catch (err) {
      setError(userFacingError(err));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <Section title="Sign In to Quorum" className="shadow-none">
        <div className="space-y-4 pt-2">
          {/* SSO Integrations */}
          <div className="space-y-2">
            <button
              onClick={() => setError("Concordia SSO is not configured for beta yet. Use email/password or a QA bearer token.")}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-none border border-[var(--border-app)] bg-[var(--btn-primary-bg)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[var(--btn-primary-hover)] transition cursor-pointer"
            >
              <span>Concordia Student Portal</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void triggerSSO("google")}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-none border border-[var(--border-app)] bg-[var(--surface-app)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-app)] hover:bg-[var(--bg-app)] transition cursor-pointer"
              >
                Google SSO
              </button>
              <button
                onClick={() => void triggerSSO("github")}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-none border border-[var(--border-app)] bg-black dark:bg-[#1e1e24] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:opacity-90 transition cursor-pointer"
              >
                GitHub
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="h-[1px] w-full bg-[var(--border-subtle)]"></div>
            <span className="px-3 text-[10px] text-stone-400 font-bold uppercase tracking-wider font-mono">or</span>
            <div className="h-[1px] w-full bg-[var(--border-subtle)]"></div>
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
                <a href="#reset" className="text-[9px] text-[var(--accent-app)] hover:underline">Forgot password?</a>
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
            {error && <p className="text-xs text-rose-500 font-bold font-mono">{error}</p>}
            <button className="btn-primary w-full py-3 mt-1" type="submit" disabled={loading}>
              {loading ? "Authenticating Session..." : "Connect Session"}
            </button>
          </form>

          <p className="text-[11px] text-center text-stone-500 pt-2 font-mono">
            First time accessing Quorum?{" "}
            <Link href="/auth/register" className="text-[var(--accent-app)] font-bold hover:underline">Create a Profile</Link>
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
