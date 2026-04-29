import test from "node:test";
import assert from "node:assert/strict";
import { createAgentRequestStore } from "../src/requests/store";

test("creates a predictable pending request", () => {
	const store = createAgentRequestStore({
		generateId: () => "request-1",
		now: () => new Date("2026-01-01T00:00:00.000Z"),
	});

	const request = store.create({ prompt: "Make the button clearer" });

	assert.deepEqual(request, {
		id: "request-1",
		prompt: "Make the button clearer",
		status: "pending",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		error: null,
		action: null,
	});
});

test("transitions a request from pending to accepted", () => {
	let callCount = 0;
	const store = createAgentRequestStore({
		generateId: () => "request-2",
		now: () => new Date(`2026-01-01T00:00:0${callCount++}.000Z`),
	});

	store.create({ prompt: "Review the header" });
	const updated = store.markAccepted("request-2");

	assert.equal(updated?.status, "accepted");
	assert.equal(updated?.updatedAt, "2026-01-01T00:00:01.000Z");
	assert.equal(store.get("request-2")?.status, "accepted");
});

test("marks a request as failed with error detail", () => {
	let callCount = 0;
	const store = createAgentRequestStore({
		generateId: () => "request-3",
		now: () => new Date(`2026-01-01T00:00:0${callCount++}.000Z`),
	});

	store.create({ prompt: "Generate a quick variant" });
	const updated = store.markFailed("request-3", "Bridge unavailable");

	assert.equal(updated?.status, "failed");
	assert.equal(updated?.error, "Bridge unavailable");
	assert.equal(store.get("request-3")?.error, "Bridge unavailable");
});
