// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const emailSignIn = vi.fn();
const socialSignIn = vi.fn();
const oauth2SignIn = vi.fn();
const emailSignUp = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn();
const listAccounts = vi.fn();
const linkSocial = vi.fn();
const unlinkAccount = vi.fn();

vi.mock("./client", () => ({
  authClient: {
    signIn: { email: emailSignIn, social: socialSignIn, oauth2: oauth2SignIn },
    signUp: { email: emailSignUp },
    getSession,
    signOut,
    listAccounts,
    linkSocial,
    unlinkAccount,
  },
}));

describe("Auth V2 client actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses Better Auth email/password endpoints and propagates a safe provider error", async () => {
    emailSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
    const { signInWithEmail } = await import("./client-actions");

    await expect(signInWithEmail("user@example.test", "password")).rejects.toThrow("Invalid credentials");
    expect(emailSignIn).toHaveBeenCalledWith({ email: "user@example.test", password: "password" });
  });

  it("starts Google sign-in with reviewed relative callbacks only", async () => {
    socialSignIn.mockResolvedValue({ data: { redirect: true }, error: null });
    const { signInWithGoogle } = await import("./client-actions");

    await signInWithGoogle();
    expect(socialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/auth/complete",
      newUserCallbackURL: "/auth/complete",
      errorCallbackURL: "/auth/login?oauth=error",
    });
  });

  it("uses the deterministic OAuth provider only behind the explicit browser-test flag", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_TEST_OIDC", "true");
    oauth2SignIn.mockResolvedValue({ data: { redirect: true }, error: null });
    const { signInWithGoogle } = await import("./client-actions");

    await signInWithGoogle();
    expect(oauth2SignIn).toHaveBeenCalledWith({
      providerId: "quorum-test-oidc",
      callbackURL: "/auth/complete",
      newUserCallbackURL: "/auth/complete",
      errorCallbackURL: "/auth/login?oauth=error",
    });
    expect(socialSignIn).not.toHaveBeenCalled();
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

  it("projects linked accounts to reviewed sign-in methods", async () => {
    listAccounts.mockResolvedValue({
      data: [
        { providerId: "credential", accountId: "private-password-id", userId: "private-user-id" },
        { providerId: "google", accountId: "private-google-id", userId: "private-user-id" },
      ],
      error: null,
    });
    const { listSignInMethods } = await import("./client-actions");

    await expect(listSignInMethods()).resolves.toEqual(["password", "google"]);
  });

  it("links and unlinks Google with reviewed relative callbacks", async () => {
    linkSocial.mockResolvedValue({ data: { redirect: true }, error: null });
    unlinkAccount.mockResolvedValue({ data: { status: true }, error: null });
    const { linkGoogle, unlinkGoogle } = await import("./client-actions");

    await linkGoogle();
    await unlinkGoogle();
    expect(linkSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/settings/account?linked=google",
      errorCallbackURL: "/settings/account?link=error",
    });
    expect(unlinkAccount).toHaveBeenCalledWith({ providerId: "google" });
  });});
