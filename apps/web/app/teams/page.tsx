"use client";
import Link from "next/link";
import { useState } from "react";
import { Section, Status, Badge } from "@/components/ui";
import { useGraphQL } from "@/lib/graphql";
import { TEAMS_QUERY } from "@/lib/queries";
import type { Team } from "@/types/domain";

export default function TeamsPage() {
  const [q, setQ] = useState("");
  const { data, error, loading } = useGraphQL<{ teams: Team[] }>(TEAMS_QUERY, q.trim() ? { search: q.trim() } : {});
  const teams = data?.teams || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-app)] pb-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Capstone Groups</h1>
          <p className="text-sm text-stone-500 font-sans">Discover active student project teams, check open slots, or apply to join.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search groups..."
            className="input-field py-2 flex-1 md:w-64"
          />
          <Link href="/teams/new" className="btn-primary text-xs shrink-0 flex items-center justify-center">
            Create Team
          </Link>
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-stone-500 font-mono animate-pulse uppercase tracking-wider">Loading active teams...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-rose-500 font-mono font-bold uppercase tracking-wider">{error}</p></Section>}

      <div className="grid gap-6 md:grid-cols-2">
        {!loading && !error && teams.map((team) => {
          const openings = team.maxSize - team.members.length;
          return (
            <div key={team.id} className="panel-interactive flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/teams/${team.id}`} className="text-lg font-bold font-serif text-[var(--text-app)] hover:text-[var(--accent-app)] uppercase tracking-tight">
                    {team.name}
                  </Link>
                  <Status value={team.isComplete ? "COMPLETE" : "RECRUITING"} />
                </div>
                <p className="text-xs text-stone-500 leading-relaxed font-sans line-clamp-2">{team.description || "No description provided."}</p>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-[11px] text-stone-500 font-mono">
                <Badge label={team.discipline || "CROSS-DISCIPLINARY"} type="discipline" />
                <div className="flex items-center gap-1 font-semibold text-stone-600 dark:text-slate-350">
                  <span>Openings:</span>
                  <span className={`font-bold ${openings > 0 ? "text-[var(--accent-app)]" : "text-stone-400"}`}>{openings} slots ({team.members.length}/{team.maxSize})</span>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && !error && teams.length === 0 && (
          <div className="col-span-full panel text-center py-16 space-y-2 border-dashed border-[var(--border-app)]">
            <p className="text-stone-400 text-lg font-mono">No capstone groups found matching your query.</p>
            <p className="text-xs text-stone-500 font-mono">Try adjusting your filters or search tags.</p>
          </div>
        )}
      </div>
    </div>
  );
}
