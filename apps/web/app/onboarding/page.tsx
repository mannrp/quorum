"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Section, LoadingSkeleton } from "@/components/ui";
import { viewerClient } from "@/lib/auth-v2/viewer-client";
import type { SelfServiceRole } from "@/lib/auth-v2/viewer-contract";

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState<SelfServiceRole>("STUDENT");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void viewerClient.viewer()
      .then((result) => {
        if (result.state === "unauthenticated") router.replace("/auth/login");
        if (result.state === "ready") router.replace("/dashboard");
      })
      .catch(() => setError("Unable to load enrollment."))
      .finally(() => setLoading(false));
  }, [router]);

  const enroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await viewerClient.enroll(role);
      router.replace("/dashboard");
    } catch {
      setError("Enrollment could not be completed.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md py-12">
        <Section title="Choose your Quorum role">
          <LoadingSkeleton rows={3} />
        </Section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <Section title="Choose your Quorum role" className="shadow-none">
        <form className="space-y-4 pt-2" onSubmit={enroll}>
          <p className="text-sm text-stone-500">
            Choose how you will initially use Quorum. Professor and Admin access cannot be self-selected.
          </p>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Role</span>
            <select className="input-field" value={role} onChange={(event) => setRole(event.target.value as SelfServiceRole)}>
              <option value="STUDENT">Student</option>
              <option value="SPONSOR">Sponsor</option>
            </select>
          </label>
          {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
          <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
            {submitting ? "Enrolling..." : "Continue"}
          </button>
        </form>
      </Section>
    </div>
  );
}
