import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiSpaceInfo } from "../types/api/api-space";
import type { CredentialsParams } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { pick } from "../utils/pick";
import type { SPACE_EXPANDABLE_KEYS, SpaceEntry } from "./list-spaces";
import { SPACE_EXPAND_KEYS } from "./list-spaces";

export async function spaceInfo<
	const T extends Exclude<(typeof SPACE_EXPANDABLE_KEYS)[number], (typeof SPACE_EXPAND_KEYS)[number]> = never,
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
): Promise<SpaceEntry & Pick<ApiSpaceInfo, T>> {
	const accessToken = params && checkCredentials(params);

	const search = new URLSearchParams([
		...SPACE_EXPAND_KEYS.map((val) => ["expand", val] satisfies [string, string]),
		...(params?.additionalFields?.map((val) => ["expand", val] satisfies [string, string]) ?? []),
	]).toString();

	const response = await (params.fetch || fetch)(
		`${params?.hubUrl || HUB_URL}/api/spaces/${params.name}/revision/${encodeURIComponent(
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
		sdk: data.sdk,
		likes: data.likes,
		private: data.private,
		updatedAt: new Date(data.lastModified),
	} as SpaceEntry & Pick<ApiSpaceInfo, T>;
}
