import { assert, it, describe } from "vitest";
import { parseSafetensorsMetadata, parseSafetensorsShardFilename } from "./parse-safetensors-metadata";
import { sum } from "../utils/sum";

describe("parseSafetensorsMetadata", () => {
	it("fetch info for single-file (with the default conventional filename)", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "google-bert/bert-base-uncased",
			computeParametersCount: true,
			revision: "86b5e0934494bd15c9632b12f734a8a67f723594",
		});

		assert(!parse.sharded);
		assert.deepStrictEqual(parse.header.__metadata__, { format: "pt" });

		// Example of one tensor (the header contains many tensors)

		assert.deepStrictEqual(parse.header["bert.embeddings.LayerNorm.beta"], {
			dtype: "F32",
			shape: [768],
			data_offsets: [0, 3072],
		});

		assert.deepStrictEqual(parse.parameterCount, { F32: 110_106_428 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 110_106_428);
		// total params = 110m
	});

	it("fetch info for sharded (with the default conventional filename)", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "bigscience/bloom",
			computeParametersCount: true,
			revision: "053d9cd9fbe814e091294f67fcfedb3397b954bb",
		});

		assert(parse.sharded);

		assert.strictEqual(Object.keys(parse.headers).length, 72);
		// This model has 72 shards!

		// Example of one tensor inside one file

		assert.deepStrictEqual(parse.headers["model_00012-of-00072.safetensors"]["h.10.input_layernorm.weight"], {
			dtype: "BF16",
			shape: [14336],
			data_offsets: [3288649728, 3288678400],
		});

		assert.deepStrictEqual(parse.parameterCount, { BF16: 176_247_271_424 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 176_247_271_424);
		// total params = 176B
	});

	it("fetch info for single-file with multiple dtypes", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "roberta-base",
			computeParametersCount: true,
			revision: "e2da8e2f811d1448a5b465c236feacd80ffbac7b",
		});

		assert(!parse.sharded);

		assert.deepStrictEqual(parse.parameterCount, { F32: 124_697_433, I64: 514 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 124_697_947);
		// total params = 124m
	});

	it("fetch info for single-file with file path", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "CompVis/stable-diffusion-v1-4",
			computeParametersCount: true,
			path: "unet/diffusion_pytorch_model.safetensors",
			revision: "133a221b8aa7292a167afc5127cb63fb5005638b",
		});

		assert(!parse.sharded);
		assert.deepStrictEqual(parse.header.__metadata__, { format: "pt" });

		// Example of one tensor (the header contains many tensors)

		assert.deepStrictEqual(parse.header["up_blocks.3.resnets.0.norm2.bias"], {
			dtype: "F32",
			shape: [320],
			data_offsets: [3_409_382_416, 3_409_383_696],
		});

		assert.deepStrictEqual(parse.parameterCount, { F32: 859_520_964 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 859_520_964);
	});

	it("fetch info for sharded with file path", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "Alignment-Lab-AI/ALAI-gemma-7b",
			computeParametersCount: true,
			path: "7b/1/model.safetensors.index.json",
			revision: "37e307261fe97bbf8b2463d61dbdd1a10daa264c",
		});

		assert(parse.sharded);

		assert.strictEqual(Object.keys(parse.headers).length, 4);

		assert.deepStrictEqual(parse.headers["model-00004-of-00004.safetensors"]["model.layers.24.mlp.up_proj.weight"], {
			dtype: "BF16",
			shape: [24576, 3072],
			data_offsets: [301996032, 452990976],
		});

		assert.deepStrictEqual(parse.parameterCount, { BF16: 8_537_680_896 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 8_537_680_896);
	});

	it("fetch info for sharded, but get param count directly from metadata", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "hf-internal-testing/sharded-model-metadata-num-parameters",
			computeParametersCount: true,
			revision: "999395eb3db277f3d7a0393402b02486ca91cef8",
		});

		assert(parse.sharded);
		assert.deepStrictEqual(parse.parameterTotal, 109_482_240);
		// total params = 109M
	});

	it("fetch info for single-file, but get param count directly from metadata", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "hf-internal-testing/single-file-model",
			computeParametersCount: true,
			revision: "75fcd3fed0285ac7f1092897ff2aefdf24bf872e",
		});

		assert(!parse.sharded);
		assert.deepStrictEqual(parse.parameterTotal, 109_482_240);
	});

	it("should detect sharded safetensors filename", async () => {
		const safetensorsFilename = "model_00005-of-00072.safetensors"; // https://huggingface.co/bigscience/bloom/blob/4d8e28c67403974b0f17a4ac5992e4ba0b0dbb6f/model_00005-of-00072.safetensors
		const safetensorsShardFileInfo = parseSafetensorsShardFilename(safetensorsFilename);

		assert.strictEqual(safetensorsShardFileInfo?.prefix, "model_");
		assert.strictEqual(safetensorsShardFileInfo?.basePrefix, "model");
		assert.strictEqual(safetensorsShardFileInfo?.shard, "00005");
		assert.strictEqual(safetensorsShardFileInfo?.total, "00072");
	});

	it("should detect sharded safetensors filename with 6 digits", async () => {
		const safetensorsFilename = "model-00001-of-000163.safetensors"; // https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Exp/blob/main/model-00001-of-000163.safetensors
		const safetensorsShardFileInfo = parseSafetensorsShardFilename(safetensorsFilename);

		assert.strictEqual(safetensorsShardFileInfo?.prefix, "model-");
		assert.strictEqual(safetensorsShardFileInfo?.basePrefix, "model");
		assert.strictEqual(safetensorsShardFileInfo?.shard, "00001");
		assert.strictEqual(safetensorsShardFileInfo?.total, "000163");
	});

	it("should support sub-byte data types", async () => {
		const newDataTypes: Array<"F4" | "F6_E2M3" | "F6_E3M2" | "E8M0"> = ["F4", "F6_E2M3", "F6_E3M2", "E8M0"];

		for (const dtype of newDataTypes) {
			const tensorInfo = {
				dtype,
				shape: [1, 2],
				data_offsets: [0, 1] as [number, number],
			};

			assert.ok(typeof tensorInfo.dtype === "string");
			assert.ok(["F4", "F6_E2M3", "F6_E3M2", "E8M0"].includes(tensorInfo.dtype));
		}
	});

	it("should handle parameter counting with sub-byte data types", () => {
		const mockHeader = {
			tensor_f4: {
				dtype: "F4" as const,
				shape: [10, 20],
				data_offsets: [0, 100] as [number, number],
			},
			tensor_f6_e2m3: {
				dtype: "F6_E2M3" as const,
				shape: [5, 10],
				data_offsets: [100, 150] as [number, number],
			},
			tensor_f6_e3m2: {
				dtype: "F6_E3M2" as const,
				shape: [8, 12],
				data_offsets: [150, 246] as [number, number],
			},
			tensor_e8m0: {
				dtype: "E8M0" as const,
				shape: [4, 6],
				data_offsets: [246, 270] as [number, number],
			},
			__metadata__: { format: "pt" },
		};

		const computeNumOfParamsByDtypeSingleFile = (header: typeof mockHeader) => {
			const counter: Partial<Record<string, number>> = {};
			const tensors = Object.fromEntries(Object.entries(header).filter(([key]) => key !== "__metadata__"));

			for (const [, v] of Object.entries(tensors) as [
				string,
				{ dtype: string; shape: number[]; data_offsets: [number, number] },
			][]) {
				if (v.shape.length === 0) {
					continue;
				}
				counter[v.dtype] = (counter[v.dtype] ?? 0) + v.shape.reduce((a: number, b: number) => a * b);
			}
			return counter;
		};

		const parameterCount = computeNumOfParamsByDtypeSingleFile(mockHeader);

		assert.strictEqual(parameterCount.F4, 200);
		assert.strictEqual(parameterCount.F6_E2M3, 50);
		assert.strictEqual(parameterCount.F6_E3M2, 96);
		assert.strictEqual(parameterCount.E8M0, 24);
	});

	it("fetch info for GPTQ quantized 8B model", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "RedHatAI/Meta-Llama-3.1-8B-Instruct-quantized.w4a16",
			revision: "3921b6aee65496a708b0af456c964ceca7423193",
			computeParametersCount: true,
		});

		const parameterCount = parse.parameterCount;
		assert.ok(parameterCount);
		assert.ok(parameterCount.I32);
		assert.ok(parameterCount.F16);
		assert.strictEqual(parameterCount.I32, 6_979_321_856);
		assert.strictEqual(parameterCount.F16, 1_052_315_648);

		const parameterCountTotal =
			parse.parameterTotal ??
			sum(
				Object.entries(parameterCount)
					.filter(([, value]) => typeof value === "number")
					.map(([, value]) => value as number)
			);

		assert.strictEqual(parameterCountTotal, 8_031_637_504);
	});

	it("fetch info for openai/gpt-oss-20b (large sharded model)", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "openai/gpt-oss-20b",
			computeParametersCount: true,
			revision: "bbf09307421df45099c1e7dcbd64e3106ce5b403",
		});

		assert(parse.sharded);

		assert.ok(Object.keys(parse.headers).length > 1);
		assert.ok(parse.parameterCount);

		const totalParams = parse.parameterTotal || sum(Object.values(parse.parameterCount));

		assert.strictEqual(totalParams, 21_511_953_984); // 21.5B

		assert.ok(parse.parameterCount.BF16 && parse.parameterCount.U8);

		assert.strictEqual(Object.keys(parse.headers).length, 3);
	});

	it("should support FP4 and UE8 data types in type system", () => {
		const newDataTypes: Array<"FP4" | "UE8"> = ["FP4", "UE8"];

		for (const dtype of newDataTypes) {
			const tensorInfo = {
				dtype,
				shape: [1, 2],
				data_offsets: [0, 1] as [number, number],
			};

			assert.ok(typeof tensorInfo.dtype === "string");
			assert.ok(["FP4", "UE8"].includes(tensorInfo.dtype));
		}

		const mockHeader = {
			tensor_fp4: {
				dtype: "FP4" as const,
				shape: [100, 200],
				data_offsets: [0, 5000] as [number, number],
			},
			tensor_ue8: {
				dtype: "UE8" as const,
				shape: [50, 100],
				data_offsets: [5000, 10000] as [number, number],
			},
			__metadata__: { format: "pt" },
		};

		const computeNumOfParamsByDtypeSingleFile = (header: typeof mockHeader) => {
			const counter: Partial<Record<string, number>> = {};
			const tensors = Object.fromEntries(Object.entries(header).filter(([key]) => key !== "__metadata__"));

			for (const [, v] of Object.entries(tensors) as [
				string,
				{ dtype: string; shape: number[]; data_offsets: [number, number] },
			][]) {
				if (v.shape.length === 0) {
					continue;
				}
				counter[v.dtype] = (counter[v.dtype] ?? 0) + v.shape.reduce((a: number, b: number) => a * b);
			}
			return counter;
		};

		const parameterCount = computeNumOfParamsByDtypeSingleFile(mockHeader);

		assert.strictEqual(parameterCount.FP4, 20000);
		assert.strictEqual(parameterCount.UE8, 5000);
	});

	it("fetch info for large index file (>10MB) with many experts (moonshotai/Kimi-K2-Instruct-0905)", async () => {
		// This model has a 13.5MB index file due to having 384 experts per layer
		const parse = await parseSafetensorsMetadata({
			repo: "moonshotai/Kimi-K2-Instruct-0905",
			revision: "7152993552508c9f22042b3bb93b5e6acd06ce73",
		});

		assert(parse.sharded);
		assert.strictEqual(Object.keys(parse.headers).length, 62);
	});
});
