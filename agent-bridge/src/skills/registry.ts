import type {
	RegisteredSkillDescription,
	SkillDefinition,
	SkillRegistry,
} from "./types";

export function createSkillRegistry(): SkillRegistry {
	const skills = new Map<string, SkillDefinition>();

	return {
		register(skill) {
			if (skills.has(skill.name)) {
				throw new Error(`Skill '${skill.name}' is already registered`);
			}

			skills.set(skill.name, skill as SkillDefinition);
		},

		list(): RegisteredSkillDescription[] {
			return Array.from(skills.values()).map((skill) => ({
				name: skill.name,
				description: skill.description,
			}));
		},

		describe(name: string): RegisteredSkillDescription | null {
			const skill = skills.get(name);
			if (!skill) {
				return null;
			}

			return {
				name: skill.name,
				description: skill.description,
			};
		},

		async invoke<TOutput = unknown>(name: string, input: unknown): Promise<TOutput> {
			const skill = skills.get(name);
			if (!skill) {
				throw new Error(`Unknown skill '${name}'`);
			}

			const parsed = skill.inputSchema.parse(input);
			return await skill.execute(parsed) as TOutput;
		},
	};
}
