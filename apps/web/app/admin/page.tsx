"use client";

import { Section, Status } from "@/components/ui";
import { graphqlRequest, useGraphQL } from "@/lib/graphql";
import { ADMIN_QUERY } from "@/lib/queries";
import type { Project, Team, User } from "@/types/domain";

export default function AdminPage() {
  const { data, error, loading, reload } = useGraphQL<{ users: User[]; teams: Team[]; projects: Project[] }>(ADMIN_QUERY, {}, { auth: true });
  const users = data?.users || [];
  const teams = data?.teams || [];
  const projects = data?.projects || [];

  const removeUser = async (id: string) => {
    await graphqlRequest(`mutation RemoveUser($id: ID!) { removeUser(userId: $id) }`, { id });
    await reload();
  };

  const removeTeam = async (id: string) => {
    await graphqlRequest(`mutation RemoveTeam($id: ID!) { removeTeam(teamId: $id) }`, { id });
    await reload();
  };

  const removeProject = async (id: string) => {
    await graphqlRequest(`mutation RemoveProject($id: ID!) { removeProject(projectId: $id) }`, { id });
    await reload();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Admin Control Center</h1>
          <p className="text-sm text-slate-400">Maintain institutional profiles, team rosters, project posts, and platform integrity.</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wider">
          Admin Authority
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-slate-500">Loading admin data from GraphQL...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-red-400">{error}</p></Section>}

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="panel p-6 space-y-2"><span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Platform Accounts</span><p className="text-4xl font-extrabold text-white">{users.length}</p></div>
        <div className="panel p-6 space-y-2"><span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Capstone Groups</span><p className="text-4xl font-extrabold text-white">{teams.length}</p></div>
        <div className="panel p-6 space-y-2"><span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Registered Posts</span><p className="text-4xl font-extrabold text-white">{projects.length}</p></div>
      </div>

      <Section title="Account Roster Controls">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b border-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider"><th className="pb-3">Name</th><th className="pb-3">Discipline</th><th className="pb-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {users.map((user) => (
                <tr key={user.id} className="text-sm">
                  <td className="py-4"><div className="font-bold text-slate-200">{user.fullName}</div><div className="text-xs text-slate-500">@{user.username}</div></td>
                  <td className="py-4"><span className="rounded bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300 font-semibold border border-slate-700/60 uppercase">{user.discipline || "GEN"}</span></td>
                  <td className="py-4 text-right"><button onClick={() => void removeUser(user.id)} className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-slate-950 hover:border-transparent transition duration-200">Delete Account</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Team Controls">
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between gap-4 border-b border-slate-800/50 pb-3">
              <div><p className="text-sm font-bold text-slate-200">{team.name}</p><p className="text-xs text-slate-500">{team.members.length}/{team.maxSize} members</p></div>
              <button onClick={() => void removeTeam(team.id)} className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400">Remove Team</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Project Controls">
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="flex items-center justify-between gap-4 border-b border-slate-800/50 pb-3">
              <div><p className="text-sm font-bold text-slate-200">{project.title}</p><Status value={project.status} /></div>
              <button onClick={() => void removeProject(project.id)} className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400">Remove Project</button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
