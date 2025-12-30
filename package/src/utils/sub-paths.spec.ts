import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { describe, expect, it } from "vitest";
import { subPaths } from "./sub-paths";
import { pathToFileURL } from "url";

describe("sub-paths", () => {
	it("should retrieve all sub-paths of a directory", async () => {
		const tmpDir = tmpdir();

		await mkdir(`${tmpDir}/test-dir/sub`, { recursive: true });

		await writeFile(`${tmpDir}/test-dir/sub/file1.txt`, "file1");
		await writeFile(`${tmpDir}/test-dir/sub/file2.txt`, "file2");
		await writeFile(`${tmpDir}/test-dir/file3.txt`, "file3");
		await writeFile(`${tmpDir}/test-dir/file4.txt`, "file4");
		const result = await subPaths(pathToFileURL(`${tmpDir}/test-dir`));

		expect(result).toEqual([
			{
				path: pathToFileURL(`${tmpDir}/test-dir/file3.txt`),
				relativePath: "file3.txt",
			},
			{
				path: pathToFileURL(`${tmpDir}/test-dir/file4.txt`),
				relativePath: "file4.txt",
			},

			{
				path: pathToFileURL(`${tmpDir}/test-dir/sub/file1.txt`),
				relativePath: "sub/file1.txt",
			},
			{
				path: pathToFileURL(`${tmpDir}/test-dir/sub/file2.txt`),
				relativePath: "sub/file2.txt",
			},
		]);
	});
});
