import { describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";

function options() {
  const rejectMail = async () => {
    throw new Error("test mail adapter");
  };
  return buildBetterAuthSpikeOptions({
    database: {} as never,
    baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
    secret: "s".repeat(32),
    sendChangeEmailConfirmation: rejectMail,
    sendResetPassword: rejectMail,
    sendVerificationEmail: rejectMail,
    trustedOrigins: ["http://127.0.0.1:3000"],
  });
}

describe("Better Auth Quorum session metadata", () => {
  it("configures rolling idle, fixed absolute, and ten-minute recent auth", () => {
    const candidate = options();
    expect(candidate.session).toMatchObject({
      expiresIn: 86_400,
      freshAge: 600,
      updateAge: 900,
      additionalFields: {
        absoluteExpiresAt: { input: false, required: true, type: "date" },
        assurance: { input: false, required: true, type: "string" },
        authenticatedAt: { input: false, required: true, type: "date" },
        authenticationMethods: {
          input: false,
          required: true,
          type: "string",
        },
        lastSeenAt: { input: false, required: true, type: "date" },
      },
    });
  });

  it("initializes immutable authentication context and advances only last seen", async () => {
    const candidate = options();
    const create = candidate.databaseHooks?.session?.create?.before;
    const update = candidate.databaseHooks?.session?.update?.before;
    expect(create).toEqual(expect.any(Function));
    expect(update).toEqual(expect.any(Function));

    const created = await create?.(
      {
        id: "session",
        token: "test-only-token",
        userId: "user",
        createdAt: new Date(0),
        updatedAt: new Date(0),
        expiresAt: new Date(1),
      },
      { path: "/sign-in/email" } as never,
    );
    expect(created).toMatchObject({
      data: {
        assurance: "aal1",
        authenticationMethods: '["password"]',
      },
    });
    const data = created && typeof created === "object" ? created.data : undefined;
    expect(data?.authenticatedAt).toBeInstanceOf(Date);
    expect(data?.lastSeenAt).toBeInstanceOf(Date);
    expect(data?.absoluteExpiresAt).toBeInstanceOf(Date);
    expect(
      (data?.absoluteExpiresAt as Date).getTime() -
        (data?.authenticatedAt as Date).getTime(),
    ).toBe(7 * 24 * 60 * 60 * 1_000);

    const updated = await update?.(
      {
        absoluteExpiresAt: data?.absoluteExpiresAt,
        assurance: data?.assurance,
        authenticatedAt: data?.authenticatedAt,
        authenticationMethods: data?.authenticationMethods,
      },
      null,
    );
    expect(updated).toMatchObject({
      data: {
        absoluteExpiresAt: data?.absoluteExpiresAt,
        assurance: "aal1",
        authenticatedAt: data?.authenticatedAt,
        authenticationMethods: '["password"]',
        lastSeenAt: expect.any(Date),
      },
    });
  });
});
