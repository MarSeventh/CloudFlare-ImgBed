import { expect, test, describe, vi, beforeEach } from "vitest";
import type { RepoDesignation, RepoId } from "../types/public";
import { dirname, join } from "node:path";
import { lstat, mkdir, stat, symlink, rename } from "node:fs/promises";
import { pathsInfo } from "./paths-info";
import { createWriteStream, type Stats } from "node:fs";
import { getHFHubCachePath, getRepoFolderName } from "./cache-management";
import { toRepoId } from "../utils/toRepoId";
import { downloadFileToCacheDir } from "./download-file-to-cache-dir";
import { createSymlink } from "../utils/symlink";

vi.mock("node:fs/promises", () => ({
	rename: vi.fn(),
	symlink: vi.fn(),
	lstat: vi.fn(),
	mkdir: vi.fn(),
	stat: vi.fn(),
}));

vi.mock("node:fs", () => ({
	createWriteStream: vi.fn(),
}));

vi.mock("./paths-info", () => ({
	pathsInfo: vi.fn(),
}));

vi.mock("../utils/symlink", () => ({
	createSymlink: vi.fn(),
}));

const DUMMY_REPO: RepoId = {
	name: "hello-world",
	type: "model",
};

const DUMMY_ETAG = "dummy-etag";

// utility test method to get blob file path
function _getBlobFile(params: {
	repo: RepoDesignation;
	etag: string;
	cacheDir?: string; // default to {@link getHFHubCache}
}) {
	return join(params.cacheDir ?? getHFHubCachePath(), getRepoFolderName(toRepoId(params.repo)), "blobs", params.etag);
}

// utility test method to get snapshot file path
function _getSnapshotFile(params: {
	repo: RepoDesignation;
	path: string;
	revision: string;
	cacheDir?: string; // default to {@link getHFHubCache}
}) {
	return join(
		params.cacheDir ?? getHFHubCachePath(),
		getRepoFolderName(toRepoId(params.repo)),
		"snapshots",
		params.revision,
		params.path
	);
}

