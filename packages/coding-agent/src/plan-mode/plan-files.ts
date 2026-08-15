import * as fs from "node:fs";
import * as path from "node:path";
import { isEnoent } from "@dude1wudv/pi-utils";
import { type LocalProtocolOptions, resolveLocalUrlToPath } from "../internal-urls";
import { normalizeLocalScheme, resolveToCwd } from "../tools/path-utils";

export const PROJECT_PLAN_FILENAME_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9_-]*(?:-\d+)?\.md$/i;

/** Reads a project-relative plan or a legacy local URL. */
export async function readPlanFile(
	planFilePath: string,
	options: { localProtocolOptions: LocalProtocolOptions; cwd: string },
): Promise<string | null> {
	const resolvedPath = planFilePath.startsWith("local:")
		? resolveLocalUrlToPath(normalizeLocalScheme(planFilePath), options.localProtocolOptions)
		: resolveToCwd(planFilePath, options.cwd);
	try {
		return await Bun.file(resolvedPath).text();
	} catch (error) {
		if (isEnoent(error)) return null;
		throw error;
	}
}

/** Lists project canonical plans from newest to oldest. */
export async function listPlanFiles(options: { cwd: string }): Promise<string[]> {
	const plansRoot = path.resolve(options.cwd, ".omp", "plans");
	try {
		const entries = await fs.promises.readdir(plansRoot, { withFileTypes: true });
		const plans = await Promise.all(
			entries
				.filter(entry => entry.isFile() && PROJECT_PLAN_FILENAME_RE.test(entry.name))
				.map(async entry => {
					const stat = await fs.promises.stat(path.join(plansRoot, entry.name)).catch(() => null);
					return { path: `.omp/plans/${entry.name}`, mtime: stat?.mtimeMs ?? 0 };
				}),
		);
		return plans.sort((a, b) => b.mtime - a.mtime).map(plan => plan.path);
	} catch {
		return [];
	}
}
