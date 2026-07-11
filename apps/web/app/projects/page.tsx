"use client";

import Link from "next/link";
import { useState } from "react";
import { Section, Status, Badge, LoadingSkeleton } from "@/components/ui";
import { useGraphQL } from "@/lib/graphql";
import { PROJECTS_QUERY } from "@/lib/queries";
import type { Project } from "@/types/domain";

export default function ProjectsPage() {
  const [q, setQ] = useState("");
  const { data, error, loading } = useGraphQL<{ projects: Project[] }>(
    PROJECTS_QUERY,
    q.trim() ? { search: q.trim() } : {},
    { debounceMs: q.trim() ? 250 : 0 }
  );
  const projects = data?.projects || [];

  return (
    <div className="dashboard-stage space-y-8 max-w-6xl mx-auto py-4 px-4">
      <section className="workspace-hero">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <span className="page-kicker">Project directory</span>
            <div className="space-y-2">
              <h1 className="page-title">Capstone projects</h1>
              <p className="page-subtitle">Browse sponsor challenges and research topics that are ready for student teams.</p>
            </div>
          </div>
          <div className="w-full md:w-96">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects by title or scope..." className="input-field py-3" />
          </div>
        </div>
      </section>

      {loading && <Section title="Projects"><LoadingSkeleton rows={5} /></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs font-semibold text-rose-500">{error}</p></Section>}

      <div className="stagger-in grid gap-5 md:grid-cols-2">
        {!loading && !error && projects.map((project) => (
          <div key={project.id} className="directory-card">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/projects/${project.id}`} className="card-title">
                  {project.title}
                </Link>
                <Status value={project.status} />
              </div>
              <p className="text-sm leading-6 text-[var(--muted-app)] line-clamp-3">{project.description}</p>
            </div>

            <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex flex-wrap gap-1.5">
                {project.disciplines.map((discipline) => (
                  <Badge key={discipline} label={discipline} type="discipline" />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--muted-app)]">
                <span>Required Team Size:</span>
                <span className="font-bold text-[var(--text-app)]">{project.teamSizeMin}-{project.teamSizeMax} students</span>
              </div>
            </div>
          </div>
        ))}

        {!loading && !error && projects.length === 0 && (
          <div className="col-span-full panel text-center py-12 space-y-2 border-dashed border-[var(--border-subtle)]">
            <p className="text-lg font-semibold text-[var(--text-app)]">No capstones found matching your search.</p>
            <p className="text-xs text-[var(--muted-app)]">Try adjusting your filters or search phrases.</p>
          </div>
        )}
      </div>
    </div>
  );
}
