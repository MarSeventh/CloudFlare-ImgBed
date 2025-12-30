import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { CredentialsParams } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";

export async function deleteCollectionItem(
	params: {
		/**
		 * The slug of the collection to delete the item from.
		 */
		slug: string;
		/**
		 * The item object id which is different from the repo_id/paper_id provided when adding the item to the collection.
		 * This should be the _id property of the item.
		 */
		itemId: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<void> {
	const accessToken = checkCredentials(params);

	const res = await (params.fetch ?? fetch)(
		`${params.hubUrl ?? HUB_URL}/api/collections/${params.slug}/items/${params.itemId}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		}
	);

	if (!res.ok) {
		throw await createApiError(res);
	}
}
