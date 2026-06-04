"use client";
import { useState } from "react";
import { Section, Status, Modal } from "@/components/ui";
import { getAuthToken, graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
import { ADMIN_QUERY } from "@/lib/queries";
import type { Project, Team, User } from "@/types/domain";

type DeleteAction = {
  type: "USER" | "TEAM" | "PROJECT";
  id: string;
  name: string;
};

type AuditLog = {
  id: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId?: string | null;
  reason?: string | null;
  createdAt: string;
  actor?: Pick<User, "id" | "username" | "email" | "fullName"> | null;
};

export default function AdminPage() {
  const { data, error, loading, reload } = useGraphQL<{ users: User[]; teams: Team[]; projects: Project[]; auditLogs: AuditLog[] }>(ADMIN_QUERY, {}, { auth: true });
  const users = data?.users || [];
  const teams = data?.teams || [];
  const projects = data?.projects || [];
  const auditLogs = data?.auditLogs || [];

  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "TEAMS" | "PROJECTS" | "DEADLINES" | "AUDIT">("ACCOUNTS");
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteAction | null>(null);
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState("2026-06-15T23:59");
  const [deadlineNotice, setDeadlineNotice] = useState<string | null>(null);
  const [deadlineConfirmOpen, setDeadlineConfirmOpen] = useState(false);
  const [deadlineReason, setDeadlineReason] = useState("");

  const handleOpenDelete = (type: "USER" | "TEAM" | "PROJECT", id: string, name: string) => {
    setReason("");
    setDeleteConfirm({ type, id, name });
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    const token = getAuthToken();
    try {
      if (deleteConfirm.type === "USER") {
        await graphqlRequest(`mutation RemoveUser($id: ID!, $reason: String) { removeUser(userId: $id, reason: $reason) }`, { id: deleteConfirm.id, reason }, token);
      } else if (deleteConfirm.type === "TEAM") {
        await graphqlRequest(`mutation RemoveTeam($id: ID!, $reason: String) { removeTeam(teamId: $id, reason: $reason) }`, { id: deleteConfirm.id, reason }, token);
      } else if (deleteConfirm.type === "PROJECT") {
        await graphqlRequest(`mutation RemoveProject($id: ID!, $reason: String) { removeProject(projectId: $id, reason: $reason) }`, { id: deleteConfirm.id, reason }, token);
      }
    } catch (err) {
      setDeadlineNotice(userFacingError(err));
    } finally {
      setDeleteConfirm(null);
      setReason("");
      await reload();
    }
  };

  const handleDeadlineSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    setDeadlineReason("");
    setDeadlineConfirmOpen(true);
  };

  const executeDeadlineSave = async () => {
    setDeadlineNotice(null);
    try {
      const deadlineAt = new Date(deadline).toISOString();
      await graphqlRequest(
        `mutation SetDeadline($deadlineAt: String!, $reason: String) {
          setUniversalDeadline(deadlineAt: $deadlineAt, reason: $reason) { id deadlineAt updatedAt }
        }`,
        { deadlineAt, reason: deadlineReason },
        getAuthToken()
      );
      setDeadlineNotice("Universal match deadline saved and propagated.");
      setDeadlineConfirmOpen(false);
      await reload();
    } catch (err) {
      setDeadlineNotice(userFacingError(err));
      setDeadlineConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      <div className="border-b border-stone-250 dark:border-stone-850 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc] tracking-tight">Admin Console</h1>
          <p className="text-sm text-stone-500">Oversee Concordia capstone teams, projects, matchings, and overrides.</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-450 rounded-lg text-xs font-bold uppercase tracking-wider">
          Admin Authority
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Syncing platform registries...</p></Section>}
      {error && <Section title="Error"><p className="text-xs text-rose-500 font-bold">{error}</p></Section>}

      {/* Stats row */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="panel p-6 space-y-1">
          <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Accounts</span>
          <p className="text-3xl font-bold font-serif text-[#283593] dark:text-indigo-300">{users.length}</p>
        </div>
        <div className="panel p-6 space-y-1">
          <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Capstone Groups</span>
          <p className="text-3xl font-bold font-serif text-[#283593] dark:text-indigo-300">{teams.length}</p>
        </div>
        <div className="panel p-6 space-y-1">
          <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Sponsor Posts</span>
          <p className="text-3xl font-bold font-serif text-[#283593] dark:text-indigo-300">{projects.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 gap-1.5 overflow-x-auto">
        {(["ACCOUNTS", "TEAMS", "PROJECTS", "DEADLINES", "AUDIT"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                isActive
                  ? "border-[#283593] text-[#283593] dark:border-indigo-400 dark:text-indigo-300 font-bold"
                  : "border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Renders Tab Panels */}
      {activeTab === "ACCOUNTS" && (
        <Section title="Institutional Accounts">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-850 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 font-semibold">User details</th>
                  <th className="pb-3 font-semibold">Discipline</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3">
                      <div className="font-bold text-stone-900 dark:text-slate-200">{u.fullName}</div>
                      <div className="text-[10px] text-stone-400">@{u.username}</div>
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[10px] border border-stone-250 dark:border-stone-750 font-bold">{u.discipline || "SOEN"}</span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleOpenDelete("USER", u.id, u.fullName)}
                        className="rounded px-2.5 py-1.5 text-[9px] font-bold border transition bg-rose-50 hover:bg-rose-500 hover:text-white dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-200/50 dark:border-rose-900/50 uppercase tracking-wider"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {activeTab === "TEAMS" && (
        <Section title="Capstone Groups">
          <div className="space-y-3">
            {teams.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-3">
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-slate-200">{t.name}</p>
                  <p className="text-[10px] text-stone-500">{t.members?.length || 0}/{t.maxSize} Members</p>
                </div>
                <button
                  onClick={() => handleOpenDelete("TEAM", t.id, t.name)}
                  className="rounded px-2.5 py-1.5 text-[9px] font-bold border transition bg-rose-50 hover:bg-rose-500 hover:text-white dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-200/50 dark:border-rose-900/50 uppercase tracking-wider"
                >
                  Archive Team
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {activeTab === "PROJECTS" && (
        <Section title="Sponsor Challenge Posts">
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-stone-900 dark:text-slate-200">{p.title}</p>
                  <Status value={p.status} />
                </div>
                <button
                  onClick={() => handleOpenDelete("PROJECT", p.id, p.title)}
                  className="rounded px-2.5 py-1.5 text-[9px] font-bold border transition bg-rose-50 hover:bg-rose-500 hover:text-white dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-200/50 dark:border-rose-900/50 uppercase tracking-wider"
                >
                  Archive Project
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {activeTab === "DEADLINES" && (
        <Section title="Capstone Deadlines Configuration">
          <form onSubmit={handleDeadlineSaveClick} className="space-y-4 max-w-md pt-2">
            {deadlineNotice && <p className="text-xs text-emerald-600 font-bold">{deadlineNotice}</p>}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Universal Match Deadline</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="input-field py-2 text-xs"
              />
            </div>
            <button type="submit" className="btn-primary py-2 px-4 text-xs">
              Commit Deadlines
            </button>
          </form>
        </Section>
      )}

      {activeTab === "AUDIT" && (
        <Section title="Platform Override Audit Logs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-850 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Action type</th>
                  <th className="pb-3 font-semibold">Admin Account</th>
                  <th className="pb-3 font-semibold">Target Entity</th>
                  <th className="pb-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-600 dark:text-slate-350 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 font-bold text-[#283593] dark:text-indigo-400">{log.actionType}</td>
                    <td className="py-3">{log.actor?.email || log.actor?.username || "system"}</td>
                    <td className="py-3">{log.targetEntityType}{log.targetEntityId ? ` (${log.targetEntityId})` : ""}</td>
                    <td className="py-3 text-stone-400">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td className="py-4 text-stone-400" colSpan={4}>No audit logs returned by the backend.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Destructive Override Confirmation">
        {deleteConfirm && (
          <div className="space-y-4 text-xs">
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              Are you sure you want to {deleteConfirm.type === "USER" ? "deactivate" : "archive"} the {deleteConfirm.type.toLowerCase()} <strong>&quot;{deleteConfirm.name}&quot;</strong>?
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Override Reason (Required)</label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Specify compliance or administrative reason..."
                className="input-field min-h-16 text-xs"
              />
            </div>
            <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
              ⚠️ This will update the status of the entity on the platform. Historical logs will be preserved.
            </p>
            <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary py-1 px-3 text-xs">Cancel</button>
              <button onClick={handleExecuteDelete} disabled={!reason.trim()} className="btn-primary bg-rose-600 hover:bg-rose-700 py-1 px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed">Confirm Action</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Deadline Confirmation Modal */}
      <Modal isOpen={deadlineConfirmOpen} onClose={() => setDeadlineConfirmOpen(false)} title="Deadline Update Confirmation">
        <div className="space-y-4 text-xs">
          <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
            Are you sure you want to change the universal capstone matching deadline to <strong>{new Date(deadline).toLocaleString()}</strong>?
          </p>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Reason for Extension/Change (Required)</label>
            <textarea
              required
              value={deadlineReason}
              onChange={(e) => setDeadlineReason(e.target.value)}
              placeholder="e.g., Extension requested by course coordinator..."
              className="input-field min-h-16 text-xs"
            />
          </div>
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
            ⚠️ Changing the deadline changes the match eligibility window. Active offers or invites exceeding this new time will expire.
          </p>
          <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
            <button onClick={() => setDeadlineConfirmOpen(false)} className="btn-secondary py-1 px-3 text-xs">Cancel</button>
            <button onClick={executeDeadlineSave} disabled={!deadlineReason.trim()} className="btn-primary py-1 px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed">Confirm & Propagate</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
