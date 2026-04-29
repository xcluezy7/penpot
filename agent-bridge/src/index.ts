import express from "express";
import type { Express } from "express";
import type { Server } from "node:http";
import { pathToFileURL } from "node:url";
import { createConnectionManager } from "./agents/connection-manager";
import { createOpenClawAdapter } from "./agents/openclaw-adapter";
import { createPiAgentAdapter } from "./agents/pi-agent-adapter";
import type { AgentAdapter } from "./agents/types";
import { loadConfig } from "./config";
import type { EnvConfig } from "./config";
import {
	getHealth,
	recordStartTime,
	setMcpPluginConnected,
	setPenpotWsConnected,
} from "./health";
import { createLogger } from "./logger";
import type { Logger } from "./logger";
import { createPenpotWsClient } from "./penpot/ws-client";
import type { PenpotWsClient } from "./penpot/ws-client";
import { createAgentRequestStore } from "./requests/store";
import { registerAgentRequestRoutes } from "./http/agent-requests";
import { registerBuiltInSkills } from "./skills/built-in";
import { createSkillRegistry } from "./skills/registry";

interface AgentConnectionManagerLike {
	registerAdapter(adapter: AgentAdapter): void;
	start(): Promise<void>;
	stop(): Promise<void>;
	onAgentMessage(
		handler: (session: { identity: { id: string } }, message: { type: string }) => Promise<void>,
	): void;
	onAgentConnect(handler: (identity: unknown) => void): void;
	onAgentDisconnect(handler: (agentId: string) => void): void;
}

export interface AgentBridgeDependencies {
	loadConfig?: (overrides?: Record<string, string>) => EnvConfig;
	createLogger?: (level?: string) => Logger;
	createPenpotWsClient?: () => PenpotWsClient;
	createConnectionManager?: () => AgentConnectionManagerLike;
	createOpenClawAdapter?: () => AgentAdapter;
	createPiAgentAdapter?: () => AgentAdapter;
	recordStartTime?: () => void;
	setMcpPluginConnected?: (connected: boolean, detail?: string | null) => void;
	setPenpotWsConnected?: (connected: boolean, detail?: string | null) => void;
	expressFactory?: () => Express;
}

export interface StartAgentBridgeOptions {
	configOverrides?: Record<string, string>;
	deps?: AgentBridgeDependencies;
	startHttpServer?: boolean;
	enableSignalHandlers?: boolean;
}

export interface AgentBridgeRuntime {
	app: Express;
	config: EnvConfig;
	shutdown: (signal?: string) => Promise<void>;
	server: Server | null;
}

function createHealthApp(app: Express): void {
	app.use((_req, res, next) => {
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");

		if (_req.method === "OPTIONS") {
			res.status(204).end();
			return;
		}

		next();
	});

	app.get("/health", (_req, res) => {
		const health = getHealth();
		const code = health.status === "unhealthy" ? 503 : 200;
		res.status(code).json(health);
	});
}

async function startHttpServer(
	app: Express,
	config: EnvConfig,
	log: Pick<Logger, "info">,
): Promise<Server> {
	return await new Promise((resolve) => {
		const server = app.listen(config.PORT, config.HOST, () => {
			log.info({ port: config.PORT, host: config.HOST }, "HTTP server listening");
			resolve(server);
		});
	});
}

function registerSignalHandlers(runtime: AgentBridgeRuntime): void {
	const shutdownWithSignal = async (signal: string): Promise<void> => {
		await runtime.shutdown(signal);
		process.exit(0);
	};

	process.on("SIGTERM", () => {
		void shutdownWithSignal("SIGTERM");
	});

	process.on("SIGINT", () => {
		void shutdownWithSignal("SIGINT");
	});
}

