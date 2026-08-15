/**
 * Owner-routed async delivery + quiescence (structured concurrency for
 * background jobs): each AgentSession registers a delivery sink for its own
 * agent id, owned job completions inject async-result follow-up turns into
 * THAT session, and `hasPendingAsyncWork()` / `settleAsyncWork()` define the
 * run quiescence the task executor's barrier is built on.
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import { type } from "@dude1wudv/omptype";
import { Agent, type AgentTool } from "@dude1wudv/pi-agent-core";
import { createMockModel } from "@dude1wudv/pi-ai/providers/mock";
import { getBundledModel } from "@dude1wudv/pi-catalog/models";
import { type AsyncBatchSnapshot, AsyncJobManager } from "@dude1wudv/pi-coding-agent/async";
import { ModelRegistry } from "@dude1wudv/pi-coding-agent/config/model-registry";
import { Settings } from "@dude1wudv/pi-coding-agent/config/settings";
import type { DaemonCompletionNotification } from "@dude1wudv/pi-coding-agent/launch/protocol";
import { AgentSession } from "@dude1wudv/pi-coding-agent/session/agent-session";
import {
	ASYNC_BATCH_RESULT_MESSAGE_TYPE,
	type AsyncResultEntry,
	buildAsyncBatchResultMessage,
} from "@dude1wudv/pi-coding-agent/session/async-job-delivery";
import { AuthStorage } from "@dude1wudv/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@dude1wudv/pi-coding-agent/session/messages";
import { SessionManager } from "@dude1wudv/pi-coding-agent/session/session-manager";

describe("AgentSession owner-routed async delivery", () => {
	let session: AgentSession;
	const authStorages: AuthStorage[] = [];

	afterEach(async () => {
		vi.useRealTimers();
		if (session) {
			await session.dispose();
		}
		for (const authStorage of authStorages.splice(0)) {
			authStorage.close();
		}
		AsyncJobManager.resetForTests();
	});

	it("injects an owned completion as a follow-up turn and reaches quiescence", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);

		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "SubAgent",
			asyncJobManager: manager,
		});

		const gate = Promise.withResolvers<string>();
		manager.register("bash", "gated job", () => gate.promise, { id: "sub-job", ownerId: "SubAgent" });

		// A running owned job holds the session out of quiescence.
		expect(session.hasPendingAsyncWork()).toBe(true);

		gate.resolve("job finished: ALL GREEN");
		await session.settleAsyncWork();

		// The completion routed to THIS session (not a global default sink) and
		// ran as a follow-up turn whose context carries the job result.
		expect(session.hasPendingAsyncWork()).toBe(false);
		const sawResult = mock.calls.some(call =>
			call.context.messages.some(message => {
				if (typeof message.content === "string") {
					return message.content.includes("ALL GREEN");
				}
				return (
					Array.isArray(message.content) &&
					message.content.some(content => content.type === "text" && content.text.includes("ALL GREEN"))
				);
			}),
		);
		expect(sawResult).toBe(true);
	});

	it("routes an advisor-owned launch completion through the session", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const sessionManager = SessionManager.inMemory();
		const owner = `${sessionManager.getSessionId()}-advisor`;
		session = new AgentSession({
			agent,
			sessionManager,
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
		});
		const completion = {
			event: "daemon-completed",
			completionId: "advisor-completion",
			owner,
			daemon: {
				name: "advisor-worker",
				id: "daemon-id",
				state: "exited",
				createdAt: 1,
				startedAt: 1,
				exitedAt: 2,
				exitCode: 0,
				restartCount: 0,
				outputBytes: 0,
				owner,
				persist: false,
				detached: false,
			},
		} satisfies DaemonCompletionNotification;

		await session.queueLaunchCompletion(completion);
		await session.waitForIdle();

		expect(
			mock.calls.some(call =>
				call.context.messages.some(message =>
					typeof message.content === "string"
						? message.content.includes("advisor-worker")
						: message.content.some(content => content.type === "text" && content.text.includes("advisor-worker")),
				),
			),
		).toBe(true);
	});

	it("purges finished owned jobs when starting a new session", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const manager = new AsyncJobManager({ retentionMs: 60_000 });
		AsyncJobManager.setInstance(manager);

		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "Main",
			ownedAsyncJobManager: manager,
		});

		const completedJobId = manager.register("task", "prior session", async () => "done", {
			id: "prior-session-job",
			ownerId: "Main",
		});
		const failedJobId = manager.register(
			"task",
			"failed prior session",
			async () => {
				throw new Error("prior session failure");
			},
			{
				id: "failed-prior-session-job",
				ownerId: "Main",
			},
		);
		const otherOwnerJobId = manager.register("task", "other session", async () => "done", {
			id: "other-session-job",
			ownerId: "Other",
		});
		manager.watchJobs([completedJobId, failedJobId, otherOwnerJobId]);
		await manager.waitForAll();

		expect(manager.getJob(completedJobId)?.status).toBe("completed");
		expect(manager.getJob(failedJobId)?.status).toBe("failed");
		expect(await session.newSession()).toBe(true);
		expect(manager.getJob(completedJobId)).toBeUndefined();
		expect(manager.getJob(failedJobId)).toBeUndefined();
		expect(manager.getJob(otherOwnerJobId)?.status).toBe("completed");
	});

	it("does not inject a prior session's pending async result after a new session", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const manager = new AsyncJobManager({ retentionMs: 60_000 });
		AsyncJobManager.setInstance(manager);

		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "Main",
			ownedAsyncJobManager: manager,
		});

		// Complete a job and push its result all the way onto the yield queue, so a
		// follow-up turn is pending injection into the (soon-to-be-replaced) session.
		manager.register("task", "prior session", async () => "STALE ASYNC RESULT", {
			id: "prior-session-job",
			ownerId: "Main",
		});
		await manager.waitForOwnerJobs("Main");
		await manager.drainDeliveries({ filter: { ownerId: "Main" } });
		expect(session.hasPendingAsyncWork()).toBe(true);

		expect(await session.newSession()).toBe(true);
		expect(session.hasPendingAsyncWork()).toBe(false);

		// A fresh turn in the replacement session must not carry the prior result.
		const callsBefore = mock.calls.length;
		await session.sendUserMessage("fresh turn");
		const leaked = mock.calls.slice(callsBefore).some(call =>
			call.context.messages.some(message => {
				if (typeof message.content === "string") return message.content.includes("STALE ASYNC RESULT");
				return (
					Array.isArray(message.content) &&
					message.content.some(content => content.type === "text" && content.text.includes("STALE ASYNC RESULT"))
				);
			}),
		);
		expect(leaked).toBe(false);
	});

	it("drops a prior session's late delivery even after its job id is reused", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const manager = new AsyncJobManager({ retentionMs: 60_000 });
		AsyncJobManager.setInstance(manager);

		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "Main",
			ownedAsyncJobManager: manager,
		});

		// The delivery generation starts at 0; a new session bumps it to 1.
		expect(await session.newSession()).toBe(true);

		// Simulate a delivery that finished formatting in the prior session (epoch
		// 0) but only reaches the yield queue after the transition — the exact
		// window a reused job id would reopen by clearing the manager's per-id
		// suppression marker. It must not inject into the replacement transcript.
		session.yieldQueue.enqueue<AsyncResultEntry>("async-result", {
			jobId: "bg_1",
			result: "STALE ASYNC RESULT",
			job: undefined,
			durationMs: 0,
			epoch: 0,
		});

		const callsBefore = mock.calls.length;
		await session.sendUserMessage("fresh turn");
		await session.settleAsyncWork();
		const leaked = mock.calls.slice(callsBefore).some(call =>
			call.context.messages.some(message => {
				if (typeof message.content === "string") return message.content.includes("STALE ASYNC RESULT");
				return (
					Array.isArray(message.content) &&
					message.content.some(content => content.type === "text" && content.text.includes("STALE ASYNC RESULT"))
				);
			}),
		);
		expect(leaked).toBe(false);
		// The stale entry was consumed by the run's aside/flush path and dropped,
		// not left lingering as pending work.
		expect(session.hasPendingAsyncWork()).toBe(false);
	});

	it("still reports pending async work while a delivered result awaits injection", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);

		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "SubAgent",
			asyncJobManager: manager,
		});

		const gate = Promise.withResolvers<string>();
		manager.register("bash", "gated job", () => gate.promise, { id: "sub-job", ownerId: "SubAgent" });
		gate.resolve("job finished: QUEUED RESULT");
		await manager.waitForOwnerJobs("SubAgent");
		await manager.drainDeliveries({ filter: { ownerId: "SubAgent" } });

		// The manager has fully handed off — no running jobs, no queued or
		// in-flight deliveries — but the async-result follow-up still sits on
		// the session's yield queue awaiting the (delayed) idle flush / next
		// step boundary. A terminal yield observed in this window MUST still
		// count as pending async work, or the run driver terminates and the
		// delivered result is silently dropped from the final report.
		expect(session.hasPendingAsyncWork()).toBe(true);

		// Settling drains the queued follow-up into a real turn and only then
		// reaches quiescence.
		await session.settleAsyncWork();
		expect(session.hasPendingAsyncWork()).toBe(false);
	});

	it("keeps the event loop live until a delayed idle flush runs", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);

		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "SubAgent",
			asyncJobManager: manager,
		});

		let flushed = false;
		session.yieldQueue.register("keepalive-probe", {
			isStale: () => {
				flushed = true;
				return true;
			},
			build: () => null,
		});
		vi.useFakeTimers();
		const baselineTimers = vi.getTimerCount();
		session.yieldQueue.enqueue("keepalive-probe", {});

		// The 1ms flush timer and a keepalive must both remain armed until the
		// flush runs. Without the keepalive, Bun can park here until unrelated
		// TTY I/O wakes the loop.
		expect(vi.getTimerCount()).toBeGreaterThanOrEqual(baselineTimers + 2);

		vi.advanceTimersByTime(1);
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(flushed).toBe(true);
		expect(vi.getTimerCount()).toBe(baselineTimers + 1);
	});

	it("resumes only on an aggregate batch message after all children settle", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "Main",
			agentKind: "main",
			asyncJobManager: manager,
		});

		const release = Promise.withResolvers<void>();
		const batchGate = manager.createBatchGate({ ownerId: "Main", wakeInterval: "off" });
		manager.register("task", "first", async () => "first done", {
			ownerId: "Main",
			batchGate,
		});
		manager.register(
			"task",
			"second",
			async () => {
				await release.promise;
				return "second done";
			},
			{ ownerId: "Main", batchGate },
		);

		await Promise.resolve();
		await Promise.resolve();
		expect(mock.calls).toHaveLength(0);
		release.resolve();
		await session.settleAsyncWork();

		expect(mock.calls).toHaveLength(1);
		const injected = session.messages.find(
			message => message.role === "custom" && message.customType === ASYNC_BATCH_RESULT_MESSAGE_TYPE,
		);
		expect(injected).toBeDefined();
		if (injected?.role !== "custom") throw new Error("Expected async batch custom message");
		expect(injected.content).toContain("Every child is terminal");
	});

	it("parks Main after a task-only async response without another provider call", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({
			responses: [
				{
					content: [
						{ type: "toolCall", id: "task-1", name: "task", arguments: {} },
						{ type: "toolCall", id: "task-2", name: "task", arguments: {} },
					],
				},
				{ content: ["should not be reached"] },
			],
		});
		const asyncTaskTool: AgentTool = {
			name: "task",
			label: "Task",
			description: "Schedule async work",
			parameters: type({}),
			execute: async () => ({
				content: [{ type: "text" as const, text: "scheduled" }],
				details: { async: { state: "running", type: "task", batchId: "batch_1" } },
			}),
		};
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [asyncTaskTool] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "Main",
			agentKind: "main",
		});

		await session.prompt("dispatch");
		await session.waitForIdle();

		expect(mock.calls).toHaveLength(1);
		expect(session.isStreaming).toBe(false);
	});

	it("does not park a mixed task and non-task response", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({
			responses: [
				{
					content: [
						{ type: "toolCall", id: "task-1", name: "task", arguments: {} },
						{ type: "toolCall", id: "read-1", name: "read", arguments: {} },
					],
				},
				{ content: ["continued"] },
			],
		});
		const asyncTaskTool: AgentTool = {
			name: "task",
			label: "Task",
			description: "Schedule async work",
			parameters: type({}),
			execute: async () => ({
				content: [{ type: "text" as const, text: "scheduled" }],
				details: { async: { state: "running", type: "task", batchId: "batch_1" } },
			}),
		};
		const readTool: AgentTool = {
			name: "read",
			label: "Read",
			description: "Read data",
			parameters: type({}),
			execute: async () => ({ content: [{ type: "text" as const, text: "read" }] }),
		};
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [asyncTaskTool, readTool] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "Main",
			agentKind: "main",
		});

		await session.prompt("dispatch and read");
		await session.waitForIdle();

		expect(mock.calls).toHaveLength(2);
		expect(session.getLastAssistantMessage()?.content).toEqual([{ type: "text", text: "continued" }]);
	});

	it("coalesces ordered batch generations without dropping error or terminal wakes", () => {
		const failedJob = {
			id: "job-failed",
			type: "task" as const,
			status: "failed" as const,
			startTime: 1,
			label: "failed child",
			errorText: "boom",
		};
		const pendingJob = {
			id: "job-pending",
			type: "task" as const,
			status: "running" as const,
			startTime: 1,
			label: "pending child",
		};
		const firstError: AsyncBatchSnapshot = {
			gateId: "batch_1",
			ownerId: "Main",
			generation: 1,
			reason: "first-error",
			allSettled: false,
			jobs: [failedJob, pendingJob],
			settled: [failedJob],
			pending: [pendingJob],
			settledJobIds: [failedJob.id],
			pendingJobIds: [pendingJob.id],
			newSettledJobIds: [failedJob.id],
			createdAt: 1,
			observedAt: 2,
		};
		const completedJob = { ...pendingJob, status: "completed" as const, resultText: "done" };
		const allSettled: AsyncBatchSnapshot = {
			...firstError,
			generation: 2,
			reason: "all-settled",
			allSettled: true,
			jobs: [failedJob, completedJob],
			settled: [failedJob, completedJob],
			pending: [],
			settledJobIds: [failedJob.id, completedJob.id],
			pendingJobIds: [],
			newSettledJobIds: [completedJob.id],
			observedAt: 3,
		};

		const message = buildAsyncBatchResultMessage([
			{ snapshot: firstError, epoch: 0 },
			{ snapshot: firstError, epoch: 0 },
			{ snapshot: allSettled, epoch: 0 },
		]);

		expect(message?.details?.snapshots.map((snapshot: AsyncBatchSnapshot) => snapshot.reason)).toEqual([
			"first-error",
			"all-settled",
		]);
		expect(message?.content).toContain("The first child failure arrived");
		expect(message?.content).toContain("Every child is terminal");
	});

	it("does not park when any task result fails the async running contract", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		const mock = createMockModel({
			responses: [
				{
					content: [
						{ type: "toolCall", id: "task-ok", name: "task", arguments: {} },
						{ type: "toolCall", id: "task-error", name: "task", arguments: {} },
					],
				},
				{ content: ["continued after task error"] },
			],
		});
		const asyncTaskTool: AgentTool = {
			name: "task",
			label: "Task",
			description: "Schedule async work",
			parameters: type({}),
			execute: async toolCallId => ({
				content: [{ type: "text" as const, text: toolCallId }],
				details: { async: { state: "running", type: "task", batchId: "batch_1" } },
				isError: toolCallId === "task-error",
			}),
		};
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [asyncTaskTool] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		authStorages.push(authStorage);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
			agentId: "Main",
			agentKind: "main",
		});

		await session.prompt("dispatch");
		await session.waitForIdle();

		expect(mock.calls).toHaveLength(2);
	});
});
