import type { Express, Request, Response } from "express";
import { mapDesignIntentToVisibleAction } from "../commands/design-command-mapper";
import type { AgentRequestStore } from "../requests/store";
import { registerBuiltInSkills } from "../skills/built-in";
import type { SemanticDesignIntent } from "../skills/built-in/design-generator";
import { createSkillRegistry } from "../skills/registry";
import type { SkillRegistry } from "../skills/types";

export interface AgentRequestRoutesDependencies {
	store: AgentRequestStore;
	skillRegistry?: SkillRegistry;
}

function readPrompt(req: Request): string | null {
	const body = req.body as { prompt?: unknown } | undefined;
	if (typeof body?.prompt !== "string") {
		return null;
	}

	const prompt = body.prompt.trim();
	return prompt.length > 0 ? prompt : null;
}

export function registerAgentRequestRoutes(
	app: Express,
	deps: AgentRequestRoutesDependencies,
): void {
	const skillRegistry = deps.skillRegistry ?? createSkillRegistry();
	if (!deps.skillRegistry) {
		registerBuiltInSkills(skillRegistry);
	}

	app.post("/agent-requests", async (req: Request, res: Response) => {
		const prompt = readPrompt(req);
		if (!prompt) {
			res.status(400).json({ error: "prompt is required" });
			return;
		}

		const createdRequest = deps.store.create({ prompt });

		try {
			const designIntent = await skillRegistry.invoke<SemanticDesignIntent>(
				"design-generator",
				{ prompt },
			);
			deps.store.markAccepted(
				createdRequest.id,
				mapDesignIntentToVisibleAction(designIntent),
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Request processing failed";
			deps.store.markFailed(createdRequest.id, message);
		}

		res.status(202).json(createdRequest);
	});

	app.get("/agent-requests/:id", (req: Request, res: Response) => {
		const request = deps.store.get(req.params.id);
		if (!request) {
			res.status(404).json({ error: "request not found" });
			return;
		}

		res.status(200).json(request);
	});
}
