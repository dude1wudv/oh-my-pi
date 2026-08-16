import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resetSettingsForTest, Settings } from "@dude1wudv/pi-coding-agent/config/settings";
import { StatusLineComponent } from "@dude1wudv/pi-coding-agent/modes/components/status-line";
import type { SegmentContext } from "@dude1wudv/pi-coding-agent/modes/components/status-line/segments";
import { renderSegment } from "@dude1wudv/pi-coding-agent/modes/components/status-line/segments";
import { initTheme, theme } from "@dude1wudv/pi-coding-agent/modes/theme/theme";
import { getSessionAccentAnsi, getSessionAccentHex } from "@dude1wudv/pi-coding-agent/utils/session-color";
import { visibleWidth } from "@dude1wudv/pi-tui";
import { getProjectDir, setProjectDir } from "@dude1wudv/pi-utils";

const originalProjectDir = getProjectDir();

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true });
	await initTheme();
});

afterAll(() => {
	resetSettingsForTest();
	setProjectDir(originalProjectDir);
});

/** Minimal SegmentContext factory — only path/git fields matter for these tests. */
function createCtx(overrides?: {
	pathMaxLength?: number;
	branch?: string | null;
	sessionName?: string;
	sessionAccent?: boolean;
}): SegmentContext {
	const hasName = overrides?.sessionName !== undefined;
	return {
		session: {
			state: {},
			isFastModeEnabled: () => false,
			modelRegistry: { isUsingOAuth: () => false },
			sessionManager: hasName ? { getSessionName: () => overrides.sessionName } : undefined,
		} as unknown as SegmentContext["session"],
		sessionAccent: overrides?.sessionAccent,
		width: 120,
		compactThinkingLevel: false,
		options: {
			path: {
				abbreviate: false,
				maxLength: overrides?.pathMaxLength ?? 40,
				stripWorkPrefix: false,
			},
		},
		planMode: null,
		loopMode: null,
		prewalk: null,
		goalMode: null,
		vibeMode: null,
		collab: null,
		usageStats: {
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
			tokensPerSecond: null,
		},
		contextPercent: 0,
		contextTokens: 0,
		contextWindow: 0,
		autoCompactEnabled: false,
		subagentCount: 0,
		activeMs: 0,
		activeRepo: null,
		worktree: null,
		git: {
			branch: overrides?.branch ?? null,
			status: null,
			pr: null,
		},
		usage: null,
	};
}

