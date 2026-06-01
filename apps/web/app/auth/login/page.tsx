"use client";

import { useState } from "react";
import Link from "next/link";
import { Section } from "@/components/ui";
import { graphqlRequest, setAuthToken } from "@/lib/graphql";
import { ME_QUERY } from "@/lib/queries";
import type { User } from "@/types/domain";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setAuthToken(token);
    try {
      const result = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, token);
      setMe(result.me);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify token");
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Section title="Connect Neon Auth Token" className="shadow-teal-950/10">
        <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Bearer Token</label>
            <textarea required value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste a real Neon Auth access token" className="input-field min-h-32" />
          </div>
          <button className="btn-primary w-full py-3 mt-2" type="submit">Verify Session</button>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {me && (
            <div className="text-center py-4 space-y-2">
              <p className="font-bold text-slate-100">Verified as {me.fullName}</p>
              <Link href="/" className="btn-secondary py-2 px-4 text-xs block w-fit mx-auto">Continue to Dashboard</Link>
            </div>
          )}
          <p className="text-xs text-center text-slate-500 pt-2">
            Need a local Quorum profile for this token?{" "}
            <Link href="/auth/register" className="text-teal-400 font-semibold hover:underline">Bootstrap one</Link>
          </p>
        </form>
      </Section>
    </div>
  );
}
