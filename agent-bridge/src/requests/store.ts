import { randomUUID } from "node:crypto";
import type { AgentRequestActionResult } from "../commands/design-command-mapper";

export type AgentRequestStatus = "pending" | "accepted" | "failed";

export interface AgentRequest {
	id: string;
	prompt: string;
	status: AgentRequestStatus;
	createdAt: string;
	updatedAt: string;
	error: string | null;
	action: AgentRequestActionResult | null;
}

export interface CreateAgentRequestInput {
	prompt: string;
}

export interface AgentRequestStore {
	create(input: CreateAgentRequestInput): AgentRequest;
	get(id: string): AgentRequest | null;
	markAccepted(id: string, action?: AgentRequestActionResult | null): AgentRequest | null;
	markFailed(id: string, error: string): AgentRequest | null;
}

export interface AgentRequestStoreDependencies {
	generateId?: () => string;
	now?: () => Date;
}

function cloneRequest(request: AgentRequest): AgentRequest {
	return { ...request };
}

export function createAgentRequestStore(
	deps: AgentRequestStoreDependencies = {},
): AgentRequestStore {
	const generateId = deps.generateId ?? randomUUID;
	const now = deps.now ?? (() => new Date());
	const requests = new Map<string, AgentRequest>();

	function timestamp(): string {
		return now().toISOString();
	}

	return {
		create(input: CreateAgentRequestInput): AgentRequest {
			const createdAt = timestamp();
			const request: AgentRequest = {
				id: generateId(),
				prompt: input.prompt,
				status: "pending",
				createdAt,
				updatedAt: createdAt,
				error: null,
				action: null,
			};

			requests.set(request.id, request);
			return cloneRequest(request);
		},

		get(id: string): AgentRequest | null {
			const request = requests.get(id);
			return request ? cloneRequest(request) : null;
		},

		markAccepted(id: string, action: AgentRequestActionResult | null = null): AgentRequest | null {
			const request = requests.get(id);
			if (!request) {
				return null;
			}

			request.status = "accepted";
			request.updatedAt = timestamp();
			request.error = null;
			request.action = action;
			return cloneRequest(request);
		},

		markFailed(id: string, error: string): AgentRequest | null {
			const request = requests.get(id);
			if (!request) {
				return null;
			}

			request.status = "failed";
			request.updatedAt = timestamp();
			request.error = error;
			request.action = null;
			return cloneRequest(request);
		},
	};
}
