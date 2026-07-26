import { expect, test } from "@playwright/test";

test("public shell is reachable without authentication", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find the right team, project, and next step." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse projects" })).toHaveAttribute("href", "/projects");
});
