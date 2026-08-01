// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const emailSignIn = vi.fn();
const emailSignUp = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn();

vi.mock("./client", () => ({
  authClient: {
    signIn: { email: emailSignIn },
    signUp: { email: emailSignUp },
    getSession,
    signOut,
  },
}));

describe("Auth V2 client actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses Better Auth email/password endpoints and propagates a safe provider error", async () => {
    emailSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
    const { signInWithEmail } = await import("./client-actions");

    await expect(signInWithEmail("user@example.test", "password")).rejects.toThrow("Invalid credentials");
    expect(emailSignIn).toHaveBeenCalledWith({ email: "user@example.test", password: "password" });
  });

  it("registers without fabricating a post-registration session", async () => {
    emailSignUp.mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null });
    const { signUpWithEmail } = await import("./client-actions");

    await signUpWithEmail("user@example.test", "a".repeat(29), "Test User");
    expect(emailSignUp).toHaveBeenCalledWith({
      email: "user@example.test",
      password: "a".repeat(29),
      name: "Test User",
      callbackURL: "/auth/complete",
    });
    expect(emailSignIn).not.toHaveBeenCalled();
  });
});
