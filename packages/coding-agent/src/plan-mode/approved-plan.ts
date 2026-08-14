import * as fs from "node:fs/promises";
import * as path from "node:path";
import { normalizeLocalScheme } from "../tools/path-utils";
import { ToolError } from "../tools/tool-errors";
import { projectPlanRelativePath, resolveProjectPlanPath } from "./state";

/** Shape forwarded from the plan-proposal handler to InteractiveMode's
 * approval popup. */
export interface PlanApprovalDetails {
	planFilePath: string;
	title: string;
	planExists: boolean;
	/** Set after approval when the project plan was exported successfully. */
	projectPlanPath?: string;
}

/** Validate and normalize the agent-supplied plan title into a safe filename stem. */
export function normalizePlanTitle(title: string): { title: string; fileName: string } {
	const trimmed = title.trim();
	if (!trimmed) throw new ToolError("Plan title is required and must not be empty.");
	if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
		throw new ToolError("Plan title must not contain path separators or '..'.");
	}
	const withoutExt = trimmed.replace(/\.md$/i, "");
	const sanitized = withoutExt
		.replace(/\s+/g, "-")
		.replace(/[^A-Za-z0-9_-]/g, "")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!sanitized) {
		throw new ToolError(
			"Plan title must contain at least one letter, number, underscore, or hyphen after sanitization.",
		);
	}
	return { title: sanitized, fileName: `${sanitized}.md` };
}

/** Best-effort derivation of a plan title from inputs the agent already produced. */
export function resolvePlanTitle(input: { suppliedTitle?: unknown; planContent: string; planFilePath: string }): {
	title: string;
	fileName: string;
	source: "supplied" | "heading" | "filename" | "default";
} {
	const candidates: Array<{ value: string; source: "supplied" | "heading" | "filename" | "default" }> = [];
	if (typeof input.suppliedTitle === "string" && input.suppliedTitle.trim()) {
		candidates.push({ value: input.suppliedTitle.trim(), source: "supplied" });
	}
	const heading = firstLevelOneHeading(input.planContent);
	if (heading) candidates.push({ value: heading, source: "heading" });
	const stem = planFilenameStem(input.planFilePath);
	if (stem) candidates.push({ value: stem, source: "filename" });
	candidates.push({ value: "plan", source: "default" });
	for (const candidate of candidates) {
		try {
			return { ...normalizePlanTitle(candidate.value), source: candidate.source };
		} catch {
			// Fall through to the next candidate.
		}
	}
	return { title: "plan", fileName: "plan.md", source: "default" };
}

