import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiDatasetInfo } from "../types/api/api-dataset";
import type { CredentialsParams } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { pick } from "../utils/pick";
import { type DATASET_EXPANDABLE_KEYS, DATASET_EXPAND_KEYS, type DatasetEntry } from "./list-datasets";

export async function datasetInfo<
	const T extends Exclude<(typeof DATASET_EXPANDABLE_KEYS)[number], (typeof DATASET_EXPAND_KEYS)[number]> = never,
>(
	params: {
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
	} & Partial<CredentialsParams>
): Promise<DatasetEntry & Pick<ApiDatasetInfo, T>> {
	const accessToken = params && checkCredentials(params);

	const search = new URLSearchParams([
		...DATASET_EXPAND_KEYS.map((val) => ["expand", val] satisfies [string, string]),
		...(params?.additionalFields?.map((val) => ["expand", val] satisfies [string, string]) ?? []),
	]).toString();

	const response = await (params.fetch || fetch)(
		`${params?.hubUrl || HUB_URL}/api/datasets/${params.name}/revision/${encodeURIComponent(
			params.revision ?? "HEAD"
		)}?${search.toString()}`,
		{
			headers: {
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
		}
	);

	if (!response.ok) {
		throw await createApiError(response);
	}

	const data = await response.json();

	return {
		...(params?.additionalFields && pick(data, params.additionalFields)),
		id: data._id,
		name: data.id,
		private: data.private,
		downloads: data.downloads,
		likes: data.likes,
		gated: data.gated,
		updatedAt: new Date(data.lastModified),
	} as DatasetEntry & Pick<ApiDatasetInfo, T>;
}
