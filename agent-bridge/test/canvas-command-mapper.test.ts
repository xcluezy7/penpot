import test from "node:test";
import assert from "node:assert/strict";
import { mapPromptToVisibleAction } from "../src/commands/design-command-mapper";

test("maps a prompt to a deterministic createAgentMarker task", () => {
	const action = mapPromptToVisibleAction("Highlight the main CTA");

	assert.equal(action.type, "plugin-task");
	assert.equal(action.request.task, "createAgentMarker");
	assert.deepEqual(action.request.params, {
		label: "Agent: Highlight the main CTA",
		prompt: "Highlight the main CTA",
		width: 260,
		height: 72,
	});
});

test("truncates long prompts for the visible label", () => {
	const action = mapPromptToVisibleAction(
		"This is a very long prompt that should be truncated so the visible marker stays compact in the workspace",
	);

	assert.equal(action.request.task, "createAgentMarker");
	assert.match(action.request.params.label, /^Agent: /);
	assert.ok(action.request.params.label.length <= 55);
});
