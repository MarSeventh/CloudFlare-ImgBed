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
export declare function createBlobs(url: URL, destPath: string, opts?: {
    fetch?: typeof fetch;
    maxFolderDepth?: number;
    accessToken?: string;
}): Promise<Array<{
    path: string;
    blob: Blob;
}>>;
//# sourceMappingURL=createBlobs.d.ts.map