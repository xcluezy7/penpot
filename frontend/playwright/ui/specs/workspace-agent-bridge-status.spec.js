import { test, expect } from "@playwright/test";
import { WasmWorkspacePage } from "../pages/WasmWorkspacePage";

test.beforeEach(async ({ page }) => {
  await page.route("**:4501/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "degraded",
        connections: {
          penpotWebSocket: "connected",
          mcpPlugin: "disconnected",
          agentSockets: 2,
        },
        details: {
          penpotWebSocket: null,
          mcpPlugin: "Plugin health check not implemented yet",
        },
      }),
    }),
  );

  await WasmWorkspacePage.init(page);
});

test("Shows bridge status in workspace header", async ({ page }) => {
  const workspacePage = new WasmWorkspacePage(page);
  await workspacePage.setupEmptyFile();
  await workspacePage.goToWorkspace();

  await expect(page.getByTestId("agent-bridge-status")).toBeVisible();
  await expect(page.getByTestId("agent-bridge-status")).toContainText(
    "Bridge degraded",
  );
  await expect(page.getByTestId("agent-bridge-status-meta")).toContainText(
    "WS connected · MCP disconnected · Agents 2",
  );
});
