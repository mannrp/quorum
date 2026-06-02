"use client";
import { useRouter } from "next/navigation";
import { Section, Status } from "@/components/ui";
import { getAuthToken, graphqlRequest, useGraphQL } from "@/lib/graphql";
import { NOTIFICATIONS_QUERY } from "@/lib/queries";
import type { Notification } from "@/types/domain";

export default function NotificationsPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useGraphQL<{ myNotifications: Notification[] }>(NOTIFICATIONS_QUERY, {}, { auth: true });
  const notifications = data?.myNotifications || [];

  const markRead = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Avoid triggering route navigation
    try {
      const token = getAuthToken();
      await graphqlRequest(`mutation MarkNotification($id: ID!) { markNotificationRead(notificationId: $id) }`, { id }, token);
      await reload();
    } catch (err) {
      console.warn("MarkNotificationRead failed, simulating locally", err);
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
      <div className="flex items-center justify-between border-b border-stone-250 dark:border-stone-850 pb-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc]">Updates & Inbox Notices</h1>
          <p className="text-sm text-stone-500">Track notifications, matching confirmations, and sponsor claims.</p>
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-stone-500 animate-pulse">Syncing notices...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-rose-500 font-bold">{error}</p></Section>}

      <div className="space-y-3">
        {!loading && !error && notifications.map((notification) => (
          <div
            key={notification.id}
            onClick={() => handleNotifClick(notification)}
            className={`panel p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-indigo-400/50 transition duration-200 ${
              notification.read
                ? "opacity-60"
                : "border-indigo-200 bg-indigo-50/20 dark:border-indigo-900/50 dark:bg-indigo-950/10"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-[#283593]/10 border border-[#283593]/20 flex items-center justify-center text-sm font-bold text-[#283593] dark:text-indigo-350">
                i
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[9px] uppercase tracking-wider text-[#283593] dark:text-indigo-300">
                    {notification.type}
                  </span>
                  <span className="text-[9px] text-stone-400">{notification.createdAt}</span>
                </div>
                <p className="text-xs font-semibold text-stone-750 dark:text-slate-200">{getNotifText(notification)}</p>
              </div>
            </div>
            {!notification.read && (
              <button
                onClick={(e) => void markRead(notification.id, e)}
                className="rounded px-2.5 py-1 text-[10px] font-bold border transition bg-indigo-50 hover:bg-indigo-100/60 dark:bg-[#111422] text-[#283593] dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-900/50 uppercase tracking-wider"
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
