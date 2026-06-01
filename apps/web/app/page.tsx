"use client";

import Link from "next/link";
import { Section, Status, Badge } from "@/components/ui";
import { useGraphQL } from "@/lib/graphql";
import { HOME_QUERY } from "@/lib/queries";
import type { Project, Team } from "@/types/domain";

export default function HomePage() {
  const { data, error, loading } = useGraphQL<{ teams: Team[]; projects: Project[] }>(HOME_QUERY);
  const projects = data?.projects || [];

  return (
    <div className="space-y-8 py-4 max-w-5xl mx-auto">
      <div className="panel-wide bg-stone-50/30 dark:bg-stone-900/40 p-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              [-] Institutional Console
            </span>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Capstone Matching & Claims
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/teams" className="btn-primary py-2 px-4">Browse Groups</Link>
            <Link href="/projects" className="btn-secondary py-2 px-4">Browse Postings</Link>
          </div>
        </div>
        <p className="text-sm text-stone-650 dark:text-stone-350 max-w-3xl leading-relaxed">
          Select a portal option below to assemble student project teams, recruit members with specific skill tags, or evaluate claim applications on active capstone challenges.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-1">
          <Section title="Quick Access Operations" variant="tall">
            <div className="space-y-2">
              {[
                ["/auth/register", "[+] Setup Profile"],
                ["/teams", "[+] Recruit Members"],
                ["/projects", "[+] Claim Project"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="w-full flex items-center justify-between p-3 rounded border border-stone-300 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-900 text-xs font-bold uppercase tracking-wider text-stone-850 dark:text-stone-200 transition">
                  <span>{label}</span>
                  <span>-&gt;</span>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-6 md:col-span-2">
          <Section title="Active Project Postings Summary">
            {loading && <p className="text-xs text-stone-500">Loading live project registry...</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
            {!loading && !error && projects.length === 0 && <p className="text-xs text-stone-500">No project postings are available yet.</p>}
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {projects.slice(0, 3).map((project) => (
                <div key={project.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Link href={`/projects/${project.id}`} className="font-bold text-stone-900 dark:text-stone-100 hover:text-amber-800 dark:hover:text-amber-400 transition text-sm">
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
