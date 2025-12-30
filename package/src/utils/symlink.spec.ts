/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { createSymlink } from "./symlink";
import { readFileSync, writeFileSync } from "node:fs";
import { lstat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failSymlink = false;
vi.mock("node:fs/promises", async (importOriginal) => ({
	...(await importOriginal<typeof import("node:fs/promises")>()),
	symlink: async (...args: any[]) => {
		if (failSymlink) {
			failSymlink = false;
			throw new Error("Symlink not supported");
		}

		// @ts-expect-error - ignore
		return (await importOriginal<typeof import("node:fs/promises")>()).symlink(...args);
	},
}));

describe("utils/symlink", () => {
	it("should create a symlink", async () => {
		writeFileSync(join(tmpdir(), "test.txt"), "hello world");
		await createSymlink({
			sourcePath: join(tmpdir(), "test.txt"),
			finalPath: join(tmpdir(), "test-symlink.txt"),
		});

		const stats = await lstat(join(tmpdir(), "test-symlink.txt"));
		expect(stats.isSymbolicLink()).toBe(process.platform !== "win32");

		// Test file content
		const content = readFileSync(join(tmpdir(), "test-symlink.txt"), "utf8");
		expect(content).toBe("hello world");

		// Cleanup
		await rm(join(tmpdir(), "test-symlink.txt"));
		await rm(join(tmpdir(), "test.txt"));
	});

	it("should work when symlinking twice", async () => {
		writeFileSync(join(tmpdir(), "test.txt"), "hello world");
		writeFileSync(join(tmpdir(), "test2.txt"), "hello world2");
		await createSymlink({
			sourcePath: join(tmpdir(), "test.txt"),
			finalPath: join(tmpdir(), "test-symlink.txt"),
		});
		await createSymlink({
			sourcePath: join(tmpdir(), "test2.txt"),
			finalPath: join(tmpdir(), "test-symlink.txt"),
		});

		const stats = await lstat(join(tmpdir(), "test-symlink.txt"));
		expect(stats.isSymbolicLink()).toBe(process.platform !== "win32");

		// Test file content
		const content = readFileSync(join(tmpdir(), "test-symlink.txt"), "utf8");
		expect(content).toBe("hello world2");

		// Cleanup
		await rm(join(tmpdir(), "test-symlink.txt"));
		await rm(join(tmpdir(), "test.txt"));
		await rm(join(tmpdir(), "test2.txt"));
	});

	it("should work when symlink doesn't work (windows)", async () => {
		writeFileSync(join(tmpdir(), "test.txt"), "hello world");

		failSymlink = true;
		await createSymlink({
			sourcePath: join(tmpdir(), "test.txt"),
			finalPath: join(tmpdir(), "test-symlink.txt"),
		});

		const stats = await lstat(join(tmpdir(), "test-symlink.txt"));
		expect(stats.isSymbolicLink()).toBe(false);

		// Test file content
		const content = readFileSync(join(tmpdir(), "test-symlink.txt"), "utf8");
		expect(content).toBe("hello world");

		// Cleanup
		await rm(join(tmpdir(), "test-symlink.txt"));
		await rm(join(tmpdir(), "test.txt"));
	});
});
