"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { ActionButton, Section, Status, Badge, Modal } from "@/components/ui";
import { graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
import { TEAM_QUERY } from "@/lib/queries";
import type { Team, TeamRole, User } from "@/types/domain";

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useGraphQL<{ team: Team | null }>(TEAM_QUERY, { id });
  
  const [me, setMe] = useState<User | null>(null);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinMessage, setJoinMessage] = useState("I would like to join this capstone team. I bring relevant skills in software engineering.");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmNotice, setConfirmNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const team = data?.team;

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await graphqlRequest<{ me: User | null }>(
          `query meInTeam { me { id username fullName } }`,
          {},
          { auth: true }
        );
        if (res.me) setMe(res.me);
      } catch (err) {
        setNotice(userFacingError(err));
      }
    };
    void fetchMe();
  }, []);

  const requestJoinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      await graphqlRequest<{ requestJoin: { id: string } }>(
        `mutation RequestJoin($teamId: ID!, $message: String) { requestJoin(teamId: $teamId, message: $message) { id } }`,
        { teamId: id, message: joinMessage },
        { auth: true }
      );
      setNotice("Join request successfully submitted!");
      setIsJoinOpen(false);
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const promoteMember = async (userId: string, currentRole: TeamRole) => {
    const role: TeamRole = currentRole === "MEMBER" ? "CO_LEAD" : "MEMBER";
    try {
      await graphqlRequest(
        `mutation Promote($teamId: ID!, $userId: ID!, $role: TeamRole!) {
          promoteMember(teamId: $teamId, userId: $userId, role: $role) { id role }
        }`,
        { teamId: id, userId, role },
        { auth: true }
      );
      setConfirmNotice(`Member successfully ${role === "CO_LEAD" ? "promoted to Co-Lead" : "demoted to Member"}.`);
      await reload();
    } catch (err) {
      setConfirmNotice(userFacingError(err));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Section title="Loading">
          <p className="text-xs text-[var(--muted-app)] animate-pulse">Syncing team registry...</p>
        </Section>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Section title="Error Notice">
          <p className="text-xs text-[var(--muted-app)]">{error || "The requested team profile does not exist."}</p>
          <Link href="/teams" className="btn-secondary mt-4 inline-block">Back to Groups Registry</Link>
        </Section>
      </div>
    );
  }

  // Determine user relationship with this team
  const userMembership = team.members.find((m) => m.user.id === me?.id);
  const isLead = userMembership?.role === "LEAD";
  const isCoLead = userMembership?.role === "CO_LEAD";
  const isMember = !!userMembership;

  return (
    <div className="dashboard-stage mx-auto max-w-6xl space-y-8 px-4 py-4">
      {/* Team Header */}
      <div className="workspace-hero flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-4">
          <span className="page-kicker">Team profile</span>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-normal text-[var(--text-app)] md:text-5xl">{team.name}</h1>
            <Status value={team.isComplete ? "COMPLETE" : "RECRUITING"} />
            <Badge label={team.discipline || "CROSS-DISCIPLINARY"} type="discipline" />
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted-app)]">{team.description || "A student-led team coordinating Concordia Capstone achievements."}</p>
          {notice && <p className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-success)]">{notice}</p>}
          {confirmNotice && <p className="rounded-lg border border-[var(--accent-app)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent-app)]">{confirmNotice}</p>}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          {(isLead || isCoLead) && (
            <Link href={`/teams/${id}/manage`} className="btn-primary w-full sm:w-auto text-center text-xs">
              Manage Team
            </Link>
          )}
          {!isMember && (
            <button
              onClick={() => setIsJoinOpen(true)}
              className="btn-primary w-full sm:w-auto text-xs"
            >
              Request to Join
            </button>
          )}
          {me && me.id !== team.createdBy.id && (
            <Link href={`/inbox?userId=${team.createdBy.id}`} className="btn-secondary w-full sm:w-auto text-center text-xs flex items-center justify-center gap-1">
              ✉ Message Lead
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_0.8fr]">
        {/* Left main content column */}
        <div className="space-y-5">
          <Section title="Team Roster Ranks">
            <div className="stagger-in space-y-3">
              {team.members.map((member) => (
                <div key={member.id} className="signal-card flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="avatar-chip">
                      {member.user.fullName.charAt(0)}
                    </div>
                    <div>
                      <Link href={`/profile/${member.user.username}`} className="font-bold text-[var(--text-app)] hover:text-[var(--accent-app)] text-sm">
                        {member.user.fullName}
                      </Link>
                      <p className="text-[10px] text-stone-500 font-mono uppercase tracking-wider">@{member.user.username} • {member.user.discipline || "SOEN"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge label={member.role} type={member.role === "LEAD" ? "lead" : member.role === "CO_LEAD" ? "discipline" : "tag"} />
                    {isLead && member.role !== "LEAD" && (
                      <ActionButton
                        label={member.role === "MEMBER" ? "Promote" : "Demote"}
                        variant="secondary"
                        onClick={() => void promoteMember(member.user.id, member.role)}
                        className="py-1 px-2.5 text-[9px]"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Sidebar details */}
        <div className="space-y-5">
          <Section title="Group Specifications">
            <div className="space-y-4 text-xs font-mono">
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-stone-500">Target Size:</span>
                <span className="font-semibold text-[var(--text-app)]">{team.maxSize} Members</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-stone-500">Roster Capacity:</span>
                <span className="font-semibold text-[var(--text-app)]">{team.maxSize - team.members.length} open slots</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-stone-500">Focus Core:</span>
                <span className="font-semibold text-[var(--accent-app)]">{team.discipline || "Cross-disciplinary"}</span>
              </div>
              {team.discordLink && (
                <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-stone-500">Discord Link:</span>
                  <a href={team.discordLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent-app)]">
                    Join Server
                  </a>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-stone-500">Recruiting:</span>
                <span className="font-semibold text-[var(--text-app)]">{team.recruitingState}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-stone-500">Visibility:</span>
                <span className="font-semibold text-[var(--text-app)]">{team.visibility}</span>
              </div>
            </div>
          </Section>

          {(() => {
            const existingSkills = team.existingSkills || [];
            const neededSkills = team.neededSkills || [];
            if (existingSkills.length === 0 && neededSkills.length === 0) return null;
            return (
              <Section title="Roster Skills & Fit">
                <div className="space-y-4 text-xs">
                  {existingSkills.length > 0 && (
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400 block mb-1">Existing Competencies</span>
                      <div className="flex flex-wrap gap-1">
                        {existingSkills.map(skill => (
                          <Badge key={skill} label={skill} type="tag" />
                        ))}
                      </div>
                    </div>
                  )}
                  {neededSkills.length > 0 && (
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--accent-app)] block mb-1">Actively Recruiting For</span>
                      <div className="flex flex-wrap gap-1">
                        {neededSkills.map(skill => (
                          <Badge key={skill} label={skill} type="discipline" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            );
          })()}

          <Section title="Linked Capstone Post">
            {team.project ? (
              <div className="space-y-3">
                <span className="text-[9px] font-mono uppercase tracking-wider text-stone-400 font-bold">Assigned Post</span>
                <Link href={`/projects/${team.project.id}`} className="block font-serif font-bold text-[var(--text-app)] hover:text-[var(--accent-app)] text-sm leading-snug uppercase tracking-tight">
                  {team.project.title}
                </Link>
                <p className="text-xs text-stone-500 font-sans line-clamp-2 leading-relaxed">{team.project.description}</p>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2 border border-dashed border-[var(--border-app)] p-4">
                <p className="text-xs text-stone-500 font-mono">No project claims associated.</p>
                <Link href="/projects" className="btn-secondary py-1 px-3 text-xs w-full block text-center">
                  Browse Open Postings
                </Link>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Join Request Custom Modal */}
      <Modal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} title={`Apply to Join: ${team.name}`}>
        <form onSubmit={requestJoinSubmit} className="space-y-4">
          <p className="text-xs text-stone-500 leading-relaxed font-sans">
            Specify introduction notes to the team lead explaining why your academic background and project tags align with their capstone objectives.
          </p>
          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Introduction Note</label>
            <textarea
              required
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              className="input-field min-h-28 text-xs leading-relaxed font-sans"
            />
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border-app)]">
            <button type="button" onClick={() => setIsJoinOpen(false)} className="btn-secondary py-2 text-xs" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary py-2 text-xs" disabled={submitting}>
              {submitting ? "Sending Request..." : "Submit Join Request"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
