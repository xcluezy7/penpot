# Requirements: Slop-Less — Multiplayer Agent-First Design Tool

## Problem

Design tools today are either human-only (Figma, Penpot) or agent-only (Huashu SKILL.md generating HTML in a terminal). There is no tool where **humans and agents collaborate in real-time on the same canvas** — where a designer can sketch a wireframe, leave a comment, and ask an agent to iterate on it while they keep working.

Penpot's existing MCP server enables agents to query/create elements, but the interaction is transactional — not collaborative. Huashu Design encodes deep design expertise (brand protocols, anti-slop checklists, design direction recommendation) but outputs static HTML, not editable design files.

## Goals

1. **Real-time multiplayer canvas** where humans and agents see each other's changes live
2. **Agent-first workflow** — agents are first-class participants, not just API callers
3. **Human-to-agent communication** — comments, annotations, and "fix this" callouts from the UI
4. **Agent skill system** — pluggable design capabilities (prototype generation, animation, design exploration, brand compliance) derived from Huashu Design
5. **Foundation System** — pluggable component library framework so agents generate designs using real, importable components from the user's chosen framework
6. **Primary agent compatibility** — OpenClaw and pi coding agent as first-party integrations
7. **Docker deployment** — single unified container with all services (frontend, backend, MCP, agent bridge)
8. **Codex/Claude compatibility** — secondary, in a later release

## Non-goals

- Replacing Penpot's core design engine (the canvas, shapes, components remain)
- Building a new design tool from scratch
- Supporting every AI agent in the first release
- Replacing human designers — augmenting them
- Shipping with every component library out of the box (v1 ships with curated defaults; the system is open for more)

## Approach Options

### Option A: Extend Penpot's MCP Server with Agent Workspace Protocol

Enhance the existing MCP server to support real-time bidirectional sync. Add a new "Agent Workspace" layer where agents receive canvas state via WebSocket, apply changes through Huashu-inspired design tools, and stream updates back. Humans see agent cursors/actions in the UI.

**Pros:** Leverages existing MCP infrastructure, minimal code duplication, single codebase
**Cons:** MCP server is TypeScript (Penpot backend is Clojure) — mixed-language complexity; real-time sync requires significant WebSocket additions

### Option B: New Sidecar Service (Agent Bridge) + Penpot Plugin

Build a standalone Agent Bridge service (TypeScript/Node.js) that:

- Connects to Penpot's WebSocket for canvas sync
- Exposes MCP endpoints for agents (OpenClaw, pi)
- Runs Huashu's design intelligence as internal tools
- Streams agent actions back into Penpot via the existing plugin API

**Pros:** Clean separation of concerns, can iterate independently, Penpot core remains untouched
**Cons:** Additional deployment complexity, potential latency in sync, two services to maintain

### Option C: Embed Huashu Logic into Penpot Frontend + MCP Extension

Add Huashu's SKILL.md logic directly into Penpot's frontend as a "Design Intelligence" module. Extend the MCP server with high-level design tools (generate, iterate, review). Agents connect via MCP and their changes appear on the canvas in real-time through existing Penpot collaboration infrastructure.

**Pros:** Agents use Penpot's native collaboration (already supports multi-user), no new sync layer needed, Huashu logic lives close to the canvas
**Cons:** Significant frontend changes (ClojureScript), Huashu's HTML output paradigm doesn't map directly to Penpot's SVG canvas

## Recommended Direction

**Option B: New Sidecar Service (Agent Bridge) + Penpot Plugin**, with the following rationale:

1. **Cleanest integration path**: Penpot already has a plugin system (`mcp/packages/plugin/`) and MCP server. The Agent Bridge extends this without modifying Penpot core.
2. **Real-time via existing infrastructure**: Penpot's frontend already supports real-time collaboration (WebSocket). The bridge injects agent actions as if they were another user.
3. **Skill system isolation**: Huashu's design intelligence (anti-slop checklists, brand protocols, design direction recommendation) becomes a pluggable skill registry in the bridge service.
4. **Foundation System readiness**: A sidecar architecture naturally supports a **component registry** as a separate pluggable module — frameworks and libraries can be added without touching Penpot core or the MCP protocol.
5. **Docker-friendly**: The bridge runs as an additional container in the existing Docker Compose setup.
6. **Agent-first by design**: The bridge is built from the ground up for agent interaction, not bolted onto an existing API.

### Architecture Sketch

