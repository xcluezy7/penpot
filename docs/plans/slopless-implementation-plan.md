# Slop-Less — Implementation Plan

> **Source:** `docs/brainstorms/slopless-multiagent-design-tool.md` > **Architecture:** Agent Bridge sidecar (TypeScript/Node.js) + Penpot MCP plugin extension
> **Deployment:** Docker Compose (extends existing Penpot devenv)

---

## Phase 1: Foundation & Infrastructure

### U01 — Project Scaffolding: `agent-bridge/`

- **Description:** Create the new Agent Bridge service directory with TypeScript project setup
- **Files:**
  - `agent-bridge/package.json` (pnpm workspace member)
  - `agent-bridge/tsconfig.json`
  - `agent-bridge/src/index.ts` (entrypoint)
  - `agent-bridge/src/config.ts` (env var loading with validation)
  - `agent-bridge/.env.example`
  - `agent-bridge/Dockerfile`
- **Dependencies:** None
- **Acceptance criteria:**
  - `pnpm -C agent-bridge install` succeeds
  - `pnpm -C agent-bridge run build` compiles without errors
  - TypeScript strict mode enabled
  - Zod schema validates all required env vars

### U02 — Docker Compose Integration

- **Description:** Extend Penpot's Docker Compose to include the Agent Bridge service
- **Files:**
  - `docker/devenv/docker-compose.yaml` (add `agent-bridge` service)
  - `agent-bridge/Dockerfile` (multi-stage Node.js build)
  - `manage.sh` (add `build-agent-bridge` command)
- **Dependencies:** U01
- **Acceptance criteria:**
  - `./manage.sh start-devenv` launches frontend, backend, Redis, Postgres, **and** agent-bridge
  - Agent bridge container can reach Penpot backend and MCP plugin ports
  - Health checks configured for all services

### U03 — Agent Bridge Health & Logging

- **Description:** Structured logging, health endpoint, and graceful shutdown
- **Files:**
  - `agent-bridge/src/logger.ts`
  - `agent-bridge/src/health.ts`
  - `agent-bridge/src/index.ts` (add HTTP health server)
- **Dependencies:** U01
- **Acceptance criteria:**
  - `GET /health` returns `{ status: "ok", uptime, connections }` — 200
  - All logs are JSON-structured with level, timestamp, and context
  - SIGTERM triggers graceful WebSocket disconnect and HTTP server close

---

## Phase 2: Agent Bridge Core

### U04 — Penpot WebSocket Client

- **Description:** Connect the Agent Bridge to Penpot's real-time WebSocket for canvas state subscription
- **Files:**
  - `agent-bridge/src/penpot/ws-client.ts`
  - `agent-bridge/src/penpot/protocol.ts` (message type definitions)
  - `agent-bridge/src/penpot/canvas-state.ts` (in-memory canvas model)
- **Dependencies:** U02
- **Acceptance criteria:**
  - Bridge connects to Penpot WebSocket on startup
  - Receives and parses canvas update events
  - Maintains in-memory representation of current canvas state
  - Auto-reconnects on disconnect with exponential backoff
  - Logs connection state changes

### U05 — MCP Server Extension (Design Tools)

- **Description:** Extend the existing MCP server (`mcp/packages/server/`) with new design-focused tools
- **Files:**
  - `mcp/packages/server/src/tools/design/generate.ts` — generate design from prompt
  - `mcp/packages/server/src/tools/design/iterate.ts` — iterate on selected elements
  - `mcp/packages/server/src/tools/design/explore.ts` — explore design variants
  - `mcp/packages/server/src/tools/design/review.ts` — expert review of design
  - `mcp/packages/server/src/tools/index.ts` (register new tools)
  - `mcp/packages/common/src/types.ts` (add design tool request/response types)
- **Dependencies:** U04
- **Acceptance criteria:**
  - All 4 tools registered and discoverable via `tools/list`
  - Each tool validates input with Zod schemas
  - Tools delegate work to the Agent Bridge (not implemented inline)
  - Tool responses include structured design change data

### U06 — Plugin Task Handler Extension

- **Description:** Extend the Penpot MCP plugin to execute new design tool tasks on the canvas
- **Files:**
  - `mcp/packages/plugin/src/task-handlers/design-handler.ts`
  - `mcp/packages/plugin/src/task-handlers/index.ts` (register handlers)
  - `mcp/packages/common/src/types.ts` (add design task types)
- **Dependencies:** U05
- **Acceptance criteria:**
  - Plugin receives design task from MCP server
  - Design handler applies changes to Penpot canvas via Plugin API
  - Changes appear on canvas in real-time (visible to human user)
  - Error handling: if canvas API fails, task returns error to agent

### U07 — Agent Connection Manager

- **Description:** Manage agent connections (WebSocket for OpenClaw, stdio/MCP for pi coding agent)
- **Files:**
  - `agent-bridge/src/agents/connection-manager.ts`
  - `agent-bridge/src/agents/agent-session.ts`
  - `agent-bridge/src/agents/openclaw-adapter.ts`
  - `agent-bridge/src/agents/pi-agent-adapter.ts`
  - `agent-bridge/src/agents/types.ts`
