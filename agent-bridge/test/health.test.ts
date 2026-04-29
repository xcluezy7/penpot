import test from "node:test";
import assert from "node:assert/strict";
import {
	decrementAgentSocketCount,
	getHealth,
	incrementAgentSocketCount,
	recordStartTime,
	resetHealthState,
	setMcpPluginConnected,
	setPenpotWsConnected,
} from "../src/health";

test.beforeEach(() => {
	resetHealthState();
	recordStartTime();
});

test("returns ok when dependencies are connected", () => {
	setPenpotWsConnected(true);
	setMcpPluginConnected(true);

	const health = getHealth();

	assert.equal(health.status, "ok");
	assert.equal(health.connections.penpotWebSocket, "connected");
	assert.equal(health.connections.mcpPlugin, "connected");
	assert.equal(health.details.penpotWebSocket, null);
	assert.equal(health.details.mcpPlugin, null);
});

test("returns degraded with dependency details when a connection is missing", () => {
	setPenpotWsConnected(false, "WebSocket connection timeout");
	setMcpPluginConnected(false, "Plugin health check not implemented yet");

	const health = getHealth();

	assert.equal(health.status, "degraded");
	assert.equal(health.connections.penpotWebSocket, "disconnected");
	assert.equal(health.connections.mcpPlugin, "disconnected");
	assert.equal(health.details.penpotWebSocket, "WebSocket connection timeout");
	assert.equal(
		health.details.mcpPlugin,
		"Plugin health check not implemented yet",
	);
});

test("tracks active agent socket counts", () => {
	incrementAgentSocketCount();
	incrementAgentSocketCount();
	decrementAgentSocketCount();

	const health = getHealth();

	assert.equal(health.connections.agentSockets, 1);
});
