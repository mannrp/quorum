"use client";

import { useState } from "react";
import Link from "next/link";
import { Section } from "@/components/ui";
import { signUpWithEmail } from "@/lib/auth-v2/client-actions";
import { userFacingError } from "@/lib/operations/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signUpWithEmail(email, password, fullName);
      setSubmitted(true);
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Section title="Create Your Quorum Account" className="shadow-none">
        {submitted ? (
          <div className="space-y-4 pt-2 text-sm">
            <p>Check your email and follow the verification link before signing in.</p>
            <Link href="/auth/login" className="btn-primary inline-block">Return to sign in</Link>
          </div>
        ) : (
          <form className="space-y-3 pt-2" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="register-name" className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Full name</label>
              <input id="register-name" required value={fullName} onChange={(event) => setFullName(event.target.value)} className="input-field" autoComplete="name" />
            </div>
            <div className="space-y-1">
              <label htmlFor="register-email" className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email address</label>
              <input id="register-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-field" autoComplete="email" />
            </div>
            <div className="space-y-1">
              <label htmlFor="register-password" className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Password</label>
              <input id="register-password" required type="password" minLength={29} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="input-field" autoComplete="new-password" />
              <p className="text-[10px] text-stone-500">Use at least 29 characters.</p>
            </div>
            {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
            <button className="btn-primary w-full py-3" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
            <p className="text-center text-[11px] text-stone-500">
              Already registered? <Link href="/auth/login" className="font-bold text-[var(--accent-app)] hover:underline">Sign in</Link>
            </p>
          </form>
        )}
      </Section>
    </div>
  );
}
