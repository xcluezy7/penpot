# Slop-Less Vertical Slice TDD Plan

Status: Active
Created: 2026-04-28
Repo: /home/egsox/projects/penpot

## Goal

Deliver the first testable, vertically sliced increment of the multi-agent design tool so that backend progress is visible in the product UI and can be exercised in a development environment.

## Delivery policy

- Work progresses slice-by-slice in order.
- After a slice is green in tests and passes manual acceptance, automatically move to the next slice.
- Stop only if:
  1. a dependency is unclear,
  2. a required interface in Penpot/MCP cannot be verified,
  3. test infrastructure prevents trustworthy validation.
- Every slice must include at least one user-visible change.

## Tracking notes

- Requested persistent task tracking via `tdcli`
- `tdcli` is not installed in this environment
- Commander task service was unavailable during this session
- This file is the repo-local source of truth for recovery and handoff

## Finish-first ordering

### Slice 1 — Agent Bridge health and visible frontend status

Objective: make the new architecture observable from the UI before attempting full agent-driven editing.

Definition of done:

1. `agent-bridge` connects to Penpot WebSocket on startup or reports a clear connection failure reason.
2. A small frontend status surface shows:
   - bridge reachable / unreachable
   - Penpot WS connected / disconnected
   - active agent count
3. The status can be verified locally without requiring full design-generation features.

Why this goes first:

- It closes the biggest current uncertainty: runtime connectivity.
- It gives a friendly, testable UI change tied to backend work.
- It supports every later slice.

### Slice 2 — Minimal Ask Agent request path

Objective: a human can trigger a simple request from the UI and see it acknowledged end-to-end.

Definition of done:

1. User can click a lightweight "Ask Agent" control.
2. Frontend sends a request to the bridge.
3. Bridge records and returns request status.
4. UI shows pending / accepted / failed state.

This slice may use a stub response instead of real design generation.

### Slice 3 — First canvas-affecting agent action

Objective: a tiny agent action changes something visible on canvas through the intended architecture.

Definition of done:

1. A trivial design tool path exists, such as "add sample annotation" or "rename a test layer".
2. The request flows through MCP/plugin or a deliberately temporary bridge path.
3. Human sees the visible result and can verify success in the UI.

## TDD execution model

For every slice, work in this order:

1. Write a failing test for the backend or integration seam.
2. Write a failing UI test or deterministic manual acceptance script.
3. Implement the thinnest code needed to make the tests pass.
4. Refactor only after green.
5. Record what remains blocked before moving to the next slice.

## Concrete phased implementation plan

This section replaces broad intent with exact implementation units and exact test files.

---

## Phase 0: Test Harness and Recovery Setup

**Why:** The bridge currently builds, but it does not have a verified automated test entrypoint. Before feature work, create stable test seams so each slice can be implemented TDD-first without inventing test patterns mid-stream.

### Test files to add first

- `agent-bridge/test/health.test.ts`
- `agent-bridge/test/ws-client.test.ts`
- `agent-bridge/test/startup.test.ts`

### Supporting files to add or modify

- `agent-bridge/package.json`
- `agent-bridge/tsconfig.json` or `agent-bridge/tsconfig.test.json`
- `agent-bridge/src/index.ts`
- `agent-bridge/src/health.ts`
- `agent-bridge/src/penpot/ws-client.ts`

### Planned test approach

- Use Node's built-in test runner with TypeScript execution through the existing toolchain.
- Preferred command target:
  - `pnpm -C agent-bridge exec node --import tsx --test test/**/*.test.ts`
- If needed, add a package script:
  - `"test": "node --import tsx --test test/**/*.test.ts"`

### Exit criteria

1. Bridge tests can be run independently.
2. Tests can mock WS startup without launching the full Penpot stack.
3. Recovery instructions remain in this plan file.

---

## Phase 1: Slice 1 — Bridge truthfulness and workspace-visible status

**Why:** The current bridge health is only partially truthful, and there is no user-visible evidence in the app that the new subsystem is alive. This is the smallest vertical slice that turns backend progress into visible product behavior.

### Backend tests first

**New file** → `agent-bridge/test/startup.test.ts`
- verifies `main` startup path attempts to initialize the Penpot WebSocket client
- verifies startup does not silently skip WS connection setup
- verifies degraded mode is surfaced when connection boot fails

