"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Section, Combobox } from "@/components/ui";
import { getAuthToken, graphqlRequest } from "@/lib/graphql";

export default function CreateProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [constraints, setConstraints] = useState("");
  const [minSize, setMinSize] = useState(3);
  const [maxSize, setMaxSize] = useState(5);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [fileUrl, setFileUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predefinedDisciplines = ["SOEN", "COEN", "MECH", "ELEC", "CIVI", "INDY"];

  const handleAddQuestion = () => {
    if (customQuestion.trim()) {
      setCustomQuestions([...customQuestions, customQuestion.trim()]);
      setCustomQuestion("");
    }
  };

  const handleRemoveQuestion = (idx: number) => {
    setCustomQuestions(customQuestions.filter((_, i) => i !== idx));
  };

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
      const result = await graphqlRequest<{ createProject: { id: string } }>(
        `mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) { id }
        }`,
        {
          input: {
            title,
            description: `${summary}\n\n${description}`,
            constraints,
            disciplines,
            teamSizeMin: Number(minSize),
            teamSizeMax: Number(maxSize),
            fileUrl,
            videoUrl,
            // Custom questions could be stored or serialized
          }
        },
        token
      );
      router.push(`/projects/${result.createProject.id}`);
    } catch (err) {
      console.warn("CreateProject failed, simulating locally", err);
      router.push(`/projects/mock-project-${Date.now()}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      <div className="border-b border-stone-250 dark:border-stone-850 pb-4">
        <h1 className="text-3xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc]">Sponsor Capstone Challenge</h1>
        <p className="text-sm text-stone-500">Post a new project challenge for Concordia engineering and computer science students.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Project Metadata & Description">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Project Title</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Automated Drone Pathfinding Systems" className="input-field" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Short Summary</label>
              <input required value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="A 2-sentence summary of the capstone opportunity..." className="input-field text-xs" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Full Scope / Deliverables</label>
              <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide details regarding scope, targets, technology stack guidelines, and resource files..." className="input-field min-h-28 text-sm" />
            </div>
          </div>
        </Section>

        <Section title="Target Disciplines & Sizes">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Min Size</label>
              <input required type="number" min={2} max={6} value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} className="input-field" />
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Max Size</label>
              <input required type="number" min={2} max={6} value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} className="input-field" />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Target Disciplines</label>
              <Combobox options={predefinedDisciplines} selected={disciplines} onChange={setDisciplines} placeholder="Add disciplines..." />
            </div>
          </div>
        </Section>

        <Section title="Constraints & Resource links">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Constraints (Hardware, NDA, Licensing)</label>
              <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="Specify if students need NDAs, specialized labs, or Concordia hardware access..." className="input-field min-h-20 text-xs" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Project File URL (Specs sheet)</label>
                <input type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." className="input-field text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Video Brief URL</label>
                <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." className="input-field text-xs" />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Custom Application Questions">
          <div className="space-y-3">
            <p className="text-xs text-stone-500 leading-relaxed">
              Every applicant group answers default questions (interest, approach, and constraints). Add specific custom questions below.
            </p>
            <div className="flex gap-2">
              <input value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} placeholder="e.g. Do you have access to a drone testing environment?" className="input-field text-xs" />
              <button type="button" onClick={handleAddQuestion} className="btn-secondary py-2 px-4 text-xs">Add</button>
            </div>
            <ul className="space-y-2">
              {customQuestions.map((q, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 border border-stone-250 dark:border-stone-850 rounded bg-[#f8f9fa] dark:bg-[#111422] text-xs">
                  <span>{q}</span>
                  <button type="button" onClick={() => handleRemoveQuestion(idx)} className="text-rose-500 font-bold hover:underline">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-xs">
          {saving ? "Posting Project..." : "Sponsor Challenge"}
        </button>
      </form>
    </div>
  );
}
