import { describe, expect, it } from "bun:test";
import type { YieldItem } from "@dude1wudv/pi-coding-agent/task/types";
import { arrayValuedLabels, assembleYieldResult } from "@dude1wudv/pi-coding-agent/task/yield-assembly";

describe("assembleYieldResult", () => {
	it("preserves incremental findings beside a terminal object verdict", () => {
		const items: YieldItem[] = [
			{
				status: "success",
				type: ["findings"],
				data: { title: "bug", body: "details" },
			},
			{
				status: "success",
				data: {
					overall_correctness: "incorrect",
					explanation: "One finding remains.",
					confidence: 0.95,
				},
			},
		];

		const result = assembleYieldResult(
			items,
			undefined,
			arrayValuedLabels({
				type: "object",
				properties: { findings: { type: "array", items: { type: "object" } } },
			}),
		);

		expect(result).toEqual({
			data: {
				findings: [{ title: "bug", body: "details" }],
				overall_correctness: "incorrect",
				explanation: "One finding remains.",
				confidence: 0.95,
			},
			schemaOverridden: false,
			rawText: false,
			missingData: false,
		});
	});
});
