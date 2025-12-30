import type { CredentialsParams } from "../types/public";
export declare function deleteCollection(params: {
    /**
     * The slug of the collection to delete.
     */
    slug: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<void>;
//# sourceMappingURL=delete-collection.d.ts.map