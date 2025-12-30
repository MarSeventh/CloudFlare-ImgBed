import { assert, it, describe } from "vitest";

import { TEST_ACCESS_TOKEN, TEST_HUB_URL, TEST_USER } from "../test/consts";
import type { RepoId } from "../types/public";
import { insecureRandomString } from "../utils/insecureRandomString";
import { createRepo } from "./create-repo";
import { deleteRepo } from "./delete-repo";
import { downloadFile } from "./download-file";
import { uploadFiles } from "./upload-files";
import { mkdir } from "fs/promises";
import { writeFile } from "fs/promises";
import { pathToFileURL } from "url";
import { tmpdir } from "os";

describe("uploadFiles", () => {
	it("should upload local folder", async () => {
		const tmpDir = tmpdir();

		await mkdir(`${tmpDir}/test-folder/sub`, { recursive: true });

		await writeFile(`${tmpDir}/test-folder/sub/file1.txt`, "file1");
		await writeFile(`${tmpDir}/test-folder/sub/file2.txt`, "file2");

		await writeFile(`${tmpDir}/test-folder/file3.txt`, "file3");
		await writeFile(`${tmpDir}/test-folder/file4.txt`, "file4");

		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;
		const repo = { type: "model", name: repoName } satisfies RepoId;

		try {
			const result = await createRepo({
				accessToken: TEST_ACCESS_TOKEN,
				repo,
				hubUrl: TEST_HUB_URL,
			});

			assert.deepStrictEqual(result, {
				repoUrl: `${TEST_HUB_URL}/${repoName}`,
			});

			await uploadFiles({
				accessToken: TEST_ACCESS_TOKEN,
				repo,
				files: [pathToFileURL(`${tmpDir}/test-folder`)],
				hubUrl: TEST_HUB_URL,
			});

			let content = await downloadFile({
				repo,
				path: "test-folder/sub/file1.txt",
				hubUrl: TEST_HUB_URL,
			});

			assert.strictEqual(await content?.text(), "file1");

			content = await downloadFile({
				repo,
				path: "test-folder/file3.txt",
				hubUrl: TEST_HUB_URL,
			});

			assert.strictEqual(await content?.text(), `file3`);
		} finally {
			await deleteRepo({
				repo,
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});
		}
	});
});
