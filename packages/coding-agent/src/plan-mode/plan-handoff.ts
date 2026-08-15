import { isEnoent } from "@dude1wudv/pi-utils";
import { type LocalProtocolOptions, resolveLocalUrlToPath } from "../internal-urls";
import { resolveProjectPlanPath } from "./state";

/** The session's active plan, resolved for handoff into a subagent's context. */
export interface OverallPlanReference {
	path: string;
	content: string;
}

/** Load an approved project plan, retaining legacy local URL compatibility. */
export async function loadOverallPlanReference(
	planReferencePath: string,
	localProtocolOptions: LocalProtocolOptions,
	cwd: string,
): Promise<OverallPlanReference | undefined> {
	const resolved = planReferencePath.startsWith("local:")
		? resolveLocalUrlToPath(planReferencePath, localProtocolOptions)
		: resolveProjectPlanPath(cwd, planReferencePath);
	let content: string;
	try {
		content = await Bun.file(resolved).text();
	} catch (error) {
		if (isEnoent(error)) return undefined;
		throw error;
	}
	if (!content.trim()) return undefined;
	return { path: planReferencePath, content };
}
