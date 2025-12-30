import type { ApiCollectionInfo } from "../types/api/api-collection";
import type { CredentialsParams } from "../types/public";
export declare function collectionInfo(params: {
    /**
     * The slug of the collection.
     */
    slug: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<ApiCollectionInfo & {
    position: number;
    shareUrl: string;
}>;
//# sourceMappingURL=collection-info.d.ts.map