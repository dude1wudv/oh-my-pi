import * as fs from "node:fs/promises";
import * as path from "node:path";

export type ProjectPlanStatus = "planned" | "executing" | "blocked" | "completed";

/** Plan mode state plus the durable project-plan path, when one exists. */
export interface PlanModeState {
	enabled: boolean;
	planFilePath: string;
	projectPlanPath?: string;
	workflow?: "parallel" | "iterative";
	reentry?: boolean;
}

export type ProjectPlanUpdateEvent =
	| { type: "task_created"; taskId: string; task: string; owner?: string; scope?: string }
	| { type: "task_started"; taskId: string; owner?: string; scope?: string }
	| {
			type: "task_settled";
			taskId: string;
			status: "success" | "failure" | "cancellation" | "timeout" | "dispatch failure";
			artifact?: string;
			followUp?: string;
	  }
	| { type: "dispatch_failed"; taskId: string; error: string; owner?: string; scope?: string }
	| { type: "artifact_accepted"; taskId: string; artifact: string }
	| { type: "verification_recorded"; taskId?: string; check: string; passed?: boolean; detail?: string }
	| { type: "status_changed"; status: ProjectPlanStatus; reason?: string };

export interface ProjectPlanFileUpdateOptions {
	cwd: string;
	projectPlanPath: string;
	event: ProjectPlanUpdateEvent;
	now?: Date;
}

/** Session custom-entry type used to restore the Main-owned project path. */
export const PROJECT_PLAN_ENTRY_TYPE = "project-plan";

/** Resolve a persisted project plan path and reject paths outside cwd/.omp/plans. */
export function resolveProjectPlanPath(cwd: string, projectPlanPath: string): string {
	if (!projectPlanPath || projectPlanPath.includes("://") || path.isAbsolute(projectPlanPath)) {
		throw new Error("Project plan path must be a relative path under .omp/plans.");
	}
	const root = path.resolve(cwd);
	const plansRoot = path.resolve(root, ".omp", "plans");
	const resolved = path.resolve(root, projectPlanPath);
	const relative = path.relative(plansRoot, resolved);
	if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error(`Project plan path must stay under ${path.join(".omp", "plans")}: ${projectPlanPath}`);
	}
	if (!relative.toLowerCase().endsWith(".md")) throw new Error("Project plan path must point to a markdown file.");
	return resolved;
}

export function projectPlanRelativePath(cwd: string, absolutePath: string): string {
	const root = path.resolve(cwd);
	const relative = path.relative(root, absolutePath);
	const resolved = resolveProjectPlanPath(root, relative);
	if (path.resolve(resolved) !== path.resolve(absolutePath))
		throw new Error("Project plan path escaped the project root.");
	return relative.split(path.sep).join("/");
}

function timestamp(now: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	const offset = -now.getTimezoneOffset();
	const sign = offset >= 0 ? "+" : "-";
	const absolute = Math.abs(offset);
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} UTC${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function replaceMetadata(content: string, status: ProjectPlanStatus | undefined, now: Date): string {
	let next = content.replace(/^> Updated: .*$/m, `> Updated: ${timestamp(now)}`);
	if (status) next = next.replace(/^> Status: .*$/m, `> Status: ${status}`);
	return next;
}

function section(content: string, heading: string): { start: number; end: number } | undefined {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`^## ${escaped}\\s*$`, "m").exec(content);
	if (!match || match.index === undefined) return undefined;
	const after = content.slice(match.index + match[0].length);
	const next = /^##? /m.exec(after);
	return { start: match.index, end: next ? match.index + match[0].length + next.index : content.length };
}

function appendSectionLine(content: string, heading: string, line: string): string {
	const range = section(content, heading);
	if (!range) return `${content.trimEnd()}\n\n## ${heading}\n${line}\n`;
	const body = content.slice(range.start, range.end).trimEnd();
	return `${content.slice(0, range.start)}${body}\n${line}\n${content.slice(range.end)}`;
}

function taskLine(content: string, taskId: string): { start: number; end: number; line: string } | undefined {
	const escaped = taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`^- \\[([ xX~-])\\] ${escaped}(?:\\s|—|$).*?$`, "m").exec(content);
	return match && match.index !== undefined
		? { start: match.index, end: match.index + match[0].length, line: match[0] }
		: undefined;
}

function updateTask(content: string, taskId: string, status: string, checked: boolean): string {
	const found = taskLine(content, taskId);
	if (!found)
		return appendSectionLine(content, "Task breakdown", `- [${checked ? "x" : " "}] ${taskId} — status: ${status}`);
	const base = found.line.replace(/\s+— status: [^—]+$/, "").replace(/^- \[[ xX~-]\]/, `- [${checked ? "x" : " "}]`);
	return `${content.slice(0, found.start)}${base} — status: ${status}${content.slice(found.end)}`;
}

