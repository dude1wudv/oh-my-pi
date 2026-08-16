import { beforeAll, describe, expect, it } from "bun:test";
import {
	SESSION_STATUS_PANEL_WIDTH,
	SessionStatusPanelComponent,
	type SessionStatusPanelGetters,
} from "@dude1wudv/pi-coding-agent/modes/components/session-status-panel";
import type { ObservableSession } from "@dude1wudv/pi-coding-agent/modes/session-observer-registry";
import { initTheme } from "@dude1wudv/pi-coding-agent/modes/theme/theme";
import type { TodoPhase } from "@dude1wudv/pi-coding-agent/tools/todo";
import { visibleWidth } from "@dude1wudv/pi-tui";

beforeAll(async () => {
	await initTheme();
});

function session(id: string, status: ObservableSession["status"], description: string): ObservableSession {
	return {
		id,
		kind: "subagent",
		label: description,
		status,
		lastUpdate: 0,
		description: status === "active" ? undefined : description,
		progress:
			status === "active"
				? ({
						id,
						description,
						task: description,
					} as ObservableSession["progress"])
				: undefined,
	} as ObservableSession;
}

function render(getters: SessionStatusPanelGetters): string[] {
	return new SessionStatusPanelComponent(getters).render(SESSION_STATUS_PANEL_WIDTH).map(line => Bun.stripANSI(line));
}

describe("SessionStatusPanelComponent", () => {
	it("renders todo progress, canonical plan path, and active-first terminal sessions", () => {
		const phases: TodoPhase[] = [
			{
				name: "Foundation",
				tasks: [
					{ content: "finished setup", status: "completed" },
					{ content: "delegate active", status: "pending" },
				],
			},
			{ name: "Follow-up", tasks: [{ content: "later review", status: "pending" }] },
		];
		const sessions = [
			session("done-1", "completed", "completed implementation"),
			session("live-1", "active", "delegate active"),
			session("failed-1", "failed", "failed implementation"),
			session("aborted-1", "aborted", "aborted implementation"),
			session("done-2", "completed", "second completion"),
			session("done-3", "completed", "third completion"),
			session("done-4", "completed", "hidden completion"),
		];
		const getters: SessionStatusPanelGetters = {
			getPlanPath: () => ".omp/plans/status.md",
			getTodoPhases: () => phases,
			getTodoExpanded: () => false,
			getSessions: () => sessions,
			getActiveDescriptions: () => ["delegate active"],
			getHubHint: () => "Alt+A / Ctrl+S · Enter/click in Agent Hub",
		};

		const lines = render(getters);
		const output = lines.join("\n");
		expect(lines.every(line => visibleWidth(line) === SESSION_STATUS_PANEL_WIDTH)).toBe(true);
		expect(output.indexOf("Todos")).toBeLessThan(output.indexOf("Plan"));
		expect(output.indexOf("Plan")).toBeLessThan(output.indexOf("Subagents"));
		expect(output.indexOf("Subagents")).toBeLessThan(output.indexOf("Hub"));
		expect(output).toContain("1/3");
		expect(output).toContain(".omp/plans/status.md");
		expect(output).toContain("live-1");
		expect(output).toContain("completed implementation");
		expect(output).not.toContain("later review");
		expect(output).toContain("failed-1");
		expect(output).toContain("aborted-1");
		expect(output).toContain("… 2 more agents");
		expect(output).toContain("Alt+A / Ctrl+S");
	});

	it("does not invent plan progress when there are no todos", () => {
		const getters: SessionStatusPanelGetters = {
			getPlanPath: () => ".omp/plans/canonical-plan.md",
			getTodoPhases: () => [],
			getTodoExpanded: () => false,
			getSessions: () => [],
			getActiveDescriptions: () => [],
			getHubHint: () => "app.agents.hub / app.session.observe",
		};
		const output = render(getters).join("\n");

		expect(output).toContain(".omp/plans/canonical-plan.md");
		expect(output).not.toContain("Progress");
		expect(output).toContain("app.agents.hub / app.session.observe");
	});

	it("caps wrapped subagent rows so later sections remain reachable", () => {
		const sessions = Array.from({ length: 8 }, (_, index) =>
			session(`agent-${index}`, "active", `long running description ${index} ${"detail ".repeat(12)}`),
		);
		const getters: SessionStatusPanelGetters = {
			getPlanPath: () => ".omp/plans/canonical-plan.md",
			getTodoPhases: () => [],
			getTodoExpanded: () => false,
			getSessions: () => sessions,
			getActiveDescriptions: () => [],
			getHubHint: () => "Alt+A / Ctrl+S · Enter/click in Agent Hub",
		};
		const lines = render(getters);
		const subagents = lines.findIndex(line => line.includes("Subagents"));
		const hub = lines.findIndex(line => line.includes("Hub"));

		expect(subagents).toBeGreaterThanOrEqual(0);
		expect(hub).toBeGreaterThan(subagents);
		expect(hub - subagents - 1).toBeLessThanOrEqual(6);
		expect(lines.slice(subagents, hub).join("\n")).toContain("more agents");
	});
});
