"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section, Combobox } from "@/components/ui";
import { authDestination } from "@/lib/auth-routing";
import { graphqlRequest, userFacingError } from "@/lib/graphql";
import { signInWithNeonOAuth, signUpWithNeonEmail } from "@/lib/neon-auth";
import { DISCIPLINE_OPTIONS, SKILL_OPTIONS } from "@/lib/policy";
import type { User } from "@/types/domain";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [discipline, setDiscipline] = useState(DISCIPLINE_OPTIONS[0]);
  const [university, setUniversity] = useState("Concordia");
  const [skills, setSkills] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successProfile, setSuccessProfile] = useState<User | null>(null);
  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (skills.length < 3) {
      setError("Please select at least 3 skills to initialize your profile.");
      setLoading(false);
      return;
    }

    try {
      await signUpWithNeonEmail(email, password, fullName);

      const result = await graphqlRequest<{ upsertMyProfile: User }>(
        `mutation UpsertProfile($input: UpsertMyProfileInput!) {
          upsertMyProfile(input: $input) { id username fullName discipline university profileComplete }
        }`,
        {
          input: {
            username,
            email,
            fullName,
            discipline,
            university: university || "Concordia",
            bio: "Academically driven student looking to build a strong capstone foundation.",
            skills,
            tags: skills,
          }
        },
        { auth: true }
      );

      setSuccessProfile(result.upsertMyProfile);
      setTimeout(() => {
        void authDestination().then((destination) => router.push(destination));
      }, 1500);

    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSSORegister = async (provider: string) => {
    setError(null);
    setLoading(true);
    try {
      if (provider !== "google") {
        throw new Error("Unsupported OAuth provider.");
      }
      await signInWithNeonOAuth(provider, "/auth/complete");
    } catch (err) {
      setError(userFacingError(err));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Section title="Create Your Quorum Profile" className="shadow-none">
        {!successProfile ? (
          <form className="grid gap-4 md:grid-cols-2 pt-2" onSubmit={handleRegisterSubmit}>
            
            {/* Quick Registration SSO */}
            <div className="col-span-full space-y-2">
              <button
                type="button"
                onClick={() => void handleSSORegister("google")}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-none border border-[var(--border-app)] bg-[var(--surface-app)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--text-app)] hover:bg-[var(--bg-app)] transition cursor-pointer"
              >
                Continue with Google
              </button>
            </div>

            <div className="col-span-full flex items-center justify-between py-1">
              <div className="h-[1px] w-full bg-[var(--border-subtle)]"></div>
              <span className="px-3 text-[10px] text-stone-400 font-bold uppercase tracking-wider font-mono">or register manually</span>
              <div className="h-[1px] w-full bg-[var(--border-subtle)]"></div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email Address</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex.doe@concordia.ca" className="input-field py-2" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Password</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-field py-2" />
            </div>

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
              <input required value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="Concordia University" className="input-field" />
            </div>

            {/* Skills selection */}
            <div className="col-span-full space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Choose At Least 3 Skills / Tags</label>
              <Combobox
                options={SKILL_OPTIONS}
                selected={skills}
                onChange={setSkills}
                placeholder="Select skills..."
                maxItems={5}
              />
            </div>

            {error && <p className="col-span-full text-xs text-rose-500 font-bold font-mono">{error}</p>}

            <button className="col-span-full btn-primary py-3 mt-2" type="submit" disabled={loading}>
              {loading ? "Registering Profile..." : "Complete Registration"}
            </button>

            <p className="col-span-full text-[11px] text-center text-stone-500 pt-2 font-mono">
              Already have a token or account?{" "}
              <Link href="/auth/login" className="text-[var(--accent-app)] font-bold hover:underline">Log in here</Link>
            </p>

          </form>
        ) : (
          <div className="text-center py-8 space-y-4 max-w-md mx-auto">
            <div className="space-y-1.5">
              <p className="font-serif font-bold text-emerald-600 text-lg uppercase tracking-tight">Profile Successfully Registered</p>
              <p className="text-sm text-stone-600 dark:text-stone-300">
                Welcome to Quorum, <span className="font-bold text-[var(--accent-app)]">{successProfile.fullName}</span> (@{successProfile.username}).
              </p>
            </div>
            <p className="text-xs text-stone-400 animate-pulse font-mono">Redirecting you to the dashboard...</p>
          </div>
        )}
      </Section>
    </div>
  );
}
