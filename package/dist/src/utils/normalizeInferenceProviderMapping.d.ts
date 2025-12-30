import type { WidgetType } from "@huggingface/tasks";
import type { ApiModelInferenceProviderMappingEntry } from "../types/api/api-model";
/**
 * Normalize inferenceProviderMapping to always return an array format.
 *
 * Little hack to simplify Inference Providers logic and make it backward and forward compatible.
 * Right now, API returns a dict on model-info and a list on list-models. Let's harmonize to list.
 */
export declare function normalizeInferenceProviderMapping(hfModelId: string, inferenceProviderMapping?: ApiModelInferenceProviderMappingEntry[] | Record<string, {
    providerId: string;
    status: "live" | "staging";
    task: WidgetType;
}>): ApiModelInferenceProviderMappingEntry[];
//# sourceMappingURL=normalizeInferenceProviderMapping.d.ts.map