- **Dependencies:** U04
- **Acceptance criteria:**
  - OpenClaw agents can connect via WebSocket and authenticate
  - pi coding agent can connect via MCP stdio transport
  - Each agent session has isolated state and canvas access
  - Connection manager tracks active sessions, enforces limits
  - Disconnects clean up session state

---

## Phase 3: Skill Registry

### U08 — Skill Registry Core

- **Description:** Pluggable registry of design skills that agents can invoke
- **Files:**
  - `agent-bridge/src/skills/registry.ts`
  - `agent-bridge/src/skills/types.ts` (Skill interface)
  - `agent-bridge/src/skills/loader.ts` (dynamic skill loading)
  - `agent-bridge/src/skills/built-in/index.ts`
- **Dependencies:** U07
- **Acceptance criteria:**
  - Registry supports register/describe/list/invoke operations
  - Skills are loadable at runtime from a directory
  - Each skill has a name, description, input schema, and execute function
  - Skills can access canvas state and submit changes via the bridge

### U09 — Built-in Skill: Design Generator

- **Description:** Generate a design from a natural language prompt (Huashu-inspired)
- **Files:**
  - `agent-bridge/src/skills/built-in/design-generator.ts`
  - `agent-bridge/src/skills/built-in/prompts/generate-design.ts` (prompt templates)
- **Dependencies:** U08
- **Acceptance criteria:**
  - Skill accepts `{ prompt: string, context?: CanvasState }`
  - Generates structured design intent (semantic layout, not raw shapes)
  - Output maps to Penpot canvas operations via the bridge
  - Includes placeholder handling (per Huashu protocol)

### U10 — Built-in Skill: Anti-Slop Reviewer

- **Description:** Expert review of a design against quality criteria
- **Files:**
  - `agent-bridge/src/skills/built-in/anti-slop-reviewer.ts`
  - `agent-bridge/src/skills/built-in/checklists/quality-checklist.ts`
- **Dependencies:** U08
- **Acceptance criteria:**
  - Skill accepts `{ design: CanvasState }` or a frame reference
  - Reviews against 5 dimensions: consistency, hierarchy, execution, functionality, innovation
  - Returns structured review with scores and fix suggestions
  - Suggestions map to actionable canvas operations

---

## Phase 4: Frontend Integration

### U11 — Agent Presence UI

- **Description:** Show agent cursors and activity indicators on the canvas
- **Files:**
  - `frontend/src/app/main/ui/workspace/agent-presence.cljs`
  - `frontend/src/app/main/style/agent-presence.scss`
  - `frontend/src/app/main/data/agent.cljs` (agent state management)
- **Dependencies:** U07 (agent session data flows to frontend via WebSocket)
- **Acceptance criteria:**
  - Agent cursors appear on canvas when agent is active
  - Agent activity shows a progress indicator (e.g., "Agent is editing frame X")
  - Agent presence distinguishable from human cursors (different color/icon)
  - Agent disconnects remove presence indicator

### U12 — Comments & Annotations Panel

- **Description:** UI for humans to leave comments and call out to agents
- **Files:**
  - `frontend/src/app/main/ui/workspace/comments-panel.cljs`
  - `frontend/src/app/main/ui/workspace/comments-panel.scss`
  - `frontend/src/app/main/data/comments.cljs`
  - `frontend/src/app/main/data/agent-requests.cljs`
- **Dependencies:** U11
- **Acceptance criteria:**
  - Users can add comments pinned to specific canvas elements
  - Comments panel lists all comments with status (open/resolved)
  - "Ask Agent" button on any comment sends it to the Agent Bridge
  - Agent responses appear as comment replies

### U13 — "Ask Agent" Quick Action

- **Description:** Inline UI for selecting elements and sending agent requests
- **Files:**
  - `frontend/src/app/main/ui/workspace/ask-agent-bar.cljs`
  - `frontend/src/app/main/ui/workspace/ask-agent-bar.scss`
- **Dependencies:** U12
- **Acceptance criteria:**
  - Selecting one or more elements shows "Ask Agent" floating bar
  - Bar has text input for natural language request
  - Submitting sends request to Agent Bridge with element context
  - Request status (pending/processing/done) shown inline
  - User can cancel a pending request

---

## Phase 5: Foundation System (Architecture Only)

### U14 — Foundation System Scaffold

- **Description:** Create the pluggable component registry architecture (no libraries shipped yet)
- **Files:**
  - `agent-bridge/src/foundation/registry.ts`
  - `agent-bridge/src/foundation/types.ts`
  - `agent-bridge/src/foundation/manifest-schema.ts`
  - `agent-bridge/src/foundation/adapters/react-adapter.ts` (empty scaffold)
  - `agent-bridge/src/foundation/adapters/vue-adapter.ts` (empty scaffold)
  - `agent-bridge/src/foundation/adapters/svelte-adapter.ts` (empty scaffold)
  - `agent-bridge/src/foundation/registries/shadcn-manifest.json` (example)
  - `agent-bridge/src/foundation/registries/radix-manifest.json` (example)
