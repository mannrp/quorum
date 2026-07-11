"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Section, Status, LoadingSkeleton } from "@/components/ui";
import { graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
import { NOTIFICATIONS_QUERY } from "@/lib/queries";
import type { Notification } from "@/types/domain";

export default function NotificationsPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useGraphQL<{ myNotifications: Notification[] }>(NOTIFICATIONS_QUERY, {}, { auth: true });
  const notifications = data?.myNotifications || [];
  const [actionError, setActionError] = useState<string | null>(null);

  const markRead = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Avoid triggering route navigation
    try {
      setActionError(null);
      await graphqlRequest(`mutation MarkNotification($id: ID!) { markNotificationRead(notificationId: $id) }`, { id }, { auth: true });
      await reload();
    } catch (err) {
      setActionError(userFacingError(err));
    }
  };

  const getNotifText = (notification: Notification) => {
    switch (notification.type) {
      case "APPLICATION":
        return "New project claim application submitted by student group.";
      case "MESSAGE":
        return "New direct message received in your inbox.";
      case "OFFER_SENT":
        return "Your team has received a project sponsorship offer!";
      case "MATCH_CONFIRMED":
        return "Congratulations! Your capstone claim matching has been approved.";
      default:
        return "New update regarding your Concordian Capstone workflow.";
    }
  };

  const handleNotifClick = (notification: Notification) => {
    // Attempt to parse deep link target payload parameters if available
    let targetUrl = "/dashboard";
    try {
      if (notification.payload) {
        const payloadData = JSON.parse(notification.payload) as { userId?: string; projectId?: string; teamId?: string };
        if (notification.type === "MESSAGE" && payloadData.userId) {
          targetUrl = `/inbox?userId=${payloadData.userId}`;
        } else if (notification.type === "APPLICATION" && payloadData.projectId) {
          targetUrl = `/projects/${payloadData.projectId}/applications`;
        } else if (payloadData.teamId) {
          targetUrl = `/teams/${payloadData.teamId}`;
        } else if (payloadData.projectId) {
          targetUrl = `/projects/${payloadData.projectId}`;
        }
      }
    } catch (e) {
      // Direct fallbacks based on types
      if (notification.type === "MESSAGE") targetUrl = "/inbox";
      else if (notification.type === "APPLICATION") targetUrl = "/dashboard";
    }

    router.push(targetUrl);
  };

  return (
    <div className="dashboard-stage mx-auto max-w-5xl space-y-8 px-4 py-4">
      <section className="workspace-hero">
        <div className="space-y-3">
          <span className="page-kicker">Updates</span>
          <div className="space-y-2">
            <h1 className="page-title">Inbox notices</h1>
            <p className="page-subtitle">Track notifications, matching confirmations, and sponsor claims.</p>
          </div>
        </div>
      </section>

      {loading && <Section title="Notifications"><LoadingSkeleton rows={4} /></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs font-semibold text-rose-500">{error}</p></Section>}
      {actionError && <Section title="Action Failed"><p className="text-xs font-semibold text-rose-500">{actionError}</p></Section>}

      <div className="stagger-in space-y-3">
        {!loading && !error && notifications.map((notification) => (
          <div
            key={notification.id}
            onClick={() => handleNotifClick(notification)}
            className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-[var(--surface-app)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-app)] ${
              notification.read
                ? "border-[var(--border-subtle)] opacity-65"
                : "border-[var(--accent-app)] border-l-4 border-l-[var(--accent-app)]"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-app)]">
                {notification.read ? "✓" : "!"}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[var(--accent-app)]">
                    {notification.type}
                  </span>
                  <span className="text-[10px] text-[var(--muted-app)]">{notification.createdAt}</span>
                </div>
                <p className="text-sm font-semibold text-[var(--text-app)]">{getNotifText(notification)}</p>
              </div>
            </div>
            {!notification.read && (
              <button
                onClick={(e) => void markRead(notification.id, e)}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-app)] transition hover:border-[var(--accent-app)] hover:bg-[var(--accent-app)] hover:text-white"
              >
                Mark Read
              </button>
            )}
          </div>
        ))}

        {!loading && !error && notifications.length === 0 && (
          <div className="panel text-center py-16 space-y-2">
            <p className="text-lg font-semibold text-[var(--text-app)]">Inbox zero</p>
            <p className="text-xs text-[var(--muted-app)]">You do not have any notifications at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
