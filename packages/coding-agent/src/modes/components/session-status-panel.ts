import { type Component, visibleWidth, wrapTextWithAnsi } from "@dude1wudv/pi-tui";
import { sanitizeText } from "@dude1wudv/pi-utils";
import {
	formatPhaseDisplayName,
	isClosedTodo,
	selectCollapsedTodos,
	type TodoItem,
	type TodoPhase,
	todoMatchesAnyDescription,
} from "../../tools/todo";
import { renderTreeList } from "../../tui/tree-list";
import type { ObservableSession } from "../session-observer-registry";
import { theme } from "../theme/theme";

/** Width reserved by the responsive session-status dock. */
export const SESSION_STATUS_PANEL_WIDTH = 42;

/** Getter-only state dependencies for the presentation-only session panel. */
export interface SessionStatusPanelGetters {
	getPlanPath: () => string | undefined;
	getTodoPhases: () => readonly TodoPhase[];
	getTodoExpanded: () => boolean;
	getSessions: () => readonly ObservableSession[];
	getActiveDescriptions: () => readonly string[];
	getHubHint: () => string;
}

function displayText(value: string): string {
	return sanitizeText(value)
		.replace(/[\r\n]+/g, " ")
		.replace(/\t/g, " ")
		.trim();
}

function wrapDisplay(value: string, width: number): string[] {
	const clean = displayText(value);
	return clean ? wrapTextWithAnsi(clean, Math.max(1, width)) : [];
}

function fitLine(line: string, width: number): string {
	const target = Math.max(0, width);
	const current = visibleWidth(line);
	if (current === target) return line;
	if (current < target) return `${line}${" ".repeat(target - current)}`;
	// All content is wrapped before it reaches the frame. This fallback only
	// protects the border when a themed symbol itself is wider than expected;
	// omit rather than add an ellipsis to a path or status row.
	return wrapTextWithAnsi(line, Math.max(1, target))[0] ?? "";
}

function frame(lines: readonly string[], width: number): string[] {
	const totalWidth = Math.max(2, width);
	const innerWidth = totalWidth - 2;
	const vertical = theme.fg("border", theme.boxRound.vertical);
	const top = theme.fg(
		"border",
		`${theme.boxRound.topLeft}${theme.boxRound.horizontal.repeat(innerWidth)}${theme.boxRound.topRight}`,
	);
	const bottom = theme.fg(
		"border",
		`${theme.boxRound.bottomLeft}${theme.boxRound.horizontal.repeat(innerWidth)}${theme.boxRound.bottomRight}`,
	);
	return [top, ...lines.map(line => `${vertical}${fitLine(line, innerWidth)}${vertical}`), bottom];
}

function sectionHeading(label: string): string {
	return theme.bold(theme.fg("accent", label));
}

function todoLine(task: TodoItem, matched: boolean, width: number): string[] {
	const checkbox = theme.checkbox;
	const label = displayText(task.content);
	let rendered: string;
	switch (task.status) {
		case "completed":
			rendered = theme.fg("success", `${checkbox.checked} ${label}`);
			break;
		case "abandoned":
			rendered = theme.fg("error", `${checkbox.unchecked} ${label}`);
			break;
		case "in_progress":
			rendered = theme.fg("accent", `${checkbox.unchecked} ${label}`);
			break;
		case "blocked": {
			const note = task.blocker ? `blocked: ${displayText(task.blocker)}` : "blocked";
			rendered = theme.fg("warning", `${checkbox.unchecked} ${label} (${note})`);
			break;
		}
		default:
			rendered = theme.fg(matched ? "accent" : "dim", `${checkbox.unchecked} ${label}`);
			break;
	}
	return wrapTextWithAnsi(rendered, Math.max(1, width));
}

function renderTodos(
	phases: readonly TodoPhase[],
	expanded: boolean,
	activeDescriptions: readonly string[],
	width: number,
): string[] {
	const nonEmpty = phases.filter(phase => phase.tasks.length > 0);
	const total = nonEmpty.reduce((sum, phase) => sum + phase.tasks.length, 0);
	const closed = nonEmpty.reduce((sum, phase) => sum + phase.tasks.filter(isClosedTodo).length, 0);
	const root = sectionHeading("Todos") + (total > 0 ? theme.fg("dim", ` · ${closed}/${total}`) : "");
	if (nonEmpty.length === 0) return [root, theme.fg("dim", "No todos")];

	const activeIndex = Math.max(
		0,
		nonEmpty.findIndex(phase => phase.tasks.some(task => task.status === "pending" || task.status === "in_progress")),
	);
	const effectiveActiveIndex = nonEmpty.some(phase =>
		phase.tasks.some(task => task.status === "pending" || task.status === "in_progress"),
	)
		? activeIndex
		: nonEmpty.length - 1;
	const multiPhase = nonEmpty.length > 1;
	const activeTaskCap = 5;
	const followingPhaseCap = 4;
	const isMatched = (task: TodoItem): boolean =>
		activeDescriptions.length > 0 && todoMatchesAnyDescription(task.content, activeDescriptions);

	const renderTasks = (phase: TodoPhase): string[] => {
		const selected = expanded
			? { items: phase.tasks, summary: "" }
			: selectCollapsedTodos([...phase.tasks], isMatched, activeTaskCap);
		return renderTreeList(
			{
				items: selected.items,
				expanded: expanded,
				trailingSummary: expanded ? undefined : selected.summary,
				itemType: "task",
				renderItem: task => todoLine(task, isMatched(task), Math.max(1, width - 4)),
			},
			theme,
		);
	};

	const renderPhase = (phase: TodoPhase, index: number): string[] => {
		const label = multiPhase ? formatPhaseDisplayName(phase.name, index + 1) : displayText(phase.name);
		const done = phase.tasks.filter(isClosedTodo).length;
		const header =
			(index === effectiveActiveIndex ? theme.bold(theme.fg("accent", label)) : theme.fg("muted", label)) +
			theme.fg("dim", ` · ${done}/${phase.tasks.length}`);
		const headerLines = wrapTextWithAnsi(header, Math.max(1, width - 2));
		return [...headerLines, ...(expanded || index === effectiveActiveIndex ? renderTasks(phase) : [])];
	};

	const visiblePhases = expanded
		? nonEmpty
		: nonEmpty.slice(effectiveActiveIndex, effectiveActiveIndex + 1 + followingPhaseCap);
	const phaseLines = renderTreeList(
		{
			items: visiblePhases,
			expanded: true,
			renderItem: (phase, context) =>
				renderPhase(phase, expanded ? context.index : effectiveActiveIndex + context.index),
		},
		theme,
	);
	return [root, ...phaseLines];
}

