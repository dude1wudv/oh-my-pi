import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "bun:test";
import { resetSettingsForTest, Settings } from "@dude1wudv/pi-coding-agent/config/settings";
import type { StatusLineSettings } from "@dude1wudv/pi-coding-agent/modes/components/status-line";
import { StatusLineComponent } from "@dude1wudv/pi-coding-agent/modes/components/status-line";
import { initTheme } from "@dude1wudv/pi-coding-agent/modes/theme/theme";
import type { Component } from "@dude1wudv/pi-tui";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true });
	await initTheme();
});

afterEach(() => {
	vi.useRealTimers();
});

afterAll(() => {
	resetSettingsForTest();
});

function makeSession() {
	return {
		state: { messages: [], model: undefined },
		messages: [],
		model: undefined,
		systemPrompt: [],
		agent: { state: { tools: [] } },
		skills: [],
		isStreaming: false,
		isAutoThinking: false,
		autoResolvedThinkingLevel: () => undefined,
		isAdvisorActive: () => false,
		getAdvisorStatusOverview: () => ({ configured: false, advisors: [] }),
		isFastModeActive: () => false,
		isFastModeEnabled: () => false,
		getGoalModeState: () => null,
		getAsyncJobSnapshot: () => ({ running: [] }),
		getCurrentModel: () => undefined,
		getContextUsage: () => ({ tokens: 0, contextWindow: 128_000 }),
		modelRegistry: { isUsingOAuth: () => false },
		sessionManager: {
			getSessionName: () => "status animation test",
			getUsageStatistics: () => ({
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				orchestrationInput: 0,
				orchestrationOutput: 0,
				orchestrationCacheRead: 0,
				premiumRequests: 0,
				cost: 0,
			}),
		},
	} as unknown as ConstructorParameters<typeof StatusLineComponent>[0];
}

const customSettings: StatusLineSettings = {
	preset: "custom",
	leftSegments: [],
	rightSegments: [],
	separator: "none",
	sessionAccent: false,
};

function plain(component: StatusLineComponent): string {
	return Bun.stripANSI(component.render(100).join("\n"));
}

describe("StatusLineComponent subagent badge animation", () => {
	it("repaints each 80ms tick and stops when the count reaches zero", () => {
		vi.useFakeTimers();
		const requestRepaint = vi.fn<(component: Component) => void>();
		const component = new StatusLineComponent(makeSession(), requestRepaint);
		component.updateSettings(customSettings);
		const baselineTimers = vi.getTimerCount();

		component.setSubagentCount(2);
		expect(component.subagentCount).toBe(2);
		expect(vi.getTimerCount()).toBe(baselineTimers + 1);
		const initial = plain(component);
		expect(initial).toContain("2 agents running");

		vi.advanceTimersByTime(79);
		expect(requestRepaint).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(requestRepaint).toHaveBeenCalledTimes(1);
		expect(requestRepaint).toHaveBeenCalledWith(component);
		expect(plain(component)).not.toBe(initial);

		component.setSubagentCount(0);
		expect(vi.getTimerCount()).toBe(baselineTimers);
		vi.advanceTimersByTime(240);
		expect(requestRepaint).toHaveBeenCalledTimes(1);
		expect(plain(component)).toBe("");

		component.setSubagentCount(1);
		expect(vi.getTimerCount()).toBe(baselineTimers + 1);
		component.dispose();
		expect(vi.getTimerCount()).toBe(baselineTimers);
		vi.advanceTimersByTime(160);
		expect(requestRepaint).toHaveBeenCalledTimes(1);
	});

	it("keeps focused-agent navigation guidance visible in the status line", () => {
		const component = new StatusLineComponent(makeSession());
		component.updateSettings(customSettings);
		component.setSession(makeSession(), "agent-17");

		expect(plain(component)).toContain("Viewing agent-17 · Esc main · ←← parent");
		component.dispose();
	});
});
