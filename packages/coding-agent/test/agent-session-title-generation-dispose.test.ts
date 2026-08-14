import { afterEach, describe, expect, it, vi } from "bun:test";
import { Agent } from "@dude1wudv/pi-agent-core";
import * as ai from "@dude1wudv/pi-ai";
import { createMockModel } from "@dude1wudv/pi-ai/providers/mock";
import { getBundledModel } from "@dude1wudv/pi-catalog/models";
import { ModelRegistry } from "@dude1wudv/pi-coding-agent/config/model-registry";
import { Settings } from "@dude1wudv/pi-coding-agent/config/settings";
import { AgentSession } from "@dude1wudv/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@dude1wudv/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@dude1wudv/pi-coding-agent/session/session-manager";
import { createAssistantMessage } from "./helpers/agent-session-setup";

let session: AgentSession | undefined;
let authStorage: AuthStorage | undefined;

afterEach(async () => {
	vi.restoreAllMocks();
	await session?.dispose();
	authStorage?.close();
	session = undefined;
	authStorage = undefined;
});

describe("AgentSession title generation disposal", () => {
	it("uses the active provider session and aborts an in-flight title request during disposal", async () => {
		authStorage = await AuthStorage.create(":memory:");
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 model to exist");
		const providerSessionId = "provider-session";

		const settings = Settings.isolated({
			"compaction.enabled": false,
			"providers.tinyModel": "online",
		});
		settings.overrideModelRoles({ smol: `${model.provider}/${model.id}` });
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] },
			streamFn: createMockModel({ responses: [{ content: ["Done"] }] }).stream,
		});
		const modelRegistry = new ModelRegistry(authStorage);
		const getApiKey = vi.spyOn(modelRegistry, "getApiKey");
		const resolver = vi.spyOn(modelRegistry, "resolver");
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings,
			modelRegistry,
			providerSessionId,
		});
		const started = Promise.withResolvers<void>();
		const response = Promise.withResolvers<ai.AssistantMessage>();
		let requestSignal: AbortSignal | undefined;
		vi.spyOn(ai, "completeSimple").mockImplementation((_model, _context, options) => {
			requestSignal = options?.signal;
			requestSignal?.addEventListener("abort", () => response.resolve(createAssistantMessage("")), { once: true });
			started.resolve();
			return response.promise;
		});

		const generation = session.generateTitle("Investigate shutdown");
		await started.promise;
		expect(getApiKey.mock.calls[0]?.[1]).toBe(providerSessionId);
		expect(resolver.mock.calls[0]?.[1]).toBe(providerSessionId);
		session.beginDispose();

		expect(requestSignal?.aborted).toBe(true);
		expect(await generation).toBeNull();
	});
});
