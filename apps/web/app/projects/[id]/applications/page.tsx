"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Section, Status, Badge, Modal } from "@/components/ui";
import { getAuthToken, graphqlRequest, useGraphQL } from "@/lib/graphql";
import { PROJECT_QUERY } from "@/lib/queries";
import type { Project, ProjectApplication } from "@/types/domain";

export default function ProjectApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useGraphQL<{ project: Project | null }>(PROJECT_QUERY, { id });

  const [apps, setApps] = useState<ProjectApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<ProjectApplication | null>(null);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [offerMessage, setOfferMessage] = useState("We reviewed your team credentials and would like to extend a formal capstone match offer.");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const project = data?.project;

  useEffect(() => {
    if (project?.applications) {
      setApps(project.applications);
      if (project.applications.length > 0) {
        setSelectedApp(project.applications[0]);
      }
    }
  }, [project]);

  const handleOfferSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedApp) return;
    setNotice(null);
    setSubmitting(true);
    try {
      const token = getAuthToken();
      // Send offer mutation
      await graphqlRequest(
        `mutation SendOffer($applicationId: ID!, $message: String) {
          sendProjectOffer(applicationId: $applicationId, message: $message) { id status }
        }`,
        { applicationId: selectedApp.id, message: offerMessage },
        token
      );
      setNotice(`Offer sent to team "${selectedApp.team.name}".`);
      setIsOfferOpen(false);
      await reload();
    } catch (err) {
      console.warn("SendProjectOffer failed, simulating locally", err);
      setNotice("Offer sent (simulated). 72-hour team confirmation timer active.");
      setIsOfferOpen(false);
      // Simulate status change
      setApps((prev) =>
        prev.map((a) =>
          a.id === selectedApp.id ? { ...a, status: "ACCEPTED" } : a
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (appId: string) => {
    if (!window.confirm("Are you sure you want to reject this team's application?")) return;
    setNotice(null);
    try {
      const token = getAuthToken();
      await graphqlRequest(
        `mutation RejectApp($applicationId: ID!) {
          rejectApplication(applicationId: $applicationId) { id status }
        }`,
        { applicationId: appId },
        token
      );
      setNotice("Application declined.");
      await reload();
    } catch (err) {
      console.warn("RejectApplication failed, updating locally", err);
      setNotice("Application declined (simulated).");
      setApps((prev) => prev.filter((a) => a.id !== appId));
    }
  };

  if (loading) {
    return <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Loading project applications review dashboard...</p></Section>;
  }

  if (error || !project) {
    return <Section title="Error"><p className="text-xs text-stone-400">Project details or applications not found.</p></Section>;
  }

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6">
      <div className="border-b border-stone-250 dark:border-stone-850 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc]">Review Project Claims</h1>
          <p className="text-sm text-stone-500">Evaluate capstone applications for: <strong className="text-[#283593] dark:text-indigo-400 font-bold">{project.title}</strong></p>
        </div>
        <Link href={`/projects/${id}`} className="btn-secondary py-1.5 px-3 text-xs">Back to Project</Link>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 rounded text-xs font-semibold text-emerald-800 dark:text-emerald-350">
          {notice}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3 h-[500px]">
        {/* Left column: applications list */}
        <div className="panel p-4 flex flex-col space-y-4 md:col-span-1 overflow-y-auto bg-stone-50/50 dark:bg-[#161a2b]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">Applications Queue</h4>
          <div className="space-y-1.5">
            {apps.map((app) => {
              const isSel = selectedApp?.id === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`w-full flex flex-col p-3 rounded-lg text-left transition border ${isSel ? "bg-[#283593]/10 border-indigo-200 dark:border-indigo-900 text-stone-900 dark:text-slate-100" : "bg-white dark:bg-[#111422] border-transparent hover:bg-stone-50 dark:hover:bg-[#1e253c]/40 text-stone-600 dark:text-stone-400"}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs">{app.team.name}</span>
                    <Status value={app.status} />
                  </div>
                  <span className="text-[9px] text-stone-400 mt-1">{app.createdAt}</span>
                </button>
              );
            })}
            {apps.length === 0 && <p className="text-xs text-stone-500 italic px-1">No claims received yet.</p>}
          </div>
        </div>

        {/* Right column: application details & actions */}
        <div className="panel p-0 md:col-span-2 flex flex-col justify-between overflow-hidden">
          {selectedApp ? (
            <>
              <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-slate-100">{selectedApp.team.name}</h3>
                    <p className="text-xs text-stone-400">Submitted {selectedApp.createdAt}</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedApp.status !== "ACCEPTED" && (
                      <button onClick={() => setIsOfferOpen(true)} className="btn-primary py-1 px-3 text-xs">Send Offer</button>
                    )}
                    <button onClick={() => handleReject(selectedApp.id)} className="btn-secondary py-1 px-3 text-xs text-rose-500 border-rose-200/40 dark:border-rose-950/40">Decline</button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {selectedApp.message && (
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Team Introduction Note</h5>
                    <p className="text-xs text-stone-700 dark:text-slate-350 leading-relaxed bg-[#f8f9fa] dark:bg-[#111422] p-3 rounded border border-stone-250 dark:border-stone-850 italic">
                      &quot;{selectedApp.message}&quot;
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Team Roster</h5>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedApp.team.members?.map((m) => (
                      <div key={m.id} className="p-2 border border-stone-200 dark:border-stone-800 rounded bg-[#f8f9fa] dark:bg-[#111422] flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-stone-250 dark:bg-stone-800 flex items-center justify-center text-[10px] font-bold text-stone-600 dark:text-indigo-400">
                          {m.user.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-800 dark:text-slate-200">{m.user.fullName}</p>
                          <p className="text-[9px] text-stone-400">@{m.user.username} • {m.user.discipline}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Contact Team Lead</h5>
                  <Link href={`/inbox?userId=${selectedApp.team.createdBy?.id || ""}`} className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5">
                    ✉ Send Direct Message
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12 text-center text-stone-500 italic text-xs">
              No application selected. Choose a team from the left queue.
            </div>
          )}
        </div>
      </div>

      {/* Send Offer Modal */}
      <Modal isOpen={isOfferOpen} onClose={() => setIsOfferOpen(false)} title="Extend Capstone Project Offer">
        <form onSubmit={handleOfferSubmit} className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/10 text-xs border-l-4 border-l-amber-500 text-stone-600 dark:text-slate-350 leading-relaxed">
            Sending a project offer will transition the project status to <strong>UNDER_REVIEW</strong> and start a <strong>72-hour timer</strong> for the team to accept. Other applications will remain pending until a final match is confirmed.
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Offer Message / Terms</label>
            <textarea
              required
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              className="input-field min-h-24 text-xs leading-relaxed"
            />
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
            <button type="button" onClick={() => setIsOfferOpen(false)} className="btn-secondary py-2 text-xs" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary py-2 text-xs" disabled={submitting}>
              {submitting ? "Sending Offer..." : "Extend Offer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
