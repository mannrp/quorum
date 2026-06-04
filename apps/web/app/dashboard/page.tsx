"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section, Status, Badge } from "@/components/ui";
import { getAuthToken, graphqlRequest, userFacingError } from "@/lib/graphql";
import { DASHBOARD_CONTEXT_QUERY, ME_QUERY } from "@/lib/queries";
import type { User, Team, Project, ProjectApplication, Notification } from "@/types/domain";

type DashboardInvitation = {
  id: string;
  status: string;
  message?: string | null;
  expiresAt: string;
  createdAt: string;
  team: { id: string; name: string; createdBy: { id: string; username: string; fullName: string } };
  invitedBy: { id: string; username: string; fullName: string };
};

type Deadline = { id: string; deadlineAt: string; updatedAt: string };

function getRemainingTimeText(expiresAtStr: string): string {
  const expiresAt = new Date(expiresAtStr);
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `${diffDays}d remaining`;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours > 0) return `${diffHours}h remaining`;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  return `${diffMins}m remaining`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<DashboardInvitation[]>([]);
  const [deadline, setDeadline] = useState<Deadline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      setError(null);
      // 1. Fetch me info
      const meResult = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, token);
      if (!meResult.me) {
        router.push("/auth/login");
        return;
      }
      setMe(meResult.me);

      const dashboardResult = await graphqlRequest<{
        dashboardContext: {
          myTeams: Team[];
          myProjects: Project[];
          myInvitations: DashboardInvitation[];
          universalDeadline: Deadline | null;
        };
        myNotifications: Notification[];
      }>(DASHBOARD_CONTEXT_QUERY, {}, token);

      const primaryTeam = dashboardResult.dashboardContext.myTeams[0] || null;
      const primaryProject = dashboardResult.dashboardContext.myProjects[0] || null;
      setTeam(primaryTeam);
      setProject(primaryProject);
      setApplications(primaryProject?.applications || []);
      setInvitations(dashboardResult.dashboardContext.myInvitations);
      setDeadline(dashboardResult.dashboardContext.universalDeadline);
      setNotifs(dashboardResult.myNotifications.slice(0, 3));

    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, [router]);

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    const action = accept ? "accept" : "decline";
    if (!window.confirm(`Are you sure you want to ${action} this team invitation?`)) {
      return;
    }
    
    setNotice(null);
    setError(null);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation RespondInvitation($invitationId: ID!, $accept: Boolean!) {
          respondToTeamInvitation(invitationId: $invitationId, accept: $accept) {
            id
            status
          }
        }`,
        { invitationId, accept },
        token
      );
      setNotice(`Invitation successfully ${accept ? "accepted" : "declined"}.`);
      await fetchDashboardData();
    } catch (err) {
      const msg = userFacingError(err);
      if (accept && msg.toLowerCase().includes("already")) {
        setError(`Failed to accept: You are already on a team. If you wish to join, please leave your current team first.`);
      } else {
        setError(msg);
      }
    }
  };

  const deadlineDate = deadline ? new Date(deadline.deadlineAt) : null;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <Section title="Dashboard Portal Loading">
          <p className="text-xs text-stone-500 animate-pulse uppercase tracking-wider">Syncing workspace databases...</p>
        </Section>
      </div>
    );
  }

  if (error && invitations.length === 0 && !me) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <Section title="Dashboard Unavailable">
          <p className="text-xs text-rose-500 font-bold">{error}</p>
          <div className="pt-4 flex gap-2">
            <Link href="/auth/login" className="btn-primary py-2 px-4 text-xs">Sign In Again</Link>
            <button onClick={() => window.location.reload()} className="btn-secondary py-2 px-4 text-xs">Retry</button>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 max-w-5xl mx-auto">
      {/* Welcome Banner */}
      <div className="panel-wide bg-white dark:bg-[#161a2b] p-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#283593] dark:text-[#a5b4fc]">
              [-] Academics Console
            </span>
            <h1 className="text-2xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc] tracking-tight">
              Welcome Back, {me?.fullName}
            </h1>
            <p className="text-xs text-stone-500">@{me?.username} • Concordia University • {me?.discipline || "SOEN"}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/profile" className="btn-secondary py-2 px-3.5 text-xs">Edit Settings</Link>
          </div>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 rounded text-xs font-semibold text-emerald-800 dark:text-emerald-350">
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-900 rounded text-xs font-semibold text-rose-800 dark:text-rose-350">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Alerts, Invites, and Profile */}
        <div className="space-y-6 md:col-span-1">
          {/* Deadlines */}
          <Section title="Academic Deadlines" variant="tall">
            {deadlineDate ? (
              <div className="p-3 border border-stone-250 dark:border-stone-850 rounded-lg space-y-1 bg-[#f8f9fa] dark:bg-[#111422]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 dark:text-slate-200">Universal Match Deadline</span>
                  {deadlineDate.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 7 && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-500">
                  <span>{deadlineDate.toLocaleDateString()}</span>
                  <span className="text-stone-400">Updated {new Date(deadline!.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic">No universal deadline configured.</p>
            )}
          </Section>

          {/* Pending Invitations */}
          <Section title="Team Invitations" variant="tall">
            {invitations.length > 0 ? (
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3 border border-stone-250 dark:border-stone-850 rounded-lg space-y-2.5 bg-white dark:bg-[#161a2b]">
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-stone-800 dark:text-slate-200">{inv.team.name}</span>
                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">
                          {getRemainingTimeText(inv.expiresAt)}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-500">Invited by {inv.invitedBy.fullName} - &quot;{inv.message || "No message"}&quot;</p>
                      <p className="text-[9px] text-stone-400">Expires: {new Date(inv.expiresAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary py-1 px-3 text-[9px] w-full" onClick={() => respondToInvitation(inv.id, true)}>Accept</button>
                      <button className="btn-secondary py-1 px-3 text-[9px] w-full text-rose-500 border-rose-200/40 dark:border-rose-950/40" onClick={() => respondToInvitation(inv.id, false)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic">No pending team invitations.</p>
            )}
          </Section>
        </div>

        {/* Center / Right Columns: Teams and Project Postings */}
        <div className="space-y-6 md:col-span-2">
          {/* My Team Section */}
          <Section title="My Capstone Team">
            {team ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Link href={`/teams/${team.id}`} className="text-lg font-bold text-stone-900 dark:text-indigo-300 hover:underline">
                      {team.name}
                    </Link>
                    <p className="text-xs text-stone-500 line-clamp-2">{team.description}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Status value={team.isComplete ? "COMPLETE" : "RECRUITING"} />
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{team.members.length}/{team.maxSize} Members</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Roster Preview:</span>
                    <div className="flex -space-x-2">
                      {team.members.slice(0, 3).map((m) => (
                        <div key={m.id} title={m.user.fullName} className="h-6 w-6 rounded-full bg-indigo-50 border border-stone-300 dark:border-stone-850 flex items-center justify-center text-[10px] font-bold text-[#283593] uppercase">
                          {m.user.fullName.charAt(0)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Link href={`/teams/${team.id}/manage`} className="btn-secondary py-1.5 px-3 text-xs">
                    Manage Roster & Settings
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-xs text-stone-500">You are not currently associated with a capstone team.</p>
                <div className="flex gap-2 justify-center">
                  <Link href="/teams/new" className="btn-primary py-2 px-4 text-xs">Create a Team</Link>
                  <Link href="/teams" className="btn-secondary py-2 px-4 text-xs">Join Existing Group</Link>
                </div>
              </div>
            )}
          </Section>

          {/* Project Sponsor Section (If Project Owner) */}
          {project ? (
            <Section title="My Sponsored Project Dashboard">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Link href={`/projects/${project.id}`} className="text-lg font-bold text-stone-900 dark:text-indigo-300 hover:underline">
                      {project.title}
                    </Link>
                    <p className="text-xs text-stone-500 line-clamp-2">{project.description}</p>
                  </div>
                  <Status value={project.status} />
                </div>

                <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <span className="text-xs text-stone-500">
                    Received <strong className="text-indigo-600 dark:text-indigo-450">{applications.length}</strong> capstone applications.
                  </span>
                  <div className="flex gap-2">
                    <Link href={`/projects/${project.id}/edit`} className="btn-secondary py-1.5 px-3 text-xs">Edit Post</Link>
                    <Link href={`/projects/${project.id}/applications`} className="btn-primary py-1.5 px-3 text-xs">Review Applications</Link>
                  </div>
                </div>
              </div>
            </Section>
          ) : me && (me.email?.includes("owner") || me.username.includes("owner")) ? (
            <Section title="Project Sponsor Account">
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-stone-500">You have project owner intent but haven&apos;t submitted a capstone challenge yet.</p>
                <Link href="/projects/new" className="btn-primary py-2 px-4 text-xs inline-block">Sponsor New Project</Link>
              </div>
            </Section>
          ) : null}

          {/* Recent Notifications preview */}
          <Section title="Recent Activity">
            {notifs.length > 0 ? (
              <div className="space-y-2">
                {notifs.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg border border-stone-200 dark:border-stone-850 flex items-center justify-between bg-white dark:bg-[#161a2b]">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700">!</div>
                      <span className="text-xs text-stone-700 dark:text-slate-350">{n.type === "MESSAGE" ? "New message received." : n.type === "APPLICATION" ? "New project application update." : "Capstone workflow update."}</span>
                    </div>
                    <Link href="/notifications" className="text-[10px] font-bold uppercase text-[#283593] hover:underline">View</Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic">No recent updates.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

