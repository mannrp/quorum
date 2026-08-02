"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui";
import { authDestination } from "@/lib/auth-routing";
import { userFacingError } from "@/lib/operations/client";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth-v2/client-actions";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("oauth") === "error") {
      setError("Google sign-in was cancelled or could not be completed.");
    }
    if (query.get("reset") === "complete") {
      setError("Password updated. Sign in with your new password.");
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(userFacingError(err));
      setLoading(false);
    }
  };

  const handleCredentialsLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      router.push(await authDestination());
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-md mx-auto py-8">
      <Section title="Sign In to Quorum" className="shadow-none">
        <div className="space-y-4 pt-2">
          <button type="button" className="btn-secondary w-full py-3" onClick={handleGoogleLogin} disabled={loading}>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-stone-400" aria-hidden="true">
            <span className="h-px flex-1 bg-[var(--border-subtle)]" />
            or use email
            <span className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>
          {/* Email / Password Form */}
          <form className="space-y-3" onSubmit={handleCredentialsLogin}>
            <div className="space-y-1">
              <label htmlFor="login-email" className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email Address</label>
              <input
                id="login-email"
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
                <label htmlFor="login-password" className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Password</label>
                <Link href="/auth/forgot-password" className="text-[9px] text-[var(--accent-app)] hover:underline">Forgot password?</Link>
              </div>
              <input
                id="login-password"
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
