import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	antiSlopReviewerInputSchema,
	createAntiSlopReviewerSkill,
} from "../src/skills/built-in/anti-slop-reviewer";

describe("anti-slop-reviewer skill", () => {
	it("rejects empty design input", () => {
		const skill = createAntiSlopReviewerSkill();

		assert.throws(() => {
			skill.inputSchema.parse({ designContext: { elements: [] } });
		}, /at least one element/i);
	});

	it("rejects input with no designContext at all", () => {
		assert.throws(() => {
			antiSlopReviewerInputSchema.parse({});
		});
	});

	it("returns a structured review for a minimal design", () => {
		const skill = createAntiSlopReviewerSkill();
		const input = {
			designContext: {
				elements: [
					{
						id: "btn-1",
						type: "button",
						label: "Submit",
						x: 50,
						y: 100,
						width: 120,
						height: 40,
					},
				],
			},
		};

		const result = skill.execute(input);

		assert.equal(result.kind, "anti-slop-review");
		assert.ok(Array.isArray(result.dimensions));
		assert.equal(result.dimensions.length, 5);

		const dimensionNames = result.dimensions.map((d) => d.name);
		assert.deepEqual(dimensionNames, [
			"consistency",
			"hierarchy",
			"execution",
			"functionality",
			"innovation",
		]);

		for (const dim of result.dimensions) {
			assert.ok(typeof dim.score === "number", `${dim.name} score is number`);
			assert.ok(dim.score >= 0 && dim.score <= 10, `${dim.name} score in 0–10`);
			assert.ok(typeof dim.note === "string", `${dim.name} has note`);
			assert.ok(
				Array.isArray(dim.suggestions),
				`${dim.name} has suggestions array`,
			);
		}
	});

	it("flags missing CTA when only a single generic element exists", () => {
		const skill = createAntiSlopReviewerSkill();
		const input = {
			designContext: {
				elements: [
					{
						id: "rect-1",
						type: "rectangle",
						x: 0,
						y: 0,
						width: 400,
						height: 300,
					},
				],
			},
		};

		const result = skill.execute(input);
		const functionalityDim = result.dimensions.find(
			(d) => d.name === "functionality",
		);
		assert.ok(functionalityDim);
		assert.ok(
			functionalityDim.suggestions.length > 0,
			"has at least one functionality suggestion for cta-less design",
		);
	});

	it("returns higher consistency score when elements share spacing patterns", () => {
		const skill = createAntiSlopReviewerSkill();
		const input = {
			designContext: {
				elements: [
					{ id: "btn-1", type: "button", x: 16, y: 16, width: 100, height: 36 },
					{ id: "btn-2", type: "button", x: 16, y: 68, width: 100, height: 36 },
					{
						id: "btn-3",
						type: "button",
						x: 16,
						y: 120,
						width: 100,
						height: 36,
					},
				],
			},
		};

		const result = skill.execute(input);
		const consistencyDim = result.dimensions.find(
			(d) => d.name === "consistency",
		);
		assert.ok(consistencyDim);
		assert.ok(
			consistencyDim.score >= 7,
			`consistency ${consistencyDim.score} >= 7 for aligned buttons`,
		);
	});

	it("returns suggestions that reference actionable canvas operations", () => {
		const skill = createAntiSlopReviewerSkill();
		const input = {
			designContext: {
				elements: [
					{
						id: "h1",
						type: "text",
						content: "Hero",
						x: 0,
						y: 0,
						width: 600,
						height: 80,
						fontSize: 72,
					},
					{
						id: "body",
						type: "text",
						content: "Lorem ipsum",
						x: 0,
						y: 100,
						width: 300,
						height: 200,
						fontSize: 14,
					},
				],
			},
		};

		const result = skill.execute(input);

		for (const dim of result.dimensions) {
			for (const suggestion of dim.suggestions) {
				assert.ok(
					typeof suggestion.action === "string",
					`suggestion in ${dim.name} has action string`,
				);
				assert.ok(
					suggestion.action.length > 0,
					`suggestion action is non-empty`,
				);
				assert.ok(
					typeof suggestion.description === "string",
					`suggestion in ${dim.name} has description`,
				);
			}
		}
	});

	it("produces deterministic output for identical input", () => {
		const skill = createAntiSlopReviewerSkill();
		const input = {
			designContext: {
				elements: [
					{
						id: "a",
						type: "text",
						content: "Test",
						x: 10,
						y: 10,
						width: 200,
						height: 50,
					},
				],
			},
		};

		const a = skill.execute(input);
		const b = skill.execute(input);

		assert.deepEqual(a, b);
	});
});
