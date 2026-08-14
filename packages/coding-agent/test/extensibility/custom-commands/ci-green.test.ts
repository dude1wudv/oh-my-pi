import { afterEach, describe, expect, it, vi } from "bun:test";
import { type } from "@dude1wudv/omptype";
import type * as TypeBox from "@dude1wudv/omptype/typebox";
import * as zod from "@dude1wudv/omptype/zod";
import * as piCodingAgent from "@dude1wudv/pi-coding-agent";
import { GreenCommand } from "@dude1wudv/pi-coding-agent/extensibility/custom-commands/bundled/ci-green";
import type { CustomCommandAPI } from "@dude1wudv/pi-coding-agent/extensibility/custom-commands/types";
import type { HookCommandContext } from "@dude1wudv/pi-coding-agent/extensibility/hooks/types";
import * as git from "@dude1wudv/pi-coding-agent/utils/git";

afterEach(() => {
	vi.restoreAllMocks();
});

function createApi(): CustomCommandAPI {
	return {
		cwd: "/tmp/test",
		exec: async () => ({
			stdout: "",
			stderr: "",
			code: 0,
			killed: false,
		}),
		typebox: {} as unknown as typeof TypeBox,
		arktype: Object.assign(Function.prototype.bind.call(type, undefined) as typeof type, type, { type }),
		zod,
		pi: piCodingAgent,
	};
}

describe("GreenCommand", () => {
	it("includes tag instructions when HEAD has a tag", async () => {
		vi.spyOn(git.ref, "tags").mockResolvedValue(["v0.1.0-alpha2"]);
		const command = new GreenCommand(createApi());

		const result = await command.execute([], {} as HookCommandContext);

		expect(result).toContain("v0.1.0-alpha2");
		expect(result).not.toContain("timeouts due to the harnesses");
	});

	it("omits tag instructions when HEAD is not tagged", async () => {
		vi.spyOn(git.ref, "tags").mockResolvedValue([]);
		const command = new GreenCommand(createApi());

		const result = await command.execute([], {} as HookCommandContext);

		expect(result).not.toContain("v0.1.0-alpha2");
	});
});
