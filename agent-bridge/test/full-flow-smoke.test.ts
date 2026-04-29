import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerAgentRequestRoutes } from "../src/http/agent-requests";
import { createAgentRequestStore } from "../src/requests/store";

async function withServer(
	handler: (baseUrl: string) => Promise<void>,
): Promise<void> {
	const app = express();
	app.use(express.json());
	registerAgentRequestRoutes(app, { store: createAgentRequestStore() });

	const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
		const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
	});

	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Unexpected server address");
	}

	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await handler(baseUrl);
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}
}

test("request flow returns an accepted visible-action payload", async () => {
	await withServer(async (baseUrl) => {
		const createResponse = await fetch(`${baseUrl}/agent-requests`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt: "Improve the hero CTA and tighten spacing" }),
		});

		const created = (await createResponse.json()) as { id: string; status: string };
		assert.equal(created.status, "pending");

		const readResponse = await fetch(`${baseUrl}/agent-requests/${created.id}`);
		const request = (await readResponse.json()) as {
			status: string;
			action: { type: string; request: { task: string; params: { prompt: string } } };
		};

		assert.equal(request.status, "accepted");
		assert.equal(request.action.type, "plugin-task");
		assert.equal(request.action.request.task, "createAgentMarker");
		assert.equal(
			request.action.request.params.prompt,
			"Improve the hero CTA and tighten spacing",
		);

		const label = (request.action.request.params as { label?: string }).label ?? "";
		assert.match(label, /^Agent: Improve CTA — /);
		assert.notEqual(label, "Agent: Improve the hero CTA and tighten spacing");
	});
});
