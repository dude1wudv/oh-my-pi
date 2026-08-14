/**
 * Token-throughput calculator shared by the status line (main session tok/s
 * badge) and the vibe worker aggregation ({@link aggregateVibeWorkerTokensPerSecond}).
 * Lives in `utils/` so neither the render layer nor the vibe runtime has to
 * depend on the other for a pure arithmetic helper.
 */
const MIN_DURATION_MS = 100;

type AssistantUsage = {
	output: number;
};

type AssistantLikeMessage = {
	role: "assistant";
	timestamp: number;
	duration?: number;
	usage: AssistantUsage;
};

type MaybeAssistantMessage = {
	role?: string;
	timestamp?: number;
	duration?: number;
	ttft?: number;
	usage?: {
		output?: number;
	};
};

function isAssistantMessage(message: MaybeAssistantMessage | undefined): message is AssistantLikeMessage {
	return (
		message?.role === "assistant" &&
		typeof message.timestamp === "number" &&
		message.usage !== undefined &&
		typeof message.usage.output === "number"
	);
}

function getLastAssistantMessage(messages: ReadonlyArray<MaybeAssistantMessage>): AssistantLikeMessage | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (isAssistantMessage(message)) {
			return message;
		}
	}
	return null;
}

export function calculateAverageTtftMs(messages: ReadonlyArray<MaybeAssistantMessage>): number | null {
	const values = messages
		.filter(message => message.role === "assistant")
		.map(message => message.ttft)
		.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateTokensPerSecond(
	messages: ReadonlyArray<MaybeAssistantMessage>,
	isStreaming: boolean,
	nowMs: number = Date.now(),
): number | null {
	const assistant = getLastAssistantMessage(messages);
	if (!assistant) return null;

	const outputTokens = assistant.usage.output;
	if (!Number.isFinite(outputTokens) || outputTokens <= 0) return null;

	const resolvedDurationMs =
		typeof assistant.duration === "number" && Number.isFinite(assistant.duration) && assistant.duration > 0
			? assistant.duration
			: isStreaming
				? nowMs - assistant.timestamp
				: null;

	if (resolvedDurationMs === null || resolvedDurationMs < MIN_DURATION_MS) return null;

	const tokensPerSecond = (outputTokens * 1000) / resolvedDurationMs;
	if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) return null;

	return tokensPerSecond;
}
