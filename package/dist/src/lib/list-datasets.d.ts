import type { ApiDatasetInfo } from "../types/api/api-dataset";
import type { CredentialsParams } from "../types/public";
export declare const DATASET_EXPAND_KEYS: readonly ["private", "downloads", "gated", "likes", "lastModified"];
export declare const DATASET_EXPANDABLE_KEYS: readonly ["author", "cardData", "citation", "createdAt", "disabled", "description", "downloads", "downloadsAllTime", "gated", "gitalyUid", "lastModified", "likes", "paperswithcode_id", "private", "sha", "tags"];
export interface DatasetEntry {
    id: string;
    name: string;
    private: boolean;
    downloads: number;
    gated: false | "auto" | "manual";
    likes: number;
    updatedAt: Date;
}
export declare function listDatasets<const T extends Exclude<(typeof DATASET_EXPANDABLE_KEYS)[number], (typeof DATASET_EXPAND_KEYS)[number]> = never>(params?: {
    search?: {
        /**
         * Will search in the dataset name for matches
         */
        query?: string;
        owner?: string;
        tags?: string[];
    };
    hubUrl?: string;
    additionalFields?: T[];
    /**
     * Set to limit the number of models returned.
     */
    limit?: number;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): AsyncGenerator<DatasetEntry & Pick<ApiDatasetInfo, T>>;
//# sourceMappingURL=list-datasets.d.ts.map