**New file** → `agent-bridge/test/health.test.ts`
- returns `status: ok` when HTTP server is up and dependencies are connected
- returns `status: degraded` when Penpot WS is disconnected
- reports `agentSockets` count accurately
- does not claim a dependency is connected unless that dependency was actually established

**New file** → `agent-bridge/test/ws-client.test.ts`
- verifies reconnect scheduling after disconnect
- verifies subscribe state is retained across reconnects
- verifies malformed messages do not crash the client

### Frontend tests first

**New file** → `frontend/test/frontend_tests/data/agent_bridge_status_test.cljs`
- verifies health payload parsing into frontend state
- verifies derived state for `:ok`, `:degraded`, `:unreachable`
- verifies agent count display data remains stable when fields are absent

**New file** → `frontend/playwright/ui/specs/workspace-agent-bridge-status.spec.js`
- verifies a visible bridge-status widget appears in workspace
- verifies disconnected/degraded state is rendered when bridge health endpoint is unavailable or mocked degraded
- verifies active agent count is displayed when bridge reports sessions

### Implementation files

**Modify** → `agent-bridge/src/index.ts`
- split boot logic so it can be tested without only invoking process-global side effects
- actually connect the Penpot WS client during startup
- expose a clearer boot lifecycle for tests

**Modify** → `agent-bridge/src/health.ts`
- remove placeholder semantics where possible
- optionally include a `details` or `reason` field for degraded state

**Modify** → `agent-bridge/src/penpot/ws-client.ts`
- make connection state externally observable in a testable way
- keep reconnect behavior deterministic enough for tests

**New file** → `frontend/src/app/main/data/agent_bridge.cljs`
- owns bridge health fetch/poll logic
- stores UI-facing bridge status state

**New file** → `frontend/src/app/main/ui/workspace/agent_bridge_status.cljs`
- renders the compact workspace status surface

**Modify** → `frontend/src/app/main/ui/workspace/presence.cljs`
or
**Modify** → `frontend/src/app/main/ui/workspace/viewport/top_bar.cljs`
- mount the new status surface in a low-risk visible location

### Acceptance checks

1. `pnpm -C agent-bridge run build`
2. `pnpm -C agent-bridge exec node --import tsx --test test/**/*.test.ts`
3. `pnpm -C frontend test`
4. `pnpm -C frontend exec playwright test playwright/ui/specs/workspace-agent-bridge-status.spec.js`
5. Manual: stop the bridge and watch the workspace status surface update accordingly

### Do not expand in this phase

- no Ask Agent action yet
- no skill registry yet
- no plugin canvas mutations yet
- no agent presence cursor UX beyond bridge status visibility

---

## Phase 2: Slice 2 — Minimal Ask Agent request path with stubbed acknowledgment

**Why:** Once health is visible, the next best vertical slice is a real user action that crosses the frontend-to-bridge boundary. The response can be stubbed; the important thing is a trustworthy request lifecycle.

### Backend tests first

**New file** → `agent-bridge/test/request-store.test.ts`
- verifies a request can be created with a predictable ID
- verifies request status transitions `pending -> accepted` or `pending -> failed`
- verifies invalid request payloads are rejected cleanly

**New file** → `agent-bridge/test/http-api.test.ts`
- verifies `POST /agent-requests` returns an acknowledgment payload
- verifies `GET /agent-requests/:id` returns current status

### Frontend tests first

**New file** → `frontend/test/frontend_tests/data/agent_requests_test.cljs`
- verifies frontend state transitions for request creation and polling
- verifies error state if bridge rejects or is unreachable

**New file** → `frontend/playwright/ui/specs/workspace-ask-agent-request.spec.js`
- verifies user can trigger Ask Agent from a minimal visible control
- verifies pending state appears
- verifies accepted or failed state is rendered

### Implementation files

**New file** → `agent-bridge/src/requests/store.ts`
- in-memory request registry for the initial slice

**New file** → `agent-bridge/src/http/agent-requests.ts`
- minimal express route handlers for request create/read

**Modify** → `agent-bridge/src/index.ts`
- register the minimal request routes

**New file** → `frontend/src/app/main/data/agent_requests.cljs`
- submit request + poll/read status

**New file** → `frontend/src/app/main/ui/workspace/ask_agent_bar.cljs`
or
**New file** → `frontend/src/app/main/ui/workspace/ask_agent_button.cljs`
- keep this tiny and visible, not a large panel

