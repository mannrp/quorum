"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Section, Status, Combobox } from "@/components/ui";
import { getAuthToken, graphqlRequest, uploadToSignedPost, userFacingError } from "@/lib/graphql";
import { ME_QUERY } from "@/lib/queries";
import type { UploadSignature, User } from "@/types/domain";

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
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const predefinedSkills = [
    "TypeScript", "React", "Next.js", "Go", "GraphQL", "Python",
    "PostgreSQL", "C++", "Docker", "Svelte", "Node.js", "Tailwind CSS",
    "Agile", "UI/UX Design", "Machine Learning", "Cloud Architecture"
  ];

  useEffect(() => {
    const loadProfile = async () => {
      const token = getAuthToken();
      if (!token) {
        router.push("/auth/login");
        return;
      }
      try {
        const res = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, token);
        if (res.me) {
          setUser(res.me);
          setFullName(res.me.fullName || "");
          setBio(res.me.bio || "");
          setDiscipline(res.me.discipline || "");
          setUniversity(res.me.university || "Concordia");
          setLinkedinUrl(res.me.linkedinUrl || "");
          setGithubUrl(res.me.githubUrl || "");
          setPortfolioUrl(res.me.portfolioUrl || "");
          setSkills((res.me.tags || []).map((t) => t.name));
          setResumeVisibility(res.me.resumeVisibility || "PUBLIC");
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
      const token = getAuthToken();
      let resumeUrl = user?.resumeUrl || "";

      if (resumeFile) {
        const result = await graphqlRequest<{ signUpload: UploadSignature }>(
          `mutation Sign($input: SignUploadInput!) { signUpload(input: $input) { url key publicUrl expiresAt fields { name value } } }`,
          { input: { kind: "RESUME", filename: resumeFile.name, contentType: resumeFile.type, size: resumeFile.size } },
          token
        );
        await uploadToSignedPost(resumeFile, result.signUpload);
        resumeUrl = result.signUpload.publicUrl || result.signUpload.key;
      }

      await graphqlRequest(
        `mutation UpdateProfile($input: UpdateProfileInput!) { updateProfile(input: $input) { id } }`,
        {
          input: {
            fullName,
            bio,
            discipline,
            university,
            linkedinUrl,
            githubUrl,
            portfolioUrl,
            resumeUrl: resumeUrl || undefined,
            resumeVisibility,
            skills,
            tags: skills,
          },
        },
        token
      );

      setNotice("Profile successfully updated.");
      setResumeFile(null);
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse uppercase tracking-wider">Fetching settings console...</p></Section>;
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
              <input required value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="input-field" />
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
            <Combobox options={predefinedSkills} selected={skills} onChange={setSkills} />
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
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Current Attached File</label>
              {user?.resumeUrl ? (
                <a href={user.resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent-app)] hover:underline font-bold">
                  View Uploaded Resume File
                </a>
              ) : (
                <span className="text-xs text-stone-500 italic font-mono">No resume attached yet.</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Upload New Resume (PDF / DOCX)</label>
              <input type="file" accept=".pdf,.docx" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} className="block text-xs text-stone-500 border border-[var(--border-app)] p-2 rounded-none bg-[var(--bg-app)] w-full font-mono" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Document Access Level</label>
              <select value={resumeVisibility} onChange={(e) => setResumeVisibility(e.target.value)} className="input-field py-2 text-xs bg-[var(--surface-app)]">
                <option value="PUBLIC">Visible to all Quorum Members</option>
                <option value="TEAM_LEADS">Visible only to Team Leads during applications</option>
                <option value="PROJECT_OWNERS">Visible only to project sponsors</option>
                <option value="PRIVATE">Keep Private</option>
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
