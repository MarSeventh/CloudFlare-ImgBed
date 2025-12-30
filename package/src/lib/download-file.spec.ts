import { expect, test, describe, assert } from "vitest";
import { downloadFile } from "./download-file";
import { deleteRepo } from "./delete-repo";
import { createRepo } from "./create-repo";
import { TEST_ACCESS_TOKEN, TEST_HUB_URL, TEST_USER } from "../test/consts";
import { insecureRandomString } from "../utils/insecureRandomString";

describe("downloadFile", () => {
	test("should download regular file", async () => {
		const blob = await downloadFile({
			repo: {
				type: "model",
				name: "openai-community/gpt2",
			},
			path: "README.md",
		});

		const text = await blob?.slice(0, 1000).text();
		assert(
			text?.includes(`---
language: en
tags:
- exbert

license: mit
---


# GPT-2

Test the whole generation capabilities here: https://transformer.huggingface.co/doc/gpt2-large`)
		);
	});
	test("should downoad xet file", async () => {
		const blob = await downloadFile({
			repo: {
				type: "model",
				name: "celinah/xet-experiments",
			},
			path: "large_text.txt",
		});

		const text = await blob?.slice(0, 100).text();
		expect(text).toMatch("this is a text file.".repeat(10).slice(0, 100));
	});

	test("should download private file", async () => {
		const repoName = `datasets/${TEST_USER}/TEST-${insecureRandomString()}`;

		const result = await createRepo({
			accessToken: TEST_ACCESS_TOKEN,
			hubUrl: TEST_HUB_URL,
			private: true,
			repo: repoName,
			files: [{ path: ".gitattributes", content: new Blob(["*.html filter=lfs diff=lfs merge=lfs -text"]) }],
		});

		assert.deepStrictEqual(result, {
			repoUrl: `${TEST_HUB_URL}/${repoName}`,
		});

		try {
			const blob = await downloadFile({
				repo: repoName,
				path: ".gitattributes",
				hubUrl: TEST_HUB_URL,
				accessToken: TEST_ACCESS_TOKEN,
			});

			assert(blob, "File should be found");

			const text = await blob?.text();
			assert.strictEqual(text, "*.html filter=lfs diff=lfs merge=lfs -text");
		} finally {
			await deleteRepo({
				repo: repoName,
				hubUrl: TEST_HUB_URL,
				accessToken: TEST_ACCESS_TOKEN,
			});
		}
	});
});
