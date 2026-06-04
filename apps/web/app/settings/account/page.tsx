"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Section, Modal } from "@/components/ui";
import { AUTH_TOKEN_KEY, getAuthToken, graphqlRequest, userFacingError } from "@/lib/graphql";
import { ME_QUERY } from "@/lib/queries";
import type { User } from "@/types/domain";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const activeToken = getAuthToken();
      if (!activeToken) {
        router.push("/auth/login");
        return;
      }
      setToken(activeToken);
      try {
        const res = await graphqlRequest<{ me: User | null }>(ME_QUERY, {}, activeToken);
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
      const activeToken = getAuthToken();
      if (me?.id) {
        await graphqlRequest(
          `mutation RemoveUser($id: ID!) { removeUser(userId: $id) }`,
          { id: me.id },
          activeToken
        );
      }
      localStorage.removeItem(AUTH_TOKEN_KEY);
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
      <div className="border-b border-stone-200 dark:border-stone-850 pb-4">
        <h1 className="text-3xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc]">Account Security</h1>
        <p className="text-sm text-stone-500">Manage active auth tokens, dev credentials, and account termination options.</p>
      </div>

      <Section title="Active Neon Auth Session">
        {notice && (
          <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
            {notice}
          </div>
        )}
        <div className="space-y-3">
          <p className="text-xs text-stone-500 leading-relaxed">
            Your active browser session utilizes the Neon Auth bearer JWT listed below to validate operations with the GraphQL service.
          </p>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Bearer Token</label>
            <textarea
              readOnly
              value={token}
              className="input-field min-h-24 font-mono text-xs bg-stone-50 dark:bg-stone-900/60 border border-stone-250 dark:border-stone-850 text-stone-600 dark:text-stone-400 select-all cursor-text"
            />
          </div>
        </div>
      </Section>

      <Section title="Danger Zone" className="border-l-4 border-l-rose-500">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">Deactivate / Delete Account</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Terminating your Quorum profile will immediately withdraw all pending project applications, remove you from your active team membership roster, and delete your academic resume from our storage buckets.
            </p>
          </div>

          <button
            onClick={() => setIsDeleteOpen(true)}
            className="rounded-md border border-rose-250 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-450 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-900 transition cursor-pointer"
          >
            Permanently Terminate Account
          </button>
        </div>
      </Section>

      {/* Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Account Termination">
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Are you absolutely sure you want to delete your Quorum profile? This operation is <strong className="text-rose-500">final and cannot be undone</strong>.
          </p>
          <ul className="list-disc pl-5 text-xs text-stone-500 space-y-1 leading-relaxed">
            <li>You will be removed from your capstone team.</li>
            <li>All applications submitted by you will be withdrawn.</li>
            <li>Your inbox and chat history will be archived.</li>
          </ul>
          <div className="flex gap-3 justify-end pt-4 border-t border-stone-200 dark:border-stone-800">
            <button onClick={() => setIsDeleteOpen(false)} className="btn-secondary py-2 text-xs">
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-700 active:scale-[0.98] transition cursor-pointer"
            >
              {deleting ? "Deleting profile..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
