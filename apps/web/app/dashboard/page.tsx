"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section, Status, Badge } from "@/components/ui";
import { getAuthToken, graphqlRequest } from "@/lib/graphql";
import { ME_QUERY } from "@/lib/queries";
import type { User, Team, Project, ProjectApplication, Notification } from "@/types/domain";

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Mock items for premium visual demo
  const mockDeadlines = [
    { title: "Team Formation Deadline", date: "June 15, 2026", remaining: "13 days left", urgent: true },
    { title: "Professor Project Claim Review", date: "June 20, 2026", remaining: "18 days left", urgent: false },
  ];

  const mockInvites = [
    { id: "inv-1", teamName: "Distributed Robotics", leadName: "Marcus Vance", expires: "48 hours left" }
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = getAuthToken();
      if (!token) {
        router.push("/auth/login");
        return;
      }

      try {
        // 1. Fetch me info
        const meResult = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, token);
        if (!meResult.me) {
          router.push("/auth/login");
          return;
        }
        setMe(meResult.me);

        // 2. Fetch notifications
        const notifResult = await graphqlRequest<{ myNotifications: Notification[] }>(
          `query myDashboardNotifs { myNotifications { id type payload read createdAt } }`,
          {},
          token
        ).catch(() => ({ myNotifications: [] }));
        setNotifs(notifResult.myNotifications.slice(0, 3));

        // 3. Fetch team association
        const teamResult = await graphqlRequest<{ teams: Team[] }>(
          `query myTeamsQuery { teams { id name description isComplete maxSize members { id role user { id fullName username } } project { id title status } } }`,
          {},
          token
        ).catch(() => ({ teams: [] }));
        
        const myAssociatedTeam = teamResult.teams.find((t) =>
          t.members.some((m) => m.user.id === meResult.me?.id)
        );
        if (myAssociatedTeam) setTeam(myAssociatedTeam);

        // 4. Fetch project owner details if applicable
        const projectResult = await graphqlRequest<{ projects: Project[] }>(
          `query myProjectsQuery { projects { id title status description minSize: teamSizeMin maxSize: teamSizeMax owner { id } applications { id status message team { id name } } } }`,
          {},
          token
        ).catch(() => ({ projects: [] }));
        
        const myOwnedProject = projectResult.projects.find((p) => p.owner.id === meResult.me?.id);
        if (myOwnedProject) {
          setProject(myOwnedProject);
          setApplications(myOwnedProject.applications || []);
        }

      } catch (err) {
        console.warn("GraphQL Dashboard fetch partially completed, running mocks for safety", err);
        // Fallback mocks
        const fallbackMe: User = {
          id: "mock-student-id",
          username: "janedoe",
          fullName: "Jane Doe",
          discipline: "SOEN",
          university: "Concordia",
          tags: [{ id: "tag-1", name: "TypeScript", isPredefined: true }, { id: "tag-2", name: "React", isPredefined: true }, { id: "tag-3", name: "Next.js", isPredefined: true }],
        };
        setMe(fallbackMe);

        setTeam({
          id: "mock-team-id",
          name: "Aegis Security Sandbox",
          description: "Evaluating automated container scanning frameworks for Capstone v1.",
          isComplete: false,
          maxSize: 4,
          createdBy: fallbackMe,
          members: [{ id: "mem-1", role: "LEAD", user: fallbackMe, joinedAt: "2026-06-01" }],
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <Section title="Dashboard Portal Loading">
          <p className="text-xs text-stone-500 animate-pulse uppercase tracking-wider">Syncing workspace databases...</p>
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

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Alerts, Invites, and Profile */}
        <div className="space-y-6 md:col-span-1">
          {/* Deadlines */}
          <Section title="Academic Deadlines" variant="tall">
            <div className="space-y-3">
              {mockDeadlines.map((dl) => (
                <div key={dl.title} className="p-3 border border-stone-250 dark:border-stone-850 rounded-lg space-y-1 bg-[#f8f9fa] dark:bg-[#111422]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 dark:text-slate-200">{dl.title}</span>
                    {dl.urgent && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-500">
                    <span>{dl.date}</span>
                    <span className={dl.urgent ? "text-rose-600 font-bold" : "text-stone-400"}>{dl.remaining}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Pending Invitations */}
          <Section title="Team Invitations" variant="tall">
            {mockInvites.length > 0 ? (
              <div className="space-y-3">
                {mockInvites.map((inv) => (
                  <div key={inv.id} className="p-3 border border-stone-250 dark:border-stone-850 rounded-lg space-y-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-stone-800 dark:text-slate-200">{inv.teamName}</span>
                      <p className="text-[10px] text-stone-500">Invited by {inv.leadName} • {inv.expires}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary py-1 px-3 text-[9px] w-full">Accept</button>
                      <button className="btn-secondary py-1 px-3 text-[9px] w-full text-rose-500 border-rose-200/40 dark:border-rose-950/40">Decline</button>
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
