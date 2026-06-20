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
    <div className="dashboard-stage space-y-8 max-w-6xl mx-auto py-4 px-4">
      <section className="workspace-hero">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <span className="page-kicker">Team directory</span>
            <div className="space-y-2">
              <h1 className="page-title">Capstone teams</h1>
              <p className="page-subtitle">Find active student groups, compare open slots, and spot teams that match your discipline.</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search teams..."
              className="input-field py-3 flex-1 md:w-72"
            />
            <Link href="/teams/new" className="btn-primary shrink-0 flex items-center justify-center">
              Create team
            </Link>
          </div>
        </div>
      </section>

      {loading && <Section title="Loading"><p className="text-xs text-[var(--muted-app)] animate-pulse">Loading active teams...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs font-semibold text-rose-500">{error}</p></Section>}

      <div className="stagger-in grid gap-5 md:grid-cols-2">
        {!loading && !error && teams.map((team) => {
          const openings = team.maxSize - team.members.length;
          return (
            <div key={team.id} className="directory-card">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/teams/${team.id}`} className="card-title">
                    {team.name}
                  </Link>
                  <Status value={team.isComplete ? "COMPLETE" : "RECRUITING"} />
                </div>
                <p className="text-sm leading-6 text-[var(--muted-app)] line-clamp-2">{team.description || "No description provided."}</p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--muted-app)]">
                <Badge label={team.discipline || "CROSS-DISCIPLINARY"} type="discipline" />
                <div className="flex items-center gap-1 font-semibold">
                  <span>Openings:</span>
                  <span className={`font-bold ${openings > 0 ? "text-[var(--accent-app)]" : "text-[var(--muted-app)]"}`}>{openings} slots ({team.members.length}/{team.maxSize})</span>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && !error && teams.length === 0 && (
          <div className="col-span-full panel text-center py-16 space-y-2 border-dashed border-[var(--border-subtle)]">
            <p className="text-lg font-semibold text-[var(--text-app)]">No capstone groups found matching your query.</p>
            <p className="text-xs text-[var(--muted-app)]">Try adjusting your filters or search tags.</p>
          </div>
        )}
      </div>
    </div>
  );
}
