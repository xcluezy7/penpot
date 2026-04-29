import type { ZodType } from "zod";

export interface RegisteredSkillDescription {
	name: string;
	description: string;
}

export interface SkillDefinition<TInput = unknown, TOutput = unknown> {
	name: string;
	description: string;
	inputSchema: ZodType<TInput>;
	execute(input: TInput): Promise<TOutput> | TOutput;
}

export interface SkillRegistry {
	register<TInput, TOutput>(skill: SkillDefinition<TInput, TOutput>): void;
	list(): RegisteredSkillDescription[];
	describe(name: string): RegisteredSkillDescription | null;
	invoke<TOutput = unknown>(name: string, input: unknown): Promise<TOutput>;
}
