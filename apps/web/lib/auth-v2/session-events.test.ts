// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishSessionInvalidated, subscribeToSessionInvalidation } from "./session-events";

class TestChannel {
  static instances: TestChannel[] = [];
  listeners: Array<(event: MessageEvent<unknown>) => void> = [];
  posted: unknown[] = [];
  closed = false;

  constructor(readonly name: string) {
    TestChannel.instances.push(this);
  }
  postMessage(value: unknown) { this.posted.push(value); }
  addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) { this.listeners.push(listener); }
  close() { this.closed = true; }
}

afterEach(() => {
  TestChannel.instances = [];
  vi.unstubAllGlobals();
});

describe("cross-tab session invalidation", () => {
  it("publishes only a fixed credential-free event", () => {
    vi.stubGlobal("BroadcastChannel", TestChannel);
    publishSessionInvalidated();
    expect(TestChannel.instances[0].name).toBe("quorum-auth-session");
    expect(TestChannel.instances[0].posted).toEqual([{ type: "session-invalidated" }]);
    expect(JSON.stringify(TestChannel.instances[0].posted)).not.toMatch(/token|cookie|email|user/i);
    expect(TestChannel.instances[0].closed).toBe(true);
  });

  it("accepts only the reviewed event and closes its subscription", () => {
    vi.stubGlobal("BroadcastChannel", TestChannel);
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionInvalidation(listener);
    const channel = TestChannel.instances[0];
    channel.listeners[0]({ data: { type: "ignored", token: "private" } } as MessageEvent);
    channel.listeners[0]({ data: { type: "session-invalidated" } } as MessageEvent);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(channel.closed).toBe(true);
  });
});