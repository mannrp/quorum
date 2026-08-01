"use client";

const channelName = "quorum-auth-session";
const invalidated = "session-invalidated";

export function publishSessionInvalidated(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(channelName);
  channel.postMessage({ type: invalidated });
  channel.close();
}

export function subscribeToSessionInvalidation(onInvalidated: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(channelName);
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (
      event.data &&
      typeof event.data === "object" &&
      (event.data as { type?: unknown }).type === invalidated
    ) {
      onInvalidated();
    }
  });
  return () => channel.close();
}