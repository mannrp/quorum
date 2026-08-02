"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Section, Status, Combobox, LoadingSkeleton } from "@/components/ui";
import { userFacingError } from "@/lib/graphql";
import { operationRequest } from "@/lib/operations/client";
import { DISCIPLINE_OPTIONS, RESUME_VISIBILITY_OPTIONS, SKILL_OPTIONS } from "@/lib/policy";
import type { User } from "@/types/domain";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [university, setUniversity] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [resumeVisibility, setResumeVisibility] = useState("PUBLIC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await operationRequest<{ me: User | null }>("ViewerProfileV1", {});
        if (res.me) {
          setUser(res.me);
          setFullName(res.me.fullName || "");
          setBio(res.me.bio || "");
          setDiscipline(res.me.discipline || DISCIPLINE_OPTIONS[0]);
          setUniversity(res.me.university || "Concordia");
          setLinkedinUrl(res.me.linkedinUrl || "");
          setGithubUrl(res.me.githubUrl || "");
          setPortfolioUrl(res.me.portfolioUrl || "");
          setSkills((res.me.tags || []).map((t) => t.name));
          setResumeVisibility(res.me.resumeVisibility || "PUBLIC");
        } else {
          router.push("/onboarding");
        }
      } catch (err) {
        setNotice(userFacingError(err));
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, [router]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setSaving(true);

    try {
      await operationRequest("UpdateMyProfileV1", {
        input: {
          username: user?.username || "",
          fullName,
          bio,
          discipline,
          university,
          linkedinUrl,
          githubUrl,
          portfolioUrl,
          resumeVisibility,
          skills,
          tags: skills,
        },
      });

      setNotice("Profile successfully updated.");
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Section title="Profile settings"><LoadingSkeleton rows={5} /></Section>;
  }

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Profile Settings</h1>
        <p className="text-sm text-stone-500 font-sans">Manage your academic credentials, portfolio links, and file attachments.</p>
      </div>

      {notice && (
        <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success)] rounded-none text-xs font-mono font-semibold text-[var(--color-success)]">
          {notice}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Basic Profile Information">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Full Name</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Username</label>
              <input disabled value={user?.username || ""} className="input-field opacity-60 cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Discipline</label>
              <select required value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="input-field py-2 text-xs bg-[var(--surface-app)]">
                {DISCIPLINE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">University</label>
              <input required value={university} onChange={(e) => setUniversity(e.target.value)} className="input-field" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Biography</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input-field min-h-24 text-sm" />
          </div>
        </Section>

        <Section title="Acquired Skills & Tags">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Manage Core Skills (Minimum 3)</label>
            <Combobox options={SKILL_OPTIONS} selected={skills} onChange={setSkills} />
          </div>
        </Section>

        <Section title="Portfolio & Professional Links">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">LinkedIn URL</label>
              <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="input-field text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">GitHub URL</label>
              <input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className="input-field text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Portfolio Website</label>
              <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://..." className="input-field text-xs" />
            </div>
          </div>
        </Section>

        <Section title="Resume Document Visibility">
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              Private resume upload and download will be enabled with authorization-checked file access in P4.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Future document access level</label>
              <select value={resumeVisibility} onChange={(e) => setResumeVisibility(e.target.value)} className="input-field py-2 text-xs bg-[var(--surface-app)]">
                {RESUME_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-xs">
          {saving ? "Saving Changes..." : "Commit Settings Changes"}
        </button>
      </form>
    </div>
  );
}
