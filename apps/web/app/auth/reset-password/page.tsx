"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui";
import { resetPasswordWithToken } from "@/lib/auth-v2/client-actions";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("This password reset link is invalid or expired.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPasswordWithToken(token, password);
      router.replace("/auth/login?reset=complete");
    } catch {
      setError("This password reset link is invalid or expired.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Section title="Choose a new password" className="shadow-none">
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1">
            <label htmlFor="new-password" className="text-[10px] font-bold uppercase tracking-wider text-stone-400">New password</label>
            <input id="new-password" className="input-field py-2" type="password" minLength={29} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || !token} />
          </div>
          {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
          <button className="btn-primary w-full py-3" type="submit" disabled={loading || !token}>{loading ? "Updating..." : "Update password"}</button>
        </form>
      </Section>
    </div>
  );
}