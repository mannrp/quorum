"use client";

import { useState } from "react";
import Link from "next/link";
import { Section } from "@/components/ui";
import { graphqlRequest, setAuthToken } from "@/lib/graphql";
import type { User } from "@/types/domain";

export default function RegisterPage() {
  const [token, setToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [university, setUniversity] = useState("Concordia");
  const [profile, setProfile] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setAuthToken(token);
    try {
      const result = await graphqlRequest<{ bootstrapProfile: User }>(
        `mutation Bootstrap($input: BootstrapProfileInput!) {
          bootstrapProfile(input: $input) { id username fullName discipline university }
        }`,
        { input: { username, email, fullName, discipline: discipline || null, university: university || null } },
        token,
      );
      setProfile(result.bootstrapProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to bootstrap profile");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Section title="Bootstrap Quorum Profile" className="shadow-teal-950/10">
        {!profile ? (
          <form className="grid gap-4 md:grid-cols-2 pt-2" onSubmit={handleSubmit}>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Neon Auth Bearer Token</label>
              <textarea required value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste a real Neon Auth access token" className="input-field min-h-28" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
              <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Alex Nguyen" className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Username</label>
              <input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="alexng" className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@university.edu" className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Discipline</label>
              <input value={discipline} onChange={(event) => setDiscipline(event.target.value)} placeholder="SOEN" className="input-field" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">University</label>
              <input value={university} onChange={(event) => setUniversity(event.target.value)} placeholder="Concordia" className="input-field" />
            </div>
            {error && <p className="md:col-span-2 text-xs text-red-400">{error}</p>}
            <button className="col-span-full btn-primary py-3 mt-2" type="submit">Create Local Profile</button>
            <p className="col-span-full text-xs text-center text-slate-500 pt-2">
              Already bootstrapped?{" "}
              <Link href="/auth/login" className="text-teal-400 font-semibold hover:underline">Verify token instead</Link>
            </p>
          </form>
        ) : (
          <div className="text-center py-8 space-y-4 max-w-md mx-auto">
            <div className="space-y-1.5">
              <p className="font-bold text-slate-100 text-lg">Profile Ready</p>
              <p className="text-sm text-slate-300">Welcome to Quorum, <span className="text-teal-400 font-bold">{profile.fullName}</span> (@{profile.username}).</p>
            </div>
            <Link href="/" className="btn-primary py-2.5 px-6 text-sm inline-block">Get Started</Link>
          </div>
        )}
      </Section>
    </div>
  );
}
