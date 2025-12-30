import type { ApiDatasetInfo } from "../types/api/api-dataset";
import type { CredentialsParams } from "../types/public";
import { type DATASET_EXPANDABLE_KEYS, DATASET_EXPAND_KEYS, type DatasetEntry } from "./list-datasets";
export declare function datasetInfo<const T extends Exclude<(typeof DATASET_EXPANDABLE_KEYS)[number], (typeof DATASET_EXPAND_KEYS)[number]> = never>(params: {
    name: string;
    hubUrl?: string;
    additionalFields?: T[];
    /**
     * An optional Git revision id which can be a branch name, a tag, or a commit hash.
     */
    revision?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<DatasetEntry & Pick<ApiDatasetInfo, T>>;
//# sourceMappingURL=dataset-info.d.ts.map