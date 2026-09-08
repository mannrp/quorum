"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Section, Modal, LoadingSkeleton } from "@/components/ui";
import { clearOperationCache, userFacingError } from "@/lib/operations/client";
import { operationRequest } from "@/lib/operations/client";
import type { User } from "@/types/domain";
import { linkGoogle, listSignInMethods, signOut, unlinkGoogle, type SignInMethod } from "@/lib/auth-v2/client-actions";
import { sessionClient, type BrowserSession } from "@/lib/auth-v2/session-client";
import { CredentialsPanel } from "./credentials-panel";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [signInMethods, setSignInMethods] = useState<SignInMethod[]>([]);
  const [updatingMethods, setUpdatingMethods] = useState(false);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [updatingSessions, setUpdatingSessions] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await operationRequest<{ me: User | null }>("ViewerProfileV1", {});
        if (!res.me) {
          router.push("/onboarding");
          return;
        }
        setMe(res.me);
        const [methods, activeSessions] = await Promise.all([listSignInMethods(), sessionClient.list()]);
        setSignInMethods(methods);
        setSessions(activeSessions);
      } catch (err) {
        setNotice(userFacingError(err));
      } finally {
        setLoading(false);
      }
    };
    void checkUser();
  }, [router]);

  const handleSessionRevocation = async (
    input: { scope: "ONE"; sessionId: string } | { scope: "OTHERS" | "ALL" },
  ) => {
    setUpdatingSessions(true);
    setNotice(null);
    try {
      const result = await sessionClient.revoke(input);
      if (result.revokedCurrent) {
        window.location.assign("/auth/login");
        return;
      }
      setSessions(await sessionClient.list());
      setNotice("Session access updated.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update sessions.");
    } finally {
      setUpdatingSessions(false);
    }
  };
  const handleLinkGoogle = async () => {
    setUpdatingMethods(true);
    setNotice(null);
    try {
      await linkGoogle();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not link Google.");
      setUpdatingMethods(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    setUpdatingMethods(true);
    setNotice(null);
    try {
      await unlinkGoogle();
      setSignInMethods(await listSignInMethods());
      setNotice("Google sign-in disconnected.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not unlink Google.");
    } finally {
      setUpdatingMethods(false);
    }
  };
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setNotice(null);
    try {
      await operationRequest("DeactivateAccountV1", { reason: "Self-service deactivation from settings" });
      try {
        await sessionClient.revoke({ scope: "ALL" });
      } catch {
        // Canonical account state already fails closed; continue clearing this browser session.
      }
      try {
        await signOut();
      } catch {
        // Revoking all sessions may already have invalidated the current Better Auth session.
      }
      window.location.assign("/");
    } catch (err) {
      setNotice(userFacingError(err));
    } finally {
      setDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  if (loading) {
    return <Section title="Account settings"><LoadingSkeleton rows={4} /></Section>;
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Account Security</h1>
        <p className="text-sm text-stone-500">Manage your active session and account deactivation options.</p>
      </div>

      <Section title="Active Quorum Session">
        {notice && (
          <div className="mb-3 rounded-none border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 text-xs font-mono font-semibold text-[var(--color-danger)]">
            {notice}
          </div>
        )}
        <div className="space-y-3">
          <p className="text-xs text-stone-500 leading-relaxed">
            Your browser session uses an opaque HttpOnly cookie. Reusable credentials are not exposed to this page.
          </p>
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 border border-[var(--border-subtle)] px-3 py-2 text-xs">
                <div>
                  <p className="font-semibold text-[var(--text-app)]">{session.current ? "This browser" : "Browser session"}</p>
                  <p className="text-stone-500">Started {new Date(session.createdAt).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary py-1.5 text-[10px]"
                  disabled={updatingSessions}
                  onClick={() => void handleSessionRevocation({ scope: "ONE", sessionId: session.id })}
                >
                  {session.current ? "Log out" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary py-2 text-xs" disabled={updatingSessions || sessions.length < 2} onClick={() => void handleSessionRevocation({ scope: "OTHERS" })}>Revoke other sessions</button>
            <button type="button" className="btn-secondary py-2 text-xs" disabled={updatingSessions} onClick={() => void handleSessionRevocation({ scope: "ALL" })}>Log out everywhere</button>
          </div>          <div className="grid gap-2 text-xs font-mono text-stone-500">
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

      <CredentialsPanel
        passwordEnabled={signInMethods.includes("password")}
        onPasswordChanged={async () => {
          clearOperationCache();
          setSessions(await sessionClient.list());
        }}
      />
      <Section title="Sign-in methods">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between border border-[var(--border-subtle)] px-3 py-3">
            <div>
              <p className="font-semibold text-[var(--text-app)]">Email and password</p>
              <p className="text-xs text-stone-500">{signInMethods.includes("password") ? "Connected" : "Not connected"}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border border-[var(--border-subtle)] px-3 py-3">
            <div>
              <p className="font-semibold text-[var(--text-app)]">Google</p>
              <p className="text-xs text-stone-500">{signInMethods.includes("google") ? "Connected" : "Not connected"}</p>
            </div>
            {signInMethods.includes("google") ? (
              <button
                type="button"
                className="btn-secondary py-2 text-xs"
                disabled={updatingMethods || signInMethods.length < 2}
                onClick={() => void handleUnlinkGoogle()}
                title={signInMethods.length < 2 ? "Add another sign-in method before disconnecting Google." : undefined}
              >
                {updatingMethods ? "Updating..." : "Disconnect"}
              </button>
            ) : (
              <button
                type="button"
                className="btn-secondary py-2 text-xs"
                disabled={updatingMethods}
                onClick={() => void handleLinkGoogle()}
              >
                {updatingMethods ? "Connecting..." : "Connect Google"}
              </button>
            )}
          </div>
          {signInMethods.length === 1 && (
            <p className="text-xs text-stone-500">Keep at least one sign-in method connected to avoid losing access.</p>
          )}
        </div>
      </Section>
      <Section title="Danger Zone" className="border-l-4 border-l-[var(--color-danger)]">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-stone-850 dark:text-stone-200">Deactivate Account</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Deactivation disables your Quorum profile and product access, revokes every browser session, and signs you out. Existing team and project records remain intact.
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
            <li>Your profile and product access will be disabled.</li>
            <li>Every browser session will be revoked.</li>
            <li>Existing workflow records remain for project integrity.</li>
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
