/**
 * Agent Connection Types
 *
 * Defines the interfaces for agent connections, sessions, and
 * the communication protocol between the Agent Bridge and
 * connected agents (OpenClaw, pi coding agent).
 */

// --- Agent Identity ---

export type AgentType = "openclaw" | "pi-agent";

export interface AgentIdentity {
	id: string;
	type: AgentType;
	name: string;
	connectedAt: number;
}

// --- Agent Session ---

export type SessionStatus = "active" | "idle" | "busy" | "disconnected";

export interface AgentSessionState {
	identity: AgentIdentity;
	status: SessionStatus;
	subscribedFileId: string | null;
	selectedToolIds: string[];
	lastActivity: number;
	metadata: Record<string, unknown>;
}

// --- Message Protocol ---

export type AgentMessageType =
	| "auth"
	| "subscribe"
	| "unsubscribe"
	| "tool-invoke"
	| "tool-result"
	| "canvas-update"
	| "presence-update"
	| "agent-status"
	| "error"
	| "ping"
	| "pong";

export interface AgentMessage {
	type: AgentMessageType;
	id?: string; // Correlation ID for request/response
	payload?: unknown;
	timestamp?: number;
}

export interface AuthMessage extends AgentMessage {
	type: "auth";
	payload: {
		token: string;
		agentType: AgentType;
		agentName: string;
	};
}

export interface SubscribeMessage extends AgentMessage {
	type: "subscribe";
	payload: {
		fileId: string;
		teamId?: string;
	};
}

export interface ToolInvokeMessage extends AgentMessage {
	type: "tool-invoke";
	id: string;
	payload: {
		toolName: string;
		args: Record<string, unknown>;
	};
}

export interface ToolResultMessage extends AgentMessage {
	type: "tool-result";
	id: string;
	payload: {
		success: boolean;
		data?: unknown;
		error?: string;
	};
}

export interface CanvasUpdateMessage extends AgentMessage {
	type: "canvas-update";
	payload: Record<string, unknown>; // Serialized CanvasState
}

// --- Agent Adapter Interface ---

/**
 * Each agent type (OpenClaw, pi) has an adapter that handles
 * the specifics of its transport and protocol.
 */
export interface AgentAdapter {
	/** Transport type identifier */
	readonly transportType: "websocket" | "stdio";

	/** Start listening for agent connections */
	start(): Promise<void>;

	/** Stop the transport */
	stop(): Promise<void>;

	/** Send a message to a specific agent session */
	send(agentId: string, message: AgentMessage): Promise<void>;

	/** Register handler for incoming agent messages */
	onMessage(handler: (agentId: string, message: AgentMessage) => void): void;

	/** Register handler for agent connect */
	onConnect(handler: (identity: AgentIdentity) => void): void;

	/** Register handler for agent disconnect */
	onDisconnect(handler: (agentId: string) => void): void;
}