describe("downloadFileToCacheDir", () => {
	const fetchMock: typeof fetch = vi.fn();
	beforeEach(() => {
		vi.resetAllMocks();
		// mock 200 request
		vi.mocked(fetchMock).mockResolvedValue(
			new Response("dummy-body", {
				status: 200,
				headers: {
					etag: DUMMY_ETAG,
					"Content-Range": "bytes 0-54/55",
				},
			})
		);

		// prevent to use caching
		vi.mocked(stat).mockRejectedValue(new Error("Do not exists"));
		vi.mocked(lstat).mockRejectedValue(new Error("Do not exists"));
	});

	test("should throw an error if fileDownloadInfo return nothing", async () => {
		await expect(async () => {
			await downloadFileToCacheDir({
				repo: DUMMY_REPO,
				path: "/README.md",
				fetch: fetchMock,
			});
		}).rejects.toThrowError("cannot get path info for /README.md");

		expect(pathsInfo).toHaveBeenCalledWith(
			expect.objectContaining({
				repo: DUMMY_REPO,
				paths: ["/README.md"],
				fetch: fetchMock,
			})
		);
	});

	test("existing symlinked and blob should not re-download it", async () => {
		// <cache>/<repo>/<revision>/snapshots/README.md
		const expectPointer = _getSnapshotFile({
			repo: DUMMY_REPO,
			path: "/README.md",
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
		});
		// stat ensure a symlink and the pointed file exists
		vi.mocked(stat).mockResolvedValue({} as Stats); // prevent default mocked reject

		const output = await downloadFileToCacheDir({
			repo: DUMMY_REPO,
			path: "/README.md",
			fetch: fetchMock,
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
		});

		expect(stat).toHaveBeenCalledOnce();
		// Get call argument for stat
		const starArg = vi.mocked(stat).mock.calls[0][0];

		expect(starArg).toBe(expectPointer);
		expect(fetchMock).not.toHaveBeenCalledWith();

		expect(output).toBe(expectPointer);
	});

	test("existing symlinked and blob with default revision should not re-download it", async () => {
		// <cache>/<repo>/<revision>/snapshots/README.md
		const expectPointer = _getSnapshotFile({
			repo: DUMMY_REPO,
			path: "/README.md",
			revision: "main",
		});
		// stat ensure a symlink and the pointed file exists
		vi.mocked(stat).mockResolvedValue({} as Stats); // prevent default mocked reject
		vi.mocked(lstat).mockResolvedValue({} as Stats);
		vi.mocked(pathsInfo).mockResolvedValue([
			{
				oid: DUMMY_ETAG,
				size: 55,
				path: "README.md",
				type: "file",
				lastCommit: {
					date: new Date(),
					id: "main",
					title: "Commit msg",
				},
			},
		]);

		const output = await downloadFileToCacheDir({
			repo: DUMMY_REPO,
			path: "/README.md",
			fetch: fetchMock,
		});

		expect(stat).toHaveBeenCalledOnce();
		expect(symlink).not.toHaveBeenCalledOnce();
		// Get call argument for stat
		const starArg = vi.mocked(stat).mock.calls[0][0];

		expect(starArg).toBe(expectPointer);
		expect(fetchMock).not.toHaveBeenCalledWith();

		expect(output).toBe(expectPointer);
	});

	test("existing blob should only create the symlink", async () => {
		// <cache>/<repo>/<revision>/snapshots/README.md
		const expectPointer = _getSnapshotFile({
			repo: DUMMY_REPO,
			path: "/README.md",
			revision: "dummy-commit-hash",
		});
		// <cache>/<repo>/blobs/<etag>
		const expectedBlob = _getBlobFile({
			repo: DUMMY_REPO,
			etag: DUMMY_ETAG,
		});

		// mock existing blob only no symlink
		vi.mocked(lstat).mockResolvedValue({} as Stats);
		// mock pathsInfo resolve content
		vi.mocked(pathsInfo).mockResolvedValue([
			{
				oid: DUMMY_ETAG,
				size: 55,
				path: "README.md",
				type: "file",
				lastCommit: {
					date: new Date(),
					id: "dummy-commit-hash",
					title: "Commit msg",
				},
			},
		]);

		const output = await downloadFileToCacheDir({
			repo: DUMMY_REPO,
			path: "/README.md",
			fetch: fetchMock,
		});

		// should have check for the blob
		expect(lstat).toHaveBeenCalled();
		expect(vi.mocked(lstat).mock.calls[0][0]).toBe(expectedBlob);

		// symlink should have been created
		expect(createSymlink).toHaveBeenCalledOnce();
		// no download done
		expect(fetchMock).not.toHaveBeenCalled();

		expect(output).toBe(expectPointer);
	});

	test("expect resolve value to be the pointer path of downloaded file", async () => {
		// <cache>/<repo>/<revision>/snapshots/README.md
		const expectPointer = _getSnapshotFile({
			repo: DUMMY_REPO,
			path: "/README.md",
			revision: "dummy-commit-hash",
		});
		// <cache>/<repo>/blobs/<etag>
		const expectedBlob = _getBlobFile({
			repo: DUMMY_REPO,
			etag: DUMMY_ETAG,
		});

		vi.mocked(pathsInfo).mockResolvedValue([
			{
				oid: DUMMY_ETAG,
				size: 55,
				path: "README.md",
				type: "file",
				lastCommit: {
					date: new Date(),
					id: "dummy-commit-hash",
					title: "Commit msg",
				},
			},
		]);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(createWriteStream).mockReturnValue(async function* () {} as any);

		const output = await downloadFileToCacheDir({
			repo: DUMMY_REPO,
			path: "/README.md",
			fetch: fetchMock,
		});

		// expect blobs and snapshots folder to have been mkdir
		expect(vi.mocked(mkdir).mock.calls[0][0]).toBe(dirname(expectedBlob));
		expect(vi.mocked(mkdir).mock.calls[1][0]).toBe(dirname(expectPointer));

		expect(output).toBe(expectPointer);
	});

	test("should write fetch response to blob", async () => {
		// <cache>/<repo>/<revision>/snapshots/README.md
		const expectPointer = _getSnapshotFile({
			repo: DUMMY_REPO,
			path: "/README.md",
			revision: "dummy-commit-hash",
		});
		// <cache>/<repo>/blobs/<etag>
		const expectedBlob = _getBlobFile({
			repo: DUMMY_REPO,
			etag: DUMMY_ETAG,
		});

		// mock pathsInfo resolve content
		vi.mocked(pathsInfo).mockResolvedValue([
			{
				oid: DUMMY_ETAG,
				size: 55,
				path: "README.md",
				type: "file",
				lastCommit: {
					date: new Date(),
					id: "dummy-commit-hash",
					title: "Commit msg",
				},
			},
		]);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(createWriteStream).mockReturnValue(async function* () {} as any);

		await downloadFileToCacheDir({
			repo: DUMMY_REPO,
			path: "/README.md",
			fetch: fetchMock,
		});

		const incomplete = `${expectedBlob}.incomplete`;
		// 1. should write fetch#response#body to incomplete file
		expect(createWriteStream).toHaveBeenCalledWith(incomplete);
		// 2. should rename the incomplete to the blob expected name
		expect(rename).toHaveBeenCalledWith(incomplete, expectedBlob);
		// 3. should create symlink pointing to blob
		expect(createSymlink).toHaveBeenCalledWith({ sourcePath: expectedBlob, finalPath: expectPointer });
	});
});
