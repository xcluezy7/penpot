import WebSocket from "ws";
import type { Logger } from "../logger";
import type { EnvConfig } from "../config";
import { getConfig } from "../config";
import { setPenpotWsConnected } from "../health";
import { getLogger } from "../logger";
import {
	applyFileChange,
	type CanvasState,
	createEmptyCanvasState,
} from "./canvas-state";
import type {
	FileChangeMessage,
	PenpotCommand,
	PenpotMessage,
} from "./protocol";

/**
 * Penpot WebSocket Client
 *
 * Connects to Penpot's real-time collaboration WebSocket to receive
 * canvas state updates. Subscribes to files/teams and maintains an
 * in-memory canvas model.
 *
 * Penpot WS protocol uses Transit-encoded messages. During Phase 1,
 * we parse messages as generic JSON — full Transit support is a TODO.
 */

export type CanvasUpdateHandler = (state: CanvasState) => void;

export interface PenpotWsClient {
	connect(sessionId: string): Promise<void>;
	disconnect(): void;
	subscribe(fileId: string, teamId?: string): void;
	getCanvasState(): CanvasState | null;
	onCanvasUpdate(handler: CanvasUpdateHandler): void;
	isConnected(): boolean;
}

export interface WebSocketLike {
	readyState: number;
	on(event: string, handler: (...args: any[]) => void): void;
	close(code?: number, reason?: string): void;
	send(payload: string): void;
	removeAllListeners(): void;
}

export interface PenpotWsClientDependencies {
	config?: Pick<EnvConfig, "PENPOT_WS_URL" | "CONNECTION_TIMEOUT_MS">;
	logger?: Pick<Logger, "info" | "warn" | "error" | "debug">;
	createWebSocket?: (url: string) => WebSocketLike;
	setTimeoutFn?: typeof setTimeout;
	clearTimeoutFn?: typeof clearTimeout;
}

