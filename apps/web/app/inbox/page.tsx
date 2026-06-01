"use client";

import { useEffect, useMemo, useState } from "react";
import { Section } from "@/components/ui";
import { graphqlRequest, useGraphQL } from "@/lib/graphql";
import { INBOX_QUERY, MESSAGES_QUERY } from "@/lib/queries";
import type { Message, User } from "@/types/domain";

export default function InboxPage() {
  const { data, error, loading } = useGraphQL<{ me: User | null; myInbox: User[] }>(INBOX_QUERY, {}, { auth: true });
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const users = useMemo(() => data?.myInbox || [], [data?.myInbox]);
  const me = data?.me;
  const activeUserData = users.find((user) => user.id === activeUser);

  useEffect(() => {
    if (!activeUser && users.length > 0) {
      setActiveUser(users[0].id);
    }
  }, [activeUser, users]);

  useEffect(() => {
    if (!activeUser) return;
    graphqlRequest<{ myMessages: Message[] }>(MESSAGES_QUERY, { withUser: activeUser })
      .then((result) => setMessages(result.myMessages))
      .catch((err) => setNotice(err instanceof Error ? err.message : "Unable to load messages"));
  }, [activeUser]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !activeUser) return;
    const result = await graphqlRequest<{ sendMessage: Message }>(
      `mutation Send($receiverId: ID!, $body: String!) { sendMessage(receiverId: $receiverId, body: $body) { id body read createdAt sender { id username fullName } receiver { id username fullName } } }`,
      { receiverId: activeUser, body: text.trim() },
    );
    setMessages((prev) => [...prev, result.sendMessage]);
    setText("");
  };

  const markAllRead = async () => {
    const unread = messages.filter((message) => message.receiver.id === me?.id && !message.read);
    await Promise.all(unread.map((message) => graphqlRequest(`mutation MarkRead($id: ID!) { markRead(messageId: $id) }`, { id: message.id })));
    setMessages((prev) => prev.map((message) => ({ ...message, read: message.receiver.id === me?.id ? true : message.read })));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      <div className="border-b border-stone-300 dark:border-stone-800 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Direct Messages</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">Sync with project leads, stakeholder mentors, and applicant rosters.</p>
        </div>
      </div>

      {loading && <Section title="Loading"><p className="text-xs text-slate-500">Loading inbox from GraphQL...</p></Section>}
      {(error || notice) && <Section title="Notice"><p className="text-xs text-red-400">{error || notice}</p></Section>}

      <div className="grid gap-6 md:grid-cols-3 h-[550px]">
        <div className="panel p-4 flex flex-col space-y-4 md:col-span-1 overflow-y-auto border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/60">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2">Active Conversations</h4>
          <div className="space-y-1">
            {users.map((user) => {
              const isActive = activeUser === user.id;
              return (
                <button key={user.id} onClick={() => setActiveUser(user.id)} className={`w-full flex items-center justify-between p-3 rounded text-left transition border ${isActive ? "bg-[#F1F5F0] dark:bg-[#1E2520] border-[#A8BAA5] dark:border-[#384A3B] text-stone-900 dark:text-stone-150" : "bg-transparent border-transparent hover:bg-stone-100 dark:hover:bg-stone-900 text-stone-600 dark:text-stone-400"}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-750 flex items-center justify-center font-bold text-stone-800 dark:text-stone-200 text-sm">{user.fullName.charAt(0)}</div>
                    <div className="space-y-0.5">
                      <span className="font-semibold text-sm">{user.fullName}</span>
                      <p className="text-xs text-stone-500 max-w-[130px] truncate">@{user.username}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {!loading && users.length === 0 && <p className="px-2 text-xs text-slate-500">No conversations yet.</p>}
          </div>
        </div>

        <div className="panel p-0 md:col-span-2 flex flex-col justify-between overflow-hidden border-stone-300 dark:border-stone-800">
          <div className="px-6 py-4 border-b border-stone-300 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/60">
            <div>
              <span className="font-bold text-stone-900 dark:text-stone-100">{activeUserData?.fullName || "Select a conversation"}</span>
              <p className="text-xs text-stone-500 dark:text-stone-400">{activeUserData ? `@${activeUserData.username} - ${activeUserData.discipline || "GEN"}` : "Messages load after choosing a person."}</p>
            </div>
            <button onClick={() => void markAllRead()} className="btn-secondary py-1 px-3 text-xs">Mark Read</button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white dark:bg-stone-950/20">
            {messages.map((message) => {
              const isSelf = message.sender.id === me?.id;
              return (
                <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-md rounded px-4 py-2.5 text-sm border leading-relaxed ${isSelf ? "bg-stone-900 dark:bg-stone-50 border-stone-900 dark:border-stone-200 text-white dark:text-stone-950 font-medium" : "bg-stone-50 dark:bg-stone-900 border-stone-300 dark:border-stone-800 text-stone-950 dark:text-stone-100"}`}>
                    <p>{message.body}</p>
                    <div className="text-[9px] mt-1 text-right opacity-60">{message.createdAt}</div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <div className="text-center py-20"><p className="text-stone-500 dark:text-stone-400 text-xs">No conversation history.</p></div>}
          </div>

          <form onSubmit={(event) => void handleSend(event).catch((err) => setNotice(err.message))} className="p-4 border-t border-stone-300 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-900/40 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${activeUserData?.fullName || "someone"}...`} className="input-field py-2" disabled={!activeUser} />
            <button type="submit" className="btn-primary px-4 py-2" disabled={!activeUser}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