- **Dependencies:** U08
- **Acceptance criteria:**
  - Manifest schema defined: `{ name, framework, components: [{ name, props, styles, layout }] }`
  - Registry loads manifests from a directory
  - Framework adapter interface defined but not implemented
  - Example manifests for shadcn/ui and Radix demonstrate the format
  - Registry is queryable: "give me all button components for React"

### U15 — Component-Aware Design Generator Hook

- **Description:** Wire the Design Generator skill (U09) to optionally use component library data
- **Files:**
  - `agent-bridge/src/skills/built-in/design-generator.ts` (extend U09)
  - `agent-bridge/src/foundation/component-mapper.ts`
- **Dependencies:** U09, U14
- **Acceptance criteria:**
  - Design Generator checks if a framework is selected
  - If framework selected, maps semantic design intent to component library definitions
  - If no framework selected, falls back to generic shape generation
  - Output includes component references (e.g., "this button uses shadcn/ui Button")

---

## Phase 6: Integration & Deployment

### U16 — End-to-End Integration Test

- **Description:** Full flow test: agent connects → receives canvas state → makes changes → visible in UI
- **Files:**
  - `agent-bridge/test/integration/full-flow.test.ts`
  - `agent-bridge/test/fixtures/canvas-state.json`
  - `agent-bridge/test/mocks/penpot-ws.ts`
- **Dependencies:** U06, U07, U08, U09
- **Acceptance criteria:**
  - Test spins up mock Penpot backend + Agent Bridge + mock agent
  - Agent connects, receives canvas state
  - Agent invokes design generator skill
  - Changes flow through MCP → Plugin → Canvas
  - All steps complete within 5 seconds
  - Test is deterministic (no flakiness)

### U17 — Docker Production Build

- **Description:** Production Docker Compose with all services, health checks, and networking
- **Files:**
  - `docker/compose/slopless.yaml` (production compose)
  - `docker/images/Dockerfile.agent-bridge` (production image)
  - `manage.sh` (add `build-slopless` command)
- **Dependencies:** U02, U16
- **Acceptance criteria:**
  - `docker compose -f docker/compose/slopless.yaml up` starts all services
  - All health checks pass within 30 seconds
  - Agent bridge reachable on port 4401 (MCP) and 4402 (WebSocket)
  - Frontend, backend, Redis, Postgres, Agent Bridge all on same network
  - No hardcoded secrets — all config via env vars

### U18 — Documentation

- **Description:** Developer guide, architecture docs, and agent connection guide
- **Files:**
  - `docs/technical-guide/slopless-architecture.md`
  - `docs/technical-guide/slopless-agent-connection.md`
  - `docs/technical-guide/slopless-foundation-system.md`
  - `agent-bridge/README.md`
- **Dependencies:** U17
- **Acceptance criteria:**
  - Architecture doc explains all components and data flow
  - Agent connection guide shows how OpenClaw and pi agent connect
  - Foundation System doc explains how to add component libraries
  - README has quickstart: `docker compose up`, connect agent, start designing

---

## Execution Groups (Parallel-Safe)

```
Group 1:  U01, U02, U03          (scaffolding + Docker)
Group 2:  U04, U07                (WebSocket client + agent connections)
Group 3:  U05, U11                (MCP tools + agent presence UI)
Group 4:  U06, U12, U08           (plugin handler + comments + skill registry)
Group 5:  U09, U10, U13           (skills + Ask Agent UI)
Group 6:  U14                      (Foundation System scaffold)
Group 7:  U15, U16                (component-aware generator + e2e test)
Group 8:  U17, U18                (production Docker + docs)
```

## Risk Areas

| Risk                                                               | Impact                               | Mitigation                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Penpot WebSocket protocol is undocumented**                      | U04, U06 blocked                     | Reverse-engineer from frontend `app.main.store` and MCP plugin code; document as we go                             |
| **MCP server architecture may not support new tool types cleanly** | U05 requires redesign                | If tools can't be added modularly, fork the MCP server package under `agent-bridge/`                               |
| **Real-time sync latency >200ms**                                  | User experience degraded             | Profile WebSocket → Plugin → Canvas path; batch small changes; consider direct canvas injection                    |
| **Huashu's HTML output doesn't map to Penpot SVG**                 | U09 skill produces unusable output   | Skill generates _semantic design intent_ (layout, hierarchy, colors), not HTML; bridge translates to Penpot shapes |
| **Foundation System manifests become stale as libraries update**   | U14 produces outdated component data | Manifests are versioned and pinned; add a manifest update workflow; don't auto-sync                                |

## Success Criteria (from requirements)

- [ ] Human and agent can simultaneously edit the same canvas without conflicts
- [ ] Agent can understand and act on human comments/annotations
- [ ] Design skills work within Slop-Less's native format (not HTML output)
- [ ] Single `docker compose up` brings up the full environment
- [ ] OpenClaw and pi coding agent can connect and make design changes
- [ ] Agent changes are visible to humans in real-time (<200ms latency)
- [ ] Humans can undo/redo agent actions independently
- [ ] Foundation System architecture supports plugging in component libraries without core rewrites
- [ ] At least 4 frameworks with open-source component library defaults (Phase 2)
