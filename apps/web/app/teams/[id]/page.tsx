"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ActionButton, Section, Status, Badge } from "@/components/ui";
import { graphqlRequest, useGraphQL } from "@/lib/graphql";
import { TEAM_QUERY } from "@/lib/queries";
import type { Team, TeamRole } from "@/types/domain";

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useGraphQL<{ team: Team | null }>(TEAM_QUERY, { id });
  const [notice, setNotice] = useState<string | null>(null);
  const team = data?.team;

  const requestJoin = async () => {
    setNotice(null);
    await graphqlRequest<{ requestJoin: { id: string } }>(
      `mutation RequestJoin($teamId: ID!, $message: String) { requestJoin(teamId: $teamId, message: $message) { id } }`,
      { teamId: id, message: "I would like to join this capstone team." },
    );
    setNotice("Join request submitted.");
  };

  const promoteMember = async (userId: string, currentRole: TeamRole) => {
    const role: TeamRole = currentRole === "MEMBER" ? "CO_LEAD" : "MEMBER";
    await graphqlRequest(`mutation Promote($teamId: ID!, $userId: ID!, $role: TeamRole!) {
      promoteMember(teamId: $teamId, userId: $userId, role: $role) { id role }
    }`, { teamId: id, userId, role });
    await reload();
  };

  if (loading) {
    return <Section title="Loading"><p className="text-slate-400">Loading team from GraphQL...</p></Section>;
  }

  if (error || !team) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Section title="Error">
          <p className="text-slate-400">{error || "The requested team profile does not exist."}</p>
          <Link href="/teams" className="btn-secondary mt-4">Back to Teams</Link>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="panel flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight">{team.name}</h1>
            <Status value={team.isComplete ? "COMPLETE" : "OPEN"} />
            <Badge label={team.discipline || "CROSS-DISCIPLINARY"} type="discipline" />
          </div>
          <p className="text-slate-300 leading-relaxed max-w-2xl">{team.description || "A student-led team coordinating capstone achievements."}</p>
          {notice && <p className="text-xs text-emerald-400">{notice}</p>}
        </div>

        <button onClick={() => void requestJoin().catch((err) => setNotice(err.message))} className="btn-primary w-full sm:w-auto">
          Request to Join
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Section title="Team Roster">
            <div className="divide-y divide-slate-800/60">
              {team.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center font-bold text-teal-400">
                      {member.user.fullName.charAt(0)}
                    </div>
                    <div>
                      <Link href={`/profile/${member.user.username}`} className="font-bold text-slate-200 hover:text-teal-400 transition">
                        {member.user.fullName}
                      </Link>
                      <p className="text-xs text-slate-500">@{member.user.username} - {member.user.discipline || "GEN"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge label={member.role} type={member.role === "LEAD" ? "lead" : member.role === "CO_LEAD" ? "discipline" : "tag"} />
                    {member.role !== "LEAD" && (
                      <ActionButton label={member.role === "MEMBER" ? "Promote" : "Demote"} variant="secondary" onClick={() => void promoteMember(member.user.id, member.role).catch((err) => setNotice(err.message))} className="py-1 px-2.5 text-xs rounded-lg" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Details">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-800/40"><span className="text-slate-500">Max Size:</span><span className="font-semibold text-slate-200">{team.maxSize} Members</span></div>
              <div className="flex justify-between py-2 border-b border-slate-800/40"><span className="text-slate-500">Current Slots:</span><span className="font-semibold text-slate-200">{team.maxSize - team.members.length} open</span></div>
              <div className="flex justify-between py-2 border-b border-slate-800/40"><span className="text-slate-500">Disciplines:</span><span className="font-semibold text-teal-400">{team.discipline || "Any / Cross"}</span></div>
            </div>
          </Section>

          <Section title="Associated Project">
            {team.project ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Assigned Capstone</p>
                <Link href={`/projects/${team.project.id}`} className="block font-bold text-slate-200 hover:text-teal-400 transition">{team.project.title}</Link>
                <p className="text-xs text-slate-400 line-clamp-2">{team.project.description}</p>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-slate-500">No project associated yet.</p>
                <Link href="/projects" className="btn-secondary py-1 px-3 text-xs w-full">Browse Open Projects</Link>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
