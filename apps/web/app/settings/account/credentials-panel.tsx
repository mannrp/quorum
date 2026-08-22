"use client";

import { useState, type FormEvent } from "react";
import { Section } from "@/components/ui";
import { changeCurrentPassword, requestEmailChange } from "@/lib/auth-v2/client-actions";

type Props = Readonly<{
  passwordEnabled: boolean;
  onPasswordChanged: () => Promise<void>;
}>;

export function CredentialsPanel({ passwordEnabled, onPasswordChanged }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState<"password" | "email" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("password");
    setNotice(null);
    try {
      await changeCurrentPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      await onPasswordChanged();
      setNotice("Password changed. Other sessions were revoked.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setBusy(null);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("email");
    setNotice(null);
    try {
      await requestEmailChange(newEmail);
      setNewEmail("");
      setNotice("Check your current email, then the new address, to finish the change.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not request email change.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Credentials">
      <div className="space-y-5">
        {notice && <p role="status" className="text-xs font-semibold text-[var(--text-app)]">{notice}</p>}
        {passwordEnabled && (
          <form className="space-y-3" onSubmit={submitPassword}>
            <h2 className="text-sm font-semibold text-[var(--text-app)]">Change password</h2>
            <label className="block text-xs font-semibold text-stone-500">
              Current password
              <input className="input mt-1 w-full" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-stone-500">
              New password
              <input className="input mt-1 w-full" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <button className="btn-secondary py-2 text-xs" type="submit" disabled={busy !== null}>
              {busy === "password" ? "Changing password..." : "Change password"}
            </button>
          </form>
        )}
        <form className="space-y-3 border-t border-[var(--border-subtle)] pt-4" onSubmit={submitEmail}>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-app)]">Change email</h2>
            <p className="text-xs text-stone-500">Confirmation is required from both your current and new mailboxes.</p>
          </div>
          <label className="block text-xs font-semibold text-stone-500">
            New email address
            <input className="input mt-1 w-full" type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
          </label>
          <button className="btn-secondary py-2 text-xs" type="submit" disabled={busy !== null}>
            {busy === "email" ? "Sending confirmation..." : "Request email change"}
          </button>
        </form>
      </div>
    </Section>
  );
}