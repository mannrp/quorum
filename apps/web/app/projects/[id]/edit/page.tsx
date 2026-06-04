"use client";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Section, Combobox } from "@/components/ui";
import { useGraphQL, getAuthToken, graphqlRequest, userFacingError } from "@/lib/graphql";
import { PROJECT_QUERY } from "@/lib/queries";
import type { Project } from "@/types/domain";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, loading, reload } = useGraphQL<{ project: Project | null }>(PROJECT_QUERY, { id });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [constraints, setConstraints] = useState("");
  const [minSize, setMinSize] = useState(3);
  const [maxSize, setMaxSize] = useState(5);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [status, setStatus] = useState("OPEN");
  
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const predefinedDisciplines = ["SOEN", "COEN", "MECH", "ELEC", "CIVI", "INDY"];

  useEffect(() => {
    if (data?.project) {
      setTitle(data.project.title);
      setDescription(data.project.description);
      setConstraints(data.project.constraints || "");
      setMinSize(data.project.teamSizeMin);
      setMaxSize(data.project.teamSizeMax);
      setDisciplines(data.project.disciplines);
      setStatus(data.project.status);
    }
  }, [data?.project]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setSaving(true);

    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation UpdateProjectDetails($id: ID!, $input: UpdateProjectInput!) {
          updateProject(id: $id, input: $input) { id }
        }`,
        {
          id,
          input: {
            title,
            description,
            constraints,
            disciplines,
            teamSizeMin: Number(minSize),
            teamSizeMax: Number(maxSize),
            status,
          }
        },
        token
      );
      setNotice("Project updated successfully. Applicants notified of material changes.");
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Fetching project details...</p></Section>;
  }

  if (error || !data?.project) {
    return <Section title="Error"><p className="text-xs text-stone-400">Project details not found.</p></Section>;
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      <div className="border-b border-[var(--border-subtle)] pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Edit Project</h1>
          <p className="text-sm text-stone-500 font-sans">Edit sponsored capstone details and status.</p>
        </div>
        <Link href={`/projects/${id}`} className="btn-secondary py-1.5 px-3 text-xs">View Project</Link>
      </div>

      {notice && (
        <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success)] rounded-none text-xs font-mono font-semibold text-[var(--color-success)]">
          {notice}
        </div>
      )}

      {/* Material change warning alert */}
      <div className="p-4 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/10 text-xs leading-relaxed space-y-1">
        <strong className="text-amber-800 dark:text-amber-400 block font-bold uppercase tracking-wider text-[9px]">⚠️ Warning: Material Scope Modification</strong>
        <p className="text-stone-600 dark:text-slate-350">
          Updating the description, constraints, target sizes, or disciplines after teams have submitted claims will automatically notify those groups and prompt their leads to review the changes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Project Metadata">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Project Title</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field py-2 text-xs bg-white dark:bg-[#161a2b]">
                <option value="OPEN">Open (Accepting applications)</option>
                <option value="IN_REVIEW">Under Review (Evaluating submissions)</option>
                <option value="CLAIMED">Claimed (Match confirmed, locked)</option>
                <option value="CLOSED">Closed (Draft or archived)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Full Description</label>
              <textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-32 text-sm leading-relaxed" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Constraints & Licensing</label>
              <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} className="input-field min-h-20 text-xs" />
            </div>
          </div>
        </Section>

        <Section title="Requirements & Sizes">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Minimum Size</label>
              <input required type="number" min={2} max={6} value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Maximum Size</label>
              <input required type="number" min={2} max={6} value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} className="input-field" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Disciplines</label>
              <Combobox options={predefinedDisciplines} selected={disciplines} onChange={setDisciplines} />
            </div>
          </div>
        </Section>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-xs">
          {saving ? "Saving Changes..." : "Commit Specifications Changes"}
        </button>
      </form>
    </div>
  );
}