```
┌─────────────────────────────────────────────────┐
│                  Docker Compose                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │   Slop-Less     │  │      Agent Bridge         │  │
│  │  Frontend    │◄─┤  (TypeScript/Node.js)    │  │
│  │  (Clojure    │  │                           │  │
│  │   Script)    │  │  ┌───────────────────┐   │  │
│  └──────┬───────┘  │  │  Skill Registry   │   │  │
│         │          │  │  - Prototype Gen   │   │  │
│         │ WebSocket│  │  - Animation       │   │  │
│         │          │  │  - Design Explorer │   │  │
│  ┌──────┴───────┐  │  │  - Brand Protocol  │   │  │
│  │   Slop-Less     │◄─┤  │  - Anti-Slop Check │   │  │
│  │   Backend    │  │  └─────────┬─────────┘   │  │
│  │  (Clojure)   │  │            │              │  │
│  └──────┬───────┘  │  ┌─────────┴─────────┐   │  │
│         │          │  │  MCP Server       │   │  │
│  ┌──────┴───────┐  │  │  (extends Penpot  │   │  │
│  │  PostgreSQL  │  │  │   MCP with new    │   │  │
│  │  + Redis     │  │  │   design tools)   │   │  │
│  └──────────────┘  │  └─────────┬─────────┘   │  │
│                    └────────────┼─────────────┘  │
│                                 │                │
│                    ┌────────────┴────────────┐   │
│                    │  Agent Connections       │   │
│                    │  - OpenClaw (WebSocket)  │   │
│                    │  - pi coding agent (MCP) │   │
│                    └─────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### User Experience

**Human in the canvas:**

1. Opens a Slop-Less design file
2. Makes edits, draws annotations, leaves comments on frames
3. Clicks "Ask Agent" on a selected element or area
4. Types a natural language request ("make this button more prominent", "explore 3 color variants")
5. Sees the agent working in real-time (agent cursor, progressive changes)
6. Can accept, reject, or iterate on agent changes

**Agent in the workspace:**

1. Connects to the Agent Bridge via MCP or WebSocket
2. Receives full canvas state (shapes, styles, layout)
3. Receives human intent (comments, selections, "Ask Agent" requests)
4. Applies design changes using the skill registry
5. Streams changes back to the canvas in real-time
6. Can propose alternatives, ask clarifying questions, or flag issues

## Foundation System (Phase 2 — design for it now, build after core)

### Problem

When agents generate designs, they produce generic shapes and styles. Developers want designs that use **real, importable components** from their chosen framework's ecosystem — so the output maps directly to their codebase.

### Concept

The **Foundation System** is a pluggable registry of component libraries, organized by framework. When a user selects a framework (React, Vue, Svelte, etc.), the agent knows which component libraries are available and generates designs using those components' patterns, props, and layout conventions.

### Architecture (open-loop design)

```
┌──────────────────────────────────────────────────────┐
│                   Foundation System                   │
│                                                       │
│  ┌─────────────────┐    ┌────────────────────────┐   │
│  │  Framework       │    │  Component Registry     │   │
│  │  Selector        │───►│  (pluggable, open)     │   │
│  │  React / Vue /   │    │                        │   │
│  │  Svelte / ...    │    │  - Library manifests   │   │
│  └─────────────────┘    │  - Component schemas     │   │
│                          │  - Props definitions     │   │
│                          │  - Style tokens          │   │
│                          │  - Layout conventions    │   │
│                          └───────────┬──────────────┘   │
│                                      │                  │
│                          ┌───────────▼──────────────┐   │
│                          │  Agent Component Mapper  │   │
│                          │                          │   │
│                          │  Translates design intent │   │
│                          │  → framework components   │   │
│                          │  → generated code         │   │
│                          └──────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Default Component Libraries (v1 — open source only)

| Framework    | Libraries                                               |
| ------------ | ------------------------------------------------------- |
| **React**    | shadcn/ui, Radix Primitives, MUI (Community), Chakra UI |
| **Vue**      | PrimeVue, Naive UI, VueUse Components                   |
| **Svelte**   | shadcn-svelte, Bits UI, Skeleton                        |
| **HTML/CSS** | Tailwind UI patterns, Pico CSS, Open Props              |

### Extensibility Rules (keep open-loop)

- **Registry is file-driven**: Each component library is defined by a manifest (JSON/YAML) — no hard-coded library logic
- **Manifest schema is public**: Third parties can author and share manifests
- **Framework adapters are isolated**: Each framework has its own adapter module; adding a new framework = adding one adapter, not rewriting the system
- **Component resolution is lazy**: Libraries are fetched/onboarded on demand, not bundled into the core
- **Code generation is templated**: Output code uses templates per framework, so new frameworks = new templates, not core changes

### Why this matters during core build

When building the Agent Bridge and Skill Registry:

- **Don't hardcode component types** (e.g., "button", "card") as fixed shapes — represent them as abstract semantic types that map to component library definitions later
- **Keep the design-to-code pipeline open** — the skill system should output semantic design intent, not just canvas primitives
- **Component library awareness** should be a capability that the agent can reference ("I'm using shadcn/ui buttons here") even in v1

## Success Criteria

1. Human and agent can simultaneously edit the same canvas without conflicts
2. Agent can understand and act on human comments/annotations
3. Design skills (prototype generation, animation, variant exploration) work within Slop-Less's native format (not HTML output)
4. Docker deployment: single `docker compose up` brings up the full environment
5. OpenClaw and pi coding agent can connect and make design changes
6. Agent changes are visible to humans in real-time (<200ms latency)
7. Humans can undo/redo agent actions independently
8. Foundation System: architecture supports plugging in component libraries without core rewrites (Phase 2)
9. Foundation System: at least 4 frameworks with open-source component library defaults ship in Phase 2
