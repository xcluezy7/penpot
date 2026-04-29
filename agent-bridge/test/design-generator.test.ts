import test from "node:test";
import assert from "node:assert/strict";
import {
	createDesignGeneratorSkill,
	createSemanticDesignIntent,
} from "../src/skills/built-in/design-generator";

test("returns semantic design intent for a natural-language request", async () => {
	const skill = createDesignGeneratorSkill();
	const intent = await skill.execute({ prompt: "  Improve the hero CTA and tighten spacing  " });

	assert.equal(intent.kind, "semantic-design-intent");
	assert.equal(intent.target, "cta");
	assert.equal(intent.operation, "createAgentMarker");
	assert.equal(intent.prompt, "Improve the hero CTA and tighten spacing");
	assert.match(intent.markerLabel, /^Agent: Improve CTA/);
	assert.ok(!intent.summary.includes("<div"));
	assert.deepEqual(intent.frame, {
		width: 260,
		height: 72,
	});
});

test("keeps the fallback prompt-to-intent path semantic and compact", () => {
	const intent = createSemanticDesignIntent(
		"Create a cleaner layout for the onboarding checklist with clearer grouping",
	);

	assert.equal(intent.kind, "semantic-design-intent");
	assert.equal(intent.target, "layout");
	assert.equal(intent.operation, "createAgentMarker");
	assert.ok(intent.summary.length <= 40);
	assert.match(intent.markerLabel, /^Agent: Adjust layout/);
});
