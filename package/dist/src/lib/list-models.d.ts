import type { ApiModelInfo } from "../types/api/api-model";
import type { CredentialsParams, PipelineType } from "../types/public";
export declare const MODEL_EXPAND_KEYS: readonly ["pipeline_tag", "private", "gated", "downloads", "likes", "lastModified"];
export declare const MODEL_EXPANDABLE_KEYS: readonly ["author", "cardData", "config", "createdAt", "disabled", "downloads", "downloadsAllTime", "gated", "gitalyUid", "inferenceProviderMapping", "lastModified", "library_name", "likes", "model-index", "pipeline_tag", "private", "safetensors", "sha", "spaces", "tags", "transformersInfo"];
export interface ModelEntry {
    id: string;
    name: string;
    private: boolean;
    gated: false | "auto" | "manual";
    task?: PipelineType;
    likes: number;
    downloads: number;
    updatedAt: Date;
}
export declare function listModels<const T extends Exclude<(typeof MODEL_EXPANDABLE_KEYS)[number], (typeof MODEL_EXPAND_KEYS)[number]> = never>(params?: {
    search?: {
        /**
         * Will search in the model name for matches
         */
        query?: string;
        owner?: string;
        task?: PipelineType;
        tags?: string[];
        /**
         * Will search for models that have one of the inference providers in the list.
         */
        inferenceProviders?: string[];
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
} & Partial<CredentialsParams>): AsyncGenerator<ModelEntry & Pick<ApiModelInfo, T>>;
//# sourceMappingURL=list-models.d.ts.map