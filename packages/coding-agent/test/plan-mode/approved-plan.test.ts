import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	humanizePlanTitle,
	migrateLegacyPlan,
	normalizePlanTitle,
	planFileUrlForSlug,
	projectPlanPathForTitle,
	resolveApprovedPlan,
	resolvePlanTitle,
} from "@dude1wudv/pi-coding-agent/plan-mode/approved-plan";

describe("plan path construction", () => {
	it("builds a stable date-prefixed project path", () => {
		expect(projectPlanPathForTitle("/repo", "Auth Refactor Plan", "2026-08-15")).toBe(
			".omp/plans/2026-08-15-auth-refactor.md",
		);
	});

	it("retains the legacy URL formatter only for old session recovery", () => {
		expect(planFileUrlForSlug("auth-refactor")).toBe("local://auth-refactor-plan.md");
	});
});

describe("resolveApprovedPlan", () => {
	const cwd = "/repo";
	const reader = (files: Record<string, string>) => async (planPath: string) => files[planPath] ?? null;

	it("resolves the supplied title to the fixed project creation date", async () => {
		const projectPath = ".omp/plans/2026-08-15-auth-refactor.md";
		const result = await resolveApprovedPlan({
			suppliedTitle: "auth-refactor",
			statePlanFilePath: ".omp/plans/2026-08-15-plan.md",
			createdDate: "2026-08-15",
			cwd,
			readPlan: reader({ [projectPath]: "# Auth refactor\n\nbody" }),
		});
		expect(result.planFilePath).toBe(projectPath);
		expect(result.title).toBe("auth-refactor");
	});

	it("falls back to the fixed state path before scanned plans", async () => {
		const statePath = ".omp/plans/2026-08-15-current.md";
		const result = await resolveApprovedPlan({
			statePlanFilePath: statePath,
			cwd,
			readPlan: reader({
				[statePath]: "# Current\n\nCurrent plan",
				".omp/plans/2026-08-15-newer.md": "# Newer\n\nNewer plan",
			}),
			listPlanFiles: async () => [".omp/plans/2026-08-15-newer.md"],
		});
		expect(result.planFilePath).toBe(statePath);
	});

	it("scans project plans when the placeholder is absent", async () => {
		const discovered = ".omp/plans/2026-08-15-discovered.md";
		const result = await resolveApprovedPlan({
			statePlanFilePath: ".omp/plans/2026-08-15-plan.md",
			cwd,
			readPlan: reader({ [discovered]: "# Discovered\n\nbody" }),
			listPlanFiles: async () => [discovered],
		});
		expect(result.planFilePath).toBe(discovered);
	});

	it("still reads a legacy local state path for migration", async () => {
		const result = await resolveApprovedPlan({
			statePlanFilePath: "local://legacy-plan.md",
			cwd,
			readPlan: reader({ "local://legacy-plan.md": "# Legacy\n\nbody" }),
		});
		expect(result.planFilePath).toBe("local://legacy-plan.md");
	});

	it("throws an actionable project-path error when no plan exists", async () => {
		await expect(
			resolveApprovedPlan({
				suppliedTitle: "ghost",
				statePlanFilePath: ".omp/plans/2026-08-15-plan.md",
				createdDate: "2026-08-15",
				cwd,
				readPlan: reader({}),
			}),
		).rejects.toThrow("Plan file not found at .omp/plans/2026-08-15-ghost.md");
	});
});

describe("migrateLegacyPlan", () => {
	it("copies legacy content exclusively and suffixes conflicts", async () => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "omp-plan-migrate-"));
		try {
			const first = await migrateLegacyPlan({
				cwd,
				legacyPath: "local://legacy-plan.md",
				content: "# Legacy\n\nBody",
				title: "legacy-plan",
				createdDate: "2026-08-15",
			});
			const second = await migrateLegacyPlan({
				cwd,
				legacyPath: "local://legacy-plan.md",
				content: "# Legacy\n\nBody",
				title: "legacy-plan",
				createdDate: "2026-08-15",
			});
			expect(first.projectPlanPath).toBe(".omp/plans/2026-08-15-legacy.md");
			expect(second.projectPlanPath).toBe(".omp/plans/2026-08-15-legacy-2.md");
			expect(await fs.readFile(first.absolutePath, "utf8")).toContain("> Status: planned");
		} finally {
			await fs.rm(cwd, { recursive: true, force: true });
		}
	});
});

describe("humanizePlanTitle", () => {
	it("replaces separators with spaces and capitalizes", () => {
		expect(humanizePlanTitle("migrate-mcp-loader")).toBe("Migrate mcp loader");
		expect(humanizePlanTitle("fix_session_naming")).toBe("Fix session naming");
		expect(humanizePlanTitle("RefactorRouter")).toBe("RefactorRouter");
	});

	it("collapses runs of separators", () => {
		expect(humanizePlanTitle("foo--bar__baz")).toBe("Foo bar baz");
	});

	it("returns empty string for blank-ish input", () => {
		expect(humanizePlanTitle("")).toBe("");
		expect(humanizePlanTitle("---")).toBe("");
	});
});

