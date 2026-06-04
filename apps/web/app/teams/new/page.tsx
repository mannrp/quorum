"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Section, Combobox } from "@/components/ui";
import { getAuthToken, graphqlRequest } from "@/lib/graphql";

export default function CreateTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxSize, setMaxSize] = useState(4);
  const [discipline, setDiscipline] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [neededSkills, setNeededSkills] = useState<string[]>([]);
  const [existingSkills, setExistingSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predefinedSkills = [
    "TypeScript", "React", "Next.js", "Go", "GraphQL", "Python",
    "PostgreSQL", "C++", "Docker", "Svelte", "Node.js", "Tailwind CSS",
    "Agile", "UI/UX Design", "Machine Learning", "Cloud Architecture"
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const token = getAuthToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const result = await graphqlRequest<{ createTeam: { id: string } }>(
        `mutation CreateTeam($input: CreateTeamInput!) {
          createTeam(input: $input) { id }
        }`,
        {
          input: {
            name,
            description,
            maxSize: Number(maxSize),
            discipline: discipline || "SOEN",
            visibility: visibility === "HIDDEN" ? "HIDDEN" : "VISIBLE",
            discordLink: discordUrl || null,
            existingSkills,
            neededSkills,
            recruitingState: "RECRUITING"
          }
        },
        token
      );
      router.push(`/teams/${result.createTeam.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 px-4 space-y-6">
      <div className="border-b border-[var(--border-app)] pb-4">
        <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Form Capstone Team</h1>
        <p className="text-sm text-stone-500 font-sans">Register a new student team to recruit members and apply for project claims.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Basic Group Metadata">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Team / Group Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aegis Container Security"
                className="input-field"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Target Size (Students)</label>
              <input
                required
                type="number"
                min={2}
                max={6}
                value={maxSize}
                onChange={(e) => setMaxSize(Number(e.target.value))}
                className="input-field font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Focus Discipline</label>
              <input
                required
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="SOEN / COEN / Cross"
                className="input-field"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Group Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="input-field py-2 text-xs bg-[var(--surface-app)] font-mono"
              >
                <option value="PUBLIC">Visible in search & accepts join requests</option>
                <option value="HIDDEN">Hidden from search (Invite only)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Short Project Focus Summary</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly state your group's capstone goals, desired research directions, or working agreement..."
              className="input-field min-h-24 text-sm font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Discord Group Link (Optional)</label>
            <input
              type="url"
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.gg/..."
              className="input-field text-xs font-mono"
            />
          </div>
        </Section>

        <Section title="Desired Roster Competencies">
          <div className="grid gap-6">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-400">Existing Skills In Group</label>
              <Combobox options={predefinedSkills} selected={existingSkills} onChange={setExistingSkills} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--accent-app)]">Desired Skills Needed From Recruits</label>
              <Combobox options={predefinedSkills} selected={neededSkills} onChange={setNeededSkills} />
            </div>
          </div>
        </Section>

        {error && <p className="text-xs text-rose-500 font-mono font-bold uppercase tracking-wider">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-xs">
          {saving ? "Registering Group..." : "Initialize Capstone Group"}
        </button>
      </form>
    </div>
  );
}
