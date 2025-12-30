import { expect, test, describe, vi, beforeEach } from "vitest";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { getHFHubCachePath } from "./cache-management";
import { downloadFileToCacheDir } from "./download-file-to-cache-dir";
import { snapshotDownload } from "./snapshot-download";
import type { ListFileEntry } from "./list-files";
import { listFiles } from "./list-files";
import { modelInfo } from "./model-info";
import type { ModelEntry } from "./list-models";
import type { ApiModelInfo } from "../types/api/api-model";
import { datasetInfo } from "./dataset-info";
import type { DatasetEntry } from "./list-datasets";
import type { ApiDatasetInfo } from "../types/api/api-dataset";
import { spaceInfo } from "./space-info";
import type { SpaceEntry } from "./list-spaces";
import type { ApiSpaceInfo } from "../types/api/api-space";

vi.mock("node:fs/promises", () => ({
	writeFile: vi.fn(),
	mkdir: vi.fn(),
}));

vi.mock("./space-info", () => ({
	spaceInfo: vi.fn(),
}));

vi.mock("./dataset-info", () => ({
	datasetInfo: vi.fn(),
}));

vi.mock("./model-info", () => ({
	modelInfo: vi.fn(),
}));

vi.mock("./list-files", () => ({
	listFiles: vi.fn(),
}));

vi.mock("./download-file-to-cache-dir", () => ({
	downloadFileToCacheDir: vi.fn(),
}));

const DUMMY_SHA = "dummy-sha";

// utility method to transform an array of ListFileEntry to an AsyncGenerator<ListFileEntry>
async function* toAsyncGenerator(content: ListFileEntry[]): AsyncGenerator<ListFileEntry> {
	for (const entry of content) {
		yield Promise.resolve(entry);
	}
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(listFiles).mockReturnValue(toAsyncGenerator([]));

	// mock repo info
	vi.mocked(modelInfo).mockResolvedValue({
		sha: DUMMY_SHA,
	} as ModelEntry & ApiModelInfo);
	vi.mocked(datasetInfo).mockResolvedValue({
		sha: DUMMY_SHA,
	} as DatasetEntry & ApiDatasetInfo);
	vi.mocked(spaceInfo).mockResolvedValue({
		sha: DUMMY_SHA,
	} as SpaceEntry & ApiSpaceInfo);
});

describe("snapshotDownload", () => {
	test("empty AsyncGenerator should not call downloadFileToCacheDir", async () => {
		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "space",
			},
		});

		expect(downloadFileToCacheDir).not.toHaveBeenCalled();
	});

	test("repo type model should use modelInfo", async () => {
		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "model",
			},
		});
		expect(modelInfo).toHaveBeenCalledOnce();
		expect(modelInfo).toHaveBeenCalledWith({
			name: "foo/bar",
			additionalFields: ["sha"],
			revision: "main",
			repo: {
				name: "foo/bar",
				type: "model",
			},
		});
	});

	test("repo type dataset should use datasetInfo", async () => {
		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "dataset",
			},
		});
		expect(datasetInfo).toHaveBeenCalledOnce();
		expect(datasetInfo).toHaveBeenCalledWith({
			name: "foo/bar",
			additionalFields: ["sha"],
			revision: "main",
			repo: {
				name: "foo/bar",
				type: "dataset",
			},
		});
	});

	test("repo type space should use spaceInfo", async () => {
		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "space",
			},
		});
		expect(spaceInfo).toHaveBeenCalledOnce();
		expect(spaceInfo).toHaveBeenCalledWith({
			name: "foo/bar",
			additionalFields: ["sha"],
			revision: "main",
			repo: {
				name: "foo/bar",
				type: "space",
			},
		});
	});

	test("commitHash should be saved to ref folder", async () => {
		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "space",
			},
			revision: "dummy-revision",
		});

		// cross-platform testing
		const expectedPath = join(getHFHubCachePath(), "spaces--foo--bar", "refs", "dummy-revision");
		expect(mkdir).toHaveBeenCalledWith(dirname(expectedPath), { recursive: true });
		expect(writeFile).toHaveBeenCalledWith(expectedPath, DUMMY_SHA);
	});

	test("directory ListFileEntry should mkdir it", async () => {
		vi.mocked(listFiles).mockReturnValue(
			toAsyncGenerator([
				{
					oid: "dummy-etag",
					type: "directory",
					path: "potatoes",
					size: 0,
					lastCommit: {
						date: new Date().toISOString(),
						id: DUMMY_SHA,
						title: "feat: best commit",
					},
				},
			])
		);

		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "space",
			},
		});

		// cross-platform testing
		const expectedPath = join(getHFHubCachePath(), "spaces--foo--bar", "snapshots", DUMMY_SHA, "potatoes");
		expect(mkdir).toHaveBeenCalledWith(expectedPath, { recursive: true });
	});

	test("files in ListFileEntry should download them", async () => {
		const entries: ListFileEntry[] = Array.from({ length: 10 }, (_, i) => ({
			oid: `dummy-etag-${i}`,
			type: "file",
			path: `file-${i}.txt`,
			size: i,
			lastCommit: {
				date: new Date().toISOString(),
				id: DUMMY_SHA,
				title: "feat: best commit",
			},
		}));
		vi.mocked(listFiles).mockReturnValue(toAsyncGenerator(entries));

		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "space",
			},
		});

		for (const entry of entries) {
			expect(downloadFileToCacheDir).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: {
						name: "foo/bar",
						type: "space",
					},
					path: entry.path,
					revision: DUMMY_SHA,
				})
			);
		}
	});

	test("custom params should be propagated", async () => {
		// fetch mock
		const fetchMock: typeof fetch = vi.fn();
		const hubMock = "https://foor.bar";
		const accessTokenMock = "dummy-access-token";

		vi.mocked(listFiles).mockReturnValue(
			toAsyncGenerator([
				{
					oid: `dummy-etag`,
					type: "file",
					path: `file.txt`,
					size: 10,
					lastCommit: {
						date: new Date().toISOString(),
						id: DUMMY_SHA,
						title: "feat: best commit",
					},
				},
			])
		);

		await snapshotDownload({
			repo: {
				name: "foo/bar",
				type: "space",
			},
			hubUrl: hubMock,
			fetch: fetchMock,
			accessToken: accessTokenMock,
		});

		expect(spaceInfo).toHaveBeenCalledWith(
			expect.objectContaining({
				fetch: fetchMock,
				hubUrl: hubMock,
				accessToken: accessTokenMock,
			})
		);

		// list files should receive custom fetch
		expect(listFiles).toHaveBeenCalledWith(
			expect.objectContaining({
				fetch: fetchMock,
				hubUrl: hubMock,
				accessToken: accessTokenMock,
			})
		);

		// download file to cache should receive custom fetch
		expect(downloadFileToCacheDir).toHaveBeenCalledWith(
			expect.objectContaining({
				fetch: fetchMock,
				hubUrl: hubMock,
				accessToken: accessTokenMock,
			})
		);
	});
});
