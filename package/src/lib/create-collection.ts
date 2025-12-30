import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiCreateCollectionPayload } from "../types/api/api-create-collection";
import type { CredentialsParams } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";

export async function createCollection(
	params: {
		collection: ApiCreateCollectionPayload;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<{ slug: string }> {
	const accessToken = checkCredentials(params);

	const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/collections`, {
		method: "POST",
		body: JSON.stringify(params.collection),
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	if (!res.ok) {
		throw await createApiError(res);
	}

	const output = await res.json();

	return { slug: output.slug };
}
