import test from "node:test";
import assert from "node:assert/strict";
import { createDesignGeneratorSkill } from "../src/skills/built-in/design-generator";
import { createSkillRegistry } from "../src/skills/registry";

test("registers, describes, lists, and invokes a built-in skill", async () => {
	const registry = createSkillRegistry();
	registry.register(createDesignGeneratorSkill());

	assert.deepEqual(registry.list(), [
		{
			name: "design-generator",
			description:
				"Turns a natural-language design request into semantic design intent that the bridge can map into a visible canvas action.",
		},
	]);

	assert.deepEqual(registry.describe("design-generator"), registry.list()[0]);

	const intent = await registry.invoke<{ target: string; operation: string }>(
		"design-generator",
		{ prompt: "Polish the hero CTA" },
	);

	assert.equal(intent.target, "cta");
	assert.equal(intent.operation, "createAgentMarker");
});

test("rejects duplicate registration and unknown skill invocation", async () => {
	const registry = createSkillRegistry();
	registry.register(createDesignGeneratorSkill());

	assert.throws(() => registry.register(createDesignGeneratorSkill()), /already registered/);

	await assert.rejects(
		() => registry.invoke("missing-skill", { prompt: "Anything" }),
		/Unknown skill/,
	);
});
