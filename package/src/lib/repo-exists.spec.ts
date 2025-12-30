import { describe, expect, it } from "vitest";
import { repoExists } from "./repo-exists";

describe("repoExists", () => {
	it("should check if a repo exists", async () => {
		const exists1 = await repoExists({ repo: { type: "model", name: "openai-community/gpt2" } });

		expect(exists1).toBe(true);

		const exists2 = await repoExists({ repo: { type: "model", name: "openai-community/gpt9000" } });
		expect(exists2).toBe(false);
	});
});
