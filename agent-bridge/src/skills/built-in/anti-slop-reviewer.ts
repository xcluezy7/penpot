import { z } from "zod";
import type { SkillDefinition } from "../types";
import type { AntiSlopReview } from "./checklists/quality-checklist";
import { reviewDesign } from "./checklists/quality-checklist";

export const designElementSchema = z.object({
	id: z.string(),
	type: z.string(),
	label: z.string().optional(),
	content: z.string().optional(),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	fontSize: z.number().optional(),
});

export const antiSlopReviewerInputSchema = z.object({
	designContext: z.object({
		elements: z
			.array(designElementSchema)
			.min(1, "at least one element is required for review"),
	}),
});

export type AntiSlopReviewerInput = z.infer<typeof antiSlopReviewerInputSchema>;

export function createAntiSlopReviewerSkill(): SkillDefinition<
	AntiSlopReviewerInput,
	AntiSlopReview
> {
	return {
		name: "anti-slop-reviewer",
		description:
			"Reviews a design against five quality dimensions (consistency, hierarchy, execution, functionality, innovation) and returns scored suggestions that map to actionable canvas operations.",
		inputSchema: antiSlopReviewerInputSchema,
		execute(input) {
			return reviewDesign(input.designContext.elements);
		},
	};
}
