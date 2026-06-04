"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section, Status, Badge } from "@/components/ui";
import { DeadlineDisplay } from "@/components/deadline-display";
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

type DashboardJoinRequest = {
  id: string;
  status: string;
  message?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  team: { id: string; name: string };
};

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
  const [teamApps, setTeamApps] = useState<ProjectApplication[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<DashboardInvitation[]>([]);
  const [myRequests, setMyRequests] = useState<DashboardJoinRequest[]>([]);
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

      const requestsResult = await graphqlRequest<{ myJoinRequests: DashboardJoinRequest[] }>(
        `query GetMyJoinRequests($status: JoinRequestStatus) {
          myJoinRequests(status: $status) {
            id
            status
            message
            expiresAt
            createdAt
            team {
              id
              name
            }
          }
        }`,
        { status: "ACCEPTED_PENDING_CONFIRMATION" },
        token
      );
      setMyRequests(requestsResult.myJoinRequests || []);

      // Fetch all projects to filter team's applications
      const projectsRes = await graphqlRequest<{ projects: Project[] }>(
        `query GetProjectsWithApplications {
          projects {
            id
            title
            summary
            description
            status
            lifecycleState
            owner {
              id
              fullName
              username
            }
            applications {
              id
              status
              message
              answers
              reviewMessage
              offerMessage
              expiresAt
              teamConfirmedAt
              ownerConfirmedAt
              withdrawnAt
              createdAt
              team {
                id
                name
              }
            }
          }
        }`,
        {},
        token
      );

      if (primaryTeam && projectsRes.projects) {
        const filteredApps: ProjectApplication[] = [];
        for (const p of projectsRes.projects) {
          if (p.applications) {
            for (const app of p.applications) {
              if (app.team && app.team.id === primaryTeam.id) {
                filteredApps.push({
                  ...app,
                  project: p
                });
              }
            }
          }
        }
        setTeamApps(filteredApps);
      } else {
        setTeamApps([]);
      }

    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleConfirmJoinRequest = async (requestId: string) => {
    if (!window.confirm("Are you sure you want to confirm joining this team?")) {
      return;
    }
    setNotice(null);
    setError(null);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation ConfirmJoinRequest($requestId: ID!) {
          confirmJoinRequest(requestId: $requestId) {
            id
            status
          }
        }`,
        { requestId },
        token
      );
      setNotice("You have successfully confirmed your membership on the team!");
      await fetchDashboardData();
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const handleConfirmOffer = async (applicationId: string) => {
    if (!window.confirm("Are you sure you want to confirm this project offer? Doing so indicates your team's agreement to match with this project.")) {
      return;
    }
    setNotice(null);
    setError(null);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation ConfirmOffer($applicationId: ID!) {
          confirmProjectOfferByTeam(applicationId: $applicationId) {
            id
            status
            teamConfirmedAt
          }
        }`,
        { applicationId },
        token
      );
      setNotice("Offer confirmed by your team! Waiting for the project owner's final match confirmation.");
      await fetchDashboardData();
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const handleWithdrawApplication = async (applicationId: string) => {
    if (!window.confirm("Are you sure you want to withdraw this project application?")) {
      return;
    }
    setNotice(null);
    setError(null);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation WithdrawApp($applicationId: ID!) {
          withdrawApplication(applicationId: $applicationId) {
            id
            status
            withdrawnAt
          }
        }`,
        { applicationId },
        token
      );
      setNotice("Application successfully withdrawn.");
      await fetchDashboardData();
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const deadlineDate = deadline ? new Date(deadline.deadlineAt) : null;
  const myRoleOnTeam = team?.members.find((m) => m.user.id === me?.id)?.role;
  const isLeadOrCoLead = myRoleOnTeam === "LEAD" || myRoleOnTeam === "CO_LEAD";

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
            {deadline ? (
              <DeadlineDisplay
                deadlineAt={deadline.deadlineAt}
                label="Universal Match Deadline"
                consequenceText="All matching confirmations must occur before this timestamp."
              />
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
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-stone-900 dark:text-slate-100">{inv.team.name}</span>
                      </div>
                      <p className="text-[10px] text-stone-500">Invited by {inv.invitedBy.fullName} - &quot;{inv.message || "No message"}&quot;</p>
                      <DeadlineDisplay deadlineAt={inv.expiresAt} label="Invitation Expiration" />
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

          {/* Accepted Join Requests */}
          <Section title="Accepted Join Requests" variant="tall">
            {myRequests.length > 0 ? (
              <div className="space-y-3">
                {myRequests.map((req) => (
                  <div key={req.id} className="p-3 border border-amber-250 dark:border-amber-900 rounded-lg space-y-2.5 bg-amber-50/50 dark:bg-amber-950/15">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-stone-900 dark:text-slate-100">{req.team.name}</span>
                      </div>
                      <p className="text-[10px] text-stone-500">Your request to join this team was accepted. Please confirm your membership.</p>
                      {req.expiresAt && (
                        <DeadlineDisplay deadlineAt={req.expiresAt} label="Confirmation Expiration" />
                      )}
                    </div>
                    <button className="btn-primary py-1.5 px-3 text-[9px] w-full" onClick={() => handleConfirmJoinRequest(req.id)}>
                      Confirm Membership
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic">No accepted join requests pending confirmation.</p>
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

                {/* Team Applications & Offers Sub-section */}
                <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">Project Applications & Offers</h4>
                  {teamApps.length > 0 ? (
                    <div className="space-y-3">
                      {teamApps.map((app) => {
                        const hasOffer = app.status === "OFFER_SENT";
                        const isLeadOrCoLead = myRoleOnTeam === "LEAD" || myRoleOnTeam === "CO_LEAD";
                        return (
                          <div key={app.id} className={`p-3 border rounded-lg space-y-2.5 ${hasOffer ? "bg-amber-50/50 dark:bg-amber-950/15 border-amber-250 dark:border-amber-900" : "bg-white dark:bg-[#161a2b] border-stone-250 dark:border-stone-850"}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="text-xs font-bold text-stone-900 dark:text-slate-100">{app.project?.title}</h5>
                                <p className="text-[10px] text-stone-500">Sponsored by {app.project?.owner.fullName}</p>
                              </div>
                              <Status value={app.status} />
                            </div>

                            {hasOffer && app.offerMessage && (
                              <div className="text-xs text-stone-700 dark:text-slate-350 bg-amber-50/20 dark:bg-amber-950/10 p-2.5 rounded border border-amber-200/40 dark:border-amber-900/30 italic">
                                &quot;{app.offerMessage}&quot;
                              </div>
                            )}

                            <div className="space-y-1">
                              <div className="text-[10px] text-stone-400">
                                Applied: {new Date(app.createdAt).toLocaleDateString()}
                              </div>
                              {app.expiresAt && (
                                <DeadlineDisplay deadlineAt={app.expiresAt} label="Offer Match Window" />
                              )}
                            </div>

                            <div className="flex gap-2">
                              {hasOffer && (
                                <button
                                  onClick={() => handleConfirmOffer(app.id)}
                                  disabled={!isLeadOrCoLead}
                                  className="btn-primary py-1 px-3 text-[10px]"
                                  title={!isLeadOrCoLead ? "Only Team Leads/Co-Leads can confirm offers" : ""}
                                >
                                  Confirm Offer
                                </button>
                              )}
                              {app.status === "PENDING" && (
                                <button
                                  onClick={() => handleWithdrawApplication(app.id)}
                                  disabled={!isLeadOrCoLead}
                                  className="btn-secondary text-rose-500 border-rose-200/40 dark:border-rose-950/40 py-1 px-3 text-[10px]"
                                  title={!isLeadOrCoLead ? "Only Team Leads/Co-Leads can withdraw applications" : ""}
                                >
                                  Withdraw
                                </button>
                              )}
                              <Link href={`/inbox?userId=${app.project?.owner.id}`} className="btn-secondary py-1 px-3 text-[10px] flex items-center gap-1">
                                Message Owner
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 italic">No project applications submitted yet.</p>
                  )}
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

