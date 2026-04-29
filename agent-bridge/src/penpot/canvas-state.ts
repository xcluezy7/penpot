import type {
	ChangeOperation,
	FileChangeMessage,
	PenpotMessage,
} from "./protocol";

/**
 * In-memory representation of the current canvas state.
 *
 * Maintains a lightweight model of the Penpot canvas for agents to query.
 * Updated by processing file-change events from the Penpot WebSocket.
 *
 * The full shape tree is stored as a JSON-compatible structure to simplify
 * serialization when sending to agents.
 */

export interface CanvasShape {
	id: string;
	type: string; // "rect", "circle", "text", "path", "frame", "group", "board", etc.
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	visible: boolean;
	locked: boolean;
	fills: CanvasFill[];
	strokes: CanvasStroke[];
	children: CanvasShape[];
	parentId: string | null;
	frameId: string | null;
	// Additional shape-specific properties
	props: Record<string, unknown>;
}

export interface CanvasFill {
	"fill-color"?: string;
	"fill-opacity"?: number;
	"fill-image"?: Record<string, unknown>;
}

export interface CanvasStroke {
	"stroke-color"?: string;
	"stroke-opacity"?: number;
	"stroke-width"?: number;
	"stroke-style"?: string;
}

export interface CanvasPage {
	id: string;
	name: string;
	order: number;
	shapes: CanvasShape[];
	background: string;
}

export interface CanvasState {
	fileId: string;
	revn: number;
	vern: number;
	pages: CanvasPage[];
	activePageId: string | null;
	lastUpdated: number;
}

// --- State Factory ---

export function createEmptyCanvasState(fileId: string): CanvasState {
	return {
		fileId,
		revn: 0,
		vern: 0,
		pages: [],
		activePageId: null,
		lastUpdated: Date.now(),
	};
}

// --- State Updater ---

/**
 * Apply a file-change message to update the in-memory canvas state.
 * This is a simplified processor; a full implementation would handle
 * each change type to update the shape tree incrementally.
 */
export function applyFileChange(
	state: CanvasState,
	msg: FileChangeMessage,
): CanvasState {
	const updated: CanvasState = {
		...state,
		revn: msg.revn,
		vern: msg.vern,
		lastUpdated: Date.now(),
	};

	for (const change of msg.changes ?? []) {
		applyChange(updated, change);
	}

	return updated;
}

function applyChange(state: CanvasState, change: ChangeOperation): void {
	switch (change.type) {
		case "add-obj":
			// Placeholder: add shape to the shape tree
			break;
		case "mod-obj":
			// Placeholder: modify shape properties
			break;
		case "del-obj":
			// Placeholder: remove shape from tree
			break;
		case "mov-objects":
			// Placeholder: reparent shapes
			break;
		case "add-page":
			// Placeholder: add page
			break;
		case "del-page":
			// Placeholder: remove page
			break;
		case "mod-page":
			// Placeholder: modify page properties
			break;
		default:
			// Unknown change type — skip for now
			break;
	}
}

/**
 * Find a shape by ID across all pages.
 */
export function findShape(
	state: CanvasState,
	shapeId: string,
): CanvasShape | null {
	for (const page of state.pages) {
		const found = findShapeInTree(page.shapes, shapeId);
		if (found) return found;
	}
	return null;
}

function findShapeInTree(
	shapes: CanvasShape[],
	shapeId: string,
): CanvasShape | null {
	for (const shape of shapes) {
		if (shape.id === shapeId) return shape;
		if (shape.children.length > 0) {
			const found = findShapeInTree(shape.children, shapeId);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Serialize canvas state to a plain JSON object for sending to agents.
 */
export function serializeCanvasState(
	state: CanvasState,
): Record<string, unknown> {
	return {
		fileId: state.fileId,
		revision: state.revn,
		version: state.vern,
		pages: state.pages.map((p) => ({
			id: p.id,
			name: p.name,
			shapeCount: countShapes(p.shapes),
		})),
		activePageId: state.activePageId,
		lastUpdated: new Date(state.lastUpdated).toISOString(),
	};
}

function countShapes(shapes: CanvasShape[]): number {
	let count = shapes.length;
	for (const shape of shapes) {
		count += countShapes(shape.children);
	}
	return count;
}
