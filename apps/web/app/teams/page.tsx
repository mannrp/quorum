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
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-250 dark:border-stone-850 pb-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc]">Capstone Groups</h1>
          <p className="text-sm text-stone-500">Discover active student project teams, check open slots, or apply to join.</p>
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

      {loading && <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Loading active teams...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-rose-500 font-bold">{error}</p></Section>}

      <div className="grid gap-6 md:grid-cols-2">
        {!loading && !error && teams.map((team) => {
          const openings = team.maxSize - team.members.length;
          return (
            <div key={team.id} className="panel flex flex-col justify-between space-y-4 hover:translate-y-[-2px] transition-all">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/teams/${team.id}`} className="text-lg font-bold font-serif text-stone-900 dark:text-indigo-300 hover:underline">
                    {team.name}
                  </Link>
                  <Status value={team.isComplete ? "COMPLETE" : "RECRUITING"} />
                </div>
                <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{team.description || "No description provided."}</p>
              </div>

              <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-800 pt-3 text-[11px] text-stone-500">
                <Badge label={team.discipline || "CROSS-DISCIPLINARY"} type="discipline" />
                <div className="flex items-center gap-1 font-semibold text-stone-600 dark:text-slate-350">
                  <span>Openings:</span>
                  <span className={`font-bold ${openings > 0 ? "text-[#283593] dark:text-indigo-400" : "text-stone-400"}`}>{openings} slots ({team.members.length}/{team.maxSize})</span>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && !error && teams.length === 0 && (
          <div className="col-span-full panel text-center py-16 space-y-2">
            <p className="text-stone-400 text-lg">No capstone groups found matching your query.</p>
            <p className="text-xs text-stone-500">Try adjusting your filters or search tags.</p>
          </div>
        )}
      </div>
    </div>
  );
}
