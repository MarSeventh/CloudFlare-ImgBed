import { describe, expect, it } from "vitest";
import { datasetInfo } from "./dataset-info";
import type { DatasetEntry } from "./list-datasets";
import type { ApiDatasetInfo } from "../types/api/api-dataset";

describe("datasetInfo", () => {
	it("should return the dataset info", async () => {
		const info = await datasetInfo({
			name: "nyu-mll/glue",
		});
		expect(info).toEqual({
			id: "621ffdd236468d709f181e3f",
			downloads: expect.any(Number),
			gated: false,
			name: "nyu-mll/glue",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			private: false,
		});
	});

	it("should return the dataset info with author", async () => {
		const info: DatasetEntry & Pick<ApiDatasetInfo, "author"> = await datasetInfo({
			name: "nyu-mll/glue",
			additionalFields: ["author"],
		});
		expect(info).toEqual({
			id: "621ffdd236468d709f181e3f",
			downloads: expect.any(Number),
			gated: false,
			name: "nyu-mll/glue",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			private: false,
			author: "nyu-mll",
		});
	});

	it("should return the dataset info for a specific revision", async () => {
		const info: DatasetEntry & Pick<ApiDatasetInfo, "sha"> = await datasetInfo({
			name: "nyu-mll/glue",
			revision: "cb2099c76426ff97da7aa591cbd317d91fb5fcb7",
			additionalFields: ["sha"],
		});
		expect(info).toEqual({
			id: "621ffdd236468d709f181e3f",
			downloads: expect.any(Number),
			gated: false,
			name: "nyu-mll/glue",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			private: false,
			sha: "cb2099c76426ff97da7aa591cbd317d91fb5fcb7",
		});
	});
});
