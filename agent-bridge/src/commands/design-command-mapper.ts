import type { SemanticDesignIntent } from "../skills/built-in/design-generator";

export interface CreateAgentMarkerTaskParams {
	label: string;
	prompt: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

export interface DesignTaskRequest<TParams = unknown> {
	task: string;
	params: TParams;
}

export interface AgentRequestActionResult {
	type: "plugin-task";
	request: DesignTaskRequest<CreateAgentMarkerTaskParams>;
}

function buildActionParams(intent: SemanticDesignIntent): CreateAgentMarkerTaskParams {
	return {
		label: intent.markerLabel,
		prompt: intent.prompt,
		width: intent.frame.width,
		height: intent.frame.height,
		...(intent.frame.x !== undefined ? { x: intent.frame.x } : {}),
		...(intent.frame.y !== undefined ? { y: intent.frame.y } : {}),
	};
}

function truncateLabel(prompt: string, maxLength = 48): string {
	const trimmed = prompt.trim();
	if (trimmed.length <= maxLength) {
		return trimmed;
	}

	return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function mapDesignIntentToVisibleAction(
	intent: SemanticDesignIntent,
): AgentRequestActionResult {
	return {
		type: "plugin-task",
		request: {
			task: intent.operation,
			params: buildActionParams(intent),
		},
	};
}

export function mapPromptToVisibleAction(prompt: string): AgentRequestActionResult {
	return mapDesignIntentToVisibleAction({
		kind: "semantic-design-intent",
		prompt,
		summary: truncateLabel(prompt),
		target: "general",
		operation: "createAgentMarker",
		markerLabel: `Agent: ${truncateLabel(prompt)}`,
		frame: {
			width: 260,
			height: 72,
		},
	});
}
