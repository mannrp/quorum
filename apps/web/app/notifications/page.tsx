"use client";

import { Section } from "@/components/ui";
import { graphqlRequest, useGraphQL } from "@/lib/graphql";
import { NOTIFICATIONS_QUERY } from "@/lib/queries";
import type { Notification } from "@/types/domain";

export default function NotificationsPage() {
  const { data, error, loading, reload } = useGraphQL<{ myNotifications: Notification[] }>(NOTIFICATIONS_QUERY, {}, { auth: true });
  const notifications = data?.myNotifications || [];

  const markRead = async (id: string) => {
    await graphqlRequest(`mutation MarkNotification($id: ID!) { markNotificationRead(notificationId: $id) }`, { id });
    await reload();
  };

  const getNotifText = (notification: Notification) => {
    if (notification.type === "APPLICATION") return "New project application received.";
    if (notification.type === "MESSAGE") return "New direct message received.";
    return "New update regarding your capstone workflow.";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Updates & Notifications</h1>
          <p className="text-sm text-slate-400">Keep track of team invites, project assignments, and direct messages.</p>
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-slate-500">Loading notifications from GraphQL...</p></Section>}
      {error && <Section title="GraphQL Error"><p className="text-xs text-red-400">{error}</p></Section>}

      <div className="space-y-4">
        {!loading && !error && notifications.map((notification) => (
          <div key={notification.id} className={`panel p-4 flex items-center justify-between gap-4 transition ${notification.read ? "opacity-60 hover:opacity-80" : "border-teal-500/30 bg-teal-950/5"}`}>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg">!</div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-teal-400">{notification.type}</span>
                  <span className="text-[10px] text-slate-500">{notification.createdAt}</span>
                </div>
                <p className="text-sm text-slate-200">{getNotifText(notification)}</p>
              </div>
            </div>
            {!notification.read && (
              <button onClick={() => void markRead(notification.id)} className="rounded-lg px-2.5 py-1 text-xs font-semibold border transition bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20">
                Mark Read
              </button>
            )}
          </div>
        ))}

        {!loading && !error && notifications.length === 0 && (
          <div className="panel text-center py-16 space-y-2">
            <p className="text-slate-400 text-lg">Inbox Zero</p>
            <p className="text-xs text-slate-500">You do not have any notifications at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
