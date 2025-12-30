import { WebBlob } from "./WebBlob";
import { isFrontend } from "./isFrontend";

/**
 * This function allow to retrieve either a FileBlob or a WebBlob from a URL.
 *
 * From the backend:
 *   - support local files
 *   - support local folders
 *   - support http resources with absolute URLs
 *
 * From the frontend:
 *   - support http resources with absolute or relative URLs
 */
export async function createBlobs(
	url: URL,
	destPath: string,
	opts?: { fetch?: typeof fetch; maxFolderDepth?: number; accessToken?: string }
): Promise<Array<{ path: string; blob: Blob }>> {
	if (url.protocol === "http:" || url.protocol === "https:") {
		const blob = await WebBlob.create(url, { fetch: opts?.fetch, accessToken: opts?.accessToken });
		return [{ path: destPath, blob }];
	}

	if (isFrontend) {
		throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
	}

	if (url.protocol === "file:") {
		const { FileBlob } = await import("./FileBlob");
		const { subPaths } = await import("./sub-paths");
		const paths = await subPaths(url, opts?.maxFolderDepth);

		if (paths.length === 1 && paths[0].relativePath === ".") {
			const blob = await FileBlob.create(url);
			return [{ path: destPath, blob }];
		}

		return Promise.all(
			paths.map(async (path) => ({
				path: `${destPath}/${path.relativePath}`
					.replace(/\/[.]$/, "")
					.replaceAll("//", "/")
					.replace(/^[.]?\//, ""),
				blob: await FileBlob.create(new URL(path.path)),
			}))
		);
	}

	throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
}
