/**
 * Owner-routed async job delivery: formatting and batch-message assembly for
 * `async-result` follow-ups.
 *
 * Each {@link AgentSession} registers a delivery sink for its own agent id
 * (`AsyncJobManager.registerDeliverySink`) and enqueues formatted entries on
 * its yield queue; the queue's idle flush injects them as a follow-up turn.
 * This replaces the old single hardwired `onJobComplete` closure that routed
 * every completion — regardless of owner — into the first top-level session.
 */
import { prompt } from "@dude1wudv/pi-utils";
import type { AsyncBatchSnapshot, AsyncJob, AsyncJobType } from "../async";
import asyncBatchResultTemplate from "../prompts/tools/async-batch-result.md" with { type: "text" };
import asyncResultTemplate from "../prompts/tools/async-result.md" with { type: "text" };
import type { CustomMessage } from "./messages";

/**
 * `customType` of the injected async-result follow-up message. The task
 * executor's run monitor matches on it to invalidate a previously recorded
 * yield: a result injected after the yield supersedes that yield's payload.
 */
export const ASYNC_RESULT_MESSAGE_TYPE = "async-result";
export const ASYNC_BATCH_RESULT_MESSAGE_TYPE = "async-batch-result";

/** Result payloads longer than this spill to an artifact with an inline preview. */
export const ASYNC_INLINE_RESULT_MAX_CHARS = 12_000;
export const ASYNC_PREVIEW_MAX_CHARS = 4_000;

export interface AsyncResultEntry {
	jobId: string;
	result: string;
	job: AsyncJob | undefined;
	durationMs: number | undefined;
	/**
	 * Owning session's async-delivery generation at enqueue time. A session
	 * transition (`/new`, switch, handoff) bumps the generation, so an entry
	 * whose generation no longer matches belongs to a replaced transcript and
	 * is dropped at flush — even after its job id has been reused, which clears
	 * the manager's per-id suppression marker.
	 */
	epoch: number;
}

export interface AsyncBatchResultEntry {
	snapshot: AsyncBatchSnapshot;
	epoch: number;
}

export type AsyncBatchResultDetails = {
	snapshots: AsyncBatchSnapshot[];
};

type AsyncResultJobDetails = {
	jobId: string;
	type?: AsyncJobType;
	label?: string;
	durationMs?: number;
};

export type AsyncResultDetails = {
	jobs: AsyncResultJobDetails[];
};

export function buildAsyncResultBatchMessage(entries: AsyncResultEntry[]): CustomMessage<AsyncResultDetails> | null {
	if (entries.length === 0) return null;
	const jobs = entries.map(entry => ({
		jobId: entry.jobId,
		result: entry.result,
		type: entry.job?.type,
		label: entry.job?.label,
		durationMs: entry.durationMs,
	}));
	const details: AsyncResultDetails = {
		jobs: jobs.map(job => ({
			jobId: job.jobId,
			type: job.type,
			label: job.label,
			durationMs: job.durationMs,
		})),
	};
	return {
		role: "custom",
		customType: ASYNC_RESULT_MESSAGE_TYPE,
		content: prompt.render(asyncResultTemplate, {
			multiple: jobs.length > 1,
			jobs,
		}),
		display: true,
		attribution: "agent",
		details,
		timestamp: Date.now(),
	};
}

export function buildAsyncBatchResultMessage(
	entries: AsyncBatchResultEntry[],
): CustomMessage<AsyncBatchResultDetails> | null {
	if (entries.length === 0) return null;
	const unique = new Map<string, AsyncBatchSnapshot>();
	for (const entry of entries) {
		const snapshot = entry.snapshot;
		unique.set(`${snapshot.gateId}:${snapshot.generation}`, snapshot);
	}
	const snapshots = [...unique.values()];
	const wakes = snapshots.map(snapshot => {
		const failed = snapshot.jobs.filter(job => job.status === "failed");
		const formatJob = (job: AsyncBatchSnapshot["jobs"][number]): string => {
			const detail = job.status === "failed" ? job.errorText : job.resultText;
			return `- ${job.id}${job.label ? ` (${job.label})` : ""}: ${job.status}${detail ? ` — ${detail}` : ""}`;
		};
		return {
			gateId: snapshot.gateId,
			generation: snapshot.generation,
			reason: snapshot.reason,
			timer: snapshot.reason === "timer",
			firstError: snapshot.reason === "first-error",
			allSettled: snapshot.reason === "all-settled",
			failed: failed.map(formatJob).join("\n"),
			pending: snapshot.pending.map(formatJob).join("\n"),
			jobs: snapshot.jobs.map(formatJob).join("\n"),
		};
	});
	return {
		role: "custom",
		customType: ASYNC_BATCH_RESULT_MESSAGE_TYPE,
		content: prompt.render(asyncBatchResultTemplate, { wakes }),
		display: true,
		attribution: "agent",
		details: { snapshots },
		timestamp: Date.now(),
	};
}
