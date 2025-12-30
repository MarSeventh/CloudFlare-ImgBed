import { createApiError } from "../error";
import type { XetTokenParams } from "./uploadShards";

export interface XetWriteTokenParams {
	accessToken: string | undefined;
	fetch?: typeof fetch;
	xetParams: XetTokenParams;
}

const JWT_SAFETY_PERIOD = 60_000;
const JWT_CACHE_SIZE = 1_000;

const jwtPromises: Map<string, Promise<{ accessToken: string; casUrl: string }>> = new Map();
/**
 * Cache to store JWTs, to avoid making many auth requests when downloading multiple files from the same repo
 */
const jwts: Map<
	string,
	{
		accessToken: string;
		expiresAt: Date;
		casUrl: string;
	}
> = new Map();

export async function xetWriteToken(params: XetWriteTokenParams): Promise<{ accessToken: string; casUrl: string }> {
	if (
		params.xetParams.expiresAt &&
		params.xetParams.casUrl &&
		params.xetParams.accessToken &&
		params.xetParams.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD)
	) {
		return { accessToken: params.xetParams.accessToken, casUrl: params.xetParams.casUrl };
	}
	const key = params.xetParams.refreshWriteTokenUrl;

	const jwt = jwts.get(key);

	if (jwt && jwt.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD)) {
		return { accessToken: jwt.accessToken, casUrl: jwt.casUrl };
	}

	// If we already have a promise for this repo, return it
	const existingPromise = jwtPromises.get(key);
	if (existingPromise) {
		return existingPromise;
	}

	const promise = (async () => {
		const resp = await (params.fetch ?? fetch)(params.xetParams.refreshWriteTokenUrl, {
			headers: {
				...(params.accessToken
					? {
							Authorization: `Bearer ${params.accessToken}`,
					  }
					: {}),
				...(params.xetParams.sessionId ? { "X-Xet-Session-Id": params.xetParams.sessionId } : {}),
			},
		});

		if (!resp.ok) {
			throw await createApiError(resp);
		}

		const json: { accessToken: string; casUrl: string; exp: number } = await resp.json();
		const jwt = {
			accessToken: json.accessToken,
			expiresAt: new Date(json.exp * 1000),
			casUrl: json.casUrl,
		};

		jwtPromises.delete(key);

		for (const [key, value] of jwts.entries()) {
			if (value.expiresAt < new Date(Date.now() + JWT_SAFETY_PERIOD)) {
				jwts.delete(key);
			} else {
				break;
			}
		}
		if (jwts.size >= JWT_CACHE_SIZE) {
			const keyToDelete = jwts.keys().next().value;
			if (keyToDelete) {
				jwts.delete(keyToDelete);
			}
		}
		jwts.set(key, jwt);

		return {
			accessToken: json.accessToken,
			casUrl: json.casUrl,
		};
	})();

	jwtPromises.set(key, promise);

	return promise;
}
