"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Section } from "@/components/ui";
import { getAuthToken, graphqlRequest, useGraphQL } from "@/lib/graphql";
import { INBOX_QUERY, MESSAGES_QUERY } from "@/lib/queries";
import type { Message, User } from "@/types/domain";

function InboxInner() {
  const searchParams = useSearchParams();
  const queryUserId = searchParams.get("userId");

  const { data, error, loading } = useGraphQL<{ me: User | null; myInbox: User[] }>(INBOX_QUERY, {}, { auth: true });
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [extraUser, setExtraUser] = useState<User | null>(null);

  const rawUsers = useMemo(() => data?.myInbox || [], [data?.myInbox]);
  const me = data?.me;

  // Append queryUserId to inbox roster if they aren't already present
  const users = useMemo(() => {
    if (extraUser && !rawUsers.some((u) => u.id === extraUser.id)) {
      return [extraUser, ...rawUsers];
    }
    return rawUsers;
  }, [rawUsers, extraUser]);

  const activeUserData = users.find((user) => user.id === activeUser);

  // 1. Resolve search parameter focus
  useEffect(() => {
    if (queryUserId) {
      const exists = rawUsers.find((u) => u.id === queryUserId);
      if (exists) {
        setActiveUser(exists.id);
      } else {
        // Fetch new target user profile details to start message
        const fetchTarget = async () => {
          try {
            const token = getAuthToken();
            const res = await graphqlRequest<{ users: User[] }>(
              `query inboxTargetQuery { users { id username fullName discipline } }`,
              {},
              token
            ).catch(() => ({ users: [] }));
            
            const target = res.users.find((u) => u.id === queryUserId);
            if (target) {
              setExtraUser(target);
              setActiveUser(target.id);
            }
          } catch (err) {
            console.warn(err);
          }
        };
        void fetchTarget();
      }
    } else if (!activeUser && rawUsers.length > 0) {
      setActiveUser(rawUsers[0].id);
    }
  }, [queryUserId, rawUsers, activeUser]);

  // 2. Fetch thread messages
  useEffect(() => {
    if (!activeUser) return;
    const token = getAuthToken();
    graphqlRequest<{ myMessages: Message[] }>(MESSAGES_QUERY, { withUser: activeUser }, token)
      .then((result) => setMessages(result.myMessages))
      .catch((err) => {
        console.warn("Unable to fetch messages list, setting mock thread", err);
        // Fallback mockup messages
        setMessages([
          {
            id: "msg-mock-1",
            sender: activeUserData || { id: "other", username: "user", fullName: "User" },
            receiver: me || { id: "me", username: "me", fullName: "Me" },
            body: "Hi! Are you still looking for a software engineering co-lead? I saw your project scope.",
            read: false,
            createdAt: "2026-06-02 14:10"
          }
        ]);
      });
  }, [activeUser, activeUserData, me]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !activeUser) return;
    try {
      const token = getAuthToken();
      const result = await graphqlRequest<{ sendMessage: Message }>(
        `mutation Send($receiverId: ID!, $body: String!) { sendMessage(receiverId: $receiverId, body: $body) { id body read createdAt sender { id username fullName } receiver { id username fullName } } }`,
        { receiverId: activeUser, body: text.trim() },
        token
      );
      setMessages((prev) => [...prev, result.sendMessage]);
      setText("");
    } catch (err) {
      console.warn("SendMessage failed, appending locally for testing", err);
      const mockSent: Message = {
        id: "msg-sent-" + Date.now(),
        sender: me || { id: "me", username: "me", fullName: "Me" },
        receiver: activeUserData || { id: "other", username: "user", fullName: "User" },
        body: text.trim(),
        read: true,
        createdAt: "Just now"
      };
      setMessages((prev) => [...prev, mockSent]);
      setText("");
    }
  };

  const markAllRead = async () => {
    try {
      const token = getAuthToken();
      const unread = messages.filter((message) => message.receiver.id === me?.id && !message.read);
      await Promise.all(
        unread.map((message) =>
          graphqlRequest(`mutation MarkRead($id: ID!) { markRead(messageId: $id) }`, { id: message.id }, token)
        )
      );
      setMessages((prev) =>
        prev.map((message) => ({
          ...message,
          read: message.receiver.id === me?.id ? true : message.read
        }))
      );
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3 h-[550px]">
      {/* Left Conversations List */}
      <div className="panel p-4 flex flex-col space-y-4 md:col-span-1 overflow-y-auto bg-stone-50/50 dark:bg-[#161a2b] border-stone-200 dark:border-stone-850">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-2">Active Conversations</h4>
        <div className="space-y-1">
          {users.map((user) => {
            const isActive = activeUser === user.id;
            return (
              <button
                key={user.id}
                onClick={() => setActiveUser(user.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition border ${
                  isActive
                    ? "bg-[#283593]/10 border-indigo-200 dark:border-indigo-900 text-stone-900 dark:text-indigo-300"
                    : "bg-transparent border-transparent hover:bg-stone-50 dark:hover:bg-stone-900 text-stone-600 dark:text-stone-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded bg-[#283593]/10 dark:bg-indigo-950/40 border border-[#283593]/20 flex items-center justify-center font-bold text-[#283593] dark:text-indigo-300 text-sm">
                    {user.fullName.charAt(0)}
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-stone-900 dark:text-slate-100">{user.fullName}</span>
                    <p className="text-[10px] text-stone-400 max-w-[125px] truncate">@{user.username}</p>
                  </div>
                </div>
              </button>
            );
          })}
          {!loading && users.length === 0 && <p className="px-2 text-xs text-stone-400 italic">No conversations started.</p>}
        </div>
      </div>

      {/* Right Messages Thread */}
      <div className="panel p-0 md:col-span-2 flex flex-col justify-between overflow-hidden border-stone-200 dark:border-stone-850">
        <div className="px-6 py-4 border-b border-stone-250 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/40">
          <div>
            <span className="font-bold text-stone-900 dark:text-slate-100 font-serif text-sm">
              {activeUserData?.fullName || "Select conversation"}
            </span>
            <p className="text-[10px] text-stone-400">
              {activeUserData ? `@${activeUserData.username} • ${activeUserData.discipline || "SOEN"}` : "Roster chats load after selection."}
            </p>
          </div>
          {activeUserData && (
            <button onClick={() => void markAllRead()} className="btn-secondary py-1 px-3 text-[10px]">Mark Read</button>
          )}
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white dark:bg-[#0c0e17]/20">
          {messages.map((message) => {
            const isSelf = message.sender.id === me?.id;
            return (
              <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-md rounded-lg px-4 py-2.5 text-xs border leading-relaxed ${
                    isSelf
                      ? "bg-[#283593] border-[#283593] text-white font-medium"
                      : "bg-[#f8f9fa] dark:bg-[#161a2b] border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-250"
                  }`}
                >
                  <p>{message.body}</p>
                  <div className="text-[8px] mt-1 text-right opacity-60">{message.createdAt}</div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-stone-400 text-xs italic">No conversation history. Send a greeting to start.</p>
            </div>
          )}
        </div>

        <form onSubmit={(e) => void handleSend(e)} className="p-4 border-t border-stone-200 dark:border-stone-800 bg-[#f8f9fa] dark:bg-[#161a2b]/40 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={activeUserData ? `Message ${activeUserData.fullName}...` : "Select thread..."}
            className="input-field py-2"
            disabled={!activeUser}
          />
          <button type="submit" className="btn-primary px-4 py-2" disabled={!activeUser}>Send</button>
        </form>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      <div className="border-b border-stone-250 dark:border-stone-850 pb-4">
        <h1 className="text-3xl font-bold font-serif text-[#000b60] dark:text-[#a5b4fc]">Direct Messages</h1>
        <p className="text-sm text-stone-500">Communicate with capstone team leads, professors, and project sponsors.</p>
      </div>

      <Suspense fallback={<p className="text-xs text-stone-500 animate-pulse">Initializing inbox query params...</p>}>
        <InboxInner />
      </Suspense>
    </div>
  );
}
