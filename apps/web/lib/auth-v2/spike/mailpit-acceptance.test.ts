import { describe, expect, it, vi } from "vitest";

import {
  MailpitAcceptanceClient,
  type MailpitMessage,
} from "./mailpit-acceptance";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Mailpit acceptance client", () => {
  it.each([
    "https://mail.example.test",
    "http://user:password@127.0.0.1:8025",
    "http://127.0.0.1:8025/path",
  ])("rejects a non-local or credential-bearing API URL: %s", (apiUrl) => {
    expect(() => new MailpitAcceptanceClient({ apiUrl })).toThrow(
      "local Mailpit",
    );
  });

  it("polls metadata and keeps message content inside the exercise callback", async () => {
    const message: MailpitMessage = {
      id: "message-1",
      subject: "Verify your Quorum account",
      from: ["no-reply@quorum.example.test"],
      to: ["member@example.test"],
      text: "secret verification link",
      html: "<a href='secret'>verify</a>",
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [
            {
              ID: message.id,
              Subject: message.subject,
              From: { Address: message.from[0] },
              To: [{ Address: message.to[0] }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ID: message.id,
          Subject: message.subject,
          From: { Address: message.from[0] },
          To: [{ Address: message.to[0] }],
          Text: message.text,
          HTML: message.html,
        }),
      );
    const exercise = vi.fn(async (received: MailpitMessage) => {
      expect(received).toEqual(message);
      return true;
    });
    const client = new MailpitAcceptanceClient({
      apiUrl: "http://127.0.0.1:8025",
      fetch,
    });

    await expect(
      client.waitForAndExercise({
        recipient: "member@example.test",
        subject: message.subject,
        timeoutMs: 100,
        exercise,
      }),
    ).resolves.toEqual({
      delivered: true,
      exercised: true,
    });
    expect(JSON.stringify(await exercise.mock.results[0]?.value)).not.toContain(
      "secret",
    );
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8025/api/v1/messages",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("fails on malformed Mailpit data instead of skipping", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(jsonResponse({ messages: [{ Subject: "missing id" }] }));
    const client = new MailpitAcceptanceClient({
      apiUrl: "http://mailpit:8025",
      fetch,
    });

    await expect(client.listMessages()).rejects.toThrow("Malformed Mailpit");
  });

  it("fails on Mailpit outage instead of treating no mail as success", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    const client = new MailpitAcceptanceClient({
      apiUrl: "http://localhost:8025",
      fetch,
    });

    await expect(client.listMessages()).rejects.toThrow("Mailpit request failed");
  });

  it("replaces secret-bearing exercise errors with a fixed safe failure", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [
            {
              ID: "message-1",
              Subject: "Reset your password",
              From: { Address: "no-reply@quorum.example.test" },
              To: [{ Address: "member@example.test" }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ID: "message-1",
          Subject: "Reset your password",
          From: { Address: "no-reply@quorum.example.test" },
          To: [{ Address: "member@example.test" }],
          Text: "https://quorum.example.test/reset?token=secret-token",
          HTML: "",
        }),
      );
    const client = new MailpitAcceptanceClient({
      apiUrl: "http://127.0.0.1:8025",
      fetch,
    });

    await expect(
      client.waitForAndExercise({
        recipient: "member@example.test",
        subject: "Reset your password",
        timeoutMs: 100,
        exercise: async (message) => {
          throw new Error(message.text);
        },
      }),
    ).rejects.toThrow("Mailpit message exercise failed");
  });
});
