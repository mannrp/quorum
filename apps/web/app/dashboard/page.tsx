"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog, Section, Status } from "@/components/ui";
import { DeadlineDisplay } from "@/components/deadline-display";
import { graphqlRequest, userFacingError } from "@/lib/graphql";
import { AUTH_STATE_QUERY, DASHBOARD_CONTEXT_QUERY } from "@/lib/queries";
import type { AuthState, User, Team, Project, ProjectApplication, Notification } from "@/types/domain";

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

type ConfirmAction = {
  title: string;
  message: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  onConfirm: () => Promise<void>;
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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const authResult = await graphqlRequest<{ authState: AuthState }>(AUTH_STATE_QUERY, {}, { auth: true });
      if (!authResult.authState.authenticated) {
        router.push("/auth/login");
        return;
      }
      if (!authResult.authState.profile || !authResult.authState.profileComplete) {
        router.push("/onboarding");
        return;
      }
      setMe(authResult.authState.profile);

      const [dashboardResult, requestsResult, projectsRes] = await Promise.all([
        graphqlRequest<{
        dashboardContext: {
          myTeams: Team[];
          myProjects: Project[];
          myInvitations: DashboardInvitation[];
          universalDeadline: Deadline | null;
        };
        myNotifications: Notification[];
      }>(DASHBOARD_CONTEXT_QUERY, {}, { auth: true }),
        graphqlRequest<{ myJoinRequests: DashboardJoinRequest[] }>(
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
          { auth: true }
        ),
        graphqlRequest<{ projects: Project[] }>(
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
          { auth: true }
        )
      ]);

      const primaryTeam = dashboardResult.dashboardContext.myTeams[0] || null;
      const primaryProject = dashboardResult.dashboardContext.myProjects[0] || null;
      setTeam(primaryTeam);
      setProject(primaryProject);
      setApplications(primaryProject?.applications || []);
      setInvitations(dashboardResult.dashboardContext.myInvitations);
      setDeadline(dashboardResult.dashboardContext.universalDeadline);
      setNotifs(dashboardResult.myNotifications.slice(0, 3));

      setMyRequests(requestsResult.myJoinRequests || []);

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

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setConfirming(true);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } finally {
      setConfirming(false);
    }
  };

  const respondToInvitation = (invitationId: string, accept: boolean) => {
    const action = accept ? "accept" : "decline";
    setConfirmAction({
      title: `${accept ? "Accept" : "Decline"} Team Invitation`,
      message: `Are you sure you want to ${action} this team invitation?`,
      confirmLabel: accept ? "Accept Invitation" : "Decline Invitation",
      variant: accept ? "primary" : "danger",
      onConfirm: async () => {
        setNotice(null);
        setError(null);
        try {
          await graphqlRequest(
            `mutation RespondInvitation($invitationId: ID!, $accept: Boolean!) {
              respondToTeamInvitation(invitationId: $invitationId, accept: $accept) {
                id
                status
              }
            }`,
            { invitationId, accept },
            { auth: true }
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
      }
    });
  };

  const handleConfirmJoinRequest = (requestId: string) => {
    setConfirmAction({
      title: "Confirm Team Membership",
      message: "Are you sure you want to confirm joining this team?",
      confirmLabel: "Confirm Membership",
      onConfirm: async () => {
        setNotice(null);
        setError(null);
        try {
          await graphqlRequest(
            `mutation ConfirmJoinRequest($requestId: ID!) {
              confirmJoinRequest(requestId: $requestId) {
                id
                status
              }
            }`,
            { requestId },
            { auth: true }
          );
          setNotice("You have successfully confirmed your membership on the team!");
          await fetchDashboardData();
        } catch (err) {
          setError(userFacingError(err));
        }
      }
    });
  };

  const handleConfirmOffer = (applicationId: string) => {
    setConfirmAction({
      title: "Confirm Project Offer",
      message: "Confirming indicates your team's agreement to match with this project.",
      confirmLabel: "Confirm Offer",
      onConfirm: async () => {
        setNotice(null);
        setError(null);
        try {
          await graphqlRequest(
            `mutation ConfirmOffer($applicationId: ID!) {
              confirmProjectOfferByTeam(applicationId: $applicationId) {
                id
                status
                teamConfirmedAt
              }
            }`,
            { applicationId },
            { auth: true }
          );
          setNotice("Offer confirmed by your team! Waiting for the project owner's final match confirmation.");
          await fetchDashboardData();
        } catch (err) {
          setError(userFacingError(err));
        }
      }
    });
  };

  const handleWithdrawApplication = (applicationId: string) => {
    setConfirmAction({
      title: "Withdraw Application",
      message: "Are you sure you want to withdraw this project application?",
      confirmLabel: "Withdraw Application",
      variant: "danger",
      onConfirm: async () => {
        setNotice(null);
        setError(null);
        try {
          await graphqlRequest(
            `mutation WithdrawApp($applicationId: ID!) {
              withdrawApplication(applicationId: $applicationId) {
                id
                status
                withdrawnAt
              }
            }`,
            { applicationId },
            { auth: true }
          );
          setNotice("Application successfully withdrawn.");
          await fetchDashboardData();
        } catch (err) {
          setError(userFacingError(err));
        }
      }
    });
  };

  const myRoleOnTeam = team?.members.find((m) => m.user.id === me?.id)?.role;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <Section title="Dashboard Portal Loading">
          <p className="text-xs text-stone-500 font-mono animate-pulse uppercase tracking-widest">Syncing workspace databases...</p>
        </Section>
      </div>
    );
  }

  if (error && invitations.length === 0 && !me) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <Section title="Dashboard Unavailable">
          <p className="text-xs text-rose-500 font-mono font-bold uppercase tracking-wider">{error}</p>
          <div className="pt-4 flex gap-2">
            <Link href="/auth/login" className="btn-primary py-2 px-4 text-xs">Sign In Again</Link>
            <button onClick={() => window.location.reload()} className="btn-secondary py-2 px-4 text-xs">Retry</button>
          </div>
        </Section>
      </div>
    );
  }

  const teamApplicationCount = teamApps.length;
  const pendingOfferCount = teamApps.filter((app) => app.status === "OFFER_SENT").length;
  const memberCount = team?.members.length || 0;
  const maxMembers = team?.maxSize || 0;

  return (
    <div className="dashboard-stage space-y-8 py-4 max-w-6xl mx-auto px-4">
      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmedAction()}
        title={confirmAction?.title || "Confirm Action"}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        variant={confirmAction?.variant || "primary"}
        disabled={confirming}
      />
      <section className="dashboard-hero">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-bold text-[var(--accent-app)]">
              <span className="activity-dot" />
              Workspace
            </div>
            <div className="space-y-2">
              <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-normal text-[var(--text-app)] md:text-5xl">
                Good to see you, {me?.fullName?.split(" ")[0] || me?.username}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[var(--muted-app)]">
                A focused view of your team, applications, offers, and deadline-sensitive work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-[var(--muted-app)]">
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1">@{me?.username}</span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1">Concordia University</span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1">{me?.discipline || "SOEN"}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="metric-tile">
              <p className="text-[10px] font-semibold text-[var(--muted-app)]">Team seats</p>
              <p className="mt-2 text-3xl font-bold text-[var(--text-app)]">{memberCount}/{maxMembers || "-"}</p>
            </div>
            <div className="metric-tile">
              <p className="text-[10px] font-semibold text-[var(--muted-app)]">Applications</p>
              <p className="mt-2 text-3xl font-bold text-[var(--text-app)]">{teamApplicationCount}</p>
            </div>
            <div className="metric-tile">
              <p className="text-[10px] font-semibold text-[var(--muted-app)]">Offers</p>
              <p className="mt-2 text-3xl font-bold text-[var(--text-app)]">{pendingOfferCount}</p>
            </div>
          </div>
        </div>
      </section>
      {/* Welcome Banner */}
      {false && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[var(--accent-app)]">
              [-] Academics Console
            </span>
            <h1 className="text-2xl font-bold font-serif text-[var(--text-app)] tracking-tight uppercase">
              Welcome Back, {me?.fullName}
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
              @{me?.username} • Concordia University • {me?.discipline || "SOEN"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/profile" className="btn-secondary py-2 px-3.5 text-xs">Edit Settings</Link>
          </div>
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success-bg)] p-3 text-xs font-bold uppercase tracking-wider text-[var(--color-success)]">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3 text-xs font-bold uppercase tracking-wider text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.7fr]">
        {/* Left Column: Alerts, Invites, and Profile */}
        <div className="space-y-5">
          {/* Deadlines */}
          <Section title="Academic Deadlines" variant="tall">
            {deadline ? (
              <DeadlineDisplay
                deadlineAt={deadline.deadlineAt}
                label="Universal Match Deadline"
                consequenceText="All matching confirmations must occur before this timestamp."
              />
            ) : (
              <p className="text-xs text-stone-500 font-mono italic">No universal deadline configured.</p>
            )}
          </Section>

          {/* Pending Invitations */}
          <Section title="Team Invitations" variant="tall">
            {invitations.length > 0 ? (
              <div className="stagger-in space-y-3">
                {invitations.map((inv) => (
                  <div key={inv.id} className="signal-card space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="font-serif text-lg font-bold text-[var(--text-app)]">{inv.team.name}</span>
                      </div>
                      <p className="text-xs leading-5 text-[var(--muted-app)]">
                        Invited by <strong className="text-[var(--text-app)]">{inv.invitedBy.fullName}</strong>: &quot;{inv.message || "No message"}&quot;
                      </p>
                      <DeadlineDisplay deadlineAt={inv.expiresAt} label="Expiration" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button className="btn-primary py-1 px-3 text-[9px] w-full" onClick={() => respondToInvitation(inv.id, true)}>Accept</button>
                      <button className="btn-secondary py-1 px-3 text-[9px] w-full text-rose-500 border-rose-300 dark:border-rose-900" onClick={() => respondToInvitation(inv.id, false)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-app)]">No pending team invitations.</p>
            )}
          </Section>

          {/* Accepted Join Requests */}
          <Section title="Accepted Join Requests" variant="tall">
            {myRequests.length > 0 ? (
              <div className="stagger-in space-y-3">
                {myRequests.map((req) => (
                  <div key={req.id} className="signal-card space-y-3 border-[var(--color-warning)] bg-[var(--color-warning-bg)]">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="font-serif text-lg font-bold text-[var(--text-app)]">{req.team.name}</span>
                      </div>
                      <p className="text-xs leading-5 text-[var(--muted-app)]">
                        Your request to join this team was accepted. Please confirm your membership.
                      </p>
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
              <p className="text-xs text-[var(--muted-app)]">No accepted join requests.</p>
            )}
          </Section>
        </div>

        {/* Center / Right Columns: Teams and Project Postings */}
        <div className="space-y-5">
          {/* My Team Section */}
          <Section title="My Capstone Team">
            {team ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <Link href={`/teams/${team.id}`} className="subtle-link font-serif text-3xl font-black leading-tight text-[var(--text-app)] hover:text-[var(--accent-app)]">
                      {team.name}
                    </Link>
                    <p className="max-w-xl text-sm leading-6 text-[var(--muted-app)]">{team.description}</p>
                  </div>
                  <div className="flex flex-row items-center gap-2 md:flex-col md:items-end">
                    <Status value={team.isComplete ? "COMPLETE" : "RECRUITING"} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-app)]">
                      {team.members.length}/{team.maxSize} Members
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-app)]">Roster</span>
                    <div className="flex -space-x-2">
                      {team.members.slice(0, 4).map((m) => (
                        <div key={m.id} title={m.user.fullName} className="avatar-chip">
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
                <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-app)]">Project Applications & Offers</h4>
                  {teamApps.length > 0 ? (
                    <div className="stagger-in space-y-3">
                      {teamApps.map((app) => {
                        const hasOffer = app.status === "OFFER_SENT";
                        const isLeadOrCoLead = myRoleOnTeam === "LEAD" || myRoleOnTeam === "CO_LEAD";
                        return (
                          <div key={app.id} className={`signal-card space-y-3 ${hasOffer ? "border-[var(--color-warning)] bg-[var(--color-warning-bg)]" : ""}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-serif text-lg font-bold text-[var(--text-app)]">{app.project?.title}</h5>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-app)]">Sponsored by {app.project?.owner.fullName}</p>
                              </div>
                              <Status value={app.status} />
                            </div>

                            {hasOffer && app.offerMessage && (
                              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3 text-xs italic text-[var(--text-app)]">
                                &quot;{app.offerMessage}&quot;
                              </div>
                            )}

                            <div className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-app)]">
                              <div>
                                Applied: {new Date(app.createdAt).toLocaleDateString()}
                              </div>
                              {app.expiresAt && (
                                <DeadlineDisplay deadlineAt={app.expiresAt} label="Offer Match Window" />
                              )}
                            </div>

                            <div className="flex gap-2 pt-1">
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
                                  className="btn-secondary text-rose-500 border-rose-300 dark:border-rose-900 py-1 px-3 text-[10px]"
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
                    <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
                      <p className="text-sm text-[var(--muted-app)]">No project applications submitted yet.</p>
                      <Link href="/projects" className="subtle-link mt-3 text-xs uppercase tracking-wider">Browse projects</Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-app)] bg-[var(--surface-raised)] p-8 text-center space-y-4">
                <p className="text-sm text-[var(--muted-app)]">You are not currently associated with a capstone team.</p>
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
                    <Link href={`/projects/${project.id}`} className="text-lg font-bold text-[var(--text-app)] hover:text-[var(--accent-app)] font-serif uppercase tracking-tight">
                      {project.title}
                    </Link>
                    <p className="text-xs text-stone-500 font-sans line-clamp-2">{project.description}</p>
                  </div>
                  <Status value={project.status} />
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-xs text-stone-500 font-mono">
                    Received <strong className="text-[var(--accent-app)]">{applications.length}</strong> capstone applications.
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
              <div className="text-center py-8 border border-dashed border-[var(--border-app)] p-6 space-y-3">
                <p className="text-xs text-stone-500 font-mono">You have project owner intent but haven&apos;t submitted a capstone challenge yet.</p>
                <Link href="/projects/new" className="btn-primary py-2 px-4 text-xs inline-block">Sponsor New Project</Link>
              </div>
            </Section>
          ) : null}

          {/* Recent Notifications preview */}
          <Section title="Recent Activity">
            {notifs.length > 0 ? (
              <div className="space-y-2">
                {notifs.map((n) => (
                  <div key={n.id} className="p-3 rounded-none border border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-app)]">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-none bg-[var(--bg-app)] border border-[var(--border-app)] flex items-center justify-center text-[9px] font-mono font-bold text-[var(--accent-app)]">!</div>
                      <span className="text-xs text-stone-700 dark:text-slate-350 font-sans">{n.type === "MESSAGE" ? "New message received." : n.type === "APPLICATION" ? "New project application update." : "Capstone workflow update."}</span>
                    </div>
                    <Link href="/notifications" className="text-[9px] font-mono font-bold uppercase text-[var(--accent-app)]">View</Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 font-mono italic">No recent updates.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

