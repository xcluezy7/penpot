import pino from "pino";

let logger: pino.Logger | null = null;

export function createLogger(level: string = "info"): pino.Logger {
	if (logger) return logger;

	logger = pino({
		level,
		formatters: {
			level(label) {
				return { level: label };
			},
		},
		timestamp: pino.stdTimeFunctions.isoTime,
		messageKey: "message",
		// Structured JSON in production, pretty-print for dev via env
		transport:
			process.env.NODE_ENV !== "production"
				? {
						target: "pino-pretty",
						options: {
							colorize: true,
							translateTime: "SYS:HH:MM:ss.l",
							ignore: "pid,hostname",
						},
					}
				: undefined,
	});

	return logger;
}

export function getLogger(): pino.Logger {
	if (!logger)
		throw new Error("Logger not initialized — call createLogger() first");
	return logger;
}

export type { Logger } from "pino";
