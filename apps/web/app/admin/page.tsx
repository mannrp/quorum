"use client";
import { useState } from "react";
import Link from "next/link";
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
  const [approvalAction, setApprovalAction] = useState<{ id: string; title: string; state: "PROFESSOR_APPROVED" | "CHANGES_REQUESTED" } | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [approving, setApproving] = useState(false);

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

  const executeApprovalAction = async () => {
    if (!approvalAction) return;
    setApproving(true);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation ReviewApproval($projectId: ID!, $state: ProjectApprovalState!, $reason: String) {
          reviewProjectApproval(projectId: $projectId, approvalState: $state, reason: $reason) {
            id
            approvalState
          }
        }`,
        { projectId: approvalAction.id, state: approvalAction.state, reason: approvalReason },
        token
      );
      setDeadlineNotice(`Project approval updated to ${approvalAction.state}.`);
      setApprovalAction(null);
      setApprovalReason("");
      await reload();
    } catch (err) {
      setDeadlineNotice(userFacingError(err));
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      <div className="border-b border-[var(--border-subtle)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Admin Console</h1>
          <p className="text-sm text-stone-500">Oversee Concordia capstone teams, projects, matchings, and overrides.</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] text-[var(--color-danger)] rounded-none text-xs font-bold font-mono uppercase tracking-wider">
          Admin Authority
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Syncing platform registries...</p></Section>}
      {error && <Section title="Error"><p className="text-xs text-rose-500 font-bold">{error}</p></Section>}

      {/* Stats row */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="panel p-6 space-y-1">
          <span className="text-stone-450 text-[10px] font-bold font-mono uppercase tracking-wider">Accounts</span>
          <p className="text-3xl font-bold font-serif text-[var(--accent-app)]">{users.length}</p>
        </div>
        <div className="panel p-6 space-y-1">
          <span className="text-stone-450 text-[10px] font-bold font-mono uppercase tracking-wider">Capstone Groups</span>
          <p className="text-3xl font-bold font-serif text-[var(--accent-app)]">{teams.length}</p>
        </div>
        <div className="panel p-6 space-y-1">
          <span className="text-stone-450 text-[10px] font-bold font-mono uppercase tracking-wider">Sponsor Posts</span>
          <p className="text-3xl font-bold font-serif text-[var(--accent-app)]">{projects.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-subtle)] gap-1.5 overflow-x-auto">
        {(["ACCOUNTS", "TEAMS", "PROJECTS", "DEADLINES", "AUDIT"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                isActive
                  ? "border-[var(--accent-app)] text-[var(--accent-app)] font-bold"
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
                      <div className="text-[10px] text-stone-400 font-mono">@{u.username}</div>
                    </td>
                    <td className="py-3">
                      <span className="rounded-none bg-[var(--bg-app)] px-2 py-0.5 text-[10px] border border-[var(--border-subtle)] font-mono font-bold">{u.discipline || "SOEN"}</span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleOpenDelete("USER", u.id, u.fullName)}
                        className="rounded-none px-2.5 py-1.5 text-[9px] font-bold border transition bg-[var(--color-danger-bg)] hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-danger)] border-[var(--color-danger)] uppercase tracking-wider font-mono"
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
              <div key={t.id} className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-3">
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-slate-200">{t.name}</p>
                  <p className="text-[10px] text-stone-500 font-mono">{t.members?.length || 0}/{t.maxSize} Members</p>
                </div>
                <button
                  onClick={() => handleOpenDelete("TEAM", t.id, t.name)}
                  className="rounded-none px-2.5 py-1.5 text-[9px] font-bold border transition bg-[var(--color-danger-bg)] hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-danger)] border-[var(--color-danger)] uppercase tracking-wider font-mono"
                >
                  Archive Team
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {activeTab === "PROJECTS" && (
        <div className="space-y-6">
          {/* Pending approvals */}
          <Section title="Pending Professor Approval">
            <div className="space-y-4">
              {projects.filter((p) => (p.approvalState || "UNVERIFIED") === "SUBMITTED_FOR_APPROVAL").map((p) => (
                <div key={p.id} className="p-4 border border-[var(--border-app)] rounded-none space-y-3 bg-[var(--bg-app)]">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-stone-900 dark:text-slate-200 font-serif uppercase tracking-tight">{p.title}</h4>
                      <p className="text-[10px] text-stone-500 font-mono">Proposed by {p.owner.fullName} ({p.owner.email})</p>
                    </div>
                    <Status value={p.approvalState || "UNVERIFIED"} />
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-3 font-sans leading-relaxed">{p.description}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setApprovalAction({ id: p.id, title: p.title, state: "PROFESSOR_APPROVED" })}
                      className="btn-primary py-1 px-3 text-[10px]"
                    >
                      Approve Project
                    </button>
                    <button
                      onClick={() => setApprovalAction({ id: p.id, title: p.title, state: "CHANGES_REQUESTED" })}
                      className="btn-secondary text-[var(--color-danger)] border-[var(--color-danger)] py-1 px-3 text-[10px]"
                    >
                      Request Changes
                    </button>
                    <Link href={`/projects/${p.id}`} className="btn-secondary py-1 px-3 text-[10px] flex items-center">
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
              {projects.filter((p) => (p.approvalState || "UNVERIFIED") === "SUBMITTED_FOR_APPROVAL").length === 0 && (
                <p className="text-xs text-stone-500 italic">No project proposals pending approval.</p>
              )}
            </div>
          </Section>

          {/* All Sponsor Challenge Posts */}
          <Section title="All Sponsor Challenge Posts">
            <div className="space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-stone-900 dark:text-slate-200 font-serif uppercase tracking-tight">{p.title}</p>
                    <div className="flex gap-1.5 items-center">
                      <Status value={p.status} />
                      <Status value={p.approvalState || "UNVERIFIED"} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/projects/${p.id}`} className="rounded-none px-2.5 py-1.5 text-[9px] font-bold border transition bg-[var(--bg-app)] hover:bg-[var(--accent-app)] hover:text-white text-[var(--text-app)] border-[var(--border-app)] uppercase tracking-wider font-mono flex items-center">
                      View
                    </Link>
                    <button
                      onClick={() => handleOpenDelete("PROJECT", p.id, p.title)}
                      className="rounded-none px-2.5 py-1.5 text-[9px] font-bold border transition bg-[var(--color-danger-bg)] hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-danger)] border-[var(--color-danger)] uppercase tracking-wider font-mono"
                    >
                      Archive Project
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
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
                    <td className="py-3 font-bold text-[var(--accent-app)]">{log.actionType}</td>
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

      {/* Professor Approval Action Modal */}
      <Modal isOpen={!!approvalAction} onClose={() => setApprovalAction(null)} title="Professor Project Review">
        {approvalAction && (
          <div className="space-y-4 text-xs">
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              Confirm decision to <strong>{approvalAction.state === "PROFESSOR_APPROVED" ? "Approve" : "Request Changes"}</strong> for project: <strong>&quot;{approvalAction.title}&quot;</strong>.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Review Feedback / Reason (Optional)</label>
              <textarea
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="Provide directions or feedback for the sponsor..."
                className="input-field min-h-16 text-xs"
              />
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
              <button onClick={() => setApprovalAction(null)} className="btn-secondary py-1 px-3 text-xs" disabled={approving}>Cancel</button>
              <button onClick={executeApprovalAction} className="btn-primary py-1 px-3 text-xs" disabled={approving}>
                {approving ? "Submitting Review..." : "Confirm Review"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
