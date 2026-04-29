export interface DesignElement {
	id: string;
	type: string;
	label?: string;
	content?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	fontSize?: number;
}

export interface ReviewDimension {
	name: string;
	score: number; // 0–10
	note: string;
	suggestions: ReviewSuggestion[];
}

export interface ReviewSuggestion {
	action: string;
	description: string;
}

export interface AntiSlopReview {
	kind: "anti-slop-review";
	dimensions: ReviewDimension[];
}

export const REVIEW_DIMENSIONS = [
	"consistency",
	"hierarchy",
	"execution",
	"functionality",
	"innovation",
] as const;

type DimensionName = (typeof REVIEW_DIMENSIONS)[number];

function countByType(elements: DesignElement[], type: string): DesignElement[] {
	return elements.filter((e) => e.type.toLowerCase() === type.toLowerCase());
}

function hasCTA(elements: DesignElement[]): boolean {
	return elements.some(
		(e) =>
			e.type === "button" ||
			(e.label &&
				/\b(click|submit|sign.?up|buy|get.?started|download|try)\b/i.test(
					e.label,
				)) ||
			(e.content &&
				/\b(click|submit|sign.?up|buy|get.?started|download|try)\b/i.test(
					e.content,
				)),
	);
}

function hasHeadline(elements: DesignElement[]): boolean {
	return elements.some(
		(e) => e.type === "text" && e.fontSize !== undefined && e.fontSize >= 24,
	);
}

function scoreConsistency(elements: DesignElement[]): ReviewDimension {
	const buttons = countByType(elements, "button");
	const texts = countByType(elements, "text");

	const suggestions: ReviewSuggestion[] = [];

	let score = 8;

	// Check button size consistency
	if (buttons.length >= 2) {
		const widths = buttons.map((b) => b.width);
		const heights = buttons.map((b) => b.height);
		const widthSet = new Set(widths);
		const heightSet = new Set(heights);

		if (widthSet.size > 1 || heightSet.size > 1) {
			score -= 3;
			suggestions.push({
				action: "normalizeSizes",
				description:
					"Buttons have inconsistent sizes. Standardize width and height across all buttons.",
			});
		}
	}

	// Check alignment (x-coordinate)
	const xSet = new Set(elements.map((e) => e.x));
	if (xSet.size > elements.length * 0.5 && elements.length > 2) {
		score -= 2;
		suggestions.push({
			action: "alignElements",
			description:
				"Elements are scattered across different x positions. Align to a common grid.",
		});
	}

	// Check spacing pattern (y-axis)
	if (elements.length >= 3) {
		const sorted = [...elements].sort((a, b) => a.y - b.y);
		const gaps: number[] = [];
		for (let i = 1; i < sorted.length; i++) {
			gaps.push(sorted[i].y - (sorted[i - 1].y + sorted[i - 1].height));
		}
		const gapSet = new Set(gaps);
		if (gapSet.size > 1 && gaps.length >= 2) {
			score -= 2;
			suggestions.push({
				action: "normalizeSpacing",
				description:
					"Vertical spacing between elements is uneven. Use consistent spacing values.",
			});
		}
	}

	return {
		name: "consistency",
		score: Math.max(0, Math.min(10, score)),
		note:
			buttons.length > 0
				? `${elements.length} elements, ${buttons.length} buttons analyzed`
				: `${elements.length} elements analyzed`,
		suggestions,
	};
}

function scoreHierarchy(elements: DesignElement[]): ReviewDimension {
	const suggestions: ReviewSuggestion[] = [];
	let score = 7;

	const textElements = countByType(elements, "text");
	const hasLargeHeadline = textElements.some(
		(e) => e.fontSize !== undefined && e.fontSize >= 32,
	);
	const hasBody = textElements.some(
		(e) => e.fontSize !== undefined && e.fontSize >= 12 && e.fontSize <= 20,
	);

	if (textElements.length === 0) {
		score = 3;
		suggestions.push({
			action: "addTextHierarchy",
			description:
				"No text elements found. Add a headline and body text to establish visual hierarchy.",
		});
	} else if (!hasLargeHeadline) {
		score -= 3;
		suggestions.push({
			action: "addHeadline",
			description:
				"No large headline detected (fontSize >= 32). Add a prominent headline to establish the primary focal point.",
		});
	} else if (!hasBody) {
		score -= 2;
		suggestions.push({
			action: "addBodyText",
			description:
				"A headline exists but no body text. Add supporting content to build depth.",
		});
	}

	if (hasLargeHeadline && hasBody) {
		score = Math.min(10, score + 2);
	}

	return {
		name: "hierarchy",
		score: Math.max(0, Math.min(10, score)),
		note:
			textElements.length > 0
				? `${textElements.length} text element(s) — headline: ${hasLargeHeadline}, body: ${hasBody}`
				: "No text elements",
		suggestions,
	};
}