**Modify** → `frontend/src/app/main/ui/workspace/comments.cljs`
or
**Modify** → `frontend/src/app/main/ui/workspace/viewport/top_bar.cljs`
- mount the first request trigger where it is easiest to test

### Acceptance checks

1. All Phase 1 tests remain green
2. `pnpm -C agent-bridge exec node --import tsx --test test/**/*.test.ts`
3. `pnpm -C frontend exec playwright test playwright/ui/specs/workspace-ask-agent-request.spec.js`
4. Manual: create a request and see status move visibly without inspecting logs

### Temporary constraint for this phase

- bridge may acknowledge with a stubbed action message
- no actual design generation yet

---

## Phase 3: Slice 3 — First visible canvas-affecting agent action

**Why:** This is the first proof that the architecture can produce a visible design-side effect, but it should be deliberately tiny to keep the slice testable.

### Preferred first action

- add a sample comment/annotation-like marker
or
- create a known test layer/frame note

The exact action should favor the easiest existing Penpot/plugin pathway, not the most ambitious UX.

### Backend and integration tests first

**New file** → `agent-bridge/test/canvas-command-mapper.test.ts`
- verifies a stubbed agent result maps to one deterministic canvas command payload

**New file** → `mcp/packages/plugin/src/task-handlers/design-handler.test.ts`
or if the plugin test harness does not exist yet,
**New file** → `mcp/packages/plugin/src/task-handlers/__tests__/design-handler.test.ts`
- verifies the plugin-side handler accepts a minimal design task and returns success/failure predictably

**New file** → `agent-bridge/test/full-flow-smoke.test.ts`
- verifies request accepted -> mapped command -> plugin handoff invoked

### Frontend tests first

**New file** → `frontend/playwright/ui/specs/workspace-agent-visible-action.spec.js`
- verifies the user triggers a request
- verifies the visible canvas-side effect appears in the workspace

### Implementation files

**New file** → `mcp/packages/plugin/src/task-handlers/DesignTaskHandler.ts`
- first thin plugin-side handler for one safe visible action

**Modify** → `mcp/packages/plugin/src/main.ts`
or
**Modify** → `mcp/packages/plugin/src/plugin.ts`
- register the new task handler

**New file** → `agent-bridge/src/commands/design-command-mapper.ts`
- map the stubbed request result into the first concrete task payload

**Modify** → `agent-bridge/src/index.ts`
- connect request fulfillment to command mapping/handoff

### Acceptance checks

1. All Phase 1 and Phase 2 tests remain green
2. Plugin/unit tests pass for the new handler
3. Playwright verifies a visible action in workspace
4. Manual: run the same request twice and confirm behavior is deterministic enough to inspect

---

## Phase 4: Slice 4 — Replace stubs with the first real design capability

**Why:** Only after the system can visibly report health, accept a request, and perform one visible action should we introduce real design intelligence.

### Backend tests first

**New file** → `agent-bridge/test/skill-registry.test.ts`
- verifies skills can register and be invoked by name

**New file** → `agent-bridge/test/design-generator.test.ts`
- verifies the first design skill returns semantic intent, not raw HTML

### Frontend tests first

**Modify** → `frontend/playwright/ui/specs/workspace-agent-visible-action.spec.js`
- extend assertions from stubbed result to real skill-backed result

### Implementation files

**New file** → `agent-bridge/src/skills/registry.ts`
**New file** → `agent-bridge/src/skills/types.ts`
**New file** → `agent-bridge/src/skills/built-in/design-generator.ts`
**Modify** → `agent-bridge/src/index.ts`

### Acceptance checks

1. Existing slices remain green
2. First real skill path produces a visible outcome via the already-tested request flow

---

## Critical files by slice

