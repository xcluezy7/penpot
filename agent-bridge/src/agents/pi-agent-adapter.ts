import { getLogger } from "../logger";
import type { AgentAdapter, AgentIdentity, AgentMessage } from "./types";

/**
 * pi Coding Agent Adapter — stdio transport
 *
 * The pi coding agent connects via MCP stdio transport.
 * This adapter handles the stdin/stdout message exchange.
 *
 * MCP over stdio is a line-delimited JSON protocol:
 *   Content-Length: <bytes>\r\n\r\n<json>
 *
 * For initial scaffolding, we implement a simplified stdio reader.
 * Full MCP protocol support is a TODO for Phase 2.
 */

export function createPiAgentAdapter(): AgentAdapter {
	const log = getLogger();

	let reading = false;
	const agentId = `pi-agent-${Date.now()}`;
	let isConnected = false;

	const messageHandlers: ((agentId: string, msg: AgentMessage) => void)[] = [];
	const connectHandlers: ((identity: AgentIdentity) => void)[] = [];
	const disconnectHandlers: ((agentId: string) => void)[] = [];

	function parseMessage(raw: string): AgentMessage | null {
		try {
			return JSON.parse(raw) as AgentMessage;
		} catch {
			return null;
		}
	}

	function readStdin(): void {
		if (reading) return;
		reading = true;

		let buffer = "";

		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (chunk: string) => {
			buffer += chunk;

			// Process line by line (simplified; full MCP needs content-length parsing)
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				if (!line.trim()) continue;
				const msg = parseMessage(line.trim());
				if (msg) {
					log.debug({ agentId, type: msg.type }, "pi agent message received");
					for (const handler of messageHandlers) {
						handler(agentId, msg);
					}
				}
			}
		});

		process.stdin.on("end", () => {
			reading = false;
			isConnected = false;
			log.info({ agentId }, "pi agent stdin closed");

			for (const handler of disconnectHandlers) {
				handler(agentId);
			}
		});
	}

	async function start(): Promise<void> {
		log.info("pi agent adapter starting (stdio)");
		isConnected = true;

		const identity: AgentIdentity = {
			id: agentId,
			type: "pi-agent",
			name: "pi Coding Agent",
			connectedAt: Date.now(),
		};

		for (const handler of connectHandlers) {
			handler(identity);
		}

		readStdin();
	}

	async function stop(): Promise<void> {
		log.info("pi agent adapter stopping");
		isConnected = false;
		reading = false;
	}

	async function send(_agentId: string, message: AgentMessage): Promise<void> {
		if (!isConnected) {
			log.warn("Cannot send to disconnected pi agent");
			return;
		}

		const payload = JSON.stringify(message);
		process.stdout.write(payload + "\n");
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
		transportType: "stdio",
		start,
		stop,
		send,
		onMessage,
		onConnect,
		onDisconnect,
	};
}
