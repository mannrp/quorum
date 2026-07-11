"use client";

import { use } from "react";
import Link from "next/link";
import { Section, Status, Badge, LoadingSkeleton } from "@/components/ui";
import { useGraphQL } from "@/lib/graphql";
import { PROFILE_QUERY } from "@/lib/queries";
import type { User } from "@/types/domain";

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { data, error, loading } = useGraphQL<{ user: User | null }>(PROFILE_QUERY, { username }, { auth: "optional" });
  const user = data?.user;

  if (loading) {
    return <Section title="Profile"><LoadingSkeleton rows={5} /></Section>;
  }

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Section title="Error">
          <p className="text-slate-400">{error || "User profile not found."}</p>
          <Link href="/" className="btn-secondary mt-4">Back Home</Link>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="panel flex flex-col items-center text-center space-y-4 md:col-span-1 h-fit">
          <div className="h-20 w-20 rounded-none bg-[var(--bg-app)] border border-[var(--border-app)] flex items-center justify-center font-mono font-black text-3xl text-[var(--accent-app)]">
            {user.fullName.charAt(0)}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">{user.fullName}</h2>
            <p className="text-xs font-mono text-stone-500">@{user.username}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            <Status value={user.discipline || "UNSET"} />
            <span className="text-xs text-stone-500">-</span>
            <span className="text-xs text-stone-600 font-sans">{user.university || "Concordia"}</span>
          </div>
          <div className="flex justify-center gap-3 w-full pt-4 border-t border-[var(--border-subtle)] text-xs font-mono">
            {user.linkedinUrl && <a href={user.linkedinUrl} target="_blank" rel="noreferrer" className="px-2 py-1 bg-[var(--bg-app)] border border-[var(--border-app)] rounded-none text-[var(--text-app)] hover:bg-[var(--accent-app)] hover:text-white transition">LinkedIn</a>}
            {user.githubUrl && <a href={user.githubUrl} target="_blank" rel="noreferrer" className="px-2 py-1 bg-[var(--bg-app)] border border-[var(--border-app)] rounded-none text-[var(--text-app)] hover:bg-[var(--accent-app)] hover:text-white transition">GitHub</a>}
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Section title="About Me">
            <p className="leading-relaxed text-[var(--text-app)] text-sm">{user.bio || "This user hasn't added a biography yet."}</p>
          </Section>

          <Section title="Acquired Skills & Specializations">
            <div className="flex flex-wrap gap-2">
              {(user.tags || []).map((tag) => <Badge key={tag.id} label={tag.name} type="tag" />)}
              {(!user.tags || user.tags.length === 0) && <p className="text-xs text-stone-500 italic font-mono">No skills listed yet.</p>}
            </div>
          </Section>

          <Section title="Resume Document">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {user.resumeUrl ? <a href={user.resumeUrl} className="text-xs text-[var(--accent-app)] hover:underline font-bold">Current resume</a> : <span className="text-xs text-stone-500 italic font-mono">No resume uploaded.</span>}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
