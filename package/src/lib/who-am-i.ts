import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiWhoAmIReponse } from "../types/api/api-who-am-i";
import type { AccessTokenRole, AuthType, CredentialsParams } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";

export interface WhoAmIUser {
	/** Unique ID persistent across renames */
	id: string;
	type: "user";
	email: string;
	emailVerified: boolean;
	isPro: boolean;
	orgs: WhoAmIOrg[];
	name: string;
	fullname: string;
	canPay: boolean;
	avatarUrl: string;
	/**
	 * Unix timestamp in seconds
	 */
	periodEnd: number | null;
	billingMode: "postpaid" | "prepaid";
}

export interface WhoAmIOrg {
	/** Unique ID persistent across renames */
	id: string;
	type: "org";
	name: string;
	fullname: string;
	email: string | null;
	canPay: boolean;
	avatarUrl: string;
	/**
	 * Unix timestamp in seconds
	 */
	periodEnd: number | null;
}

export interface WhoAmIApp {
	id: string;
	type: "app";
	name: string;
	scope?: {
		entities: string[];
		role: "admin" | "write" | "contributor" | "read";
	};
}

export type WhoAmI = WhoAmIApp | WhoAmIOrg | WhoAmIUser;
export interface AuthInfo {
	type: AuthType;
	accessToken?: {
		displayName: string;
		role: AccessTokenRole;
		createdAt: Date;
	};
	expiresAt?: Date;
}

export async function whoAmI(
	params: {
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & CredentialsParams
): Promise<WhoAmI & { auth: AuthInfo }> {
	const accessToken = checkCredentials(params);

	const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/whoami-v2`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!res.ok) {
		throw await createApiError(res);
	}

	const response: ApiWhoAmIReponse & {
		auth: AuthInfo;
	} = await res.json();

	if (typeof response.auth.accessToken?.createdAt === "string") {
		response.auth.accessToken.createdAt = new Date(response.auth.accessToken.createdAt);
	}

	return response;
}
