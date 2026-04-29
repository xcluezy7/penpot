export interface HealthStatus {
	status: "ok" | "degraded" | "unhealthy";
	uptime: number;
	connections: {
		penpotWebSocket: "connected" | "disconnected";
		mcpPlugin: "connected" | "disconnected";
		agentSockets: number;
	};
	details: {
		penpotWebSocket: string | null;
		mcpPlugin: string | null;
	};
	version: string;
	startedAt: string;
}

let startTime: number | null = null;
let penpotWsConnected = false;
let mcpPluginConnected = false;
let agentSocketCount = 0;
let penpotWsDetail: string | null = null;
let mcpPluginDetail: string | null = null;

export function recordStartTime(): void {
	startTime = Date.now();
}

export function resetHealthState(): void {
	startTime = null;
	penpotWsConnected = false;
	mcpPluginConnected = false;
	agentSocketCount = 0;
	penpotWsDetail = null;
	mcpPluginDetail = null;
}

export function setPenpotWsConnected(
	connected: boolean,
	detail: string | null = null,
): void {
	penpotWsConnected = connected;
	penpotWsDetail = connected ? null : detail;
}

export function setMcpPluginConnected(
	connected: boolean,
	detail: string | null = null,
): void {
	mcpPluginConnected = connected;
	mcpPluginDetail = connected ? null : detail;
}

export function setAgentSocketCount(count: number): void {
	agentSocketCount = count;
}

export function incrementAgentSocketCount(): void {
	agentSocketCount++;
}

export function decrementAgentSocketCount(): void {
	agentSocketCount = Math.max(0, agentSocketCount - 1);
}

export function getHealth(): HealthStatus {
	const uptime = startTime ? (Date.now() - startTime) / 1000 : 0;

	const status: HealthStatus["status"] =
		penpotWsConnected && mcpPluginConnected ? "ok" : "degraded";

	return {
		status,
		uptime: Math.round(uptime * 100) / 100,
		connections: {
			penpotWebSocket: penpotWsConnected ? "connected" : "disconnected",
			mcpPlugin: mcpPluginConnected ? "connected" : "disconnected",
			agentSockets: agentSocketCount,
		},
		details: {
			penpotWebSocket: penpotWsDetail,
			mcpPlugin: mcpPluginDetail,
		},
		version: "1.0.0",
		startedAt: startTime ? new Date(startTime).toISOString() : "unknown",
	};
}