function firstLevelOneHeading(planContent: string): string {
	const match = planContent.match(/^[ \t]*#[ \t]+(.+?)[ \t]*$/m);
	return match?.[1]?.trim() ?? "";
}

function planFilenameStem(planFilePath: string): string {
	const withoutScheme = planFilePath.replace(/^local:\/+/, "");
	const lastSegment = withoutScheme.split(/[\\/]/).pop() ?? "";
	return lastSegment.replace(/\.md$/i, "");
}

export function humanizePlanTitle(title: string): string {
	const spaced = title.replace(/[-_]+/g, " ").trim();
	if (!spaced) return "";
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function planFileUrlForSlug(slug: string): string {
	return `local://${slug}-plan.md`;
}

function planSlugFromSupplied(suppliedTitle: unknown): string | undefined {
	if (typeof suppliedTitle !== "string" || !suppliedTitle.trim()) return undefined;
	try {
		const { title } = normalizePlanTitle(suppliedTitle);
		const slug = title.replace(/-plan$/i, "");
		return slug || title;
	} catch {
		return undefined;
	}
}

export interface ResolveApprovedPlanInput {
	suppliedTitle?: unknown;
	statePlanFilePath: string;
	readPlan: (planUrl: string) => Promise<string | null>;
	listPlanFiles?: () => Promise<string[]>;
}

export interface ResolvedApprovedPlan {
	planFilePath: string;
	planContent: string;
	title: string;
}

export async function resolveApprovedPlan(input: ResolveApprovedPlanInput): Promise<ResolvedApprovedPlan> {
	const ordered: string[] = [];
	const consider = (url: string | undefined): void => {
		if (url && !ordered.includes(url)) ordered.push(url);
	};
	const slug = planSlugFromSupplied(input.suppliedTitle);
	consider(slug ? planFileUrlForSlug(slug) : undefined);
	const listed = input.listPlanFiles ? await input.listPlanFiles() : [];
	const canonicalListed = new Set(listed.map(normalizeLocalScheme));
	if (input.statePlanFilePath && !canonicalListed.has(normalizeLocalScheme(input.statePlanFilePath)))
		consider(input.statePlanFilePath);
	for (const url of listed) consider(url);
	consider(input.statePlanFilePath);
	for (const url of ordered) {
		const content = await input.readPlan(url);
		if (content !== null) return finalizeApprovedPlan(url, content, input.suppliedTitle);
	}
	const target = ordered[0] ?? input.statePlanFilePath;
	throw new ToolError(
		`Plan file not found at ${target}. Write the finalized plan to ${target} before requesting approval.`,
	);
}

function finalizeApprovedPlan(planFilePath: string, planContent: string, suppliedTitle: unknown): ResolvedApprovedPlan {
	const { title } = resolvePlanTitle({ suppliedTitle, planContent, planFilePath });
	return { planFilePath, planContent, title };
}

export interface ExportApprovedProjectPlanInput {
	cwd: string;
	planContent: string;
	title: string;
	/** Existing metadata path; when supplied, this file is updated rather than a new plan created. */
	existingProjectPlanPath?: string;
	now?: Date;
}

export interface ExportApprovedProjectPlanResult {
	projectPlanPath: string;
	absolutePath: string;
	planId: string;
	createdDate: string;
}

function localDate(now: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function localDateTime(now: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	const offset = -now.getTimezoneOffset();
	const sign = offset >= 0 ? "+" : "-";
	const absolute = Math.abs(offset);
	return `${localDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())} UTC${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function projectSlug(title: string): string {
	const normalized = normalizePlanTitle(title)
		.title.replace(/_/g, "-")
		.replace(/-plan$/i, "");
	return (normalized || "plan").toLowerCase();
}

function initialProjectPlan(content: string, title: string, planId: string, projectPath: string, now: Date): string {
	const body = content.trimEnd();
	const metadata = [
		`> Status: executing`,
		`> Created: ${localDate(now)}`,
		`> Updated: ${localDateTime(now)}`,
		`> Plan ID: ${planId}`,
		`> Project plan: ${projectPath}`,
	].join("\n");
	const dynamic = [
		"## Task breakdown",
		"",
		"## Agent dispatch log",
		"| Round | Agent | Scope | Status | Artifact | Follow-up |",
		"| --- | --- | --- | --- | --- | --- |",
		"",
		"## Result barrier",
		"- Expected terminal items: 0",
		"- Settled: 0",
		`- WAIT_ALL: active`,
		`- Wake policy: \`batch-gated\``,
		`- Wake interval: \`20m\`; next wake: pending`,
		`- Last wake reason: timer`,
		`- Last barrier decision: not started`,
		"",
		"## Verification",
		"",
		"## Assumptions",
		"",
	].join("\n");
	const heading = /^#[ \t]+/m.test(body) ? body : `# ${title}\n\n${body}`;
	return `${heading}\n\n${metadata}\n\n${dynamic}`;
}

async function assertProjectRoot(cwd: string, plansRoot: string): Promise<void> {
	const root = await fs.realpath(path.resolve(cwd));
	const realPlansRoot = await fs.realpath(plansRoot).catch(() => plansRoot);
	const relative = path.relative(root, realPlansRoot);
	if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
		throw new Error("Project plan directory escaped the current project root.");
}

/** Export an approved local plan into cwd/.omp/plans without overwriting a plan. */
export async function exportApprovedProjectPlan(
	input: ExportApprovedProjectPlanInput,
): Promise<ExportApprovedProjectPlanResult> {
	const now = input.now ?? new Date();
	const slug = projectSlug(input.title);
	const date = localDate(now);
	const root = path.resolve(input.cwd);
	const plansRoot = path.resolve(root, ".omp", "plans");
	await fs.mkdir(plansRoot, { recursive: true });
	await assertProjectRoot(root, plansRoot);

	if (input.existingProjectPlanPath) {
		const absolutePath = resolveProjectPlanPath(root, input.existingProjectPlanPath);
		const existing = await fs.readFile(absolutePath, "utf8");
		const metadata = existing
			.replace(/^> Updated: .*$/m, `> Updated: ${localDateTime(now)}`)
			.replace(/^> Status: .*$/m, "> Status: executing");
		const merged = `${metadata.trimEnd()}\n\n${input.planContent.trimEnd()}\n`;
		await fs.writeFile(absolutePath, merged, { encoding: "utf8" });
		return {
			projectPlanPath: projectPlanRelativePath(root, absolutePath),
			absolutePath,
			planId: slug,
			createdDate: date,
		};
	}

	for (let suffix = 1; ; suffix += 1) {
		const fileName = `${date}-${slug}${suffix === 1 ? "" : `-${suffix}`}.md`;
		const absolutePath = resolveProjectPlanPath(root, path.posix.join(".omp/plans", fileName));
		const projectPath = projectPlanRelativePath(root, absolutePath);
		const document = initialProjectPlan(input.planContent, input.title, slug, projectPath, now);
		try {
			await fs.writeFile(absolutePath, document, { encoding: "utf8", flag: "wx" });
			return { projectPlanPath: projectPath, absolutePath, planId: slug, createdDate: date };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
			throw error;
		}
	}
}
