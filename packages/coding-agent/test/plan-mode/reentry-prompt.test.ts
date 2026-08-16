import { describe, expect, it } from "bun:test";
import { prompt } from "@dude1wudv/pi-utils";
import planModeActivePrompt from "../../src/prompts/system/plan-mode-active.md" with { type: "text" };

const BASE = {
	planFilePath: "local://old-feature-plan.md",
	askToolName: "ask",
	writeToolName: "write",
	editToolName: "edit",
	isHashlineEditMode: false,
	iterative: false,
	askAvailable: true,
	taskAvailable: true,
	scoutAvailable: true,
	reentry: false,
	planExists: true,
} as const;

type Overrides = Partial<Record<keyof typeof BASE, boolean | string>>;

function render(overrides: Overrides = {}): string {
	return prompt.render(planModeActivePrompt, { ...BASE, ...overrides });
}

describe("plan-mode re-entry prompt", () => {
	it("only emits the Re-entry section when re-entering", () => {
		expect(render({ reentry: false })).not.toContain("## Re-entry");
		expect(render({ reentry: true })).toContain("## Re-entry");
	});
});

describe("plan-mode-active tool availability", () => {
	it("omits ask-tool directives when ask is unavailable", () => {
		const withoutAsk = render({ askAvailable: false, iterative: true });
		expect(withoutAsk).not.toContain("`ask`: 2–4 mutually exclusive options");
		expect(withoutAsk).not.toContain("`ask` only for preferences/tradeoffs");
		expect(withoutAsk).not.toContain("Using `ask` to gather requirements");

		const withAsk = render({ askAvailable: true, iterative: true });
		expect(withAsk).toContain("`ask`: 2–4 mutually exclusive options");
		expect(withAsk).toContain("`ask` only for preferences/tradeoffs");
	});

	it("records preferences as assumptions when ask is unavailable", () => {
		const iterativeWithoutAsk = render({ askAvailable: false, iterative: true });
		expect(iterativeWithoutAsk).toContain("Record as Assumptions with a recommended default");
		expect(iterativeWithoutAsk).toContain("record preferences/tradeoffs as Assumptions");
		expect(iterativeWithoutAsk).not.toContain("`ask` only for preferences/tradeoffs");

		const parallelWithoutAsk = render({ askAvailable: false, iterative: false });
		expect(parallelWithoutAsk).toContain(
			"record remaining preference questions as Assumptions with a recommended default",
		);
		// A prose question cannot end the turn in plan mode — no prose-terminal option.
		expect(parallelWithoutAsk).not.toContain("Presenting a choice between approaches");
	});

	it("omits scout-via-task dispatch when the task tool is unavailable", () => {
		const withoutTask = render({ taskAvailable: false, scoutAvailable: true });
		expect(withoutTask).not.toContain("(via `task`)");

		const withTask = render({ taskAvailable: true, scoutAvailable: true });
		expect(withTask).toContain("(via `task`)");
	});
});

describe("plan-mode ownership", () => {
	it("biases independent slices toward stable agent-label owners", () => {
		const withTask = render({ reentry: true, taskAvailable: true });

		expect(withTask).toContain("stable, descriptive `agent-label` owner");
		expect(withTask).toContain("Main");
		expect(withTask).toContain("Planning mode remains read-only");
		expect(withTask).not.toContain("one parallel `task` batch");
	});

	it("keeps re-entry planning-only when task dispatch is unavailable", () => {
		const withoutTask = render({ reentry: true, taskAvailable: false });

		expect(withoutTask).toContain("stable, descriptive `agent-label` owner");
		expect(withoutTask).toContain("Planning mode remains read-only");
		expect(withoutTask).not.toContain("one parallel `task` batch");
		expect(withoutTask).not.toContain("Main-only fallback");
	});
});