export async function startAgentBridge(
	options: StartAgentBridgeOptions = {},
): Promise<AgentBridgeRuntime> {
	const deps = options.deps ?? {};
	const loadConfigFn = deps.loadConfig ?? loadConfig;
	const recordStartTimeFn = deps.recordStartTime ?? recordStartTime;
	const createLoggerFn = deps.createLogger ?? createLogger;
	const createPenpotWsClientFn = deps.createPenpotWsClient ?? createPenpotWsClient;
	const createConnectionManagerFn =
		deps.createConnectionManager ?? createConnectionManager;
	const createOpenClawAdapterFn =
		deps.createOpenClawAdapter ?? createOpenClawAdapter;
	const createPiAgentAdapterFn = deps.createPiAgentAdapter ?? createPiAgentAdapter;
	const setMcpPluginConnectedFn =
		deps.setMcpPluginConnected ?? setMcpPluginConnected;
	const setPenpotWsConnectedFn =
		deps.setPenpotWsConnected ?? setPenpotWsConnected;
	const expressFactory = deps.expressFactory ?? express;

	recordStartTimeFn();

	const config = loadConfigFn(options.configOverrides);
	const log = createLoggerFn(config.LOG_LEVEL);

	log.info(
		{
			config: {
				...config,
				AGENT_AUTH_TOKEN: config.AGENT_AUTH_TOKEN ? "***" : undefined,
			},
		},
		"Agent Bridge starting",
	);

	const penpotWs = createPenpotWsClientFn();

	penpotWs.onCanvasUpdate((state) => {
		log.debug(
			{ fileId: state.fileId, pages: state.pages.length },
			"Canvas state updated",
		);
	});

	const connectionManager = createConnectionManagerFn();

	connectionManager.registerAdapter(createOpenClawAdapterFn());
	connectionManager.registerAdapter(createPiAgentAdapterFn());

	connectionManager.onAgentMessage(async (session, message) => {
		log.debug(
			{ agentId: session.identity.id, type: message.type },
			"Agent message received",
		);
	});

	connectionManager.onAgentConnect((identity) => {
		log.info({ agent: identity }, "Agent connected");
	});

	connectionManager.onAgentDisconnect((agentId) => {
		log.info({ agentId }, "Agent disconnected");
	});

	await connectionManager.start();
	log.info("Agent connection manager started");

	setMcpPluginConnectedFn(false, "Plugin health check not implemented yet");

	try {
		await penpotWs.connect(config.PENPOT_WS_SESSION_ID);
	} catch (error) {
		const detail = error instanceof Error ? error.message : "Unknown startup error";
		setPenpotWsConnectedFn(false, detail);
		log.warn({ err: detail }, "Penpot WebSocket startup failed; continuing in degraded mode");
	}

	const app = expressFactory();
	app.use(express.json());
	createHealthApp(app);
	const requestStore = createAgentRequestStore();
	const skillRegistry = createSkillRegistry();
	registerBuiltInSkills(skillRegistry);
	registerAgentRequestRoutes(app, { store: requestStore, skillRegistry });

	const shouldStartHttpServer = options.startHttpServer !== false;
	const server = shouldStartHttpServer
		? await startHttpServer(app, config, log)
		: null;

	const shutdown = async (signal?: string): Promise<void> => {
		if (signal) {
			log.info({ signal }, "Shutting down gracefully");
		}

		penpotWs.disconnect();
		await connectionManager.stop();

		if (server) {
			await new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) {
						reject(error);
						return;
					}

					resolve();
				});
			});
		}

		log.info("Agent Bridge stopped");
	};

	const runtime: AgentBridgeRuntime = {
		app,
		config,
		shutdown,
		server,
	};

	if (options.enableSignalHandlers !== false) {
		registerSignalHandlers(runtime);
	}

	log.info("Agent Bridge ready");

	return runtime;
}

async function main(): Promise<void> {
	await startAgentBridge();
}

const isExecutedAsScript =
	process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isExecutedAsScript) {
	main().catch((error) => {
		console.error("Fatal startup error:", error);
		process.exit(1);
	});
}
