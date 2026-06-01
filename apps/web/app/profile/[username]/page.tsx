"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Section, Status, Badge } from "@/components/ui";
import { graphqlRequest, uploadToSignedPost, useGraphQL } from "@/lib/graphql";
import { PROFILE_QUERY } from "@/lib/queries";
import type { UploadSignature, User } from "@/types/domain";

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { data, error, loading, reload } = useGraphQL<{ user: User | null }>(PROFILE_QUERY, { username });
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const user = data?.user;

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setNotice(null);
    try {
      const result = await graphqlRequest<{ signUpload: UploadSignature }>(
        `mutation Sign($input: SignUploadInput!) { signUpload(input: $input) { url key publicUrl expiresAt fields { name value } } }`,
        { input: { kind: "RESUME", filename: file.name, contentType: file.type, size: file.size } },
      );
      await uploadToSignedPost(file, result.signUpload);
      await graphqlRequest(
        `mutation UpdateProfile($input: UpdateProfileInput!) { updateProfile(input: $input) { id resumeUrl } }`,
        {
          input: {
            fullName: user.fullName,
            bio: user.bio,
            discipline: user.discipline,
            university: user.university,
            linkedinUrl: user.linkedinUrl,
            githubUrl: user.githubUrl,
            portfolioUrl: user.portfolioUrl,
            resumeUrl: result.signUpload.publicUrl || result.signUpload.key,
            avatarUrl: user.avatarUrl,
          },
        },
      );
      setNotice("Resume uploaded and profile updated.");
      await reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <Section title="Loading"><p className="text-slate-400">Loading profile from GraphQL...</p></Section>;
  }

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Section title="Error">
          <p className="text-slate-400">{error || "User profile not found."}</p>
          <Link href="/" className="btn-secondary mt-4">Back Home</Link>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="panel flex flex-col items-center text-center space-y-4 md:col-span-1 h-fit">
          <div className="h-24 w-24 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-4xl text-teal-400">
            {user.fullName.charAt(0)}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-100">{user.fullName}</h2>
            <p className="text-sm text-slate-500">@{user.username}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            <Status value={user.discipline || "UNSET"} />
            <span className="text-xs text-slate-500">-</span>
            <span className="text-xs text-slate-400">{user.university || "Concordia"}</span>
          </div>
          <div className="flex justify-center gap-3 w-full pt-4 border-t border-slate-800/60 text-xs">
            {user.linkedinUrl && <a href={user.linkedinUrl} target="_blank" rel="noreferrer" className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-teal-400 hover:border-slate-700 transition">LinkedIn</a>}
            {user.githubUrl && <a href={user.githubUrl} target="_blank" rel="noreferrer" className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-teal-400 hover:border-slate-700 transition">GitHub</a>}
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Section title="About Me">
            <p className="leading-relaxed text-slate-300">{user.bio || "This user hasn't added a biography yet."}</p>
          </Section>

          <Section title="Acquired Skills & Specializations">
            <div className="flex flex-wrap gap-2">
              {(user.tags || []).map((tag) => <Badge key={tag.id} label={tag.name} type="tag" />)}
              {(!user.tags || user.tags.length === 0) && <p className="text-xs text-slate-500 italic">No skills listed yet.</p>}
            </div>
          </Section>

          <Section title="Resume Document">
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Direct uploads use GraphQL-signed R2 POST credentials and then update the profile with the stored asset URL.</p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="btn-secondary text-xs px-3 py-2 cursor-pointer relative overflow-hidden">
                  <span>{uploading ? "Uploading..." : "Upload Resume File"}</span>
                  <input type="file" accept=".pdf,.docx" onChange={handleResumeUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                </label>
                {user.resumeUrl ? <a href={user.resumeUrl} className="text-xs text-teal-400 hover:underline">Current resume</a> : <span className="text-xs text-slate-500 italic">No resume uploaded.</span>}
              </div>
              {notice && <p className="text-xs text-slate-400">{notice}</p>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
