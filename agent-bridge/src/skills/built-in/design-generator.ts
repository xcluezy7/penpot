import { z } from "zod";
import type { SkillDefinition } from "../types";

export const designGeneratorInputSchema = z.object({
	prompt: z.string().trim().min(1, "prompt is required"),
});

export type DesignGeneratorInput = z.infer<typeof designGeneratorInputSchema>;

export type DesignIntentTarget =
	| "cta"
	| "hero"
	| "layout"
	| "content"
	| "general";

export interface SemanticDesignIntent {
	kind: "semantic-design-intent";
	prompt: string;
	summary: string;
	target: DesignIntentTarget;
	operation: "createAgentMarker";
	markerLabel: string;
	frame: {
		width: number;
		height: number;
		x?: number;
		y?: number;
	};
}

function normalizePrompt(prompt: string): string {
	return prompt.trim().replace(/\s+/g, " ");
}

function inferTarget(prompt: string): DesignIntentTarget {
	const normalized = prompt.toLowerCase();

	if (normalized.includes("cta") || normalized.includes("button")) {
		return "cta";
	}

	if (normalized.includes("hero") || normalized.includes("headline")) {
		return "hero";
	}

	if (normalized.includes("layout") || normalized.includes("grid")) {
		return "layout";
	}

	if (normalized.includes("copy") || normalized.includes("content") || normalized.includes("text")) {
		return "content";
	}

	return "general";
}

function summarizePrompt(prompt: string, maxLength = 40): string {
	if (prompt.length <= maxLength) {
		return prompt;
	}

	return `${prompt.slice(0, maxLength - 1)}…`;
}

function buildMarkerLabel(target: DesignIntentTarget, prompt: string): string {
	switch (target) {
		case "cta":
			return `Agent: Improve CTA — ${summarizePrompt(prompt, 28)}`;
		case "hero":
			return `Agent: Refine hero — ${summarizePrompt(prompt, 27)}`;
		case "layout":
			return `Agent: Adjust layout — ${summarizePrompt(prompt, 24)}`;
		case "content":
			return `Agent: Update content — ${summarizePrompt(prompt, 23)}`;
		default:
			return `Agent: ${summarizePrompt(prompt)}`;
	}
}

export function createSemanticDesignIntent(prompt: string): SemanticDesignIntent {
	const normalizedPrompt = normalizePrompt(prompt);
	const target = inferTarget(normalizedPrompt);

	return {
		kind: "semantic-design-intent",
		prompt: normalizedPrompt,
		summary: summarizePrompt(normalizedPrompt),
		target,
		operation: "createAgentMarker",
		markerLabel: buildMarkerLabel(target, normalizedPrompt),
		frame: {
			width: 260,
			height: 72,
		},
	};
}

export function createDesignGeneratorSkill(): SkillDefinition<
	DesignGeneratorInput,
	SemanticDesignIntent
> {
	return {
		name: "design-generator",
		description:
			"Turns a natural-language design request into semantic design intent that the bridge can map into a visible canvas action.",
		inputSchema: designGeneratorInputSchema,
		execute(input) {
			return createSemanticDesignIntent(input.prompt);
		},
	};
}
