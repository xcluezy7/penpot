import type { AgentIdentity, AgentSessionState, SessionStatus } from "./types";

/**
 * Agent Session — manages per-agent session state and lifecycle.
 *
 * Each connected agent gets one session. Sessions track subscriptions,
 * activity, and current status. The session manager enforces limits and
 * handles cleanup on disconnect.
 */

export interface AgentSession {
	identity: Readonly<AgentIdentity>;
	getState(): AgentSessionState;
	updateStatus(status: SessionStatus): void;
	subscribeToFile(fileId: string): void;
	unsubscribe(): void;
	markActivity(): void;
	isActive(): boolean;
}

export function createAgentSession(
	identity: AgentIdentity,
	maxInactiveMs: number = 300000, // 5 min
): AgentSession {
	let state: AgentSessionState = {
		identity,
		status: "active",
		subscribedFileId: null,
		selectedToolIds: [],
		lastActivity: Date.now(),
		metadata: {},
	};

	function markActivity(): void {
		state = { ...state, lastActivity: Date.now() };
	}

	function isActive(): boolean {
		return Date.now() - state.lastActivity < maxInactiveMs;
	}

	function getState(): AgentSessionState {
		return { ...state };
	}

	function updateStatus(status: SessionStatus): void {
		state = { ...state, status };
		markActivity();
	}

	function subscribeToFile(fileId: string): void {
		state = {
			...state,
			subscribedFileId: fileId,
			status: "active",
		};
		markActivity();
	}

	function unsubscribe(): void {
		state = {
			...state,
			subscribedFileId: null,
			status: "idle",
		};
	}

	markActivity();

	return {
		identity,
		getState,
		updateStatus,
		subscribeToFile,
		unsubscribe,
		markActivity,
		isActive,
	};
}
