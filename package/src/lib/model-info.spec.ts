import { describe, expect, it } from "vitest";
import { modelInfo } from "./model-info";
import type { ModelEntry } from "./list-models";
import type { ApiModelInfo } from "../types/api/api-model";

describe("modelInfo", () => {
	it("should return the model info", async () => {
		const info = await modelInfo({
			name: "openai-community/gpt2",
		});
		expect(info).toEqual({
			id: "621ffdc036468d709f17434d",
			downloads: expect.any(Number),
			gated: false,
			name: "openai-community/gpt2",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			task: "text-generation",
			private: false,
		});
	});

	it("should return the model info with author", async () => {
		const info: ModelEntry & Pick<ApiModelInfo, "author"> = await modelInfo({
			name: "openai-community/gpt2",
			additionalFields: ["author"],
		});
		expect(info).toEqual({
			id: "621ffdc036468d709f17434d",
			downloads: expect.any(Number),
			author: "openai-community",
			gated: false,
			name: "openai-community/gpt2",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			task: "text-generation",
			private: false,
		});
	});

	it("should return the model info for a specific revision", async () => {
		const info: ModelEntry & Pick<ApiModelInfo, "sha"> = await modelInfo({
			name: "openai-community/gpt2",
			additionalFields: ["sha"],
			revision: "f27b190eeac4c2302d24068eabf5e9d6044389ae",
		});
		expect(info).toEqual({
			id: "621ffdc036468d709f17434d",
			downloads: expect.any(Number),
			gated: false,
			name: "openai-community/gpt2",
			updatedAt: expect.any(Date),
			likes: expect.any(Number),
			task: "text-generation",
			private: false,
			sha: "f27b190eeac4c2302d24068eabf5e9d6044389ae",
		});
	});

	it("should return model info deepseek-ai models with inference provider mapping", async () => {
		const info = await modelInfo({
			name: "deepseek-ai/DeepSeek-R1-0528",
			additionalFields: ["inferenceProviderMapping"],
		});

		expect(info.inferenceProviderMapping).toBeDefined();
		expect(info.inferenceProviderMapping).toBeInstanceOf(Array);
		expect(info.inferenceProviderMapping?.length).toBeGreaterThan(0);
		info.inferenceProviderMapping?.forEach((item) => {
			expect(item).toHaveProperty("provider");
			expect(item).toHaveProperty("hfModelId", "deepseek-ai/DeepSeek-R1-0528");
			expect(item).toHaveProperty("providerId");
		});
	});
});
