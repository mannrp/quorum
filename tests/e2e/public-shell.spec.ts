import { expect, test } from "@playwright/test";

test("public shell uses only viewer and the registered home operation", async ({ page }) => {
  const requestPaths: string[] = [];
  const legacyBodies: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    requestPaths.push(pathname);
    if (pathname === "/api/graphql") legacyBodies.push(request.postData() ?? "");
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find the right team, project, and next step." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse projects" })).toHaveAttribute("href", "/projects");
  await expect.poll(() => requestPaths).toContain("/api/v1/viewer");
  await expect.poll(() => requestPaths).toContain("/api/v1/operations/PublicHomeV1");
  expect(legacyBodies).toHaveLength(0);

  const negatives = await page.evaluate(async () => {
    const request = (operationId: string, variables: object) => fetch(`/api/v1/operations/${operationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(variables),
    }).then((response) => response.status);
    return {
      unknown: await request("Unknown", {}),
      queryText: await request("PublicHomeV1", { query: "{ users { email } }" }),
    };
  });
  expect(negatives).toEqual({ unknown: 404, queryText: 400 });
});

test("public discovery uses narrow registered operations", async ({ page }) => {
  test.setTimeout(60_000);
  const legacyBodies: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/graphql") legacyBodies.push(request.postData() ?? "");
  });

  const openThrough = async (path: string, operationId: string) => {
    const responsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/v1/operations/${operationId}`,
    );
    await page.goto(path);
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  };

  await openThrough("/teams", "PublicTeamsV1");
  await expect(page.getByRole("heading", { name: "Capstone teams" })).toBeVisible();

  await openThrough("/projects", "PublicProjectsV1");
  await expect(page.getByRole("heading", { name: "Capstone projects" })).toBeVisible();

  await openThrough("/teams/11111111-1111-4111-8111-111111111111", "PublicTeamV1");
  await openThrough("/projects/22222222-2222-4222-8222-222222222222", "PublicProjectV1");
  await openThrough("/profile/nonexistent-user", "PublicProfileV1");

  const browserBodies = legacyBodies.join("\n");
  expect(browserBodies).not.toMatch(/query (Teams|Team|Projects|Project|Profile)\b/);
  expect(browserBodies).not.toMatch(/fileUrl|resumeUrl|applications\s*\{/);
});