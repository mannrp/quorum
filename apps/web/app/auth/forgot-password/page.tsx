"use client";

import { useState } from "react";
import Link from "next/link";
import { Section } from "@/components/ui";
import { requestPasswordResetEmail } from "@/lib/auth-v2/client-actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordResetEmail(email);
      setSubmitted(true);
    } catch {
      setError("Password reset could not be requested. Try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Section title="Reset password" className="shadow-none">
        {submitted ? (
          <div className="space-y-3 text-sm">
            <p>If an eligible account exists, a password reset link has been sent.</p>
            <Link href="/auth/login" className="text-[var(--accent-app)] font-semibold hover:underline">Return to sign in</Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-stone-500">Enter your email. The response is the same whether or not an account exists.</p>
            <div className="space-y-1">
              <label htmlFor="reset-email" className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email address</label>
              <input id="reset-email" className="input-field py-2" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
            </div>
            {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
            <button className="btn-primary w-full py-3" type="submit" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button>
          </form>
        )}
      </Section>
    </div>
  );
}