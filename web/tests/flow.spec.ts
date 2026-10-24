import { expect, test } from "@playwright/test";

/**
 * The whole editorial loop, end to end:
 * reader signs up -> editor runs the AI -> fact check blocks a wrong number -> AI fixes it
 * -> editor publishes -> the reader sees it.
 *
 * Needs the full stack running locally (see README "Run everything on your laptop"),
 * with the worker started through dev/fake_ai.py so no API key is needed.
 */
const GAME = "2026-10-24-karpat-tappara";
const PASSWORD = process.env.NEWSROOM_PASSWORD ?? "kaleva";

test.describe.configure({ mode: "serial" });

test("reader picks teams and sees an empty feed before anything is approved", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await page.locator('[data-team="karpat"]').click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Nothing published for your teams yet")).toBeVisible();
});

test("editor runs the AI, fixes the flagged fact and publishes", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/newsroom");
  await page.locator("#nr-name").fill("Sanna K.");
  await page.locator("#nr-pw").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("tab", { name: "Games and AI" }).click();
  await page.locator(`[data-run="${GAME}"]`).click();
  await page.getByRole("tab", { name: /Review queue/ }).click();
  await expect(page.locator(".qi")).toHaveCount(3, { timeout: 90_000 });

  // The summary is flagged: the AI got the shot count wrong.
  await page.locator(".qi", { hasText: "match report" }).click();
  await expect(page.locator(".dh .pill")).toHaveText("Flagged");
  await expect(page.getByRole("button", { name: "Approve and publish" })).toBeDisabled();
  await page.getByRole("button", { name: "Fix with AI" }).first().click();
  await expect(page.locator(".dh .pill")).toHaveText("Needs review", { timeout: 60_000 });

  await page.getByRole("button", { name: "Approve and publish" }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.locator(".dh .pill")).toHaveText("Published");

  for (const name of ["Podcast", "Highlights"]) {
    await page.locator(".qi", { hasText: name }).click();
    await page.getByRole("button", { name: "Approve and publish" }).click();
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.locator(".dh .pill")).toHaveText("Published");
  }
});

test("reader now sees the approved summary, video and podcast", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click().catch(() => {});
  if (await page.locator('[data-team="karpat"]').isVisible()) {
    await page.locator('[data-team="karpat"]').click();
    await page.getByRole("button", { name: "Start" }).click();
  }
  const game = page.locator(`[data-game="${GAME}"]`);
  await expect(game).toBeVisible();
  await expect(game.getByText("Made by AI · checked by an editor")).toBeVisible();
  await expect(game.locator("video")).toHaveCount(1);
  await expect(game.getByText("Podcast", { exact: true })).toBeVisible();
});