function updateTaskChecked(content: string, taskId: string, checked: boolean): string {
	const found = taskLine(content, taskId);
	if (!found) return content;
	const line = found.line.replace(/^- \[[ xX~-]\]/, `- [${checked ? "x" : " "}]`);
	return `${content.slice(0, found.start)}${line}${content.slice(found.end)}`;
}

type DispatchEvent = Extract<ProjectPlanUpdateEvent, { type: "task_started" | "task_settled" | "dispatch_failed" }>;

function encodedDispatchScope(taskId: string, scope: string | undefined): string {
	const normalized = scope?.trim();
	return normalized ? `${taskId} — ${normalized}` : taskId;
}

function createdTaskMetadata(content: string, taskId: string): { owner?: string; scope?: string } {
	const line = taskLine(content, taskId)?.line;
	if (!line) return {};
	const owner = /— owner: (.*?) — scope: /.exec(line)?.[1]?.trim();
	const scope = /— scope: (.*?)$/
		.exec(line)?.[1]
		?.replace(/\s+— status:.*$/, "")
		.trim();
	return {
		...(owner ? { owner } : {}),
		...(scope && scope !== "(unspecified)" ? { scope } : {}),
	};
}

function dispatchCells(line: string): string[] | undefined {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return undefined;
	const values = trimmed.slice(1, -1).split("|");
	if (values.length < 6) return undefined;
	return [
		values[0].trim(),
		values[1].trim(),
		values[2].trim(),
		values[3].trim(),
		values[4].trim(),
		values.slice(5).join("|").trim(),
	];
}

function dispatchScopeMatches(scope: string, taskId: string): boolean {
	return (
		scope === taskId ||
		scope.startsWith(`${taskId} —`) ||
		scope.startsWith(`${taskId} - `) ||
		scope.endsWith(` [${taskId}]`)
	);
}

function findDispatchRow(lines: string[], taskId: string): { index: number; cells: string[] } | undefined {
	for (let index = 0; index < lines.length; index++) {
		const cells = dispatchCells(lines[index]);
		if (cells && dispatchScopeMatches(cells[2], taskId)) return { index, cells };
	}
	return undefined;
}

function renderDispatchRow(cells: string[]): string {
	return `| ${cells.join(" | ")} |`;
}

function applyDispatchEvent(cells: string[], event: DispatchEvent): void {
	if (event.type === "task_started") {
		cells[3] = "running";
	} else if (event.type === "task_settled") {
		cells[3] = event.status;
		if (event.artifact !== undefined) cells[4] = event.artifact || "—";
		if (event.followUp !== undefined) cells[5] = event.followUp || "—";
	} else {
		cells[3] = "dispatch failure";
		cells[5] = event.error || "—";
	}
}

function updateDispatch(content: string, event: DispatchEvent): string {
	const range = section(content, "Agent dispatch log");
	const created = createdTaskMetadata(content, event.taskId);
	const owner = ("owner" in event ? event.owner?.trim() : undefined) ?? created.owner;
	const scope = ("scope" in event ? event.scope : undefined) ?? created.scope;
	const initial = ["?", owner || "Main", encodedDispatchScope(event.taskId, scope), "—", "—", "—"];
	if (!range) {
		applyDispatchEvent(initial, event);
		return appendSectionLine(content, "Agent dispatch log", renderDispatchRow(initial));
	}

	const lines = content.slice(range.start, range.end).split("\n");
	const found = findDispatchRow(lines, event.taskId);
	const cells = found ? [...found.cells] : initial;
	if (found) {
		if (owner) cells[1] = owner;
		if (scope?.trim()) cells[2] = encodedDispatchScope(event.taskId, scope);
	}
	applyDispatchEvent(cells, event);
	if (found) {
		lines[found.index] = renderDispatchRow(cells);
		return `${content.slice(0, range.start)}${lines.join("\n")}${content.slice(range.end)}`;
	}
	return appendSectionLine(content, "Agent dispatch log", renderDispatchRow(cells));
}

function appendAcceptanceMarker(followUp: string): string {
	const marker = "artifact accepted";
	const current = followUp.trim();
	if (!current || current === "—") return marker;
	if (current.includes(marker)) return current;
	return `${current}; ${marker}`;
}

function updateAcceptedArtifact(
	content: string,
	event: Extract<ProjectPlanUpdateEvent, { type: "artifact_accepted" }>,
): string {
	const range = section(content, "Agent dispatch log");
	if (!range) return content;
	const lines = content.slice(range.start, range.end).split("\n");
	const found = findDispatchRow(lines, event.taskId);
	if (!found) return content;
	const cells = [...found.cells];
	cells[4] = event.artifact;
	cells[5] = appendAcceptanceMarker(cells[5]);
	lines[found.index] = renderDispatchRow(cells);
	return `${content.slice(0, range.start)}${lines.join("\n")}${content.slice(range.end)}`;
}

