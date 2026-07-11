"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Section, Combobox, LoadingSkeleton } from "@/components/ui";
import { authDestination } from "@/lib/auth-routing";
import { graphqlRequest, uploadToSignedPost, userFacingError } from "@/lib/graphql";
import { getCurrentNeonUser } from "@/lib/neon-auth";
import { DISCIPLINE_OPTIONS, SKILL_OPTIONS } from "@/lib/policy";
import { AUTH_STATE_QUERY } from "@/lib/queries";
import type { AuthState, UploadSignature } from "@/types/domain";

export default function OnboardingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [discipline, setDiscipline] = useState(DISCIPLINE_OPTIONS[0]);
  const [university, setUniversity] = useState("Concordia");
  const [bio, setBio] = useState("");
  const [intent, setIntent] = useState("STUDENT_FIND_TEAM");
  const [skills, setSkills] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const checkUser = async () => {
      try {
        const [stateRes, neonUser] = await Promise.all([
          graphqlRequest<{ authState: AuthState }>(AUTH_STATE_QUERY, {}, { auth: true }),
          getCurrentNeonUser().catch(() => null),
        ]);
        const state = stateRes.authState;
        if (!state.authenticated) {
          router.push("/auth/login");
          return;
        }
        if (state.profileComplete) {
          router.push("/dashboard");
          return;
        }
        if (state.profile) {
          setEmail(state.profile.email || "");
          setFullName(state.profile.fullName || "");
          setUsername(state.profile.username || "");
          setDiscipline(state.profile.discipline || DISCIPLINE_OPTIONS[0]);
          setUniversity(state.profile.university || "Concordia");
          setBio(state.profile.bio || "");
          setSkills((state.profile.tags || []).map((t) => t.name));
        } else if (neonUser) {
          setEmail(neonUser.email || "");
          setFullName(neonUser.name || "");
        }
      } catch (err) {
        setNotice(userFacingError(err));
      } finally {
        setLoading(false);
      }
    };
    void checkUser();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (skills.length < 3) {
      setNotice("You must select at least three academic skills.");
      return;
    }

    setUploading(true);

    try {
      let resumeUrl = "";

      const input = {
        username,
        email: email || undefined,
        fullName,
        bio,
        discipline,
        university,
        userIntent: intent,
        skills,
        tags: skills,
      };

      await graphqlRequest(
        `mutation UpsertProfile($input: UpsertMyProfileInput!) { upsertMyProfile(input: $input) { id } }`,
        { input },
        { auth: true }
      );

      if (resumeFile) {
        const result = await graphqlRequest<{ signUpload: UploadSignature }>(
          `mutation Sign($input: SignUploadInput!) { signUpload(input: $input) { url key publicUrl expiresAt fields { name value } } }`,
          { input: { kind: "RESUME", filename: resumeFile.name, contentType: resumeFile.type, size: resumeFile.size } },
          { auth: true }
        );
        await uploadToSignedPost(resumeFile, result.signUpload);
        resumeUrl = result.signUpload.publicUrl || result.signUpload.key;
      }

      if (resumeUrl) {
        await graphqlRequest(
          `mutation UpsertProfile($input: UpsertMyProfileInput!) { upsertMyProfile(input: $input) { id } }`,
          { input: { ...input, resumeUrl } },
          { auth: true }
        );
      }

      setNotice("Profile setup complete!");
      setTimeout(() => {
        void authDestination().then((destination) => router.push(destination));
      }, 1000);

    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Section title="Set up your profile">
          <LoadingSkeleton rows={5} />
        </Section>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <Section title="Complete Onboarding Setup">
        <p className="text-xs text-stone-500 leading-relaxed">
          Welcome to Quorum. Please complete the mandatory academic profile fields below to unlock capstone browsing, group creation, project applications, and chat systems.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-850">
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Full Name</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Doe" className="input-field" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Username</label>
              <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="alexdoe" className="input-field" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Academic Discipline</label>
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Academic Intent</label>
            <select value={intent} onChange={(e) => setIntent(e.target.value)} className="input-field py-2 text-xs bg-[var(--surface-app)]">
              <option value="STUDENT_FIND_TEAM">I want to find or create a capstone team</option>
              <option value="STUDENT_FIND_PROJECT">I want to apply to projects with an existing team</option>
              <option value="PROJECT_OWNER">I want to sponsor/submit a capstone project</option>
              <option value="PROFESSOR">I am a professor/academic reviewer</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Short Bio / Academic Summary</label>
            <textarea
              required
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Provide a brief summary of your academic interests, project experiences, and capstone goals..."
              className="input-field min-h-24 text-sm"
            />
          </div>

          {/* Academic skills */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 font-bold text-[var(--accent-app)]">
              Select Academic Skills / Core Competencies (Min 3)
            </label>
            <Combobox
              options={SKILL_OPTIONS}
              selected={skills}
              onChange={setSkills}
              placeholder="Search and add disciplines..."
              maxItems={10}
            />
          </div>

          {/* Optional resume upload */}
          <div className="space-y-2 py-3 border-t border-stone-200 dark:border-stone-850">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Resume Document (PDF/DOCX - Optional)</label>
            <div className="flex items-center gap-4">
              <label className="btn-secondary text-xs px-3 py-2 cursor-pointer relative overflow-hidden">
                <span>{resumeFile ? resumeFile.name : "Select Resume File"}</span>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              {resumeFile && (
                <button type="button" onClick={() => setResumeFile(null)} className="text-xs text-rose-500 font-bold hover:underline">Remove</button>
              )}
            </div>
          </div>

          {notice && <p className="text-xs text-rose-500 font-bold">{notice}</p>}

          <button
            type="submit"
            disabled={uploading}
            className="btn-primary w-full py-3 text-xs"
          >
            {uploading ? "Uploading & Saving Profiles..." : "Initialize Quorum Portal"}
          </button>

        </form>
      </Section>
    </div>
  );
}
