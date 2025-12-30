import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { CredentialsParams } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { parseLinkHeader } from "../utils/parseLinkHeader";
import type { ApiCollectionInfo } from "../types/api/api-collection";

/*
 * When listing collections, the item list per collection is truncated to 4 items maximum.
 * To retrieve all items from a collection, you need to make an additional call using its collection slug.
 */
export async function* listCollections(
	params?: {
		search?: {
			/**
			 * Filter collections created by specific owners (users or organizations).
			 */
			owner?: string[];
			/**
			 * Filter collections containing specific items.
			 * Value must be the item_type and item_id concatenated.
			 * Example: "models/teknium/OpenHermes-2.5-Mistral-7B", "datasets/rajpurkar/squad" or "papers/2311.12983".
			 */
			item?: string[];
			/**
			 * Filter based on substrings for titles & descriptions.
			 */
			q?: string;
		};
		/**
		 * Sort the returned collections. Supported values are "lastModified", "trending" (default) and "upvotes".
		 */
		sort?: "lastModified" | "trending" | "upvotes";
		/**
		 *  Set to limit the number of collections returned.
		 */
		limit?: number;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): AsyncGenerator<ApiCollectionInfo> {
	const accessToken = params && checkCredentials(params);

	const searchParams = new URLSearchParams();

	let totalToFetch = params?.limit ?? Infinity;
	searchParams.append("limit", String(Math.min(totalToFetch, 100)));

	if (params?.sort) {
		searchParams.append("sort", params.sort);
	}

	if (params?.search?.owner) {
		for (const owner of params.search.owner) {
			searchParams.append("owner", owner);
		}
	}

	if (params?.search?.item) {
		for (const item of params.search.item) {
			searchParams.append("item", item);
		}
	}

	if (params?.search?.q) {
		searchParams.append("q", params.search.q);
	}

	let url: string | undefined = `${params?.hubUrl || HUB_URL}/api/collections?${searchParams}`;

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

		const collections: ApiCollectionInfo[] = await res.json();

		for (const collection of collections) {
			yield collection;

			totalToFetch--;

			if (totalToFetch <= 0) {
				return;
			}
		}

		const linkHeader = res.headers.get("Link");

		url = linkHeader ? parseLinkHeader(linkHeader).next : undefined;
	}
}
