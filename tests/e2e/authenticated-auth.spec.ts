import { expect, test } from "@playwright/test";

const integration = process.env.QUORUM_REQUIRE_INTEGRATION === "true";
const mailpitURL = process.env.MAILPIT_API_URL;

async function suspendProductAccount(email: string): Promise<void> {
  const databaseURL = process.env.DATABASE_URL;
  if (!databaseURL) throw new Error("DATABASE_URL is required.");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseURL });
  try {
    const result = await pool.query(
      `UPDATE app.account_states state SET status = 'SUSPENDED', suspended_at = now(), state_version = state_version + 1, updated_at = now() FROM app.user_identities identity WHERE state.user_id = identity.user_id AND identity.verified_email = $1`,
      [email],
    );
    expect(result.rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}
async function completeProductProfile(email: string): Promise<void> {
  const databaseURL = process.env.DATABASE_URL;
  if (!databaseURL) throw new Error("DATABASE_URL is required.");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseURL });
  try {
    const result = await pool.query(
      `UPDATE users SET profile_complete = true WHERE email = $1`,
      [email],
    );
    expect(result.rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}
async function verificationURL(email: string, subject = "Verify your Quorum email"): Promise<string> {
  if (!mailpitURL) throw new Error("MAILPIT_API_URL is required.");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const list = await fetch(`${mailpitURL}/api/v1/messages`);
    if (!list.ok) throw new Error(`Mailpit list failed: ${list.status}`);
    const body = await list.json() as { messages?: Array<{ ID: string; Subject: string; To?: Array<{ Address: string }> }> };
    const summary = body.messages?.find((message) =>
      message.Subject === subject &&
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

  const legacyBodies: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/graphql") legacyBodies.push(request.postData() ?? "");
  });

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
  await expect(page.getByRole("heading", { name: /Good to see you/ })).toBeVisible();

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

  expect(legacyBodies.join("\n")).not.toMatch(/query (ShellAuth|ShellCounts|DashboardPage|DashboardContext|DashboardAuth|AuthState|Me)\b/);
  await completeProductProfile(email);
  const createResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/operations/CreateTeamV1",
  );
  await page.goto("/teams/new");
  await page.locator('input[placeholder="Aegis Container Security"]').fill(`Browser Team ${Date.now()}`);
  await page.locator('textarea[placeholder^="Briefly state"]').fill("A registered operation creates this team.");
  await page.getByRole("button", { name: "Initialize Capstone Group" }).click();
  expect((await createResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/teams\/[0-9a-f-]+$/);
  expect(legacyBodies.join("\n")).not.toMatch(/mutation CreateTeam\b/);


  await suspendProductAccount(email);
  const inactiveViewer = await page.evaluate(() => fetch("/api/v1/viewer", { cache: "no-store" }).then((response) => response.status));
  expect(inactiveViewer).toBe(403);
  const signOutStatus = await page.evaluate(() => fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).then((response) => response.status));
  expect(signOutStatus).toBe(200);
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
  await expect(page.getByText("Sign Out")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log In" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Join Now" })).not.toBeVisible();

  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/auth/register");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Role").selectOption("SPONSOR");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Good to see you/ })).toBeVisible();
  await expect(page.getByText("Sign Out")).toBeVisible();
  await expect(page.getByRole("link", { name: "Complete Profile" })).toBeVisible();

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
  await expect(page.getByText("This browser", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out everywhere" })).toBeVisible();
  await expect(page.getByText("Keep at least one sign-in method connected to avoid losing access.")).toBeVisible();
  const secondTab = await page.context().newPage();
  await secondTab.goto("/settings/account");
  await expect(secondTab.getByRole("heading", { name: "Account Security" })).toBeVisible();
  await page.getByRole("button", { name: "Log out everywhere" }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(secondTab).toHaveURL(/\/auth\/login$/);
  await expect(page.getByRole("link", { name: "Log In" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join Now" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).not.toBeVisible();
  expect(await secondTab.evaluate(() => fetch("/api/v1/viewer").then((response) => response.status))).toBe(401);
});
test("password reset email replaces credentials without retaining the token URL", async ({ page }) => {
  test.skip(!integration, "requires pinned PostgreSQL and Mailpit services");

  const email = `auth-reset-browser-${Date.now()}@example.test`;
  const password = "correct horse battery staple 123";
  const newPassword = "new correct horse battery staple 456";

  await page.goto("/auth/register");
  await page.getByLabel("Full name").fill("Reset Browser");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.goto(await verificationURL(email));

  await page.goto("/auth/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an eligible account exists, a password reset link has been sent.")).toBeVisible();

  await page.goto(await verificationURL(email, "Reset your Quorum password"));
  await expect(page).toHaveURL(/\/auth\/reset-password\?token=/);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?reset=complete$/);
  expect(page.url()).not.toContain("token=");
  await expect(page.getByText("Password updated. Sign in with your new password.")).toBeVisible();

  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Connect Session" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});