function planLines(planPath: string | undefined, phases: readonly TodoPhase[], width: number): string[] {
	const lines = [sectionHeading("Plan")];
	if (!planPath) {
		lines.push(theme.fg("dim", "No canonical plan"));
		return lines;
	}
	lines.push(...wrapDisplay(planPath, Math.max(1, width - 1)).map(line => ` ${line}`));
	const total = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
	if (total > 0) {
		const closed = phases.reduce((sum, phase) => sum + phase.tasks.filter(isClosedTodo).length, 0);
		lines.push(theme.fg("dim", ` Progress ${closed}/${total}`));
	}
	return lines;
}

function sessionStatusSymbol(status: ObservableSession["status"]): string {
	switch (status) {
		case "active":
			return theme.styledSymbol("status.running", "accent");
		case "completed":
			return theme.styledSymbol("status.done", "success");
		case "failed":
			return theme.styledSymbol("status.error", "error");
		case "aborted":
			return theme.styledSymbol("status.aborted", "error");
	}
}

function sessionDescription(session: ObservableSession): string {
	return (
		displayText(session.description ?? "") ||
		displayText(session.progress?.description ?? "") ||
		displayText(session.progress?.task ?? "") ||
		displayText(session.label)
	);
}

function renderSubagents(sessions: readonly ObservableSession[], width: number): string[] {
	const ordered = sessions
		.filter(session => session.kind === "subagent")
		.map((session, index) => ({ session, index }))
		.sort(
			(a, b) => Number(b.session.status === "active") - Number(a.session.status === "active") || a.index - b.index,
		)
		.map(entry => entry.session);
	if (ordered.length === 0) return [sectionHeading("Subagents"), theme.fg("dim", "No subagents")];

	const rows = renderTreeList(
		{
			items: ordered,
			expanded: false,
			maxCollapsed: 6,
			maxCollapsedLines: 6,
			itemType: "agent",
			renderItem: session => {
				const detail = sessionDescription(session);
				return wrapTextWithAnsi(
					`${sessionStatusSymbol(session.status)} ${displayText(session.id)}${detail ? ` · ${detail}` : ""}`,
					Math.max(1, width - 2),
				);
			},
		},
		theme,
	);
	return [sectionHeading("Subagents"), ...rows];
}

/** Pure renderer used by the component and presentation-focused tests. */
export function renderSessionStatusPanel(
	getters: SessionStatusPanelGetters,
	width = SESSION_STATUS_PANEL_WIDTH,
): readonly string[] {
	const totalWidth = Math.min(SESSION_STATUS_PANEL_WIDTH, Math.max(2, width));
	const innerWidth = totalWidth - 2;
	const phases = getters.getTodoPhases();
	const lines: string[] = [];
	lines.push(...renderTodos(phases, getters.getTodoExpanded(), getters.getActiveDescriptions(), innerWidth));
	lines.push("");
	lines.push(...planLines(getters.getPlanPath(), phases, innerWidth));
	lines.push("");
	lines.push(...renderSubagents(getters.getSessions(), innerWidth));
	lines.push("");
	lines.push(sectionHeading("Hub"));
	const hubHint = displayText(getters.getHubHint());
	lines.push(...(hubHint ? wrapDisplay(hubHint, innerWidth) : [theme.fg("dim", "Agent Hub unavailable")]));
	return frame(lines, totalWidth);
}

/** Alias for callers that want to emphasize that the renderer returns rows. */
export const renderSessionStatusPanelLines = renderSessionStatusPanel;

/** Presentation-only dock component; all mutable state remains in its getters. */
export class SessionStatusPanelComponent implements Component {
	constructor(private readonly getters: SessionStatusPanelGetters) {}

	render(width: number): readonly string[] {
		return renderSessionStatusPanel(this.getters, width || SESSION_STATUS_PANEL_WIDTH);
	}
}
