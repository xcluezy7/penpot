import { test, expect } from "@playwright/test";
import { WasmWorkspacePage } from "../pages/WasmWorkspacePage";

test.beforeEach(async ({ page }) => {
  await page.route("**:4501/agent-requests", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        id: "request-42",
        prompt: "Review the sidebar spacing",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        error: null,
      }),
    });
  });

  await page.route("**:4501/agent-requests/request-42", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "request-42",
        prompt: "Review the sidebar spacing",
        status: "accepted",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:01.000Z",
        error: null,
      }),
    });
  });

  await WasmWorkspacePage.init(page);
});

test("Submits an Ask Agent request and shows accepted state", async ({ page }) => {
  const workspacePage = new WasmWorkspacePage(page);
  await workspacePage.setupEmptyFile();
  await workspacePage.goToWorkspace();

  await page.getByTestId("ask-agent-toggle").click();
  await page.getByTestId("ask-agent-input").fill("Review the sidebar spacing");
  await page.getByTestId("ask-agent-submit").click();

  await expect(page.getByTestId("ask-agent-status")).toContainText(
    "Request accepted",
  );
});
