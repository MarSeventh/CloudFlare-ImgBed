/**
 * Heavily inspired by https://github.com/huggingface/huggingface_hub/blob/fcfd14361bd03f23f82efced1aa65a7cbfa4b922/src/huggingface_hub/file_download.py#L517
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

function expandUser(path: string): string {
	if (path.startsWith("~")) {
		return path.replace("~", os.homedir());
	}
	return path;
}

/**
 * Create a symbolic link named dst pointing to src.
 *
 * By default, it will try to create a symlink using a relative path. Relative paths have 2 advantages:
 * - If the cache_folder is moved (example: back-up on a shared drive), relative paths within the cache folder will
 *  not break.
 * - Relative paths seems to be better handled on Windows. Issue was reported 3 times in less than a week when
 *   changing from relative to absolute paths. See https://github.com/huggingface/huggingface_hub/issues/1398,
 *   https://github.com/huggingface/diffusers/issues/2729 and https://github.com/huggingface/transformers/pull/22228.
 *   NOTE: The issue with absolute paths doesn't happen on admin mode.
 * When creating a symlink from the cache to a local folder, it is possible that a relative path cannot be created.
 * This happens when paths are not on the same volume. In that case, we use absolute paths.
 *
 * The result layout looks something like
 *     └── [ 128]  snapshots
 *         ├── [ 128]  2439f60ef33a0d46d85da5001d52aeda5b00ce9f
 *         │   ├── [  52]  README.md -> ../../../blobs/d7edf6bd2a681fb0175f7735299831ee1b22b812
 *         │   └── [  76]  pytorch_model.bin -> ../../../blobs/403450e234d65943a7dcf7e05a771ce3c92faa84dd07db4ac20f592037a1e4bd
 *
 * If symlinks cannot be created on this platform (most likely to be Windows), the workaround is to avoid symlinks by
 * having the actual file in `dst`. If it is a new file (`new_blob=True`), we move it to `dst`. If it is not a new file
 * (`new_blob=False`), we don't know if the blob file is already referenced elsewhere. To avoid breaking existing
 * cache, the file is duplicated on the disk.
 */
export async function createSymlink(params: {
	/**
	 * The path to the symlink.
	 */
	finalPath: string;
	/**
	 * The path the symlink should point to.
	 */
	sourcePath: string;
}): Promise<void> {
	const abs_src = path.resolve(expandUser(params.sourcePath));
	const abs_dst = path.resolve(expandUser(params.finalPath));

	try {
		await fs.rm(abs_dst);
	} catch {
		// ignore
	}

	try {
		await fs.symlink(path.relative(path.dirname(abs_dst), abs_src), abs_dst);
	} catch {
		console.info(`Symlink not supported. Copying file from ${abs_src} to ${abs_dst}`);
		await fs.copyFile(abs_src, abs_dst);
	}
}
