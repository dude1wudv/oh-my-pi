import { getReadToolPath, type ProtectedToolContext } from "@dude1wudv/pi-agent-core/compaction/tool-protection";
import { normalizeLocalScheme } from "../tools/path-utils";

/** Legacy alias retained so restored pre-migration reads stay protected. */
const LOCAL_PLAN_ALIAS = "local://PLAN.md";

/** True when `readPath` targets `planTarget`, ignoring `local:/` vs `local://`
 *  scheme spelling and any trailing read selector (`:1-50`, `:raw`, …). */
function readTargetsPlan(readPath: string, planTarget: string): boolean {
	const read = normalizeLocalScheme(readPath);
	const target = normalizeLocalScheme(planTarget);
	return read === target || read.startsWith(`${target}:`);
}

/**
 * Build a compaction protection matcher that keeps `read` results for the active
 * plan file intact through prune/shake. Matches the active project-relative
 * canonical path and the legacy local alias used by restored sessions.
 *
 * `getPlanReferencePath` is evaluated at match time so the plan path set on
 * approval is honored immediately.
 */
export function createPlanReadMatcher(getPlanReferencePath: () => string): (context: ProtectedToolContext) => boolean {
	return (context: ProtectedToolContext) => {
		const path = getReadToolPath(context);
		if (path === undefined) return false;
		return readTargetsPlan(path, LOCAL_PLAN_ALIAS) || readTargetsPlan(path, getPlanReferencePath());
	};
}
