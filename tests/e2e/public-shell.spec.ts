import { expect, test } from "@playwright/test";

test("public shell uses only the registered home operation", async ({ page }) => {
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
  await expect.poll(() => requestPaths).toContain("/api/v1/operations/PublicHomeV1");
  expect(legacyBodies).toHaveLength(1);
  expect(legacyBodies[0]).toContain("query ShellAuth");
  expect(legacyBodies[0]).not.toContain("query Home");
  expect(legacyBodies[0]).not.toContain("projects");

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