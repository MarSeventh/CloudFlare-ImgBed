import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { CredentialsParams } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";

export async function addCollectionItem(
	params: {
		/**
		 * The slug of the collection to add the item to.
		 */
		slug: string;
		/**
		 * The item to add to the collection.
		 */
		item: {
			type: "paper" | "collection" | "space" | "model" | "dataset";
			id: string;
		};
		/**
		 * A note to attach to the item in the collection. The maximum size for a note is 500 characters.
		 */
		note?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<void> {
	if (!params.slug) {
		throw new TypeError("slug is required");
	}

	const accessToken = checkCredentials(params);

	const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/collections/${params.slug}/items`, {
		method: "POST",
		body: JSON.stringify({
			item: params.item,
			note: params.note,
		}),
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	if (!res.ok) {
		throw await createApiError(res);
	}
}