describe("normalizePlanTitle", () => {
	it("accepts a clean identifier as-is", () => {
		expect(normalizePlanTitle("my-plan")).toEqual({ title: "my-plan", fileName: "my-plan.md" });
		expect(normalizePlanTitle("feature_branch")).toEqual({ title: "feature_branch", fileName: "feature_branch.md" });
	});

	it("strips a trailing .md suffix provided by the model", () => {
		expect(normalizePlanTitle("my-plan.md")).toEqual({ title: "my-plan", fileName: "my-plan.md" });
	});

	it("converts spaces to hyphens (natural-language titles)", () => {
		expect(normalizePlanTitle("My Improvement Plan")).toEqual({
			title: "My-Improvement-Plan",
			fileName: "My-Improvement-Plan.md",
		});
	});

	it("collapses consecutive spaces / resulting hyphens", () => {
		expect(normalizePlanTitle("foo  bar")).toEqual({ title: "foo-bar", fileName: "foo-bar.md" });
	});

	it("drops characters outside the allowed set after space replacement", () => {
		expect(normalizePlanTitle("plan: v1.0 (draft)")).toEqual({
			title: "plan-v10-draft",
			fileName: "plan-v10-draft.md",
		});
	});

	it("trims leading/trailing hyphens that result from sanitization", () => {
		expect(normalizePlanTitle("!!! plan !!!")).toEqual({ title: "plan", fileName: "plan.md" });
	});

	it("throws for empty title", () => {
		expect(() => normalizePlanTitle("")).toThrow("Plan title is required");
		expect(() => normalizePlanTitle("   ")).toThrow("Plan title is required");
	});

	it("throws for path separators", () => {
		expect(() => normalizePlanTitle("../etc/passwd")).toThrow("path separators");
		expect(() => normalizePlanTitle("a/b")).toThrow("path separators");
	});

	it("throws when sanitization produces empty result", () => {
		expect(() => normalizePlanTitle("!!!")).toThrow("at least one letter");
	});
});

describe("resolvePlanTitle", () => {
	const planContent = "# Code Review: nettools — Updated Issues\n\nbody...\n";
	const planFilePath = "local://PLAN.md";

	it("uses a string `suppliedTitle` when present", () => {
		const result = resolvePlanTitle({ suppliedTitle: "my-plan", planContent, planFilePath });
		expect(result).toEqual({ title: "my-plan", fileName: "my-plan.md", source: "supplied" });
	});

	it("falls back to the plan's first H1 when the model emits a non-string title (issue #1179)", () => {
		const result = resolvePlanTitle({ suppliedTitle: {}, planContent, planFilePath });
		// "Code Review: nettools — Updated Issues" → sanitized
		expect(result.source).toBe("heading");
		expect(result.title).toBe("Code-Review-nettools-Updated-Issues");
		expect(result.fileName).toBe("Code-Review-nettools-Updated-Issues.md");
	});

	it("falls back to the H1 when `suppliedTitle` is missing entirely", () => {
		const result = resolvePlanTitle({ planContent, planFilePath });
		expect(result.source).toBe("heading");
	});

	it("falls back to the H1 when `suppliedTitle` is an empty / whitespace string", () => {
		expect(resolvePlanTitle({ suppliedTitle: "", planContent, planFilePath }).source).toBe("heading");
		expect(resolvePlanTitle({ suppliedTitle: "   ", planContent, planFilePath }).source).toBe("heading");
	});

	it("falls back to the plan filename stem when no usable H1 exists", () => {
		const result = resolvePlanTitle({ planContent: "body only, no heading\n", planFilePath });
		expect(result).toEqual({ title: "PLAN", fileName: "PLAN.md", source: "filename" });
	});

	it("falls back through to the literal `plan` when every candidate sanitizes to empty", () => {
		const result = resolvePlanTitle({
			suppliedTitle: "!!!",
			planContent: "# !!!\n",
			planFilePath: "local://!!!.md",
		});
		expect(result).toEqual({ title: "plan", fileName: "plan.md", source: "default" });
	});

	it("skips a `suppliedTitle` that contains path separators and uses the next candidate", () => {
		const result = resolvePlanTitle({
			suppliedTitle: "../etc/passwd",
			planContent,
			planFilePath,
		});
		expect(result.source).toBe("heading");
	});

	it("picks the first H1 line, not the first heading of any level", () => {
		const result = resolvePlanTitle({
			planContent: "## Subheading first\n\n# Real Title\n",
			planFilePath,
		});
		expect(result.title).toBe("Real-Title");
	});
});
