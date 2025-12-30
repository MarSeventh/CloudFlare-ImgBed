import { describe, test, expect, vi, beforeEach } from "vitest";
import {
	scanCacheDir,
	scanCachedRepo,
	scanSnapshotDir,
	parseRepoType,
	getBlobStat,
	type CachedFileInfo,
} from "./cache-management";
import { stat, readdir, realpath, lstat } from "node:fs/promises";
import type { Stats } from "node:fs";
import { join } from "node:path";

// Mocks
vi.mock("node:fs/promises");

beforeEach(() => {
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("scanCacheDir", () => {
	test("should throw an error if cacheDir is not a directory", async () => {
		vi.mocked(stat).mockResolvedValueOnce({
			isDirectory: () => false,
		} as Stats);

		await expect(scanCacheDir("/fake/dir")).rejects.toThrow("Scan cache expects a directory");
	});

	test("empty directory should return an empty set of repository and no warnings", async () => {
		vi.mocked(stat).mockResolvedValueOnce({
			isDirectory: () => true,
		} as Stats);

		// mock empty cache folder
		vi.mocked(readdir).mockResolvedValue([]);

		const result = await scanCacheDir("/fake/dir");

		// cacheDir must have been read
		expect(readdir).toHaveBeenCalledWith("/fake/dir");

		expect(result.warnings.length).toBe(0);
		expect(result.repos).toHaveLength(0);
		expect(result.size).toBe(0);
	});
});

describe("scanCachedRepo", () => {
	test("should throw an error for invalid repo path", async () => {
		await expect(() => {
			return scanCachedRepo("/fake/repo_path");
		}).rejects.toThrow("Repo path is not a valid HuggingFace cache directory");
	});

	test("should throw an error if the snapshot folder does not exist", async () => {
		vi.mocked(readdir).mockResolvedValue([]);
		vi.mocked(stat).mockResolvedValue({
			isDirectory: () => false,
		} as Stats);

		await expect(() => {
			return scanCachedRepo("/fake/cacheDir/models--hello-world--name");
		}).rejects.toThrow("Snapshots dir doesn't exist in cached repo");
	});

	test("should properly parse the repository name", async () => {
		const repoPath = "/fake/cacheDir/models--hello-world--name";
		vi.mocked(readdir).mockResolvedValue([]);
		vi.mocked(stat).mockResolvedValue({
			isDirectory: () => true,
		} as Stats);

		const result = await scanCachedRepo(repoPath);
		expect(readdir).toHaveBeenCalledWith(join(repoPath, "refs"), {
			withFileTypes: true,
		});

		expect(result.id.name).toBe("hello-world/name");
		expect(result.id.type).toBe("model");
	});
});

describe("scanSnapshotDir", () => {
	test("should scan a valid snapshot directory", async () => {
		const cachedFiles: CachedFileInfo[] = [];
		const blobStats = new Map<string, Stats>();
		vi.mocked(readdir).mockResolvedValueOnce([
			{ name: "file1", isDirectory: () => false } as unknown as Awaited<ReturnType<typeof readdir>>[0],
		]);

		vi.mocked(realpath).mockResolvedValueOnce("/fake/realpath");
		vi.mocked(lstat).mockResolvedValueOnce({ size: 1024, atimeMs: Date.now(), mtimeMs: Date.now() } as Stats);

		await scanSnapshotDir("/fake/revision", cachedFiles, blobStats);

		expect(cachedFiles).toHaveLength(1);
		expect(blobStats.size).toBe(1);
	});
});

describe("getBlobStat", () => {
	test("should retrieve blob stat if already cached", async () => {
		const blobStats = new Map<string, Stats>([["/fake/blob", { size: 1024 } as Stats]]);
		const result = await getBlobStat("/fake/blob", blobStats);

		expect(lstat).not.toHaveBeenCalled();
		expect(result.size).toBe(1024);
	});

	test("should fetch and cache blob stat if not cached", async () => {
		const blobStats = new Map();
		vi.mocked(lstat).mockResolvedValueOnce({ size: 2048 } as Stats);

		const result = await getBlobStat("/fake/blob", blobStats);

		expect(result.size).toBe(2048);
		expect(blobStats.size).toBe(1);
	});
});

describe("parseRepoType", () => {
	test("should parse models repo type", () => {
		expect(parseRepoType("models")).toBe("model");
	});

	test("should parse dataset repo type", () => {
		expect(parseRepoType("datasets")).toBe("dataset");
	});

	test("should parse space repo type", () => {
		expect(parseRepoType("spaces")).toBe("space");
	});

	test("should throw an error for invalid repo type", () => {
		expect(() => parseRepoType("invalid")).toThrowError("Invalid repo type: invalid");
	});
});
