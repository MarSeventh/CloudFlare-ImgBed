import type { WidgetType } from "@huggingface/tasks";
import type { ApiModelInferenceProviderMappingEntry } from "../types/api/api-model";

/**
 * Normalize inferenceProviderMapping to always return an array format.
 *
 * Little hack to simplify Inference Providers logic and make it backward and forward compatible.
 * Right now, API returns a dict on model-info and a list on list-models. Let's harmonize to list.
 */
export function normalizeInferenceProviderMapping(
	hfModelId: string,
	inferenceProviderMapping?:
		| ApiModelInferenceProviderMappingEntry[]
		| Record<string, { providerId: string; status: "live" | "staging"; task: WidgetType }>
): ApiModelInferenceProviderMappingEntry[] {
	if (!inferenceProviderMapping) {
		return [];
	}

	// If it's already an array, return it as is
	if (Array.isArray(inferenceProviderMapping)) {
		return inferenceProviderMapping.map((entry) => ({
			...entry,
			hfModelId,
		}));
	}

	// Convert mapping to array format
	return Object.entries(inferenceProviderMapping).map(([provider, mapping]) => ({
		provider,
		hfModelId,
		providerId: mapping.providerId,
		status: mapping.status,
		task: mapping.task,
	}));
}
