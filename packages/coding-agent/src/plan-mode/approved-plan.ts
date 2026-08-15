import * as fs from "node:fs/promises";
import * as path from "node:path";
import { normalizeLocalScheme } from "../tools/path-utils";
import { ToolError } from "../tools/tool-errors";
import { PROJECT_PLAN_FILENAME_RE } from "./plan-files";
import { projectPlanRelativePath, resolveProjectPlanPath } from "./state";

export interface PlanApprovalDetails {
	planFilePath: string;
	title: string;
	planExists: boolean;
	projectPlanPath?: string;
}

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

export function resolvePlanTitle(input: { suppliedTitle?: unknown; planContent: string; planFilePath: string }): {
	title: string;
	fileName: string;
	source: "supplied" | "heading" | "filename" | "default";
} {
	const candidates: Array<{ value: string; source: "supplied" | "heading" | "filename" | "default" }> = [];
	if (typeof input.suppliedTitle === "string" && input.suppliedTitle.trim())
		candidates.push({ value: input.suppliedTitle.trim(), source: "supplied" });
	const heading = input.planContent.match(/^[ \t]*#[ \t]+(.+?)[ \t]*$/m)?.[1]?.trim() ?? "";
	if (heading) candidates.push({ value: heading, source: "heading" });
	const filename =
		input.planFilePath
			.replace(/^local:\/+/i, "")
			.split(/[\\/]/)
			.pop() ?? "";
	const stem = filename
		.replace(/^\d{4}-\d{2}-\d{2}-/, "")
		.replace(/\.md$/i, "")
		.replace(/-\d+$/, "");
	if (stem) candidates.push({ value: stem, source: "filename" });
	candidates.push({ value: "plan", source: "default" });
	for (const candidate of candidates) {
		try {
			return { ...normalizePlanTitle(candidate.value), source: candidate.source };
		} catch {
			/* try next source */
		}
	}
	return { title: "plan", fileName: "plan.md", source: "default" };
}

export function humanizePlanTitle(title: string): string {
	const spaced = title.replace(/[-_]+/g, " ").trim();
	return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "";
}

function localDate(now: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function projectPlanPathForTitle(cwd: string, title: string, createdDate = localDate(new Date())): string {
	const slug =
		normalizePlanTitle(title)
			.title.replace(/_/g, "-")
			.replace(/-plan$/i, "")
			.toLowerCase() || "plan";
	return path.posix.join(".omp/plans", `${createdDate}-${slug}.md`);
}

export interface ResolveApprovedPlanInput {
	suppliedTitle?: unknown;
	statePlanFilePath: string;
	cwd: string;
	createdDate?: string;
	readPlan: (planPath: string) => Promise<string | null>;
	listPlanFiles?: () => Promise<string[]>;
}

export interface ResolvedApprovedPlan {
	planFilePath: string;
	planContent: string;
	title: string;
}

/** Legacy filename formatter retained only for reading old session plans. */
export function planFileUrlForSlug(slug: string): string {
	return `local://${slug}-plan.md`;
}

export async function resolveApprovedPlan(input: ResolveApprovedPlanInput): Promise<ResolvedApprovedPlan> {
	const ordered: string[] = [];
	const consider = (candidate: string | undefined): void => {
		if (candidate && !ordered.includes(candidate)) ordered.push(candidate);
	};
	const title =
		typeof input.suppliedTitle === "string" && input.suppliedTitle.trim()
			? normalizePlanTitle(input.suppliedTitle).title
			: undefined;
	if (title) consider(projectPlanPathForTitle(input.cwd, title, input.createdDate));
	consider(input.statePlanFilePath);
	for (const candidate of input.listPlanFiles ? await input.listPlanFiles() : []) consider(candidate);
	for (const candidate of ordered) {
		const content = await input.readPlan(candidate);
		if (content !== null && content.trim()) return finalizeApprovedPlan(candidate, content, input.suppliedTitle);
	}
	throw new ToolError(
		`Plan file not found at ${ordered[0] ?? input.statePlanFilePath}. Write the finalized plan to a project .omp/plans/YYYY-MM-DD-<slug>.md file before requesting approval.`,
	);
}

function finalizeApprovedPlan(planFilePath: string, planContent: string, suppliedTitle: unknown): ResolvedApprovedPlan {
	return { planFilePath, planContent, title: resolvePlanTitle({ suppliedTitle, planContent, planFilePath }).title };
}

function localDateTime(now: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	const offset = -now.getTimezoneOffset();
	const sign = offset >= 0 ? "+" : "-";
	return `${localDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())} UTC${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

function initialProjectMetadata(
	content: string,
	title: string,
	planId: string,
	projectPath: string,
	now: Date,
): string {
	const body = content.trimEnd();
	const heading = /^#[ \t]+/m.test(body) ? body : `# ${title}\n\n${body}`;
	return `${heading}\n\n> Status: planned\n> Created: ${localDate(now)}\n> Updated: ${localDateTime(now)}\n> Plan ID: ${planId}\n> Project plan: ${projectPath}\n`;
}

/** Copy a legacy local plan exactly once into an exclusive project canonical file. */
export async function migrateLegacyPlan(input: {
	cwd: string;
	legacyPath: string;
	content: string;
	title: string;
	createdDate?: string;
}): Promise<{ projectPlanPath: string; absolutePath: string }> {
	const root = path.resolve(input.cwd);
	const plansRoot = path.resolve(root, ".omp", "plans");
	await fs.mkdir(plansRoot, { recursive: true });
	const date = input.createdDate ?? localDate(new Date());
	const slug =
		normalizePlanTitle(input.title)
			.title.replace(/_/g, "-")
			.replace(/-plan$/i, "")
			.toLowerCase() || "plan";
	for (let suffix = 1; ; suffix += 1) {
		const name = `${date}-${slug}${suffix === 1 ? "" : `-${suffix}`}.md`;
		if (!PROJECT_PLAN_FILENAME_RE.test(name)) throw new Error(`Invalid project plan filename: ${name}`);
		const absolutePath = resolveProjectPlanPath(root, path.posix.join(".omp/plans", name));
		const projectPlanPath = projectPlanRelativePath(root, absolutePath);
		try {
			await fs.writeFile(
				absolutePath,
				initialProjectMetadata(input.content, input.title, slug, projectPlanPath, new Date()),
				{ encoding: "utf8", flag: "wx" },
			);
			return { projectPlanPath, absolutePath };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
			throw error;
		}
	}
}
