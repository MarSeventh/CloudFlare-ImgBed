import type { CredentialsParams } from "../types/public";
export declare function addCollectionItem(params: {
    /**
     * The slug of the collection to add the item to.
     */
    slug: string;
    /**
     * The item to add to the collection.
     */
    item: {
        type: "paper" | "collection" | "space" | "model" | "dataset";
        id: string;
    };
    /**
     * A note to attach to the item in the collection. The maximum size for a note is 500 characters.
     */
    note?: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<void>;
//# sourceMappingURL=add-collection-item.d.ts.map