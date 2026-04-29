import test from "node:test";
import assert from "node:assert/strict";
import { getHealth, resetHealthState } from "../src/health";
import { startAgentBridge } from "../src/index";

function createLoggerStub() {
	return {
		info: () => undefined,
		warn: () => undefined,
		error: () => undefined,
		debug: () => undefined,
		fatal: () => undefined,
		trace: () => undefined,
		child: () => createLoggerStub(),
	} as any;
}

function createConnectionManagerStub() {
	return {
		registerAdapter: () => undefined,
		start: async () => undefined,
		stop: async () => undefined,
		onAgentMessage: () => undefined,
		onAgentConnect: () => undefined,
		onAgentDisconnect: () => undefined,
	};
}

test.beforeEach(() => {
	resetHealthState();
});

test("startup attempts Penpot WebSocket connection with configured session id", async () => {
	const connectCalls: string[] = [];

	const runtime = await startAgentBridge({
		startHttpServer: false,
		enableSignalHandlers: false,
		configOverrides: {
			PENPOT_WS_SESSION_ID: "workspace-session-123",
		},
		deps: {
			createLogger: () => createLoggerStub(),
			createConnectionManager: () => createConnectionManagerStub(),
			createOpenClawAdapter: () => ({ transportType: "websocket" }),
			createPiAgentAdapter: () => ({ transportType: "stdio" }),
			createPenpotWsClient: () => ({
				connect: async (sessionId: string) => {
					connectCalls.push(sessionId);
				},
				disconnect: () => undefined,
				subscribe: () => undefined,
				getCanvasState: () => null,
				onCanvasUpdate: () => undefined,
				isConnected: () => true,
			}),
		},
	});

	assert.deepEqual(connectCalls, ["workspace-session-123"]);
	await runtime.shutdown();
});

test("startup continues in degraded mode when Penpot WebSocket boot fails", async () => {
	const runtime = await startAgentBridge({
		startHttpServer: false,
		enableSignalHandlers: false,
		deps: {
			createLogger: () => createLoggerStub(),
			createConnectionManager: () => createConnectionManagerStub(),
			createOpenClawAdapter: () => ({ transportType: "websocket" }),
			createPiAgentAdapter: () => ({ transportType: "stdio" }),
			createPenpotWsClient: () => ({
				connect: async () => {
					throw new Error("boom");
				},
				disconnect: () => undefined,
				subscribe: () => undefined,
				getCanvasState: () => null,
				onCanvasUpdate: () => undefined,
				isConnected: () => false,
			}),
		},
	});

	const health = getHealth();

	assert.equal(health.status, "degraded");
	assert.equal(health.connections.penpotWebSocket, "disconnected");
	assert.equal(health.details.penpotWebSocket, "boom");
	assert.equal(health.connections.mcpPlugin, "disconnected");

	await runtime.shutdown();
});
