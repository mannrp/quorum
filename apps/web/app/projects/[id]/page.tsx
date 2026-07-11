"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Section, Status, Badge, Modal } from "@/components/ui";
import { graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
import { PROJECT_QUERY } from "@/lib/queries";
import type { Project, Team, User } from "@/types/domain";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useGraphQL<{ project: Project | null }>(PROJECT_QUERY, { id });
  
  const [me, setMe] = useState<User | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [interest, setInterest] = useState("");
  const [experience, setExperience] = useState("");
  const [approach, setApproach] = useState("");
  const [message, setMessage] = useState("");
  const [customAnswers, setCustomAnswers] = useState<string[]>([]);
  const [isReviewStep, setIsReviewStep] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitApprovalOpen, setIsSubmitApprovalOpen] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const project = data?.project;

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const sessionRes = await graphqlRequest<{ me: User | null; teams: Team[] }>(
          `query projectDetailSession {
            me { id username fullName }
            teams { id name maxSize createdBy { id } members { user { id } role } }
          }`,
          {},
          { auth: true }
        );
        if (sessionRes.me) {
          setMe(sessionRes.me);
          const userTeam = sessionRes.teams.find((t) =>
            t.members.some((m) => m.user.id === sessionRes.me?.id)
          );
          if (userTeam) setMyTeam(userTeam);
        }
      } catch (err) {
        setNotice(userFacingError(err));
      }
    };
    void fetchSessionData();
  }, []);

  const handleApplySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!myTeam || !project) return;
    setNotice(null);
    setSubmitting(true);

    const answerPayload = JSON.stringify({
      defaultQuestions: {
        interest,
        experience,
        approach
      },
      customQuestions: project.applicationQuestions || "",
      customAnswers: customAnswers,
      submittedAt: new Date().toISOString()
    });

    try {
      await graphqlRequest(
        `mutation Apply($input: ApplyToProjectInput!) {
          applyToProjectInput(input: $input) { id status }
        }`,
        { input: { projectId: id, teamId: myTeam.id, message, answers: answerPayload } },
        { auth: true }
      );
      setNotice("Application submitted successfully.");
      setIsApplyOpen(false);
      // reset form
      setInterest("");
      setExperience("");
      setApproach("");
      setMessage("");
      setCustomAnswers([]);
      setIsReviewStep(false);
      await reload();
    } catch (err) {
      setNotice(userFacingError(err));
      setIsApplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSubmitApproval = async () => {
    setSubmittingApproval(true);
    setNotice(null);
    try {
      await graphqlRequest(
        `mutation SubmitApproval($projectId: ID!) {
          submitProjectForApproval(projectId: $projectId) {
            id
            approvalState
          }
        }`,
        { projectId: id },
        { auth: true }
      );
      setNotice("Project successfully submitted for professor approval!");
      setIsSubmitApprovalOpen(false);
      await reload();
    } catch (err) {
      setNotice(userFacingError(err));
      setIsSubmitApprovalOpen(false);
    } finally {
      setSubmittingApproval(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Section title="Loading">
          <p className="text-xs text-[var(--muted-app)] animate-pulse">Syncing project records...</p>
        </Section>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Section title="Error Notice">
          <p className="text-xs text-[var(--muted-app)]">{error || "The requested capstone project does not exist."}</p>
          <Link href="/projects" className="btn-secondary mt-4 inline-block text-xs">Back to Projects Registry</Link>
        </Section>
      </div>
    );
  }

  // Check eligibility details
  const myRole = myTeam?.members.find((m) => m.user.id === me?.id)?.role;
  const isEligibleToApply = myTeam && (myRole === "LEAD" || myRole === "CO_LEAD");

  return (
    <div className="dashboard-stage mx-auto max-w-6xl space-y-8 px-4 py-4">
      {/* Project Header */}
      <div className="workspace-hero flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-4">
          <span className="page-kicker">Project brief</span>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-normal text-[var(--text-app)] md:text-5xl">{project.title}</h1>
            <Status value={project.status} />
            <Status value={project.approvalState || "UNVERIFIED"} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {project.disciplines.map((discipline) => (
              <Badge key={discipline} label={discipline} type="discipline" />
            ))}
          </div>
          {notice && <p className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-success)]">{notice}</p>}
        </div>

        {me && me.id !== project.owner.id ? (
          <button
            onClick={() => setIsApplyOpen(true)}
            disabled={project.status === "CLAIMED"}
            className={`btn-primary w-full sm:w-auto text-xs ${project.status === "CLAIMED" ? "opacity-50 cursor-not-allowed hover:bg-[var(--btn-primary-hover)]" : ""}`}
          >
            {project.status === "CLAIMED" ? "Project Claimed" : "Apply with Team"}
          </button>
        ) : me ? (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
            <Link href={`/projects/${id}/edit`} className="btn-secondary py-2 px-3.5 text-xs text-center">
              Edit Project
            </Link>
            {project.permissions?.canSubmitForApproval && (project.approvalState || "UNVERIFIED") !== "PROFESSOR_APPROVED" && (project.approvalState || "UNVERIFIED") !== "SUBMITTED_FOR_APPROVAL" && (
              <button
                onClick={() => setIsSubmitApprovalOpen(true)}
                className="btn-primary py-2 px-3.5 text-xs"
              >
                Submit for Approval
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsApplyOpen(true)}
            disabled={project.status === "CLAIMED"}
            className={`btn-primary w-full sm:w-auto text-xs ${project.status === "CLAIMED" ? "opacity-50 cursor-not-allowed hover:bg-[var(--btn-primary-hover)]" : ""}`}
          >
            {project.status === "CLAIMED" ? "Project Claimed" : "Apply with Team"}
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_0.8fr]">
        {/* Scope and Application Lists */}
        <div className="space-y-5">
          <Section title="Capstone Scope & Objectives">
            <p className="text-sm leading-6 text-[var(--muted-app)]">{project.description}</p>
            {project.constraints && (
              <div className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-4">
                <h4 className="text-xs font-bold text-[var(--text-app)]">Licensing & hardware constraints</h4>
                <p className="text-xs leading-relaxed text-[var(--muted-app)]">{project.constraints}</p>
              </div>
            )}
          </Section>

          {/* Received applications */}
          <Section title="Received Roster Claims">
            {project.applications.length > 0 ? (
              <div className="stagger-in space-y-3">
                {project.applications.map((application) => (
                  <div key={application.id} className="signal-card flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Link href={`/teams/${application.team.id}`} className="card-title text-sm">
                        {application.team.name}
                      </Link>
                      {application.message && (
                        <p className="text-xs italic text-[var(--muted-app)] line-clamp-2">&quot;{application.message}&quot;</p>
                      )}
                    </div>
                    <Status value={application.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-[var(--muted-app)]">No applications received yet.</p>
            )}
          </Section>
        </div>

        {/* Sidebar Specifications */}
        <div className="space-y-5">
          <Section title="Target Criteria">
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--muted-app)]">Min team size</span>
                <span className="font-semibold text-[var(--text-app)]">{project.teamSizeMin} students</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--muted-app)]">Max team size</span>
                <span className="font-semibold text-[var(--text-app)]">{project.teamSizeMax} students</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--muted-app)]">Sponsor owner</span>
                <Link href={`/profile/${project.owner.username}`} className="font-semibold text-[var(--accent-app)]">
                  {project.owner.fullName}
                </Link>
              </div>
              {me && me.id !== project.owner.id && (
                <div className="pt-2">
                  <Link href={`/inbox?userId=${project.owner.id}`} className="btn-secondary w-full py-1.5 text-[11px] block text-center">
                    ✉ Message Owner
                  </Link>
                </div>
              )}
            </div>
          </Section>

          <Section title="Challenge Documents">
            <div className="space-y-3">
              {project.fileUrl || project.videoUrl ? (
                <div className="space-y-2">
                  {project.fileUrl && (
                    <a href={project.fileUrl} target="_blank" rel="noreferrer" className="action-row">
                      <span>Specifications sheet</span>
                      <span>-&gt;</span>
                      📄 Specifications Sheet.pdf
                    </a>
                  )}
                  {project.videoUrl && (
                    <a href={project.videoUrl} target="_blank" rel="noreferrer" className="action-row">
                      <span>Video brief</span>
                      <span>-&gt;</span>
                      🎬 Video Brief / Requirements
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--muted-app)]">No attachments attached.</p>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Application Form Modal */}
      <Modal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} title={`Claim Project: ${project.title}`}>
        {!me ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-stone-500">You must log in to submit a project application.</p>
            <Link href="/auth/login" className="btn-primary py-1.5 px-3 text-xs inline-block">Log In</Link>
          </div>
        ) : !myTeam ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-xs text-stone-500">You do not currently belong to a capstone team. You must form or join a team before applying.</p>
            <div className="flex gap-2 justify-center">
              <Link href="/teams/new" className="btn-primary py-1.5 px-3.5 text-xs">Form Team</Link>
              <button onClick={() => setIsApplyOpen(false)} className="btn-secondary py-1.5 px-3.5 text-xs">Cancel</button>
            </div>
          </div>
        ) : !isEligibleToApply ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-xs text-stone-500">Only Team Leads or Co-Leads are authorized to apply for project claims on behalf of a team.</p>
            <p className="text-[10px] text-stone-400">Current Role in &quot;{myTeam.name}&quot;: {myRole}</p>
            <button onClick={() => setIsApplyOpen(false)} className="btn-secondary py-1.5 px-3.5 text-xs mt-2">Dismiss</button>
          </div>
        ) : (
          (() => {
            let customQuestionsList: string[] = [];
            try {
              if (project?.applicationQuestions) {
                customQuestionsList = JSON.parse(project.applicationQuestions);
                if (!Array.isArray(customQuestionsList)) {
                  customQuestionsList = [];
                }
              }
            } catch (e) {
              if (project?.applicationQuestions?.trim()) {
                customQuestionsList = [project.applicationQuestions];
              }
            }

            const handleCustomAnswerChange = (idx: number, val: string) => {
              setCustomAnswers((prev) => {
                const next = [...prev];
                next[idx] = val;
                return next;
              });
            };

            const handleNextStep = (e: React.FormEvent) => {
              e.preventDefault();
              setIsReviewStep(true);
            };

            if (isReviewStep) {
              return (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-[10px] border-l-4 border-l-amber-500 text-stone-700 dark:text-slate-350 leading-relaxed font-semibold">
                    Please review your application responses carefully before submitting.
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-xs">
                    <div className="space-y-1">
                      <h4 className="font-bold text-stone-500 uppercase text-[9px] font-mono">1. Interest in Project</h4>
                      <p className="bg-[var(--bg-app)] p-2.5 rounded-none border border-[var(--border-app)] whitespace-pre-wrap">{interest || "(Blank)"}</p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-stone-500 uppercase text-[9px] font-mono">2. Team Skills & Experience</h4>
                      <p className="bg-[var(--bg-app)] p-2.5 rounded-none border border-[var(--border-app)] whitespace-pre-wrap">{experience || "(Blank)"}</p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-stone-500 uppercase text-[9px] font-mono">3. Team Project Approach</h4>
                      <p className="bg-[var(--bg-app)] p-2.5 rounded-none border border-[var(--border-app)] whitespace-pre-wrap">{approach || "(Blank)"}</p>
                    </div>

                    {customQuestionsList.map((q, idx) => (
                      <div key={idx} className="space-y-1">
                        <h4 className="font-bold text-stone-500 uppercase text-[9px] font-mono">Custom: {q}</h4>
                        <p className="bg-[var(--bg-app)] p-2.5 rounded-none border border-[var(--border-app)] whitespace-pre-wrap">{customAnswers[idx] || "(Blank)"}</p>
                      </div>
                    ))}

                    {message && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-stone-500 uppercase text-[9px] font-mono">Additional Message</h4>
                        <p className="bg-[var(--bg-app)] p-2.5 rounded-none border border-[var(--border-app)] whitespace-pre-wrap">{message}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
                    <button type="button" onClick={() => setIsReviewStep(false)} className="btn-secondary py-2 text-xs" disabled={submitting}>
                      Back to Edit
                    </button>
                    <button onClick={(e) => void handleApplySubmit(e)} className="btn-primary py-2 text-xs" disabled={submitting}>
                      {submitting ? "Submitting Application..." : "Confirm & Submit Claims"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="p-3 bg-[var(--color-info-bg)] text-[10px] border-l-4 border-l-[var(--color-info)] text-[var(--color-info)] leading-relaxed rounded-none font-mono">
                  Applying on behalf of team: <strong>{myTeam.name}</strong> ({myTeam.maxSize} max slots).
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">1. Why is your team interested in this project?</label>
                    <textarea
                      required
                      value={interest}
                      onChange={(e) => setInterest(e.target.value)}
                      className="input-field text-xs min-h-16"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">2. What relevant skills or experience does your team bring?</label>
                    <textarea
                      required
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="input-field text-xs min-h-16"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">3. How would your team approach the project?</label>
                    <textarea
                      required
                      value={approach}
                      onChange={(e) => setApproach(e.target.value)}
                      className="input-field text-xs min-h-16"
                    />
                  </div>

                  {customQuestionsList.map((q, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Custom: {q}</label>
                      <textarea
                        required
                        value={customAnswers[idx] || ""}
                        onChange={(e) => handleCustomAnswerChange(idx, e.target.value)}
                        className="input-field text-xs min-h-16"
                      />
                    </div>
                  ))}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Additional Message to Sponsor</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="input-field text-xs min-h-16"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
                  <button type="button" onClick={() => setIsApplyOpen(false)} className="btn-secondary py-2 text-xs" disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary py-2 text-xs" disabled={submitting}>
                    Continue to Review
                  </button>
                </div>
              </form>
            );
          })()
        )}
      </Modal>

      {/* Submit for Approval Confirmation Modal */}
      <Modal isOpen={isSubmitApprovalOpen} onClose={() => setIsSubmitApprovalOpen(false)} title="Submit Capstone Project for Approval">
        <div className="space-y-4 text-xs">
          <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
            Are you sure you want to submit this project challenge for professor approval?
          </p>
          <p className="text-stone-500">
            Once submitted, course directors and professors will be notified to review the details, constraints, and scope. You will receive updates on the status dashboard.
          </p>
          <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
            <button onClick={() => setIsSubmitApprovalOpen(false)} className="btn-secondary py-1.5 text-xs" disabled={submittingApproval}>
              Cancel
            </button>
            <button onClick={handleConfirmSubmitApproval} className="btn-primary py-1.5 text-xs" disabled={submittingApproval}>
              {submittingApproval ? "Submitting..." : "Confirm Submission"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
