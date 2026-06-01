"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Section, Status, Badge } from "@/components/ui";
import { graphqlRequest, useGraphQL } from "@/lib/graphql";
import { PROJECT_QUERY } from "@/lib/queries";
import type { Project } from "@/types/domain";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useGraphQL<{ project: Project | null }>(PROJECT_QUERY, { id });
  const [notice, setNotice] = useState<string | null>(null);
  const project = data?.project;

  const handleApply = async () => {
    const teamId = window.prompt("Team ID to apply with");
    if (!teamId) return;
    setNotice(null);
    await graphqlRequest(`mutation Apply($projectId: ID!, $teamId: ID!, $message: String) {
      applyToProject(projectId: $projectId, teamId: $teamId, message: $message) { id status }
    }`, { projectId: id, teamId, message: "We have coverage for this project." });
    setNotice("Application submitted.");
    await reload();
  };

  if (loading) {
    return <Section title="Loading"><p className="text-slate-400">Loading project from GraphQL...</p></Section>;
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Section title="Error">
          <p className="text-slate-400">{error || "The requested capstone project does not exist."}</p>
          <Link href="/projects" className="btn-secondary mt-4">Back to Projects</Link>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="panel flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight">{project.title}</h1>
            <Status value={project.status} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {project.disciplines.map((discipline) => <Badge key={discipline} label={discipline} type="discipline" />)}
          </div>
          {notice && <p className="text-xs text-emerald-400">{notice}</p>}
        </div>

        <button onClick={() => void handleApply().catch((err) => setNotice(err.message))} disabled={project.status === "CLAIMED"} className={`btn-primary w-full sm:w-auto ${project.status === "CLAIMED" ? "from-slate-900 to-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none" : ""}`}>
          {project.status === "CLAIMED" ? "Project Claimed" : "Apply with Team"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Section title="Project Scope & Description">
            <p className="leading-relaxed text-slate-300">{project.description}</p>
            {project.constraints && (
              <div className="mt-6 space-y-2 pt-4 border-t border-slate-800/60">
                <h4 className="text-sm font-bold text-slate-200">Constraints & Criteria:</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{project.constraints}</p>
              </div>
            )}
          </Section>

          <Section title="Received Team Applications">
            {project.applications.length > 0 ? (
              <div className="space-y-4 divide-y divide-slate-800/50">
                {project.applications.map((application) => (
                  <div key={application.id} className="pt-4 first:pt-0 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Link href={`/teams/${application.team.id}`} className="font-bold text-slate-200 hover:text-teal-400 transition">{application.team.name}</Link>
                      {application.message && <p className="text-xs text-slate-400 italic">&quot;{application.message}&quot;</p>}
                    </div>
                    <Status value={application.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6"><p className="text-xs text-slate-500">No applications received yet.</p></div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Requirements">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-800/40"><span className="text-slate-500">Min Team Size:</span><span className="font-semibold text-slate-200">{project.teamSizeMin} students</span></div>
              <div className="flex justify-between py-2 border-b border-slate-800/40"><span className="text-slate-500">Max Team Size:</span><span className="font-semibold text-slate-200">{project.teamSizeMax} students</span></div>
              <div className="flex justify-between py-2 border-b border-slate-800/40"><span className="text-slate-500">Owner:</span><Link href={`/profile/${project.owner.username}`} className="font-semibold text-teal-400">{project.owner.fullName}</Link></div>
            </div>
          </Section>

          <Section title="Resource Files">
            <div className="space-y-3">
              {project.fileUrl || project.videoUrl ? (
                <>
                  {project.fileUrl && <a href={project.fileUrl} className="block text-xs text-teal-400 hover:underline">Download project file</a>}
                  {project.videoUrl && <a href={project.videoUrl} className="block text-xs text-teal-400 hover:underline">Open project video</a>}
                </>
              ) : (
                <p className="text-xs text-slate-500">No project files have been attached.</p>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
