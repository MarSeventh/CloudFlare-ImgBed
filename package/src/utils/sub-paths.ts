import { readdir, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Recursively retrieves all sub-paths of a given directory up to a specified depth.
 */
export async function subPaths(
	path: URL,
	maxDepth = 10
): Promise<
	Array<{
		path: URL;
		relativePath: string;
	}>
> {
	const state = await stat(path);
	if (!state.isDirectory()) {
		return [{ path, relativePath: "." }];
	}

	const files = await readdir(path, { withFileTypes: true });
	const ret: Array<{ path: URL; relativePath: string }> = [];
	for (const file of files) {
		const filePath = pathToFileURL(fileURLToPath(path) + "/" + file.name);
		if (file.isDirectory()) {
			ret.push(
				...(await subPaths(filePath, maxDepth - 1)).map((subPath) => ({
					...subPath,
					relativePath: `${file.name}/${subPath.relativePath}`,
				}))
			);
		} else {
			ret.push({ path: filePath, relativePath: file.name });
		}
	}

	return ret;
}
