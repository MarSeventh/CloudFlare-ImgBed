import { assert, describe, expect, it } from "vitest";
import { checkRepoAccess } from "./check-repo-access";
import { HubApiError } from "../error";
import { TEST_ACCESS_TOKEN, TEST_HUB_URL } from "../test/consts";

describe("checkRepoAccess", () => {
	it("should throw 401 when accessing unexisting repo unauthenticated", async () => {
		try {
			await checkRepoAccess({ repo: { name: "i--d/dont", type: "model" } });
			assert(false, "should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(HubApiError);
			expect((err as HubApiError).statusCode).toBe(401);
		}
	});

	it("should throw 404 when accessing unexisting repo authenticated", async () => {
		try {
			await checkRepoAccess({
				repo: { name: "i--d/dont", type: "model" },
				hubUrl: TEST_HUB_URL,
				accessToken: TEST_ACCESS_TOKEN,
			});
			assert(false, "should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(HubApiError);
			expect((err as HubApiError).statusCode).toBe(404);
		}
	});

	it("should not throw when accessing public repo", async () => {
		await checkRepoAccess({ repo: { name: "openai-community/gpt2", type: "model" } });
	});
});
