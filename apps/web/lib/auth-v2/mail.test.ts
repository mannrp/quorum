// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(() => ({ sendMail: vi.fn() })),
}));

vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));

import { createAuthMailer } from "./mail";

const baseEnvironment = {
  SMTP_HOST: "mail.example.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_FROM: "Quorum <no-reply@example.test>",
};

describe("auth mail configuration", () => {
  beforeEach(() => mocks.createTransport.mockClear());

  it("passes complete SMTP credentials to the maintained mail client", () => {
    createAuthMailer({ ...baseEnvironment, SMTP_USER: "quorum", SMTP_PASSWORD: "secret" });

    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      auth: { user: "quorum", pass: "secret" },
    }));
  });

  it("rejects half-configured SMTP credentials", () => {
    expect(() => createAuthMailer({ ...baseEnvironment, SMTP_USER: "quorum" }))
      .toThrow("SMTP_USER and SMTP_PASSWORD must be configured together.");
  });
});
