import type { ApiCreateCollectionPayload } from "../types/api/api-create-collection";
import type { CredentialsParams } from "../types/public";
export declare function createCollection(params: {
    collection: ApiCreateCollectionPayload;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<{
    slug: string;
}>;
//# sourceMappingURL=create-collection.d.ts.map