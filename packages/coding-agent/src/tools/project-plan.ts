import { type } from "@dude1wudv/omptype";
import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@dude1wudv/pi-agent-core";
import type { ProjectPlanUpdateEvent } from "../plan-mode/state";
import type { ToolSession } from ".";
import { ToolError } from "./tool-errors";

const projectPlanSchema = type({
	action: type("'artifact_accepted' | 'verification_recorded' | 'status_changed'").describe(
		"project-plan event to record",
	),
	"taskId?": type("string").describe("stable task ID for an artifact or task-scoped verification"),
	"artifact?": type("string").describe("accepted artifact reference (artifact_accepted)"),
	"check?": type("string").describe("observed verification check (verification_recorded)"),
	"passed?": type("boolean").describe("whether the verification passed"),
	"detail?": type("string").describe("observed verification detail"),
	"status?": type("'planned' | 'executing' | 'blocked' | 'completed'").describe("overall project-plan status"),
	"reason?": type("string").describe("reason for the status change"),
}).narrow((params, ctx) => {
	const nonEmpty = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0;
	if (params.action === "artifact_accepted") {
		return (
			(nonEmpty(params.taskId) && nonEmpty(params.artifact)) ||
			ctx.mustBe('used with non-empty "taskId" and "artifact" for "artifact_accepted"')
		);
	}
	if (params.action === "verification_recorded") {
		return nonEmpty(params.check) || ctx.mustBe('used with a non-empty "check" for "verification_recorded"');
	}
	return params.status !== undefined || ctx.mustBe('used with "status" for "status_changed"');
});

export type ProjectPlanParams = typeof projectPlanSchema.infer;

export interface ProjectPlanToolDetails {
	action: ProjectPlanParams["action"];
}

function requiredText(value: string | undefined, field: string, action: ProjectPlanParams["action"]): string {
	const normalized = typeof value === "string" ? value.trim() : "";
	if (normalized.length === 0) {
		throw new ToolError(`Action "${action}" requires a non-empty "${field}".`);
	}
	return normalized;
}

function optionalText(
	value: string | undefined,
	field: string,
	action: ProjectPlanParams["action"],
): string | undefined {
	if (value === undefined) return undefined;
	return requiredText(value, field, action);
}

function eventFor(params: ProjectPlanParams): ProjectPlanUpdateEvent {
	switch (params.action) {
		case "artifact_accepted":
			return {
				type: "artifact_accepted",
				taskId: requiredText(params.taskId, "taskId", params.action),
				artifact: requiredText(params.artifact, "artifact", params.action),
			};
		case "verification_recorded": {
			const event = {
				type: "verification_recorded" as const,
				check: requiredText(params.check, "check", params.action),
				...(params.taskId === undefined ? {} : { taskId: optionalText(params.taskId, "taskId", params.action) }),
				...(params.passed === undefined ? {} : { passed: params.passed }),
				...(params.detail === undefined ? {} : { detail: params.detail }),
			};
			// `taskId` is part of the verification event contract. The state reducer
			// owns that union, so keep this local construction compatible while the
			// shared event type evolves with the reducer.
			return event as ProjectPlanUpdateEvent;
		}
		case "status_changed": {
			if (
				params.status !== "planned" &&
				params.status !== "executing" &&
				params.status !== "blocked" &&
				params.status !== "completed"
			) {
				throw new ToolError(`Action "${params.action}" requires a valid "status".`);
			}
			return {
				type: "status_changed",
				status: params.status,
				...(params.reason === undefined ? {} : { reason: params.reason }),
			};
		}
	}
}

/** Main-only semantic boundary for durable project-plan acceptance and verification events. */
export class ProjectPlanTool implements AgentTool<typeof projectPlanSchema, ProjectPlanToolDetails> {
	readonly name = "project_plan";
	readonly approval = "write" as const;
	readonly label = "Project Plan";
	readonly summary = "Record an observed project-plan event";
	readonly description =
		"Record an observed project-plan event. Use artifact_accepted only after reading and accepting the artifact, verification_recorded only for a check actually run, and status_changed for the overall plan status.";
	readonly parameters = projectPlanSchema;
	readonly strict = true;
	readonly loadMode = "discoverable" as const;
	readonly intent = (args: Partial<ProjectPlanParams>): string =>
		args.action ? `recording project-plan ${args.action}` : "recording project-plan event";

	constructor(private readonly session: ToolSession) {}

	static createIf(session: ToolSession): ProjectPlanTool | null {
		return session.isMainSession === true ? new ProjectPlanTool(session) : null;
	}

	async execute(
		_toolCallId: string,
		params: ProjectPlanParams,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<ProjectPlanToolDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<ProjectPlanToolDetails>> {
		const event = eventFor(params);
		if (this.session.isMainSession !== true) {
			throw new ToolError("The project_plan tool is available only in the Main session.");
		}
		const projectPlanPath = this.session.getProjectPlanPath?.();
		const updateProjectPlan = this.session.updateProjectPlan;
		if (
			typeof projectPlanPath !== "string" ||
			projectPlanPath.trim().length === 0 ||
			typeof updateProjectPlan !== "function"
		) {
			throw new ToolError("No approved project plan is attached to this session");
		}
		try {
			await updateProjectPlan(event);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new ToolError(`Failed to update the approved project plan: ${message}`);
		}
		return {
			content: [{ type: "text", text: `Recorded project-plan event: ${params.action}.` }],
			details: { action: params.action },
		};
	}
}
