import WebSocket, { WebSocketServer } from "ws";
import { getConfig } from "../config";
import { getLogger } from "../logger";
import type { AgentAdapter, AgentIdentity, AgentMessage } from "./types";

/**
 * OpenClaw Agent Adapter — WebSocket transport
 *
 * Listens on AGENT_WS_PORT for OpenClaw agent connections.
 * Each agent connects via WebSocket, authenticates, and then
 * receives canvas state / sends tool invocations.
 */

export function createOpenClawAdapter(): AgentAdapter {
	const log = getLogger();
	const config = getConfig();

	let wss: WebSocketServer | null = null;
	let agentCounter = 0;

	// Connected agents indexed by their WebSocket
	const agentWsMap = new Map<string, WebSocket>();

	// Callbacks
	const messageHandlers: ((agentId: string, msg: AgentMessage) => void)[] = [];
	const connectHandlers: ((identity: AgentIdentity) => void)[] = [];
	const disconnectHandlers: ((agentId: string) => void)[] = [];

	function assignAgentId(): string {
		agentCounter++;
		return `openclaw-${agentCounter}-${Date.now()}`;
	}

	async function start(): Promise<void> {
		return new Promise((resolve) => {
			wss = new WebSocketServer({ port: config.AGENT_WS_PORT }, () => {
				log.info(
					{ port: config.AGENT_WS_PORT },
					"OpenClaw WebSocket server started",
				);
				resolve();
			});

			wss.on("connection", (ws) => {
				const agentId = assignAgentId();

				log.info({ agentId }, "OpenClaw agent WebSocket connected");
				agentWsMap.set(agentId, ws);

				ws.on("message", (raw) => {
					try {
						const msg = JSON.parse(raw.toString()) as AgentMessage;
						for (const handler of messageHandlers) {
							handler(agentId, msg);
						}
					} catch (err) {
						log.warn({ agentId, err }, "Failed to parse agent message");
					}
				});

				ws.on("close", () => {
					log.info({ agentId }, "OpenClaw agent disconnected");
					agentWsMap.delete(agentId);
					for (const handler of disconnectHandlers) {
						handler(agentId);
					}
				});

				ws.on("error", (err) => {
					log.error({ agentId, err: err.message }, "OpenClaw agent WS error");
				});

				// Auto-authenticate as OpenClaw agent for now
				// TODO: Implement proper auth token validation
				const identity: AgentIdentity = {
					id: agentId,
					type: "openclaw",
					name: `OpenClaw Agent ${agentCounter}`,
					connectedAt: Date.now(),
				};

				for (const handler of connectHandlers) {
					handler(identity);
				}
			});

			wss.on("error", (err) => {
				log.error({ err: err.message }, "OpenClaw WebSocket server error");
			});
		});
	}

	async function stop(): Promise<void> {
		return new Promise((resolve) => {
			if (!wss) {
				resolve();
				return;
			}

			// Close all agent connections
			for (const [agentId, ws] of agentWsMap) {
				ws.close(1001, "Server shutting down");
				agentWsMap.delete(agentId);
			}

			wss.close(() => {
				log.info("OpenClaw WebSocket server stopped");
				resolve();
			});
		});
	}

	async function send(agentId: string, message: AgentMessage): Promise<void> {
		const ws = agentWsMap.get(agentId);
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			log.warn({ agentId }, "Cannot send to disconnected agent");
			return;
		}
		ws.send(JSON.stringify(message));
	}

	function onMessage(
		handler: (agentId: string, msg: AgentMessage) => void,
	): void {
		messageHandlers.push(handler);
	}

	function onConnect(handler: (identity: AgentIdentity) => void): void {
		connectHandlers.push(handler);
	}

	function onDisconnect(handler: (agentId: string) => void): void {
		disconnectHandlers.push(handler);
	}

	return {
		transportType: "websocket",
		start,
		stop,
		send,
		onMessage,
		onConnect,
		onDisconnect,
	};
}
