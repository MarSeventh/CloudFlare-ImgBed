import type { ApiModelInfo } from "../types/api/api-model";
import type { CredentialsParams } from "../types/public";
import { MODEL_EXPAND_KEYS, type MODEL_EXPANDABLE_KEYS, type ModelEntry } from "./list-models";
export declare function modelInfo<const T extends Exclude<(typeof MODEL_EXPANDABLE_KEYS)[number], (typeof MODEL_EXPAND_KEYS)[number]> = never>(params: {
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
} & Partial<CredentialsParams>): Promise<ModelEntry & Pick<ApiModelInfo, T>>;
//# sourceMappingURL=model-info.d.ts.map