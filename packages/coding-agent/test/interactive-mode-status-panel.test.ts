import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { Agent } from "@dude1wudv/pi-agent-core";
import { ModelRegistry } from "@dude1wudv/pi-coding-agent/config/model-registry";
import { resetSettingsForTest, Settings } from "@dude1wudv/pi-coding-agent/config/settings";
import {
	SESSION_STATUS_PANEL_WIDTH,
	SessionStatusPanelComponent,
} from "@dude1wudv/pi-coding-agent/modes/components/session-status-panel";
import { InteractiveMode } from "@dude1wudv/pi-coding-agent/modes/interactive-mode";
import { initTheme } from "@dude1wudv/pi-coding-agent/modes/theme/theme";
import { AgentSession } from "@dude1wudv/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@dude1wudv/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@dude1wudv/pi-coding-agent/session/session-manager";
import { TASK_SUBAGENT_LIFECYCLE_CHANNEL } from "@dude1wudv/pi-coding-agent/task";
import { EventBus } from "@dude1wudv/pi-coding-agent/utils/event-bus";
import { TempDir } from "@dude1wudv/pi-utils";

function setTerminalColumns(mode: InteractiveMode, columns: number): void {
	Object.defineProperty(mode.ui.terminal, "columns", {
		configurable: true,
		value: columns,
	});
}

function plain(lines: readonly string[]): string {
	return Bun.stripANSI(lines.join("\n"));
}

describe("InteractiveMode session status panel", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession;
	let mode: InteractiveMode;
	let eventBus: EventBus;

	beforeAll(async () => {
		await initTheme();
	});

	beforeEach(async () => {
		resetSettingsForTest();
		tempDir = TempDir.createSync("@pi-session-status-panel-");
		await Settings.init({
			inMemory: true,
			cwd: tempDir.path(),
			overrides: { "startup.quiet": true },
		});
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		const modelRegistry = new ModelRegistry(authStorage);
		const model = modelRegistry.find("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 to exist in registry");

		eventBus = new EventBus();
		session = new AgentSession({
			agent: new Agent({
				initialState: {
					model,
					systemPrompt: ["Test"],
					tools: [],
					messages: [],
				},
			}),
			sessionManager: SessionManager.create(tempDir.path(), tempDir.path()),
			settings: Settings.isolated({ "startup.quiet": true }),
			modelRegistry,
		});
		mode = new InteractiveMode(session, "test", undefined, undefined, undefined, undefined, eventBus);
	});

	afterEach(async () => {
		mode?.stop();
		await session?.dispose();
		authStorage?.close();
		tempDir?.removeSync();
		vi.useRealTimers();
		vi.restoreAllMocks();
		resetSettingsForTest();
	});

	it("mounts the getter-backed dock and toggles the duplicate HUD at the responsive breakpoint", async () => {
		await mode.init({ suppressWelcomeIntro: true });

		const panelEntry = mode.ui.overlayStack.find(entry => entry.component instanceof SessionStatusPanelComponent);
		if (!panelEntry) throw new Error("Expected the session status panel overlay");
		expect(panelEntry.options?.width).toBe(SESSION_STATUS_PANEL_WIDTH);
		expect(panelEntry.options?.anchor).toBe("top-right");
		expect(panelEntry.options?.reserveRight).toBe(true);
		expect(panelEntry.options?.captureFocus).toBe(false);
		expect(panelEntry.options?.fullscreen).toBe(false);
		expect(panelEntry.options?.visible?.(121, 30)).toBe(true);
		expect(panelEntry.options?.visible?.(120, 30)).toBe(false);

		mode.planModePlanFilePath = ".omp/plans/canonical.md";
		mode.setTodos([
			{
				name: "Foundation",
				tasks: [
					{ content: "finished setup", status: "completed" },
					{ content: "delegate active", status: "pending" },
				],
			},
		]);

		setTerminalColumns(mode, 121);
		process.stdout.emit("resize");
		expect(mode.todoContainer.render(121)).toEqual([]);
		expect(mode.subagentContainer.render(121)).toEqual([]);

		vi.useFakeTimers();
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
			id: "DelegateA",
			index: 0,
			agent: "task",
			agentSource: "bundled",
			description: "delegate active",
			status: "started",
			parentToolCallId: "tool-call",
			detached: true,
		});
		vi.advanceTimersByTime(100);
		await Promise.resolve();

		const panelText = plain(panelEntry.component.render(SESSION_STATUS_PANEL_WIDTH));
		expect(panelText).toContain(".omp/plans/canonical.md");
		expect(panelText).toContain("1/2");
		expect(panelText).toContain("DelegateA");
		expect(panelText).toContain("Alt+A / Ctrl+S");

		setTerminalColumns(mode, 120);
		process.stdout.emit("resize");
		const narrowTodo = plain(mode.todoContainer.render(120));
		const narrowSubagents = plain(mode.subagentContainer.render(120));
		expect(narrowTodo).toContain("Todos");
		expect(narrowSubagents).toContain("DelegateA: delegate active");

		setTerminalColumns(mode, 121);
		process.stdout.emit("resize");
		expect(mode.todoContainer.render(121)).toEqual([]);
		expect(mode.subagentContainer.render(121)).toEqual([]);
	});
});