function countTaskChecklistRows(content: string): number {
	const range = section(content, "Task breakdown");
	if (!range) return 0;
	return (content.slice(range.start, range.end).match(/^- \[[ xX~-]\] [^\n]+$/gm) ?? []).length;
}

function isTerminalDispatchStatus(status: string): boolean {
	return (
		status === "success" ||
		status === "failure" ||
		status === "cancellation" ||
		status === "timeout" ||
		status === "dispatch failure"
	);
}

function countSettledDispatchRows(content: string): number {
	const range = section(content, "Agent dispatch log");
	if (!range) return 0;
	const lines = content.slice(range.start, range.end).split("\n");
	let settled = 0;
	for (const line of lines) {
		const cells = dispatchCells(line);
		if (cells && isTerminalDispatchStatus(cells[3])) settled++;
	}
	return settled;
}

function updateBarrier(content: string, decision: string): string {
	const range = section(content, "Result barrier");
	if (!range) return content;
	const block = content.slice(range.start, range.end);
	const expected = countTaskChecklistRows(content);
	const settled = countSettledDispatchRows(content);
	let next = block.replace(/^- Expected terminal items: .*$/m, `- Expected terminal items: ${expected}`);
	next = next.replace(/^- Settled: .*$/m, `- Settled: ${settled}`);
	next = next.replace(/^- WAIT_ALL: .*$/m, `- WAIT_ALL: ${settled >= expected && expected > 0 ? "closed" : "active"}`);
	next = next.replace(/^- Last barrier decision: .*$/m, `- Last barrier decision: ${decision}`);
	return `${content.slice(0, range.start)}${next}${content.slice(range.end)}`;
}

function taskHasAcceptedArtifact(content: string, taskId: string): boolean {
	const range = section(content, "Agent dispatch log");
	if (!range) return false;
	const lines = content.slice(range.start, range.end).split("\n");
	const found = findDispatchRow(lines, taskId);
	return found?.cells[5].includes("artifact accepted") ?? false;
}

export function applyProjectPlanUpdate(content: string, event: ProjectPlanUpdateEvent, now = new Date()): string {
	/** Apply one narrow Main-owned event to the project-plan dynamic sections. */
	let next = content;
	switch (event.type) {
		case "task_created":
			next = appendSectionLine(
				next,
				"Task breakdown",
				`- [ ] ${event.taskId} — ${event.task} — owner: ${event.owner ?? "Main"} — scope: ${event.scope ?? "(unspecified)"}`,
			);
			break;
		case "task_started":
			next = updateTask(next, event.taskId, "running", false);
			next = updateDispatch(next, event);
			break;
		case "task_settled":
			next = updateTask(next, event.taskId, event.status, false);
			next = updateDispatch(next, event);
			break;
		case "dispatch_failed":
			next = updateTask(next, event.taskId, "dispatch failure", false);
			next = updateDispatch(next, event);
			break;
		case "artifact_accepted":
			next = updateAcceptedArtifact(next, event);
			break;
		case "verification_recorded":
			next = appendSectionLine(
				next,
				"Verification",
				`- [${event.passed === false ? " " : "x"}] ${event.check}${event.detail ? ` — ${event.detail}` : ""}`,
			);
			if (event.taskId && event.passed !== false && taskHasAcceptedArtifact(next, event.taskId)) {
				next = updateTaskChecked(next, event.taskId, true);
			}
			break;
		case "status_changed":
			next = replaceMetadata(next, event.status, now);
			break;
	}
	return updateBarrier(replaceMetadata(next, undefined, now), event.type);
}

let tempSequence = 0;

/** Atomic file update; AgentSession serializes calls before invoking this helper. */
export async function updateProjectPlanFile(options: ProjectPlanFileUpdateOptions): Promise<void> {
	const target = resolveProjectPlanPath(options.cwd, options.projectPlanPath);
	const root = path.resolve(options.cwd);
	const plansRoot = path.resolve(root, ".omp", "plans");
	const realPlansRoot = await fs.realpath(plansRoot).catch(() => plansRoot);
	const realTarget = await fs.realpath(target).catch(() => target);
	const relative = path.relative(realPlansRoot, realTarget);
	if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
		throw new Error("Project plan update escaped .omp/plans.");
	const current = await fs.readFile(target, "utf8");
	const updated = applyProjectPlanUpdate(current, options.event, options.now);
	const temporary = `${target}.${process.pid}.${Date.now()}.${tempSequence++}.tmp`;
	try {
		await fs.writeFile(temporary, updated, { encoding: "utf8", flag: "wx" });
		try {
			await fs.rename(temporary, target);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== "EEXIST" && code !== "EPERM") throw error;
			await fs.rm(target, { force: true });
			await fs.rename(temporary, target);
		}
	} finally {
		await fs.rm(temporary, { force: true }).catch(() => {});
	}
}
