"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Section, Status, Badge, Modal } from "@/components/ui";
import { getAuthToken, graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
import { PROJECT_QUERY } from "@/lib/queries";
import type { Project, Team, User } from "@/types/domain";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useGraphQL<{ project: Project | null }>(PROJECT_QUERY, { id });
  
  const [me, setMe] = useState<User | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [answers, setAnswers] = useState({
    q1: "We are extremely interested in this project due to our experience in container orchestration.",
    q2: "Our team has completed coursework in SOEN 387 and has hands-on React / Node.js skills.",
    q3: "We will adopt a test-driven development flow and build an automated CI/CD pipeline.",
    message: "We have complete discipline coverage for this project scope."
  });

  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const project = data?.project;

  useEffect(() => {
    const fetchSessionData = async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        const meRes = await graphqlRequest<{ me: User | null }>(
          `query meProjectDetail { me { id username fullName } }`,
          {},
          token
        );
        if (meRes.me) {
          setMe(meRes.me);
          // Check if associated with a team
          const teamRes = await graphqlRequest<{ teams: Team[] }>(
            `query myTeamsProject { teams { id name maxSize createdBy { id } members { user { id } role } } }`,
            {},
            token
          );
          
          const userTeam = teamRes.teams.find((t) =>
            t.members.some((m) => m.user.id === meRes.me?.id)
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
        interest: answers.q1,
        experience: answers.q2,
        approach: answers.q3
      },
      customQuestions: project.applicationQuestions || "",
      submittedAt: new Date().toISOString()
    });

    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation Apply($input: ApplyToProjectInput!) {
          applyToProjectInput(input: $input) { id status }
        }`,
        { input: { projectId: id, teamId: myTeam.id, message: answers.message, answers: answerPayload } },
        token
      );
      setNotice("Application submitted successfully.");
      setIsApplyOpen(false);
      await reload();
    } catch (err) {
      setNotice(userFacingError(err));
      setIsApplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <Section title="Loading">
          <p className="text-xs text-stone-500 animate-pulse uppercase tracking-wider">Syncing project records...</p>
        </Section>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Section title="Error Notice">
          <p className="text-stone-400 text-xs">{error || "The requested capstone project does not exist."}</p>
          <Link href="/projects" className="btn-secondary mt-4 inline-block text-xs">Back to Projects Registry</Link>
        </Section>
      </div>
    );
  }

  // Check eligibility details
  const myRole = myTeam?.members.find((m) => m.user.id === me?.id)?.role;
  const isEligibleToApply = myTeam && (myRole === "LEAD" || myRole === "CO_LEAD");

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      {/* Project Header */}
      <div className="panel flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc] tracking-tight">{project.title}</h1>
            <Status value={project.status} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {project.disciplines.map((discipline) => (
              <Badge key={discipline} label={discipline} type="discipline" />
            ))}
          </div>
          {notice && <p className="text-xs text-emerald-600 font-bold">{notice}</p>}
        </div>

        <button
          onClick={() => setIsApplyOpen(true)}
          disabled={project.status === "CLAIMED"}
          className={`btn-primary w-full sm:w-auto text-xs ${project.status === "CLAIMED" ? "opacity-50 cursor-not-allowed hover:bg-[#283593]" : ""}`}
        >
          {project.status === "CLAIMED" ? "Project Claimed" : "Apply with Team"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Scope and Application Lists */}
        <div className="md:col-span-2 space-y-6">
          <Section title="Capstone Scope & Objectives">
            <p className="leading-relaxed text-stone-600 dark:text-slate-350 text-xs">{project.description}</p>
            {project.constraints && (
              <div className="mt-4 space-y-2 pt-4 border-t border-stone-200 dark:border-stone-850">
                <h4 className="text-xs font-bold text-stone-800 dark:text-slate-200">Licensing & Hardware Constraints:</h4>
                <p className="text-xs text-stone-500 leading-relaxed">{project.constraints}</p>
              </div>
            )}
          </Section>

          {/* Received applications */}
          <Section title="Received Roster Claims">
            {project.applications.length > 0 ? (
              <div className="space-y-4 divide-y divide-stone-150 dark:divide-stone-850">
                {project.applications.map((application) => (
                  <div key={application.id} className="pt-4 first:pt-0 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Link href={`/teams/${application.team.id}`} className="font-bold text-stone-900 dark:text-indigo-300 hover:underline text-xs">
                        {application.team.name}
                      </Link>
                      {application.message && (
                        <p className="text-[11px] text-stone-400 italic line-clamp-2">&quot;{application.message}&quot;</p>
                      )}
                    </div>
                    <Status value={application.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic text-center py-4">No applications received yet.</p>
            )}
          </Section>
        </div>

        {/* Sidebar Specifications */}
        <div className="space-y-6">
          <Section title="Target Criteria">
            <div className="space-y-4 text-xs">
              <div className="flex justify-between py-2 border-b border-stone-200 dark:border-stone-800">
                <span className="text-stone-500">Min Team Size:</span>
                <span className="font-semibold text-stone-800 dark:text-slate-200">{project.teamSizeMin} Students</span>
              </div>
              <div className="flex justify-between py-2 border-b border-stone-200 dark:border-stone-800">
                <span className="text-stone-500">Max Team Size:</span>
                <span className="font-semibold text-stone-800 dark:text-slate-200">{project.teamSizeMax} Students</span>
              </div>
              <div className="flex justify-between py-2 border-b border-stone-200 dark:border-stone-800">
                <span className="text-stone-500">Sponsor Owner:</span>
                <Link href={`/profile/${project.owner.username}`} className="font-semibold text-[#283593] dark:text-indigo-400">
                  {project.owner.fullName}
                </Link>
              </div>
            </div>
          </Section>

          <Section title="Challenge Documents">
            <div className="space-y-3">
              {project.fileUrl || project.videoUrl ? (
                <div className="space-y-2">
                  {project.fileUrl && (
                    <a href={project.fileUrl} target="_blank" rel="noreferrer" className="block text-xs text-[#283593] dark:text-indigo-400 hover:underline font-semibold">
                      📄 Specifications Sheet.pdf
                    </a>
                  )}
                  {project.videoUrl && (
                    <a href={project.videoUrl} target="_blank" rel="noreferrer" className="block text-xs text-[#283593] dark:text-indigo-400 hover:underline font-semibold">
                      🎬 Video Brief / Requirements
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic">No attachments attached.</p>
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
          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-[10px] border-l-4 border-l-[#283593] text-stone-600 dark:text-slate-350 leading-relaxed">
              Applying on behalf of team: <strong>{myTeam.name}</strong> ({myTeam.maxSize} max slots).
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">1. Why is your team interested in this project?</label>
                <textarea
                  required
                  value={answers.q1}
                  onChange={(e) => setAnswers({ ...answers, q1: e.target.value })}
                  className="input-field text-xs min-h-16"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">2. What relevant skills or experience does your team bring?</label>
                <textarea
                  required
                  value={answers.q2}
                  onChange={(e) => setAnswers({ ...answers, q2: e.target.value })}
                  className="input-field text-xs min-h-16"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">3. How would your team approach the project?</label>
                <textarea
                  required
                  value={answers.q3}
                  onChange={(e) => setAnswers({ ...answers, q3: e.target.value })}
                  className="input-field text-xs min-h-16"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Additional Message to Sponsor</label>
                <textarea
                  value={answers.message}
                  onChange={(e) => setAnswers({ ...answers, message: e.target.value })}
                  className="input-field text-xs min-h-16"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
              <button type="button" onClick={() => setIsApplyOpen(false)} className="btn-secondary py-2 text-xs" disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary py-2 text-xs" disabled={submitting}>
                {submitting ? "Submitting application..." : "Submit Claim Application"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
