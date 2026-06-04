"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Section, Status } from "@/components/ui";
import { getAuthToken, graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
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
      const token = getAuthToken();
      await graphqlRequest(`mutation MarkNotification($id: ID!) { markNotificationRead(notificationId: $id) }`, { id }, token);
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
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Updates & Inbox Notices</h1>
          <p className="text-sm text-stone-500">Track notifications, matching confirmations, and sponsor claims.</p>
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse font-mono uppercase tracking-wider">Syncing notices...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-rose-500 font-mono font-bold uppercase tracking-wider">{error}</p></Section>}
      {actionError && <Section title="Action Failed"><p className="text-xs text-rose-500 font-mono font-bold uppercase tracking-wider">{actionError}</p></Section>}

      <div className="space-y-3">
        {!loading && !error && notifications.map((notification) => (
          <div
            key={notification.id}
            onClick={() => handleNotifClick(notification)}
            className={`flex items-center justify-between gap-4 p-4 cursor-pointer transition duration-150 border bg-[var(--surface-app)] rounded-none ${
              notification.read
                ? "border-[var(--border-subtle)] opacity-60"
                : "border-[var(--border-app)] border-l-4 border-l-[var(--accent-app)]"
            } hover:border-[var(--accent-app)]`}
          >
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-none bg-[var(--bg-app)] border border-[var(--border-app)] flex items-center justify-center text-xs font-mono font-bold text-[var(--accent-app)]">
                i
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[9px] font-mono uppercase tracking-wider text-[var(--accent-app)]">
                    {notification.type}
                  </span>
                  <span className="text-[9px] font-mono text-stone-400">{notification.createdAt}</span>
                </div>
                <p className="text-xs font-semibold text-[var(--text-app)]">{getNotifText(notification)}</p>
              </div>
            </div>
            {!notification.read && (
              <button
                onClick={(e) => void markRead(notification.id, e)}
                className="rounded-none px-2.5 py-1 text-[10px] font-bold border transition bg-[var(--bg-app)] hover:bg-[var(--accent-app)] hover:text-white border-[var(--border-app)] text-[var(--text-app)] uppercase tracking-wider font-mono"
              >
                Mark Read
              </button>
            )}
          </div>
        ))}

        {!loading && !error && notifications.length === 0 && (
          <div className="panel text-center py-16 space-y-2">
            <p className="text-stone-400 text-lg">Inbox Zero</p>
            <p className="text-xs text-stone-500">You do not have any notifications at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
