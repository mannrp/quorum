"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui";
import { authDestination } from "@/lib/auth-routing";
import { userFacingError } from "@/lib/graphql";
import { signInWithNeonEmail, signInWithNeonOAuth } from "@/lib/neon-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCredentialsLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithNeonEmail(email, password);
      router.push(await authDestination());
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  const triggerSSO = async (provider: string) => {
    setError(null);
    setLoading(true);
    try {
      if (provider !== "google") {
        throw new Error("Unsupported OAuth provider.");
      }
      await signInWithNeonOAuth(provider, "/auth/complete");
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
              onClick={() => void triggerSSO("google")}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-none border border-[var(--border-app)] bg-[var(--surface-app)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--text-app)] hover:bg-[var(--bg-app)] transition cursor-pointer"
            >
              <span>Continue with Google</span>
            </button>
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
        </div>
      </Section>
    </div>
  );
}
