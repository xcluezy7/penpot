import { z } from "zod";

const envSchema = z.object({
	// HTTP / Health
	PORT: z.coerce.number().int().positive().default(4401),
	HOST: z.string().default("0.0.0.0"),

	// Penpot backend
	PENPOT_BACKEND_URL: z.string().default("http://localhost:3448"),
	PENPOT_WS_URL: z.string().default("ws://localhost:3448"),
	PENPOT_WS_SESSION_ID: z.string().default("agent-bridge"),

	// Penpot MCP plugin (for task execution on canvas)
	MCP_PLUGIN_URL: z.string().default("http://localhost:4400"),

	// Agent connections
	AGENT_WS_PORT: z.coerce.number().int().positive().default(4402),

	// Logging
	LOG_LEVEL: z
		.enum(["trace", "debug", "info", "warn", "error", "fatal"])
		.default("info"),

	// Auth
	AGENT_AUTH_TOKEN: z.string().optional(),

	// Limits
	MAX_AGENT_SESSIONS: z.coerce.number().int().positive().default(10),
	CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cached: EnvConfig | null = null;

export function loadConfig(overrides?: Record<string, string>): EnvConfig {
	if (cached && !overrides) return cached;

	const raw: Record<string, string | undefined> = {};

	for (const key of Object.keys(envSchema.shape)) {
		const envKey = key;
		raw[key] = overrides?.[envKey] ?? process.env[envKey];
	}

	const result = envSchema.safeParse(raw);
	if (!result.success) {
		const errors = result.error.issues
			.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`Invalid configuration:\n${errors}`);
	}

	cached = result.data;
	return result.data;
}

export function getConfig(): EnvConfig {
	if (!cached) return loadConfig();
	return cached;
}
