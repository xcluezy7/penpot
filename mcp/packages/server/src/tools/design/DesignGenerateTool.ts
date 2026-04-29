import { z } from "zod";
import "reflect-metadata";
import { createLogger } from "../../logger";
import type { PenpotMcpServer } from "../../PenpotMcpServer";
import { Tool } from "../../Tool";
import type { ToolResponse } from "../../ToolResponse";
import { TextResponse } from "../../ToolResponse";

const DesignGenerateSchema = {
	prompt: z.string().min(1).describe("Natural language design prompt"),
};

export class DesignGenerateTool extends Tool<
	z.infer<z.ZodObject<typeof DesignGenerateSchema>>
> {
	private readonly agentBridgeUrl: string;

	constructor(mcpServer: PenpotMcpServer) {
		super(mcpServer, DesignGenerateSchema);
		this.agentBridgeUrl =
			process.env.AGENT_BRIDGE_URL ?? "http://localhost:4405";
	}

	public getToolName(): string {
		return "design_generate";
	}

	public getToolDescription(): string {
		return (
			"Generates a design from a natural language prompt. " +
			"Delegates to the Agent Bridge which maps the intent to canvas actions. " +
			"Returns a semantic design intent with an operation and preview label."
		);
	}

	protected async executeCore(args: { prompt: string }): Promise<ToolResponse> {
		const logger = createLogger("DesignGenerateTool");
		try {
			const response = await fetch(`${this.agentBridgeUrl}/agent-requests`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: args.prompt }),
				signal: AbortSignal.timeout(15_000),
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "unknown");
				return new TextResponse(
					`Agent Bridge returned ${response.status}: ${errorBody}`,
				);
			}

			const data = (await response.json()) as Record<string, unknown>;

			const status = data.visibleAction
				? `accepted — "${data.visibleAction}"`
				: data.status === "failed"
					? `failed — ${data.error ?? "unknown"}`
					: `status: ${data.status ?? "unknown"}`;

			return new TextResponse(
				`Design request submitted.\nRequest ID: ${data.id}\nStatus: ${status}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.warn(
				`Agent Bridge unreachable at ${this.agentBridgeUrl}: ${message}`,
			);
			return new TextResponse(
				`Agent Bridge is unreachable at ${this.agentBridgeUrl}. ` +
					`Ensure the agent-bridge service is running.\nError: ${message}`,
			);
		}
	}
}
