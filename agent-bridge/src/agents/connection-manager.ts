import { getConfig } from "../config";
import {
	decrementAgentSocketCount,
	incrementAgentSocketCount,
	setAgentSocketCount,
} from "../health";
import { getLogger } from "../logger";
import { type AgentSession, createAgentSession } from "./agent-session";
import type {
	AgentAdapter,
	AgentIdentity,
	AgentMessage,
	AgentSessionState,
} from "./types";

/**
 * Agent Connection Manager
 *
 * Central registry for all connected agents. Manages session lifecycle,
 * enforces connection limits, and routes messages between agents and
 * the bridge (canvas state, tool invocation, etc.).
 */

export type AgentMessageHandler = (
	session: AgentSession,
	message: AgentMessage,
) => Promise<void>;

export interface AgentConnectionManager {
	/** Register an adapter for a specific agent transport */
	registerAdapter(adapter: AgentAdapter): void;

	/** Start all registered adapters */
	start(): Promise<void>;

	/** Stop all adapters and disconnect all agents */
	stop(): Promise<void>;

	/** Get all active sessions */
	getSessions(): AgentSessionState[];

	/** Get a specific session by agent ID */
	getSession(agentId: string): AgentSession | undefined;

	/** Register handler for incoming agent messages */
	onAgentMessage(handler: AgentMessageHandler): void;

	/** Register handler for agent connect/disconnect */
	onAgentConnect(handler: (identity: AgentIdentity) => void): void;
	onAgentDisconnect(handler: (agentId: string) => void): void;
}

export function createConnectionManager(): AgentConnectionManager {
	const log = getLogger();
	const config = getConfig();

	const adapters: AgentAdapter[] = [];
	const sessions = new Map<string, AgentSession>();
	const messageHandlers: AgentMessageHandler[] = [];
	const connectHandlers: ((identity: AgentIdentity) => void)[] = [];
	const disconnectHandlers: ((agentId: string) => void)[] = [];

	function registerSession(identity: AgentIdentity): AgentSession {
		const existing = sessions.get(identity.id);
		if (existing) {
			log.info({ agentId: identity.id }, "Reusing existing session");
			return existing;
		}

		if (sessions.size >= config.MAX_AGENT_SESSIONS) {
			throw new Error(
				`Maximum agent sessions (${config.MAX_AGENT_SESSIONS}) reached`,
			);
		}

		const session = createAgentSession(identity, 300000);
		sessions.set(identity.id, session);
		incrementAgentSocketCount();

		log.info(
			{ agentId: identity.id, type: identity.type, name: identity.name },
			"Agent session created",
		);

		// Notify connect handlers
		for (const handler of connectHandlers) {
			try {
				handler(identity);
			} catch (err) {
				log.error({ err }, "Connect handler error");
			}
		}

		return session;
	}

	function removeSession(agentId: string): void {
		const session = sessions.get(agentId);
		if (!session) return;

		sessions.delete(agentId);
		decrementAgentSocketCount();

		log.info({ agentId }, "Agent session removed");

		for (const handler of disconnectHandlers) {
			try {
				handler(agentId);
			} catch (err) {
				log.error({ err }, "Disconnect handler error");
			}
		}
	}

	async function handleAdapterConnect(identity: AgentIdentity): Promise<void> {
		registerSession(identity);
	}

	async function handleAdapterDisconnect(agentId: string): Promise<void> {
		removeSession(agentId);
	}

	async function handleAdapterMessage(
		agentId: string,
		message: AgentMessage,
	): Promise<void> {
		const session = sessions.get(agentId);
		if (!session) {
			log.warn({ agentId }, "Message from unknown agent");
			return;
		}

		session.markActivity();

		// Handle built-in messages
		switch (message.type) {
			case "subscribe": {
				const fileId = (message.payload as { fileId?: string })?.fileId;
				if (fileId) {
					session.subscribeToFile(fileId);
				}
				break;
			}
			case "unsubscribe":
				session.unsubscribe();
				break;
			case "ping":
				// Pong is handled per-adapter
				break;
			default:
				break;
		}

		// Route to registered message handlers
		for (const handler of messageHandlers) {
			try {
				await handler(session, message);
			} catch (err) {
				log.error(
					{ err, agentId, messageType: message.type },
					"Message handler error",
				);
			}
		}
	}

	function registerAdapter(adapter: AgentAdapter): void {
		adapters.push(adapter);

		adapter.onConnect(handleAdapterConnect);
		adapter.onDisconnect(handleAdapterDisconnect);
		adapter.onMessage(handleAdapterMessage);

		log.info({ transport: adapter.transportType }, "Registered agent adapter");
	}

	async function start(): Promise<void> {
		log.info("Starting agent connection manager");
		for (const adapter of adapters) {
			await adapter.start();
		}
		log.info(
			{ adapterCount: adapters.length },
			"Agent connection manager started",
		);
	}

	async function stop(): Promise<void> {
		log.info("Stopping agent connection manager");
		for (const adapter of adapters) {
			await adapter.stop();
		}
		// Clear all sessions
		for (const agentId of sessions.keys()) {
			removeSession(agentId);
		}
		setAgentSocketCount(0);
		log.info("Agent connection manager stopped");
	}

	function getSessions(): AgentSessionState[] {
		return Array.from(sessions.values()).map((s) => s.getState());
	}

	function getSession(agentId: string): AgentSession | undefined {
		return sessions.get(agentId);
	}

	function onAgentMessage(handler: AgentMessageHandler): void {
		messageHandlers.push(handler);
	}

	function onAgentConnect(handler: (identity: AgentIdentity) => void): void {
		connectHandlers.push(handler);
	}

	function onAgentDisconnect(handler: (agentId: string) => void): void {
		disconnectHandlers.push(handler);
	}

	return {
		registerAdapter,
		start,
		stop,
		getSessions,
		getSession,
		onAgentMessage,
		onAgentConnect,
		onAgentDisconnect,
	};
}