| Slice | Test files | Implementation files |
|------|-------------|----------------------|
| Slice 1 | `agent-bridge/test/health.test.ts`, `agent-bridge/test/ws-client.test.ts`, `agent-bridge/test/startup.test.ts`, `frontend/test/frontend_tests/data/agent_bridge_status_test.cljs`, `frontend/playwright/ui/specs/workspace-agent-bridge-status.spec.js` | `agent-bridge/src/index.ts`, `agent-bridge/src/health.ts`, `agent-bridge/src/penpot/ws-client.ts`, `frontend/src/app/main/data/agent_bridge.cljs`, `frontend/src/app/main/ui/workspace/agent_bridge_status.cljs`, `frontend/src/app/main/ui/workspace/presence.cljs` or `frontend/src/app/main/ui/workspace/viewport/top_bar.cljs` |
| Slice 2 | `agent-bridge/test/request-store.test.ts`, `agent-bridge/test/http-api.test.ts`, `frontend/test/frontend_tests/data/agent_requests_test.cljs`, `frontend/playwright/ui/specs/workspace-ask-agent-request.spec.js` | `agent-bridge/src/requests/store.ts`, `agent-bridge/src/http/agent-requests.ts`, `frontend/src/app/main/data/agent_requests.cljs`, `frontend/src/app/main/ui/workspace/ask_agent_bar.cljs` |
| Slice 3 | `agent-bridge/test/canvas-command-mapper.test.ts`, `agent-bridge/test/full-flow-smoke.test.ts`, `frontend/playwright/ui/specs/workspace-agent-visible-action.spec.js`, `mcp/packages/plugin/src/task-handlers/__tests__/design-handler.test.ts` | `mcp/packages/plugin/src/task-handlers/DesignTaskHandler.ts`, `mcp/packages/plugin/src/plugin.ts` or `main.ts`, `agent-bridge/src/commands/design-command-mapper.ts` |
| Slice 4 | `agent-bridge/test/skill-registry.test.ts`, `agent-bridge/test/design-generator.test.ts` | `agent-bridge/src/skills/registry.ts`, `agent-bridge/src/skills/types.ts`, `agent-bridge/src/skills/built-in/design-generator.ts` |

## Recommended execution order from here

1. Complete Phase 0
2. Complete Slice 1 fully
3. If Slice 1 is green and visually testable, automatically continue to Slice 2
4. If Slice 2 is green and visually testable, automatically continue to Slice 3
5. If a slice fails due to missing architecture clarity, stop and document the blocker in this file before changing scope

## Slice 1 detailed TDD plan

### Backend tests first

1. Add an `agent-bridge` startup test proving the app attempts to connect to Penpot WS during boot.
2. Add a health test proving `/health` returns:
   - bridge up
   - Penpot WS real status, not placeholder-only state
   - agent count
3. Add a failure-path test proving unreachable WS marks status degraded with useful information.

### Frontend tests first

1. Add a UI test for a small status badge/panel in a safe existing workspace or dev surface.
2. Test rendering for:
   - connected
   - disconnected
   - degraded
3. Test polling or fetch behavior against a mocked bridge health endpoint.

### Implementation target

1. Make `agent-bridge/src/index.ts` actually initialize and connect the Penpot WS client.
2. Replace placeholder MCP/connection reporting where appropriate with explicit status semantics.
3. Add a minimal frontend status component backed by bridge health.
4. Keep the UI intentionally narrow and non-invasive.

### Acceptance checks

1. `pnpm -C agent-bridge run build`
2. backend/unit or integration tests for bridge health and WS startup
3. frontend targeted test for the status component
4. manual check: open app, confirm bridge status is visible and changes when bridge is stopped

## Slice boundaries to protect vertical delivery

- Do not begin design generation yet.
- Do not begin component-library foundation work yet.
- Do not begin broad presence/cursor UX yet.
- Do not add a large comment system before the health/status slice is testable.

## Proposed next implementation units

### Unit A — Bridge startup and health truthfulness

Files likely touched:

- `agent-bridge/src/index.ts`
- `agent-bridge/src/health.ts`
- `agent-bridge/src/penpot/ws-client.ts`
- `agent-bridge/src/config.ts`
- new test files under `agent-bridge/test/`

### Unit B — Frontend bridge status surface

Files likely touched:

- existing frontend workspace or debug UI entry point
- new small component for bridge status
- test file covering state rendering

### Unit C — Dev wiring and documentation

Files likely touched:

- `docker/devenv/docker-compose.yaml`
- `manage.sh`
- `agent-bridge/README.md` or technical docs if needed

## Resume checklist

When resuming this effort:

1. Open this plan file.
2. Verify whether `tdcli` or Commander task service is available again.
3. Start with Slice 1, Unit A.
4. Do not expand scope until Slice 1 is green in tests and visibly testable in the UI.
