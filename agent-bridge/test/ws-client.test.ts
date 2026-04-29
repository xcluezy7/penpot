import test from "node:test";
import assert from "node:assert/strict";
import { createPenpotWsClient } from "../src/penpot/ws-client";

type EventHandler = (...args: any[]) => void;

class FakeWebSocket {
	static readonly OPEN = 1;

	readonly url: string;
	readyState = 0;
	readonly sentMessages: string[] = [];
	private readonly handlers = new Map<string, EventHandler[]>();

	constructor(url: string) {
		this.url = url;
	}

	on(event: string, handler: EventHandler): void {
		const existing = this.handlers.get(event) ?? [];
		existing.push(handler);
		this.handlers.set(event, existing);
	}

	removeAllListeners(): void {
		this.handlers.clear();
	}

	close(code = 1000, reason = "closed"): void {
		this.readyState = 3;
		this.emit("close", code, Buffer.from(reason));
	}

	send(payload: string): void {
		this.sentMessages.push(payload);
	}

	open(): void {
		this.readyState = FakeWebSocket.OPEN;
		this.emit("open");
	}

	message(payload: string): void {
		this.emit("message", payload);
	}

	emit(event: string, ...args: any[]): void {
		for (const handler of this.handlers.get(event) ?? []) {
			handler(...args);
		}
	}
}

function createLoggerStub() {
	return {
		info: () => undefined,
		warn: () => undefined,
		error: () => undefined,
		debug: () => undefined,
	};
}

test("reconnects after disconnect and re-subscribes to the last file", async () => {
	const sockets: FakeWebSocket[] = [];
	const scheduled: Array<{ fn: () => void; delay: number }> = [];

	const client = createPenpotWsClient({
		config: {
			PENPOT_WS_URL: "ws://penpot.test",
			CONNECTION_TIMEOUT_MS: 100,
		},
		logger: createLoggerStub(),
		createWebSocket: (url) => {
			const socket = new FakeWebSocket(url);
			sockets.push(socket);
			return socket;
		},
		setTimeoutFn: ((fn: () => void, delay?: number) => {
			scheduled.push({ fn, delay: delay ?? 0 });
			return scheduled.length as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout,
		clearTimeoutFn: (() => undefined) as typeof clearTimeout,
	});

	const connectPromise = client.connect("session-1");
	sockets[0]?.open();
	await connectPromise;

	client.subscribe("file-1");
	assert.deepEqual(sockets[0]?.sentMessages, [JSON.stringify({ type: "subscribe-file", "file-id": "file-1" })]);

	sockets[0]?.emit("close", 1006, Buffer.from("lost"));
	assert.equal(scheduled.length, 2);

	scheduled.at(-1)?.fn();
	assert.equal(sockets.length, 2);
	sockets[1]?.open();

	assert.deepEqual(sockets[1]?.sentMessages, [JSON.stringify({ type: "subscribe-file", "file-id": "file-1" })]);
	assert.ok(client.isConnected());

	client.disconnect();
});

test("ignores malformed messages without crashing the client", async () => {
	const sockets: FakeWebSocket[] = [];

	const client = createPenpotWsClient({
		config: {
			PENPOT_WS_URL: "ws://penpot.test",
			CONNECTION_TIMEOUT_MS: 100,
		},
		logger: createLoggerStub(),
		createWebSocket: (url) => {
			const socket = new FakeWebSocket(url);
			sockets.push(socket);
			return socket;
		},
	});

	const connectPromise = client.connect("session-2");
	sockets[0]?.open();
	await connectPromise;

	assert.doesNotThrow(() => {
		sockets[0]?.message("{not-json");
	});

	assert.ok(client.isConnected());
	client.disconnect();
});
