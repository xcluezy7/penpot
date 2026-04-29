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
        id: "request-99",
        prompt: "Improve the hero CTA and tighten spacing",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        error: null,
        action: null,
      }),
    });
  });

  await page.route("**:4501/agent-requests/request-99", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "request-99",
        prompt: "Improve the hero CTA and tighten spacing",
        status: "accepted",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:01.000Z",
        error: null,
        action: {
          type: "plugin-task",
          request: {
            task: "createAgentMarker",
            params: {
              label: "Agent: Improve CTA — Improve the hero CTA and ti…",
              prompt: "Improve the hero CTA and tighten spacing",
              width: 260,
              height: 72,
            },
          },
        },
      }),
    });
  });

  await WasmWorkspacePage.init(page);
});

test("Shows the prepared visible-action task after Ask Agent is accepted", async ({ page }) => {
  const workspacePage = new WasmWorkspacePage(page);
  await workspacePage.setupEmptyFile();
  await workspacePage.goToWorkspace();

  await page.getByTestId("ask-agent-toggle").click();
  await page.getByTestId("ask-agent-input").fill("Improve the hero CTA and tighten spacing");
  await page.getByTestId("ask-agent-submit").click();

  await expect(page.getByTestId("ask-agent-status")).toContainText(
    "Request accepted",
  );
  await expect(page.getByTestId("ask-agent-action-task")).toContainText(
    "createAgentMarker",
  );
  await expect(page.getByTestId("ask-agent-action-label")).toContainText(
    "Agent: Improve CTA",
  );
});
