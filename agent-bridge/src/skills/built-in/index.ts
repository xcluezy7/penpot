import type { SkillRegistry } from "../types";
import { createAntiSlopReviewerSkill } from "./anti-slop-reviewer";
import { createDesignGeneratorSkill } from "./design-generator";

export function registerBuiltInSkills(registry: SkillRegistry): void {
	registry.register(createDesignGeneratorSkill());
	registry.register(createAntiSlopReviewerSkill());
}
