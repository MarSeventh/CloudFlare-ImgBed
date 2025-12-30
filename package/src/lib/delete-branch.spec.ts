import { it, describe } from "vitest";
import { TEST_ACCESS_TOKEN, TEST_HUB_URL, TEST_USER } from "../test/consts";
import type { RepoId } from "../types/public";
import { insecureRandomString } from "../utils/insecureRandomString";
import { createRepo } from "./create-repo";
import { deleteRepo } from "./delete-repo";
import { createBranch } from "./create-branch";
import { deleteBranch } from "./delete-branch";

describe("deleteBranch", () => {
	it("should delete an existing branch", async () => {
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;
		const repo = { type: "model", name: repoName } satisfies RepoId;

		try {
			await createRepo({
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
				repo,
			});

			await createBranch({
				repo,
				branch: "branch-to-delete",
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});

			await deleteBranch({
				repo,
				branch: "branch-to-delete",
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});
		} finally {
			await deleteRepo({
				repo,
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});
		}
	});
});
