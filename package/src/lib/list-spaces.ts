import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiSpaceInfo } from "../types/api/api-space";
import type { CredentialsParams, SpaceSdk } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { parseLinkHeader } from "../utils/parseLinkHeader";
import { pick } from "../utils/pick";

export const SPACE_EXPAND_KEYS = [
	"sdk",
	"likes",
	"private",
	"lastModified",
] as const satisfies readonly (keyof ApiSpaceInfo)[];
export const SPACE_EXPANDABLE_KEYS = [
	"author",
	"cardData",
	"datasets",
	"disabled",
	"gitalyUid",
	"lastModified",
	"createdAt",
	"likes",
	"private",
	"runtime",
	"sdk",
	// "siblings",
	"sha",
	"subdomain",
	"tags",
	"models",
] as const satisfies readonly (keyof ApiSpaceInfo)[];

export interface SpaceEntry {
	id: string;
	name: string;
	sdk?: SpaceSdk;
	likes: number;
	private: boolean;
	updatedAt: Date;
	// Use additionalFields to fetch the fields from ApiSpaceInfo
}

export async function* listSpaces<
	const T extends Exclude<(typeof SPACE_EXPANDABLE_KEYS)[number], (typeof SPACE_EXPAND_KEYS)[number]> = never,
>(
	params?: {
		search?: {
			/**
			 * Will search in the space name for matches
			 */
			query?: string;
			owner?: string;
			tags?: string[];
		};
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
		/**
		 * Additional fields to fetch from huggingface.co.
		 */
		additionalFields?: T[];
	} & Partial<CredentialsParams>
): AsyncGenerator<SpaceEntry & Pick<ApiSpaceInfo, T>> {
	const accessToken = params && checkCredentials(params);
	const search = new URLSearchParams([
		...Object.entries({
			limit: "500",
			...(params?.search?.owner ? { author: params.search.owner } : undefined),
			...(params?.search?.query ? { search: params.search.query } : undefined),
		}),
		...(params?.search?.tags?.map((tag) => ["filter", tag]) ?? []),
		...[...SPACE_EXPAND_KEYS, ...(params?.additionalFields ?? [])].map(
			(val) => ["expand", val] satisfies [string, string]
		),
	]).toString();
	let url: string | undefined = `${params?.hubUrl || HUB_URL}/api/spaces?${search}`;

	while (url) {
		const res: Response = await (params?.fetch ?? fetch)(url, {
			headers: {
				accept: "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
			},
		});

		if (!res.ok) {
			throw await createApiError(res);
		}

		const items: ApiSpaceInfo[] = await res.json();

		for (const item of items) {
			yield {
				...(params?.additionalFields && pick(item, params.additionalFields)),
				id: item._id,
				name: item.id,
				sdk: item.sdk,
				likes: item.likes,
				private: item.private,
				updatedAt: new Date(item.lastModified),
			} as SpaceEntry & Pick<ApiSpaceInfo, T>;
		}

		const linkHeader = res.headers.get("Link");

		url = linkHeader ? parseLinkHeader(linkHeader).next : undefined;
	}
}
