/**
 * Penpot WebSocket Protocol Definitions
 *
 * Penpot uses Transit-encoded messages over a custom WebSocket at:
 *   /ws/notifications?session-id={sid}
 *
 * Messages from the frontend are Transit-encoded Clojure maps.
 * The backend publishes file-change events to all subscribed clients.
 *
 * TODO: Implement full Transit encoding/decoding for production.
 * Currently messages are typed as generic records for initial scaffolding.
 */

// --- Message Types (as received from Penpot WebSocket) ---

export type PenpotMessageType =
	| "file-change"
	| "pointer-update"
	| "presence"
	| "library-change"
	| "notification"
	| "file-deleted"
	| "ping";

export interface PenpotMessage {
	type: PenpotMessageType;
	[key: string]: unknown;
}

export interface FileChangeMessage extends PenpotMessage {
	type: "file-change";
	"profile-id": string;
	"file-id": string;
	"session-id": string;
	revn: number;
	vern: number;
	changes: ChangeOperation[];
}

export interface PointerUpdateMessage extends PenpotMessage {
	type: "pointer-update";
	"profile-id": string;
	"file-id": string;
	x: number;
	y: number;
}

export interface PresenceMessage extends PenpotMessage {
	type: "presence";
	"profile-id": string;
	"file-id": string;
	action: "join" | "leave";
}

// --- Change Operations ---

export type ChangeType =
	| "add-obj"
	| "mod-obj"
	| "del-obj"
	| "mov-objects"
	| "reorder-children"
	| "add-page"
	| "mod-page"
	| "del-page"
	| "mov-page"
	| "set-plugin-data"
	| "set-guide"
	| "set-flow"
	| "set-default-grid";

export interface ChangeOperation {
	type: ChangeType;
	id?: string;
	"parent-id"?: string;
	"page-id"?: string;
	"frame-id"?: string;
	operations?: ModOperation[];
	[key: string]: unknown;
}

export type ModOperationType =
	| "set"
	| "assign"
	| "set-touched"
	| "set-remote-synced";

export interface ModOperation {
	type: ModOperationType;
	attr: string;
	val: unknown;
	[key: string]: unknown;
}

// --- Subscription Commands (sent by bridge to Penpot) ---

export interface SubscribeFileCommand {
	type: "subscribe-file";
	"file-id": string;
}

export interface SubscribeTeamCommand {
	type: "subscribe-team";
	"team-id": string;
}

export type PenpotCommand = SubscribeFileCommand | SubscribeTeamCommand;
