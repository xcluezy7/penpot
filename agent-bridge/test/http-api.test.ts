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

test("POST creates a request and GET returns its accepted status", async () => {
	await withServer(async (baseUrl) => {
		const createResponse = await fetch(`${baseUrl}/agent-requests`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ prompt: "Improve the hero CTA and tighten spacing" }),
		});

		assert.equal(createResponse.status, 202);
		const createdRequest = (await createResponse.json()) as {
			id: string;
			status: string;
		};

		assert.equal(createdRequest.status, "pending");
		assert.ok(createdRequest.id);

		const readResponse = await fetch(
			`${baseUrl}/agent-requests/${createdRequest.id}`,
		);
		assert.equal(readResponse.status, 200);

		const request = (await readResponse.json()) as { status: string; prompt: string };
		assert.equal(request.status, "accepted");
		assert.equal(request.prompt, "Improve the hero CTA and tighten spacing");

		const label =
			(request as { action?: { request?: { params?: { label?: string } } } }).action?.request
				?.params?.label ?? "";
		assert.match(label, /^Agent: Improve CTA — /);
		assert.notEqual(label, "Agent: Improve the hero CTA and tighten spacing");
	});
});

test("POST rejects empty prompts and GET returns 404 for unknown requests", async () => {
	await withServer(async (baseUrl) => {
		const invalidResponse = await fetch(`${baseUrl}/agent-requests`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ prompt: "   " }),
		});

		assert.equal(invalidResponse.status, 400);

		const notFoundResponse = await fetch(`${baseUrl}/agent-requests/missing-id`);
		assert.equal(notFoundResponse.status, 404);
	});
});
