import { describe, expect, it } from "vitest";
import { spaceInfo } from "./space-info";
import type { SpaceEntry } from "./list-spaces";
import type { ApiSpaceInfo } from "../types/api/api-space";

describe("spaceInfo", () => {
	it("should return the space info", async () => {
		const info = await spaceInfo({
			name: "huggingfacejs/client-side-oauth",
		});
		expect(info).toEqual({
			id: "659835e689010f9c7aed608d",
			name: "huggingfacejs/client-side-oauth",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			private: false,
			sdk: "static",
		});
	});

	it("should return the space info with author", async () => {
		const info: SpaceEntry & Pick<ApiSpaceInfo, "author"> = await spaceInfo({
			name: "huggingfacejs/client-side-oauth",
			additionalFields: ["author"],
		});
		expect(info).toEqual({
			id: "659835e689010f9c7aed608d",
			name: "huggingfacejs/client-side-oauth",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			private: false,
			sdk: "static",
			author: "huggingfacejs",
		});
	});

	it("should return the space info for a given revision", async () => {
		const info: SpaceEntry & Pick<ApiSpaceInfo, "sha"> = await spaceInfo({
			name: "huggingfacejs/client-side-oauth",
			additionalFields: ["sha"],
			revision: "e410a9ff348e6bed393b847711e793282d7c672e",
		});
		expect(info).toEqual({
			id: "659835e689010f9c7aed608d",
			name: "huggingfacejs/client-side-oauth",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			private: false,
			sdk: "static",
			sha: "e410a9ff348e6bed393b847711e793282d7c672e",
		});
	});
});
