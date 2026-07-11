"use client";

import Link from "next/link";
import { Section, Status, Badge, LoadingSkeleton } from "@/components/ui";
import { useGraphQL } from "@/lib/graphql";
import { HOME_QUERY } from "@/lib/queries";
import type { Project, Team } from "@/types/domain";

export default function HomePage() {
  const { data, error, loading } = useGraphQL<{ teams: Team[]; projects: Project[] }>(HOME_QUERY);
  const projects = data?.projects || [];

  return (
    <div className="dashboard-stage space-y-8 py-4 max-w-6xl mx-auto px-4">
      <section className="workspace-hero">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="space-y-4">
            <span className="page-kicker">
              <span className="activity-dot" />
              Capstone matching
            </span>
            <div className="space-y-2">
              <h1 className="page-title">Find the right team, project, and next step.</h1>
              <p className="page-subtitle">
                Quorum helps students form capable teams and connect with sponsor challenges without turning the capstone process into a spreadsheet chase.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/teams" className="btn-primary py-3 px-4">Browse teams</Link>
            <Link href="/projects" className="btn-secondary py-3 px-4">Browse projects</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.65fr]">
        <div className="space-y-5">
          <Section title="Quick Access Operations" variant="tall">
            <div className="space-y-2">
              {[
                ["/auth/register", "Set up profile"],
                ["/teams", "Recruit members"],
                ["/projects", "Claim project"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="action-row">
                  <span>{label}</span>
                  <span>-&gt;</span>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Active Project Postings Summary">
            {loading && <LoadingSkeleton rows={3} />}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
            {!loading && !error && projects.length === 0 && <p className="text-xs text-[var(--muted-app)]">No project postings are available yet.</p>}
            <div className="stagger-in divide-y divide-[var(--border-subtle)]">
              {projects.slice(0, 3).map((project) => (
                <div key={project.id} className="group flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <Link href={`/projects/${project.id}`} className="card-title text-sm group-hover:text-[var(--accent-app)]">
                      {project.title}
                    </Link>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.disciplines.map((discipline) => (
                        <Badge key={discipline} label={discipline} type="discipline" />
                      ))}
                    </div>
                  </div>
                  <Status value={project.status} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
