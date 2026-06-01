"use client";

import Link from "next/link";
import { useState } from "react";
import { Section, Status, Badge } from "@/components/ui";
import { useGraphQL } from "@/lib/graphql";
import { PROJECTS_QUERY } from "@/lib/queries";
import type { Project } from "@/types/domain";

export default function ProjectsPage() {
  const [q, setQ] = useState("");
  const { data, error, loading } = useGraphQL<{ projects: Project[] }>(PROJECTS_QUERY, q.trim() ? { search: q.trim() } : {});
  const projects = data?.projects || [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Capstone Projects</h1>
          <p className="text-sm text-slate-400">Browse open research topics and sponsor challenges for student capstone execution.</p>
        </div>
        <div className="w-full md:w-80">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects by title or scope..." className="input-field py-2" />
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-slate-500">Loading projects from GraphQL...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-red-400">{error}</p></Section>}

      <div className="grid gap-6 md:grid-cols-2">
        {!loading && !error && projects.map((project) => (
          <div key={project.id} className="panel flex flex-col justify-between space-y-4 hover:translate-y-[-2px] transition-all">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/projects/${project.id}`} className="text-xl font-bold text-slate-100 hover:text-teal-400 transition">
                  {project.title}
                </Link>
                <Status value={project.status} />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">{project.description}</p>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800/60">
              <div className="flex flex-wrap gap-1.5">
                {project.disciplines.map((discipline) => (
                  <Badge key={discipline} label={discipline} type="discipline" />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Required Team Size:</span>
                <span className="font-bold text-slate-300">{project.teamSizeMin}-{project.teamSizeMax} students</span>
              </div>
            </div>
          </div>
        ))}

        {!loading && !error && projects.length === 0 && (
          <div className="col-span-full panel text-center py-12 space-y-2">
            <p className="text-slate-400 text-lg">No capstones found matching your search.</p>
            <p className="text-xs text-slate-500">Try adjusting your filters or search phrases.</p>
          </div>
        )}
      </div>
    </div>
  );
}
