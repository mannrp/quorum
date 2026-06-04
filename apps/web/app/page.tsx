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
    <div className="space-y-8 py-4 max-w-5xl mx-auto px-4">
      <div className="panel-wide p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500">
              [-] Institutional Console
            </span>
            <h1 className="text-2xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">
              Capstone Matching & Claims
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/teams" className="btn-primary py-2 px-4">Browse Groups</Link>
            <Link href="/projects" className="btn-secondary py-2 px-4">Browse Postings</Link>
          </div>
        </div>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-3xl leading-relaxed font-sans">
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
                <Link key={href} href={href} className="w-full flex items-center justify-between p-3 border border-[var(--border-app)] hover:bg-[var(--bg-app)] text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-app)] transition rounded-none">
                  <span>{label}</span>
                  <span>-&gt;</span>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-6 md:col-span-2">
          <Section title="Active Project Postings Summary">
            {loading && <p className="text-xs text-stone-500 font-mono animate-pulse uppercase tracking-wider">Loading live project registry...</p>}
            {error && <p className="text-xs text-rose-500 font-mono font-bold uppercase tracking-wider">{error}</p>}
            {!loading && !error && projects.length === 0 && <p className="text-xs text-stone-500 font-mono italic">No project postings are available yet.</p>}
            <div className="divide-y divide-[var(--border-subtle)]">
              {projects.slice(0, 3).map((project) => (
                <div key={project.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Link href={`/projects/${project.id}`} className="font-bold text-[var(--text-app)] hover:text-[var(--accent-app)] transition text-sm font-serif uppercase tracking-tight">
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