export function createPenpotWsClient(
	deps: PenpotWsClientDependencies = {},
): PenpotWsClient {
	const log = deps.logger ?? getLogger();
	const config = deps.config ?? getConfig();
	const createWebSocket =
		deps.createWebSocket ?? ((url: string) => new WebSocket(url));
	const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
	const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;

	let ws: WebSocketLike | null = null;
	let canvasState: CanvasState | null = null;
	const updateHandlers: CanvasUpdateHandler[] = [];
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectAttempt = 0;
	let sessionId: string | null = null;
	let subscribedFileId: string | null = null;
	let allowReconnect = true;

	const maxReconnectDelay = 30000; // 30s max backoff
	const baseReconnectDelay = 1000;

	function scheduleReconnect(): void {
		if (!allowReconnect) {
			return;
		}

		if (reconnectTimer) {
			clearTimeoutFn(reconnectTimer);
		}

		const delay = Math.min(
			baseReconnectDelay * 1.5 ** reconnectAttempt,
			maxReconnectDelay,
		);
		log.info({ delay, attempt: reconnectAttempt }, "Scheduling reconnection");
		reconnectTimer = setTimeoutFn(() => {
			if (sessionId) connect(sessionId);
		}, delay);
	}

	async function connect(sid: string): Promise<void> {
		allowReconnect = true;
		sessionId = sid;
		const url = `${config.PENPOT_WS_URL}/ws/notifications?session-id=${encodeURIComponent(sid)}`;

		log.info(
			{ url: url.replace(sid, "***") },
			"Connecting to Penpot WebSocket",
		);

		return new Promise((resolve, reject) => {
			try {
				ws = createWebSocket(url);
			} catch (err) {
				log.error({ err }, "Failed to create WebSocket");
				setPenpotWsConnected(false, "Failed to create WebSocket client");
				reject(err);
				return;
			}

			const connectionTimeout = setTimeoutFn(() => {
				if (ws && ws.readyState !== WebSocket.OPEN) {
					ws.close();
					setPenpotWsConnected(false, "WebSocket connection timeout");
					reject(new Error("WebSocket connection timeout"));
				}
			}, config.CONNECTION_TIMEOUT_MS);

			ws.on("open", () => {
				clearTimeoutFn(connectionTimeout);
				reconnectAttempt = 0;
				setPenpotWsConnected(true);
				log.info("Connected to Penpot WebSocket");

				// Re-subscribe if we had a prior subscription
				if (subscribedFileId) {
					sendCommand({ type: "subscribe-file", "file-id": subscribedFileId });
				}

				resolve();
			});

			ws.on("message", (raw: unknown) => {
				try {
					const data = String(raw);
					const msg = parseMessage(data);
					handleMessage(msg);
				} catch (err) {
					log.warn({ err }, "Failed to parse WebSocket message");
				}
			});

			ws.on("close", (code, reason) => {
				log.info(
					{ code, reason: String(reason) },
					"Penpot WebSocket closed",
				);
				clearTimeoutFn(connectionTimeout);
				setPenpotWsConnected(false, `WebSocket closed (${String(reason) || code})`);
				cleanup();
				reconnectAttempt++;
				scheduleReconnect();
			});

			ws.on("error", (err) => {
				log.error({ err: err.message }, "Penpot WebSocket error");
				setPenpotWsConnected(false, err.message);
			});
		});
	}

	/**
	 * Parse a raw message from Penpot's WebSocket.
	 *
	 * Penpot uses Transit (JSON-verbose). Until we implement full Transit
	 * decoding, we attempt a best-effort JSON parse. Clojure keywords
	 * (like ":type") may be encoded differently.
	 *
	 * TODO: Implement Transit decoder using @transit-js/transit-js
	 */
	function parseMessage(raw: string): PenpotMessage {
		// Transit JSON-verbose looks like: ["~#cm",["^ ","~:type","~:file-change",...]]
		// For now, attempt basic JSON parse
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			// If JSON parse fails, return raw as a generic message
			return { type: "file-change", raw };
		}

		if (
			typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			return parsed as PenpotMessage;
		}

		// Transit-encoded arrays will look different; handle minimally
		if (Array.isArray(parsed)) {
			return { type: "file-change", raw: parsed };
		}

		return { type: "file-change", raw };
	}

	function handleMessage(msg: PenpotMessage): void {
		switch (msg.type) {
			case "file-change": {
				const fc = msg as FileChangeMessage;
				if (!canvasState) {
					canvasState = createEmptyCanvasState(fc["file-id"]);
				}
				canvasState = applyFileChange(canvasState, fc);
				notifyHandlers(canvasState);
				break;
			}
			case "ping":
				// Respond with pong to keep connection alive
				sendCommand({
					type: "subscribe-file",
					"file-id": "ping",
				} as PenpotCommand); // TODO: proper pong
				break;
			default:
				log.debug({ type: msg.type }, "Unknown message type");
		}
	}

	function sendCommand(cmd: PenpotCommand): void {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			log.warn("Cannot send command: WebSocket not connected");
			return;
		}
		// TODO: Encode command as Transit
		const payload = JSON.stringify(cmd);
		ws.send(payload);
	}

	function notifyHandlers(state: CanvasState): void {
		for (const handler of updateHandlers) {
			try {
				handler(state);
			} catch (err) {
				log.error({ err }, "Canvas update handler error");
			}
		}
	}

	function cleanup(): void {
		if (ws) {
			ws.removeAllListeners();
			ws = null;
		}
	}

	function disconnect(): void {
		if (reconnectTimer) {
			clearTimeoutFn(reconnectTimer);
			reconnectTimer = null;
		}
		allowReconnect = false;
		if (ws) {
			ws.close(1000, "Client disconnect");
		}
		cleanup();
		setPenpotWsConnected(false, "Client disconnected");
		log.info("Disconnected from Penpot WebSocket");
	}

	function subscribe(fileId: string, _teamId?: string): void {
		subscribedFileId = fileId;
		if (!canvasState || canvasState.fileId !== fileId) {
			canvasState = createEmptyCanvasState(fileId);
		}
		sendCommand({ type: "subscribe-file", "file-id": fileId });
		log.info({ fileId }, "Subscribed to file");
	}

	function getCanvasState(): CanvasState | null {
		return canvasState;
	}

	function onCanvasUpdate(handler: CanvasUpdateHandler): void {
		updateHandlers.push(handler);
	}

	function isConnected(): boolean {
		return ws !== null && ws.readyState === WebSocket.OPEN;
	}

	return {
		connect,
		disconnect,
		subscribe,
		getCanvasState,
		onCanvasUpdate,
		isConnected,
	};
}
