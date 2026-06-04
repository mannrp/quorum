"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section, Status, Badge, Modal } from "@/components/ui";
import { getAuthToken, graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
import { TEAM_QUERY } from "@/lib/queries";
import type { Team, TeamMembership, TeamRole } from "@/types/domain";

type JoinRequest = {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    username: string;
    discipline: string;
  };
};

export default function TeamManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, loading, reload } = useGraphQL<{ team: Team | null }>(TEAM_QUERY, { id });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  
  // Search state for invitations
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<{ id: string; fullName: string; username: string }[]>([]);
  const [inviteMessage, setInviteMessage] = useState("We would like to invite you to join our capstone team.");
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  // Join Requests state
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionReqId, setActionReqId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"ACCEPT" | "REJECT" | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const team = data?.team;

  // Load team form fields
  useEffect(() => {
    if (team) {
      setName(team.name || "");
      setDescription(team.description || "");
      setDiscordUrl(team.discordLink || "");
      setDiscipline(team.discipline || "SOEN");
      setIsComplete(team.isComplete);
      
      const loadRequests = async () => {
        try {
          const token = getAuthToken();
          const res = await graphqlRequest<{ teamJoinRequests: JoinRequest[] }>(
            `query GetTeamJoinRequests($teamId: ID!) {
              teamJoinRequests(teamId: $teamId, status: PENDING) {
                id
                message
                status
                createdAt
                user {
                  id
                  fullName
                  username
                  discipline
                }
              }
            }`,
            { teamId: id },
            token
          );
          setRequests(res.teamJoinRequests || []);
        } catch (err) {
          console.error("Error loading join requests", err);
        }
      };
      void loadRequests();
    }
  }, [team, id]);

  // Search users for invite
  const handleInviteSearch = async () => {
    if (!inviteSearch.trim()) return;
    try {
      const token = getAuthToken();
      const res = await graphqlRequest<{ users: { id: string; fullName: string; username: string }[] }>(
        `query searchUsers($q: String) { users(search: $q) { id fullName username } }`,
        { q: inviteSearch },
        token
      );
      setInviteResults(res.users);
    } catch (err) {
      setInviteNotice(userFacingError(err));
      setInviteResults([]);
    }
  };

  // Trigger invite mutation
  const sendInvite = async (userId: string) => {
    setInviteNotice(null);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation InviteTeamMember($teamId: ID!, $userId: ID!, $message: String) {
          inviteTeamMember(teamId: $teamId, userId: $userId, message: $message) { id status expiresAt }
        }`,
        { teamId: id, userId, message: inviteMessage },
        token
      );
      setInviteNotice("Invitation sent.");
    } catch (err) {
      setInviteNotice(userFacingError(err));
    }
  };

  const handleUpdateTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setSaving(true);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation UpdateTeamDetails($id: ID!, $input: UpdateTeamInput!) { updateTeam(id: $id, input: $input) { id } }`,
        {
          id,
          input: {
            name,
            description,
            isComplete,
            discipline,
            maxSize: team?.maxSize || 4,
            recruitingState: isComplete ? "PAUSED" : "RECRUITING",
            visibility: team?.visibility || "VISIBLE",
            discordLink: discordUrl || null,
            existingSkills: team?.existingSkills || [],
            neededSkills: team?.neededSkills || [],
            projectInterests: team?.projectInterests || []
          }
        },
        token
      );
      setNotice("Team specifications successfully updated.");
      await reload();
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAction = (reqId: string, type: "ACCEPT" | "REJECT") => {
    setActionReqId(reqId);
    setActionType(type);
    setIsConfirmOpen(true);
  };

  const executeRequestAction = async () => {
    if (!actionReqId || !actionType) return;
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation RespondRequest($requestId: ID!, $accept: Boolean!) {
          respondToJoinRequest(requestId: $requestId, accept: $accept) { id status }
        }`,
        { requestId: actionReqId, accept: actionType === "ACCEPT" },
        token
      );
      setRequests((prev) => prev.filter((r) => r.id !== actionReqId));
      setNotice(`Request ${actionType === "ACCEPT" ? "approved" : "declined"}.`);
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setIsConfirmOpen(false);
    }
  };

  const removeMember = (userId: string, userName: string) => {
    setMemberToRemove({ id: userId, name: userName });
  };

  const executeRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation RemoveMem($teamId: ID!, $userId: ID!) { removeMember(teamId: $teamId, userId: $userId) }`,
        { teamId: id, userId: memberToRemove.id },
        token
      );
      setNotice("Member removed.");
      await reload();
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setMemberToRemove(null);
    }
  };

  if (loading) {
    return <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Loading settings...</p></Section>;
  }

  if (error || !team) {
    return <Section title="Error"><p className="text-xs text-stone-400">Team not found.</p></Section>;
  }

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 space-y-6">
      <div className="border-b border-[var(--border-app)] pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Manage Team</h1>
          <p className="text-sm text-stone-500 font-sans">Edit details, review recruitment requests, and invite team members.</p>
        </div>
        <Link href={`/teams/${id}`} className="btn-secondary py-1.5 px-3 text-xs">View Public Page</Link>
      </div>

      {notice && (
        <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success)] rounded-none text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-success)]">
          {notice}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left main forms */}
        <div className="md:col-span-2 space-y-6">
          
          <form onSubmit={handleUpdateTeam}>
            <Section title="Edit Specifications">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Team Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Discipline</label>
                  <input required value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Discord URL</label>
                  <input type="url" value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} className="input-field text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400 block">Recruitment Status</label>
                  <select
                    value={isComplete ? "COMPLETE" : "RECRUITING"}
                    onChange={(e) => setIsComplete(e.target.value === "COMPLETE")}
                    className="input-field py-2 text-xs bg-[var(--surface-app)] font-mono"
                  >
                    <option value="RECRUITING">Recruiting (Open slots)</option>
                    <option value="COMPLETE">Complete (Recruitment paused)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1 pt-2">
                <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Description</label>
                <textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-20 text-xs font-sans" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-xs mt-2 w-full">
                {saving ? "Saving Changes..." : "Commit Settings"}
              </button>
            </Section>
          </form>

          {/* Join Requests Roster */}
          <Section title="Recruitment Join Requests">
            {requests.length > 0 ? (
              <div className="space-y-4 divide-y divide-[var(--border-subtle)]">
                {requests.map((req) => (
                  <div key={req.id} className="pt-4 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[var(--text-app)] text-sm uppercase font-serif tracking-tight">{req.user.fullName}</span>
                        <p className="text-[10px] text-stone-500 font-mono uppercase tracking-wider">@{req.user.username} • {req.user.discipline} • {req.createdAt}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleRequestAction(req.id, "ACCEPT")} className="btn-primary py-1 px-3 text-[10px]">Accept</button>
                        <button onClick={() => handleRequestAction(req.id, "REJECT")} className="btn-secondary py-1 px-3 text-[10px] text-rose-500 border-rose-300 dark:border-rose-900">Decline</button>
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 bg-[var(--bg-app)] p-3 border border-[var(--border-subtle)] rounded-none font-mono italic">&quot;{req.message}&quot;</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 font-mono italic">No pending recruitment requests.</p>
            )}
          </Section>
        </div>

        {/* Right sidebars */}
        <div className="space-y-6">
          {/* Invite user */}
          <Section title="Invite New Member" variant="tall">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Student name..."
                  className="input-field py-1 px-2 text-xs flex-1"
                />
                <button type="button" onClick={handleInviteSearch} className="btn-primary py-1 px-3 text-xs">Search</button>
              </div>
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Invitation message..."
                className="input-field min-h-16 py-2 px-2 text-xs"
              />

              {inviteNotice && <p className="text-xs text-emerald-600 font-mono font-bold uppercase tracking-wider">{inviteNotice}</p>}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {inviteResults.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 border border-[var(--border-subtle)] rounded-none bg-[var(--bg-app)]">
                    <div>
                      <p className="text-xs font-bold text-[var(--text-app)]">{r.fullName}</p>
                      <p className="text-[9px] font-mono text-stone-400">@{r.username}</p>
                    </div>
                    <button type="button" onClick={() => sendInvite(r.id)} className="btn-primary py-1 px-2 text-[9px]">Invite</button>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Member controls */}
          <Section title="Roster Controls" variant="tall">
            <div className="space-y-3">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 border border-[var(--border-subtle)] rounded-none bg-[var(--surface-app)]">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-app)]">{m.user.fullName}</span>
                    <p className="text-[9px] font-mono text-stone-400 uppercase tracking-wider">{m.role}</p>
                  </div>
                  {m.role !== "LEAD" && (
                    <button type="button" onClick={() => removeMember(m.user.id, m.user.fullName)} className="text-[10px] text-rose-500 font-mono font-bold hover:underline">Remove</button>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="Process Join Request">
        <div className="space-y-4">
          <p className="text-xs text-stone-650 dark:text-stone-300 font-sans">
            Confirm decision to {actionType === "ACCEPT" ? "approve" : "decline"} this candidate.
          </p>
          <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border-subtle)]">
            <button onClick={() => setIsConfirmOpen(false)} className="btn-secondary py-1 px-3 text-xs">Cancel</button>
            <button onClick={executeRequestAction} className="btn-primary py-1 px-3 text-xs">Confirm</button>
          </div>
        </div>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal isOpen={!!memberToRemove} onClose={() => setMemberToRemove(null)} title="Remove Team Member">
        {memberToRemove && (
          <div className="space-y-4">
            <p className="text-xs text-stone-650 dark:text-stone-300 font-sans">
              Are you sure you want to remove <strong>{memberToRemove.name}</strong> from the team?
            </p>
            <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border-subtle)]">
              <button onClick={() => setMemberToRemove(null)} className="btn-secondary py-1 px-3 text-xs">Cancel</button>
              <button onClick={executeRemoveMember} className="btn-primary bg-rose-650 hover:bg-rose-700 py-1 px-3 text-xs border-transparent">Remove Member</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
