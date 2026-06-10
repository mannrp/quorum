"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Section, Modal } from "@/components/ui";
import { graphqlRequest, userFacingError } from "@/lib/graphql";
import { ME_QUERY } from "@/lib/queries";
import type { User } from "@/types/domain";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, { auth: true });
        if (!res.me) {
          router.push("/onboarding");
          return;
        }
        setMe(res.me);
      } catch (err) {
        setNotice(userFacingError(err));
      } finally {
        setLoading(false);
      }
    };
    void checkUser();
  }, [router]);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setNotice(null);
    try {
      await graphqlRequest(
        `mutation DeactivateAccount($reason: String) { deactivateAccount(reason: $reason) }`,
        { reason: "Self-service deactivation from settings" },
        { auth: true }
      );
      router.push("/");
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  if (loading) {
    return <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Loading settings cockpit...</p></Section>;
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Account Security</h1>
        <p className="text-sm text-stone-500">Manage your active session and account deactivation options.</p>
      </div>

      <Section title="Active Neon Auth Session">
        {notice && (
          <div className="mb-3 rounded-none border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 text-xs font-mono font-semibold text-[var(--color-danger)]">
            {notice}
          </div>
        )}
        <div className="space-y-3">
          <p className="text-xs text-stone-500 leading-relaxed">
            You are signed in through Neon Auth. Quorum forwards session credentials server-side when protected GraphQL operations are required.
          </p>
          <div className="grid gap-2 text-xs font-mono text-stone-500">
            <div className="flex justify-between border border-[var(--border-subtle)] px-3 py-2">
              <span>Profile</span>
              <span className="font-bold text-[var(--text-app)]">{me?.username ? `@${me.username}` : "Not linked"}</span>
            </div>
            <div className="flex justify-between border border-[var(--border-subtle)] px-3 py-2">
              <span>Email</span>
              <span className="font-bold text-[var(--text-app)]">{me?.email || "Not provided"}</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Danger Zone" className="border-l-4 border-l-[var(--color-danger)]">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-stone-850 dark:text-stone-200">Deactivate Account</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Terminating your Quorum profile will immediately withdraw all pending project applications, remove you from your active team membership roster, and deactivate your academic profile.
            </p>
          </div>

          <button
            onClick={() => setIsDeleteOpen(true)}
            className="rounded-none border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white transition cursor-pointer"
          >
            Permanently Deactivate Account
          </button>
        </div>
      </Section>

      {/* Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Account Deactivation">
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Are you absolutely sure you want to deactivate your Quorum profile? This operation is <strong className="text-[var(--color-danger)]">final and cannot be undone</strong>.
          </p>
          <ul className="list-disc pl-5 text-xs text-stone-500 space-y-1 leading-relaxed">
            <li>You will be removed from your capstone team.</li>
            <li>All applications submitted by you will be withdrawn.</li>
            <li>Your inbox and profile details will be deactivated/archived.</li>
          </ul>
          <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border-subtle)]">
            <button onClick={() => setIsDeleteOpen(false)} className="btn-secondary py-2 text-xs">
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="inline-flex items-center justify-center rounded-none bg-[var(--color-danger)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-700 transition cursor-pointer"
            >
              {deleting ? "Deactivating profile..." : "Confirm Deactivation"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
