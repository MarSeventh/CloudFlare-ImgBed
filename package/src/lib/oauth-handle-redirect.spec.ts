import { describe, expect, it } from "vitest";
import { TEST_COOKIE, TEST_HUB_URL } from "../test/consts";
import { oauthLoginUrl } from "./oauth-login-url";
import { oauthHandleRedirect } from "./oauth-handle-redirect";

describe("oauthHandleRedirect", () => {
	it("should work", async () => {
		const localStorage = {
			nonce: undefined,
			codeVerifier: undefined,
		};
		const url = await oauthLoginUrl({
			clientId: "dummy-app",
			redirectUrl: "http://localhost:3000",
			localStorage,
			scopes: "openid profile email",
			hubUrl: TEST_HUB_URL,
		});
		const resp = await fetch(url, {
			method: "POST",
			headers: {
				Cookie: `token=${TEST_COOKIE}`,
			},
			redirect: "manual",
		});
		if (resp.status !== 303) {
			throw new Error(`Failed to fetch url ${url}: ${resp.status} ${resp.statusText}`);
		}
		const location = resp.headers.get("Location");
		if (!location) {
			throw new Error(`No location header in response`);
		}
		const result = await oauthHandleRedirect({
			redirectedUrl: location,
			codeVerifier: localStorage.codeVerifier,
			nonce: localStorage.nonce,
			hubUrl: TEST_HUB_URL,
		});

		if (!result) {
			throw new Error("Expected result to be defined");
		}
		expect(result.accessToken).toEqual(expect.any(String));
		expect(result.accessTokenExpiresAt).toBeInstanceOf(Date);
		expect(result.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
		expect(result.scope).toEqual(expect.any(String));
		expect(result.userInfo).toEqual({
			sub: "62f264b9f3c90f4b6514a269",
			name: "@huggingface/hub CI bot",
			preferred_username: "hub.js",
			email_verified: true,
			email: "eliott@huggingface.co",
			isPro: false,
			picture: "https://hub-ci.huggingface.co/avatars/934b830e9fdaa879487852f79eef7165.svg",
			profile: "https://hub-ci.huggingface.co/hub.js",
			website: "https://github.com/huggingface/hub.js",
			orgs: [],
		});
	});
});
