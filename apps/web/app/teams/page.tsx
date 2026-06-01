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
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Student Capstone Teams</h1>
          <p className="text-sm text-slate-400">Discover formed student groups, look at their open slots, or request to join.</p>
        </div>
        <div className="w-full md:w-80">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams by name or description..." className="input-field py-2" />
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-slate-500">Loading teams from GraphQL...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-red-400">{error}</p></Section>}

      <div className="grid gap-6 md:grid-cols-2">
        {!loading && !error && teams.map((team) => (
          <div key={team.id} className="panel flex flex-col justify-between space-y-4 hover:translate-y-[-2px] transition-all">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/teams/${team.id}`} className="text-xl font-bold text-slate-100 hover:text-teal-400 transition">
                  {team.name}
                </Link>
                <Status value={team.isComplete ? "COMPLETE" : "OPEN"} />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{team.description || "No description provided."}</p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs text-slate-400">
              <Badge label={team.discipline || "CROSS-DISCIPLINARY"} type="discipline" />
              <div className="flex items-center gap-1">
                <span>Capacity:</span>
                <span className="font-bold text-slate-200">{team.members.length}/{team.maxSize}</span>
              </div>
            </div>
          </div>
        ))}

        {!loading && !error && teams.length === 0 && (
          <div className="col-span-full panel text-center py-12 space-y-2">
            <p className="text-slate-400 text-lg">No teams found matching your query.</p>
            <p className="text-xs text-slate-500">Try searching for other keywords or disciplines.</p>
          </div>
        )}
      </div>
    </div>
  );
}
