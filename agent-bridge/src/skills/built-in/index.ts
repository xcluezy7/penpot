import type { SkillRegistry } from "../types";
import { createDesignGeneratorSkill } from "./design-generator";

export function registerBuiltInSkills(registry: SkillRegistry): void {
	registry.register(createDesignGeneratorSkill());
}