function createStatusLineSession(sessionName: string, modelName?: string) {
	const model = modelName ? { name: modelName, contextWindow: 128000 } : undefined;
	return {
		state: { messages: [], model },
		messages: [],
		model: model ?? { contextWindow: 128000 },
		contextUsageRevision: 0,
		systemPrompt: [],
		agent: { state: { tools: [] } },
		skills: [],
		isStreaming: false,
		isAutoThinking: false,
		autoResolvedThinkingLevel: () => undefined,
		isAdvisorActive: () => false,
		getAdvisorStatusOverview: () => ({ configured: false, advisors: [] }),
		isFastModeActive: () => false,
		getAsyncJobSnapshot: () => ({ running: [] }),
		getCurrentModel: () => undefined,
		isFastModeEnabled: () => false,
		getContextUsage: () => ({ tokens: 0, contextWindow: 128000 }),
		getGoalModeState: () => null,
		modelRegistry: { isUsingOAuth: () => false },
		sessionManager: {
			getSessionName: () => sessionName,
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

function stripAnsi(value: string): string {
	return value.replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

describe("status line session accent", () => {
	function buildComponent(sessionAccent: boolean) {
		const component = new StatusLineComponent(createStatusLineSession("Named session"));
		component.updateSettings({
			preset: "custom",
			leftSegments: ["pi"],
			rightSegments: ["session_name"],
			separator: "powerline-thin",
			sessionAccent,
		});
		return component;
	}

	// Computed lazily: `theme` is assigned by initTheme() in beforeAll, after module evaluation.
	const accentAnsi = (): string => {
		const ansi = getSessionAccentAnsi(
			getSessionAccentHex("Named session", theme.getMajorThemeColorHexes(), theme.accentSurfaceLuminance),
		);
		if (!ansi) throw new Error("expected a session accent ANSI sequence for the test theme");
		return ansi;
	};

	it("paints the gap with the session accent when enabled", () => {
		const ansi = accentAnsi();
		expect(ansi).toBeDefined();
		const border = buildComponent(true).render(80).join("\n");
		expect(border).toContain(`${ansi}${theme.boxRound.horizontal}`);
	});

	it("paints the gap with the border color and omits the session accent when disabled", () => {
		const ansi = accentAnsi();
		expect(ansi).toBeDefined();
		const border = buildComponent(false).render(80).join("\n");
		// Positive: gap is rendered with the theme border color.
		expect(border).toContain(`${theme.getFgAnsi("border")}${theme.boxRound.horizontal}`);
		// Negative: neither the gap nor the session-name segment may emit the
		// hash-derived session accent when the effective setting is disabled.
		expect(border).not.toContain(ansi);
	});

	it("renders the session name with the theme accent color when the accent is disabled", () => {
		const ansi = accentAnsi();
		expect(ansi).toBeDefined();
		const disabled = renderSegment("session_name", createCtx({ sessionName: "Named session", sessionAccent: false }));
		expect(disabled.visible).toBe(true);
		// Positive: the name uses the theme accent color, not the hash-derived session ANSI.
		expect(disabled.content).toContain(theme.getFgAnsi("accent"));
		// Negative: the hash-derived session ANSI must not appear for the name text.
		expect(disabled.content).not.toContain(ansi);
	});

	it("still renders the session name with the hash-derived accent when enabled", () => {
		const ansi = accentAnsi();
		expect(ansi).toBeDefined();
		const enabled = renderSegment("session_name", createCtx({ sessionName: "Named session", sessionAccent: true }));
		expect(enabled.visible).toBe(true);
		expect(enabled.content).toContain(ansi);
	});
});

describe("status line focused-agent dimming", () => {
	it("keeps powerline end caps at full intensity while text stays dimmed", () => {
		const component = new StatusLineComponent(createStatusLineSession("Focused session"));
		component.updateSettings({
			preset: "custom",
			leftSegments: ["pi"],
			rightSegments: ["session_name"],
			separator: "powerline-thin",
			sessionAccent: false,
		});
		component.setSession(createStatusLineSession("Focused session"), "agent-1");

		const border = component.render(80).join("\n");

		expect(border).toStartWith("\x1b[2m");
		expect(border).toContain(`\x1b[22m${theme.sep.powerlineLeft}\x1b[0m\x1b[2m`);
		expect(border).toContain(`\x1b[22m${theme.sep.powerlineRight}\x1b[0m\x1b[2m`);
		expect(border).toContain("\x1b[0m\x1b[2m");
		expect(border).toEndWith("\x1b[22m");
	});
});

describe("path segment truncation at varying maxLength", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-overflow-very-long-directory-name-for-testing-"));
		setProjectDir(tmpDir);
	});

	it("truncates path with ellipsis when maxLength is smaller than path", () => {
		const full = renderSegment("path", createCtx({ pathMaxLength: 200 }));
		const short = renderSegment("path", createCtx({ pathMaxLength: 10 }));

		expect(full.visible).toBe(true);
		expect(short.visible).toBe(true);
		expect(visibleWidth(short.content)).toBeLessThan(visibleWidth(full.content));
	});

	it("reduces visible width monotonically as maxLength decreases", () => {
		const widths = [40, 20, 10, 4].map(maxLen => {
			const rendered = renderSegment("path", createCtx({ pathMaxLength: maxLen }));
			return visibleWidth(rendered.content);
		});

		for (let i = 1; i < widths.length; i++) {
			expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
		}
	});

	it("still renders a visible segment at maxLength=4", () => {
		const rendered = renderSegment("path", createCtx({ pathMaxLength: 4 }));
		expect(rendered.visible).toBe(true);
		expect(visibleWidth(rendered.content)).toBeGreaterThan(0);
	});
});

describe("lossless footer reflow", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-footer-lossless-"));
		setProjectDir(tmpDir);
	});

	function buildLosslessComponent(): StatusLineComponent {
		const modelName = `MODEL_${"界🙂".repeat(12)}`;
		const component = new StatusLineComponent(createStatusLineSession("SESSION_KEEP", modelName));
		component.updateSettings({
			preset: "custom",
			leftSegments: ["model", "path"],
			rightSegments: ["session_name"],
			separator: "powerline-thin",
			sessionAccent: false,
			transparent: true,
			segmentOptions: {
				model: { showThinkingLevel: false },
				path: { abbreviate: false, maxLength: 8, stripWorkPrefix: false },
			},
		});
		return component;
	}

	it("keeps the 120-column fixture aligned on one row", () => {
		const component = new StatusLineComponent(createStatusLineSession("wide"));
		component.updateSettings({
			preset: "custom",
			leftSegments: ["pi"],
			rightSegments: ["session_name"],
			separator: "powerline-thin",
			sessionAccent: false,
		});

		const rows = component.render(120);
		expect(rows).toHaveLength(1);
		expect(visibleWidth(rows[0])).toBe(120);
	});

	it("preserves every main logical chunk at 60, 40, and 20 columns", () => {
		const component = buildLosslessComponent();
		for (const width of [60, 40, 20]) {
			const rows = component.render(width);
			const plain = stripAnsi(rows.join(""));
			expect(rows.every(row => visibleWidth(row) <= width)).toBe(true);
			expect(plain).toContain(`MODEL_${"界🙂".repeat(12)}`);
			expect(plain).toContain(tmpDir);
			expect(plain).toContain("SESSION_KEEP");
			expect(plain).not.toContain("…");
		}
	});

	it("wraps sanitized ANSI, CJK, emoji, and one-column hook chunks without loss", () => {
		const component = new StatusLineComponent(createStatusLineSession("unused"));
		component.updateSettings({ preset: "custom", leftSegments: [], rightSegments: [], showHookStatus: true });
		component.setHookStatus("a", "\x1b[31m检查🙂状态\x1b[0m");
		component.setHookStatus("b", "ABCDEFGHIJK");

		const rows20 = component.render(20);
		expect(rows20.every(row => visibleWidth(row) <= 20)).toBe(true);
		expect(stripAnsi(rows20.join(""))).toBe("检查🙂状态ABCDEFGHIJK");

		component.setHookStatus("a", undefined);
		const rows1 = component.render(1);
		expect(rows1.every(row => visibleWidth(row) <= 1)).toBe(true);
		expect(stripAnsi(rows1.join(""))).toBe("ABCDEFGHIJK");
		expect(stripAnsi(rows1.join(""))).not.toContain("…");
	});

	it("returns no rows for non-positive widths", () => {
		const component = buildLosslessComponent();
		expect(component.render(0)).toEqual([]);
		expect(component.render(-1)).toEqual([]);
	});
});
