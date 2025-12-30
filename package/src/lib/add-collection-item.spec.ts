import { it, describe, expect } from "vitest";

import { TEST_HUB_URL, TEST_ACCESS_TOKEN, TEST_USER } from "../test/consts";
import { addCollectionItem } from "./add-collection-item";
import { collectionInfo } from "./collection-info";
import { deleteCollectionItem } from "./delete-collection-item";
import { createCollection } from "./create-collection";
import { deleteCollection } from "./delete-collection";

describe("addCollectionItem", () => {
	it("should add a item to a collection", async () => {
		let slug: string = "";

		const randomString = crypto.randomUUID();
		const title = `Test Collection ${randomString}`;

		try {
			const result = await createCollection({
				collection: {
					title,
					namespace: TEST_USER,
					description: "This is a test collection",
					private: false,
				},
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});

			slug = result.slug;

			expect(result.slug.startsWith(`${TEST_USER}/test-collection-${randomString}`)).toBe(true);

			await addCollectionItem({
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
				slug,
				item: {
					type: "collection",
					// temporary, later the slug should work on its own
					id: result.slug.slice(-24),
				},
				note: "This is a test item",
			});

			const items = await collectionInfo({
				slug,
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});

			expect(items.items.length).toBe(1);
			expect(items.items[0].type).toBe("collection");
			// temporary, later the slug should work on its own right?
			expect(items.items[0].id).toBe(result.slug.slice(-24));
			expect(items.items[0].note).toEqual({
				html: "This is a test item",
				text: "This is a test item",
			});

			await deleteCollectionItem({
				slug,
				itemId: items.items[0]._id,
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});

			const items2 = await collectionInfo({
				slug,
				accessToken: TEST_ACCESS_TOKEN,
				hubUrl: TEST_HUB_URL,
			});

			expect(items2.items.length).toBe(0);
		} finally {
			if (slug) {
				await deleteCollection({
					slug,
					accessToken: TEST_ACCESS_TOKEN,
					hubUrl: TEST_HUB_URL,
				});
			}
		}
	});
});
