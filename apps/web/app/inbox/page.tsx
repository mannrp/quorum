"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Section, Status, Badge } from "@/components/ui";
import { graphqlRequest, useGraphQL, userFacingError } from "@/lib/graphql";
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
            const res = await graphqlRequest<{ users: User[] }>(
              `query inboxTargetQuery { users { id username fullName discipline } }`,
              {},
              { auth: true }
            );
            
            const target = res.users.find((u) => u.id === queryUserId);
            if (target) {
              setExtraUser(target);
              setActiveUser(target.id);
            }
          } catch (err) {
            setNotice(userFacingError(err));
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
    graphqlRequest<{ myMessages: Message[] }>(MESSAGES_QUERY, { withUser: activeUser }, { auth: true })
      .then((result) => setMessages(result.myMessages))
      .catch((err) => setNotice(userFacingError(err)));
  }, [activeUser, activeUserData, me]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !activeUser) return;
    try {
      const result = await graphqlRequest<{ sendMessage: Message }>(
        `mutation Send($receiverId: ID!, $body: String!) { sendMessage(receiverId: $receiverId, body: $body) { id body read createdAt sender { id username fullName } receiver { id username fullName } } }`,
        { receiverId: activeUser, body: text.trim() },
        { auth: true }
      );
      setMessages((prev) => [...prev, result.sendMessage]);
      setText("");
    } catch (err) {
      setNotice(userFacingError(err));
    }
  };

  const markAllRead = async () => {
    try {
      const unread = messages.filter((message) => message.receiver.id === me?.id && !message.read);
      await Promise.all(
        unread.map((message) =>
          graphqlRequest(`mutation MarkRead($id: ID!) { markRead(messageId: $id) }`, { id: message.id }, { auth: true })
        )
      );
      setMessages((prev) =>
        prev.map((message) => ({
          ...message,
          read: message.receiver.id === me?.id ? true : message.read
        }))
      );
    } catch (err) {
      setNotice(userFacingError(err));
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3 h-[550px] px-4">
      {/* Left Conversations List */}
      <div className="panel p-4 flex flex-col space-y-4 md:col-span-1 overflow-y-auto bg-[var(--bg-app)] border-[var(--border-app)] rounded-none">
        <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-500 px-2">Active Conversations</h4>
        <div className="space-y-1">
          {users.map((user) => {
            const isActive = activeUser === user.id;
            return (
              <button
                key={user.id}
                onClick={() => setActiveUser(user.id)}
                className={`w-full flex items-center justify-between p-3 rounded-none text-left transition border ${
                  isActive
                    ? "bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    : "bg-transparent border-transparent hover:bg-[var(--surface-app)]/50 text-stone-600 dark:text-stone-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-none bg-[var(--bg-app)] border border-[var(--border-app)] flex items-center justify-center font-mono font-bold text-[var(--text-app)] text-sm uppercase">
                    {user.fullName.charAt(0)}
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[var(--text-app)]">{user.fullName}</span>
                    <p className="text-[10px] text-stone-400 max-w-[125px] truncate font-mono">@{user.username}</p>
                  </div>
                </div>
              </button>
            );
          })}
          {!loading && users.length === 0 && <p className="px-2 text-xs text-stone-400 font-mono italic">No conversations.</p>}
        </div>
      </div>

      {/* Right Messages Thread */}
      <div className="panel p-0 md:col-span-2 flex flex-col justify-between overflow-hidden border-[var(--border-app)] rounded-none">
        <div className="px-6 py-4 border-b border-[var(--border-app)] flex items-center justify-between bg-[var(--bg-app)]">
          <div>
            <span className="font-bold text-[var(--text-app)] font-serif text-sm uppercase tracking-tight">
              {activeUserData?.fullName || "Select conversation"}
            </span>
            <p className="text-[10px] text-stone-400 font-mono">
              {activeUserData ? `@${activeUserData.username} • ${activeUserData.discipline || "SOEN"}` : "Roster chats load after selection."}
            </p>
          </div>
          {activeUserData && (
            <button onClick={() => void markAllRead()} className="btn-secondary py-1 px-3 text-[10px]">Mark Read</button>
          )}
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[var(--surface-app)]">
          {notice && (
            <div className="rounded-none border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-danger)]">
              {notice}
            </div>
          )}
          {messages.map((message) => {
            const isSelf = message.sender.id === me?.id;
            return (
              <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-md rounded-none px-4 py-2.5 text-xs border leading-relaxed ${
                    isSelf
                      ? "bg-[var(--accent-app)] border-[var(--accent-app)] text-white font-medium"
                      : "bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--text-app)]"
                  }`}
                >
                  <p className="font-sans">{message.body}</p>
                  <div className="text-[8px] font-mono mt-1 text-right opacity-60">{message.createdAt}</div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-stone-400 text-xs font-mono italic">No conversation history. Send a greeting to start.</p>
            </div>
          )}
        </div>

        <form onSubmit={(e) => void handleSend(e)} className="p-4 border-t border-[var(--border-app)] bg-[var(--bg-app)] flex gap-2">
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
    <div className="space-y-6 max-w-5xl mx-auto py-4 px-4">
      <div className="border-b border-[var(--border-app)] pb-4">
        <h1 className="text-3xl font-bold font-serif text-[var(--text-app)] uppercase tracking-tight">Direct Messages</h1>
        <p className="text-sm text-stone-500 font-sans">Communicate with capstone team leads, professors, and project sponsors.</p>
      </div>

      <Suspense fallback={<p className="text-xs text-stone-500 font-mono animate-pulse uppercase tracking-wider">Initializing inbox query params...</p>}>
        <InboxInner />
      </Suspense>
    </div>
  );
}
