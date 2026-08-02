"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Section, Status, Badge } from "@/components/ui";
import { userFacingError } from "@/lib/operations/client";
import { operationRequest, useOperation } from "@/lib/operations/client";
import type { Message, User } from "@/types/domain";

function InboxInner() {
  const searchParams = useSearchParams();
  const queryUserId = searchParams.get("userId");

  const { data, error, loading } = useOperation<{ me: User | null; myInbox: User[] }>("InboxV1", {});
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

  // A direct-recipient URL can focus only an existing authorized conversation.
  useEffect(() => {
    const target = rawUsers.find((user) => user.id === queryUserId);
    if (target) setActiveUser(target.id);
    else if (!activeUser && rawUsers.length > 0) setActiveUser(rawUsers[0].id);
  }, [queryUserId, rawUsers, activeUser]);  // 2. Fetch thread messages
  useEffect(() => {
    if (!activeUser) return;
    operationRequest<{ myMessages: Message[] }>("ThreadMessagesV1", { withUser: activeUser })
      .then((result) => setMessages(result.myMessages))
      .catch((err) => setNotice(userFacingError(err)));
  }, [activeUser, activeUserData, me]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !activeUser) return;
    try {
      const result = await operationRequest<{ sendMessage: Message }>(
        "SendMessageV1",
        { receiverId: activeUser, body: text.trim() },
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
          operationRequest("MarkMessageReadV1", { messageId: message.id })
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
    <div className="grid min-h-[580px] gap-5 lg:grid-cols-[0.82fr_1.68fr]">
      {/* Left Conversations List */}
      <div className="panel flex flex-col space-y-4 overflow-y-auto p-4">
        <h4 className="px-2 text-sm font-semibold text-[var(--text-app)]">Active conversations</h4>
        <div className="space-y-1">
          {users.map((user) => {
            const isActive = activeUser === user.id;
            return (
              <button
                key={user.id}
                onClick={() => setActiveUser(user.id)}
                className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-all duration-200 ${
                  isActive
                    ? "border-[var(--accent-app)] bg-[var(--accent-soft)] text-[var(--text-app)]"
                    : "border-transparent bg-transparent text-[var(--muted-app)] hover:translate-x-1 hover:border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-app)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="avatar-chip">
                    {user.fullName.charAt(0)}
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[var(--text-app)]">{user.fullName}</span>
                    <p className="text-[10px] text-[var(--muted-app)] max-w-[125px] truncate">@{user.username}</p>
                  </div>
                </div>
              </button>
            );
          })}
          {!loading && users.length === 0 && <p className="px-2 text-xs text-[var(--muted-app)]">No conversations.</p>}
        </div>
      </div>

      {/* Right Messages Thread */}
      <div className="panel flex flex-col justify-between overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-6 py-4">
          <div>
            <span className="text-sm font-bold text-[var(--text-app)]">
              {activeUserData?.fullName || "Select conversation"}
            </span>
            <p className="text-[10px] text-[var(--muted-app)]">
              {activeUserData ? `@${activeUserData.username} • ${activeUserData.discipline || "SOEN"}` : "Roster chats load after selection."}
            </p>
          </div>
          {activeUserData && (
            <button onClick={() => void markAllRead()} className="btn-secondary py-1 px-3 text-[10px]">Mark Read</button>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--surface-app)] p-6">
          {notice && (
            <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-danger)]">
              {notice}
            </div>
          )}
          {messages.map((message) => {
            const isSelf = message.sender.id === me?.id;
            return (
              <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-md rounded-lg border px-4 py-2.5 text-xs leading-relaxed transition-all duration-200 hover:-translate-y-0.5 ${
                    isSelf
                      ? "bg-[var(--accent-app)] border-[var(--accent-app)] text-white font-medium"
                      : "bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--text-app)]"
                  }`}
                >
                  <p className="font-sans">{message.body}</p>
                  <div className="mt-1 text-right text-[8px] opacity-60">{message.createdAt}</div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xs text-[var(--muted-app)]">No conversation history. Send a greeting to start.</p>
            </div>
          )}
        </div>

        <form onSubmit={(e) => void handleSend(e)} className="flex gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] p-4">
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
    <div className="dashboard-stage mx-auto max-w-6xl space-y-8 px-4 py-4">
      <section className="workspace-hero">
        <div className="space-y-3">
          <span className="page-kicker">Messages</span>
          <div className="space-y-2">
            <h1 className="page-title">Direct messages</h1>
            <p className="page-subtitle">Communicate with capstone team leads, professors, and project sponsors.</p>
          </div>
        </div>
      </section>

      <Suspense fallback={<p className="text-xs text-[var(--muted-app)] animate-pulse">Initializing inbox query params...</p>}>
        <InboxInner />
      </Suspense>
    </div>
  );
}
