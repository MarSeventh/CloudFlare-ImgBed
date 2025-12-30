import type { CredentialsParams } from "../types/public";
import type { ApiCollectionInfo } from "../types/api/api-collection";
export declare function listCollections(params?: {
    search?: {
        /**
         * Filter collections created by specific owners (users or organizations).
         */
        owner?: string[];
        /**
         * Filter collections containing specific items.
         * Value must be the item_type and item_id concatenated.
         * Example: "models/teknium/OpenHermes-2.5-Mistral-7B", "datasets/rajpurkar/squad" or "papers/2311.12983".
         */
        item?: string[];
        /**
         * Filter based on substrings for titles & descriptions.
         */
        q?: string;
    };
    /**
     * Sort the returned collections. Supported values are "lastModified", "trending" (default) and "upvotes".
     */
    sort?: "lastModified" | "trending" | "upvotes";
    /**
     *  Set to limit the number of collections returned.
     */
    limit?: number;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): AsyncGenerator<ApiCollectionInfo>;
//# sourceMappingURL=list-collections.d.ts.map