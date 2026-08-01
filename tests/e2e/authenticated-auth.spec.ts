import { expect, test } from "@playwright/test";

const integration = process.env.QUORUM_REQUIRE_INTEGRATION === "true";
const mailpitURL = process.env.MAILPIT_API_URL;

async function verificationURL(email: string): Promise<string> {
  if (!mailpitURL) throw new Error("MAILPIT_API_URL is required.");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const list = await fetch(`${mailpitURL}/api/v1/messages`);
    if (!list.ok) throw new Error(`Mailpit list failed: ${list.status}`);
    const body = await list.json() as { messages?: Array<{ ID: string; Subject: string; To?: Array<{ Address: string }> }> };
    const summary = body.messages?.find((message) =>
      message.Subject === "Verify your Quorum email" &&
      message.To?.some((recipient) => recipient.Address === email),
    );
    if (summary) {
      const detail = await fetch(`${mailpitURL}/api/v1/message/${encodeURIComponent(summary.ID)}`);
      if (!detail.ok) throw new Error(`Mailpit message failed: ${detail.status}`);
      const message = await detail.json() as { Text?: string };
      const match = message.Text?.match(/https?:\/\/\S+/);
      if (!match) throw new Error("Verification mail did not contain a URL.");
      return match[0];
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Verification mail was not delivered.");
}

test("verified user enrolls, refreshes the viewer, and logs out", async ({ page }) => {
  test.skip(!integration, "requires pinned PostgreSQL and Mailpit services");

  const email = `auth-browser-${Date.now()}@example.test`;
  const password = "correct horse battery staple 123";

  await page.goto("/auth/register");
  await page.getByLabel("Full name").fill("Auth Browser");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  const link = await verificationURL(email);
  expect(new URL(link).origin).toBe("http://127.0.0.1:3000");
  expect(new URL(link).searchParams.get("callbackURL")).toBe("/auth/complete");
  await page.goto(link);
  await page.goto("/auth/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Connect Session" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Role").selectOption("STUDENT");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const viewer = await page.evaluate(async () => {
      const response = await fetch("/api/v1/viewer", { cache: "no-store" });
      return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
    });
    expect(viewer.status).toBe(200);
    expect(viewer.cache).toBe("private, no-store");
    expect(viewer.body.viewer).toMatchObject({
      accountState: "ACTIVE",
      onboardingState: "NOT_STARTED",
      selfServiceRoles: ["STUDENT"],
    });
    expect(viewer.body.viewer).not.toHaveProperty("email");
    expect(viewer.body.viewer).not.toHaveProperty("authUserId");
    await page.reload();
  }

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/(?:auth\/login)?$/);
  const afterLogout = await page.evaluate(() => fetch("/api/v1/viewer").then((response) => response.status));
  expect(afterLogout).toBe(401);
});


test("Google-style OAuth user reaches the same Sponsor enrollment and logout flow", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();

  await page.waitForURL(/\/auth\/complete$/, { timeout: 15_000 });
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === "quorum.session_token");
  expect(sessionCookie).toMatchObject({
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
  const sessionProbe = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session", { cache: "no-store" });
    const body = await response.json() as { user?: { emailVerified?: boolean } } | null;
    return { status: response.status, hasUser: Boolean(body?.user), emailVerified: body?.user?.emailVerified === true };
  });
  expect(sessionProbe).toEqual({ status: 200, hasUser: true, emailVerified: true });

  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await page.getByLabel("Role").selectOption("SPONSOR");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const viewer = await page.evaluate(async () => {
    const response = await fetch("/api/v1/viewer", { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  expect(viewer.status).toBe(200);
  expect(viewer.body.viewer).toMatchObject({
    accountState: "ACTIVE",
    selfServiceRoles: ["SPONSOR"],
  });
  expect(viewer.body.viewer).not.toHaveProperty("email");
  expect(viewer.body.viewer).not.toHaveProperty("authUserId");

  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "Account Security" })).toBeVisible();
  await expect(page.getByText("Google", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeDisabled();
  await expect(page.getByText("Keep at least one sign-in method connected to avoid losing access.")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/(?:auth\/login)?$/);
  expect(await page.evaluate(() => fetch("/api/v1/viewer").then((response) => response.status))).toBe(401);
});
