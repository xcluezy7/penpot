import test from "node:test";
import assert from "node:assert/strict";
import { DesignTaskHandler } from "../DesignTaskHandler";
import { Task } from "../../TaskHandler";

type SentMessage = { type: string; response: { id: string; success: boolean; data?: any; error?: string } };

test("creates a visible marker and sends a success response", async () => {
    const messages: SentMessage[] = [];

    const rectangle = {
        id: "shape-1",
        name: "",
        x: 0,
        y: 0,
        borderRadius: 0,
        fills: [] as unknown[],
        strokes: [] as unknown[],
        resize(width: number, height: number) {
            this.width = width;
            this.height = height;
        },
        width: 0,
        height: 0,
    };

    const text = {
        id: "text-1",
        x: 0,
        y: 0,
    };

    (globalThis as any).penpot = {
        viewport: { center: { x: 400, y: 300 } },
        createRectangle: () => rectangle,
        createText: () => text,
        ui: {
            sendMessage: (message: SentMessage) => {
                messages.push(message);
            },
        },
    };

    const handler = new DesignTaskHandler();
    const task = new Task("request-1", "createAgentMarker", {
        label: "Agent: Add marker",
        prompt: "Add marker",
        width: 240,
        height: 60,
    });

    await handler.handle(task);

    assert.equal(rectangle.name, "Agent: Add marker");
    assert.equal(rectangle.x, 400);
    assert.equal(rectangle.y, 300);
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.response.success, true);
    assert.equal(messages[0]?.response.data?.shapeName, "Agent: Add marker");
});

test("rejects invalid createAgentMarker task params", async () => {
    const messages: SentMessage[] = [];

    (globalThis as any).penpot = {
        viewport: { center: { x: 0, y: 0 } },
        createRectangle: () => {
            throw new Error("should not be called");
        },
        createText: () => null,
        ui: {
            sendMessage: (message: SentMessage) => {
                messages.push(message);
            },
        },
    };

    const handler = new DesignTaskHandler();
    const task = new Task("request-2", "createAgentMarker", {
        label: "",
        prompt: "",
    });

    await handler.handle(task);

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.response.success, false);
    assert.match(String(messages[0]?.response.error), /requires 'label' and 'prompt'/);
});