function scoreExecution(elements: DesignElement[]): ReviewDimension {
	const suggestions: ReviewSuggestion[] = [];
	let score = 7;

	// Check for elements that might overflow or be too small
	for (const el of elements) {
		if (el.width < 20 || el.height < 20) {
			score -= 2;
			suggestions.push({
				action: "resizeElement",
				description: `Element '${el.id}' (${el.width}x${el.height}) is very small and may be hard to interact with.`,
			});
			break;
		}
	}

	// Check for elements at extreme coordinates
	const extremeElements = elements.filter((e) => e.x > 3000 || e.y > 3000);
	if (extremeElements.length > 0) {
		score -= 2;
		suggestions.push({
			action: "repositionElements",
			description: `${extremeElements.length} element(s) placed far off-screen. Bring into visible canvas bounds.`,
		});
	}

	return {
		name: "execution",
		score: Math.max(0, Math.min(10, score)),
		note: `${elements.length} element(s) checked for sizing and positioning issues`,
		suggestions,
	};
}

function scoreFunctionality(elements: DesignElement[]): ReviewDimension {
	const suggestions: ReviewSuggestion[] = [];
	let score = 7;

	if (elements.length > 0 && !hasCTA(elements)) {
		score -= 4;
		suggestions.push({
			action: "addCTA",
			description:
				"No call-to-action (button, submit, sign-up, etc.) found. Add a CTA element to give the design a clear user goal.",
		});
	}

	if (!hasHeadline(elements)) {
		score -= 2;
		suggestions.push({
			action: "addHeadline",
			description:
				"No clear headline element. Add a headline so users immediately understand the page purpose.",
		});
	}

	// Check interactive element count
	const interactive = elements.filter((e) => e.type === "button");
	if (elements.length > 5 && interactive.length === 0) {
		score -= 2;
		suggestions.push({
			action: "addInteractiveElements",
			description:
				"Design has multiple elements but no interactive controls. Add buttons or links.",
		});
	}

	return {
		name: "functionality",
		score: Math.max(0, Math.min(10, score)),
		note: `CTA present: ${hasCTA(elements)}, headline present: ${hasHeadline(elements)}`,
		suggestions,
	};
}

function scoreInnovation(elements: DesignElement[]): ReviewDimension {
	const suggestions: ReviewSuggestion[] = [];
	let score = 5; // baseline — innovation is subjective

	const uniqueTypes = new Set(elements.map((e) => e.type));

	if (uniqueTypes.size >= 3) {
		score += 2;
	}

	if (elements.length >= 5) {
		score += 1;
	}

	if (uniqueTypes.size <= 1) {
		score -= 2;
		suggestions.push({
			action: "diversifyElements",
			description:
				"Design uses only one element type. Add variety (images, icons, dividers) for visual interest.",
		});
	}

	if (elements.length <= 2) {
		suggestions.push({
			action: "expandComposition",
			description:
				"Minimal composition. Consider adding supporting elements to flesh out the design.",
		});
	}

	return {
		name: "innovation",
		score: Math.max(0, Math.min(10, score)),
		note: `${uniqueTypes.size} unique element type(s), ${elements.length} total elements`,
		suggestions,
	};
}

export function reviewDesign(elements: DesignElement[]): AntiSlopReview {
	return {
		kind: "anti-slop-review",
		dimensions: [
			scoreConsistency(elements),
			scoreHierarchy(elements),
			scoreExecution(elements),
			scoreFunctionality(elements),
			scoreInnovation(elements),
		],
	};
}
