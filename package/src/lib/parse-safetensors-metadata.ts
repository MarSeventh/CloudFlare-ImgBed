import type { CredentialsParams, RepoDesignation } from "../types/public";
import { omit } from "../utils/omit";
import { toRepoId } from "../utils/toRepoId";
import { typedEntries } from "../utils/typedEntries";
import { downloadFile } from "./download-file";
import { fileExists } from "./file-exists";
import { promisesQueue } from "../utils/promisesQueue";
import type { SetRequired } from "../vendor/type-fest/set-required";

export const SAFETENSORS_FILE = "model.safetensors";
export const SAFETENSORS_INDEX_FILE = "model.safetensors.index.json";
/// We advise model/library authors to use the filenames above for convention inside model repos,
/// but in some situations safetensors weights have different filenames.
export const RE_SAFETENSORS_FILE = /\.safetensors$/;
export const RE_SAFETENSORS_INDEX_FILE = /\.safetensors\.index\.json$/;
export const RE_SAFETENSORS_SHARD_FILE =
	/^(?<prefix>(?<basePrefix>.*?)[_-])(?<shard>\d{5,6})-of-(?<total>\d{5,6})\.safetensors$/;
export interface SafetensorsShardFileInfo {
	prefix: string;
	basePrefix: string;
	shard: string;
	total: string;
}
export function parseSafetensorsShardFilename(filename: string): SafetensorsShardFileInfo | null {
	const match = RE_SAFETENSORS_SHARD_FILE.exec(filename);
	if (match && match.groups) {
		return {
			prefix: match.groups["prefix"],
			basePrefix: match.groups["basePrefix"],
			shard: match.groups["shard"],
			total: match.groups["total"],
		};
	}
	return null;
}

const PARALLEL_DOWNLOADS = 20;
const MAX_HEADER_LENGTH = 25_000_000;
const GPTQ_QWEIGHT_SUFFIX = "qweight";

class SafetensorParseError extends Error {}

type FileName = string;

export type TensorName = string;
export type Dtype =
	| "F64"
	| "F32"
	| "F16"
	| "F8_E4M3"
	| "F8_E5M2"
	| "E8M0"
	| "F6_E3M2"
	| "F6_E2M3"
	| "F4"
	| "FP4"
	| "BF16"
	| "I64"
	| "I32"
	| "I16"
	| "I8"
	| "U16"
	| "U8"
	| "UE8"
	| "BOOL";

export interface TensorInfo {
	dtype: Dtype;
	shape: number[];
	data_offsets: [number, number];
}

export type SafetensorsFileHeader = Record<TensorName, TensorInfo> & {
	__metadata__: { total_parameters?: string | number } & Record<string, string>;
};

export interface SafetensorsIndexJson {
	dtype?: string;
	/// ^there's sometimes a dtype but it looks inconsistent.
	metadata?: { total_parameters?: string | number } & Record<string, string>;
	/// ^ why the naming inconsistency?
	weight_map: Record<TensorName, FileName>;
}

export type SafetensorsShardedHeaders = Record<FileName, SafetensorsFileHeader>;

export type SafetensorsParseFromRepo =
	| {
			sharded: false;
			header: SafetensorsFileHeader;
			parameterCount?: Partial<Record<Dtype, number>>;
			parameterTotal?: number;
	  }
	| {
			sharded: true;
			index: SafetensorsIndexJson;
			headers: SafetensorsShardedHeaders;
			parameterCount?: Partial<Record<Dtype, number>>;
			parameterTotal?: number;
	  };

/**
 * Fetches and parses model config.json
 */
async function fetchModelConfig(
	params: {
		repo: RepoDesignation;
		revision?: string;
		hubUrl?: string;
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<ModelConfig | null> {
	try {
		const configBlob = await downloadFile({
			...params,
			path: "config.json",
		});

		if (!configBlob) {
			return null;
		}

		const config = JSON.parse(await configBlob.text());
		return config as ModelConfig;
	} catch (error) {
		// Config file might not exist or be inaccessible
		return null;
	}
}

async function parseSingleFile(
	path: string,
	params: {
		repo: RepoDesignation;
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<SafetensorsFileHeader> {
	const blob = await downloadFile({ ...params, path });

	if (!blob) {
		throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors header length.`);
	}

	const bufLengthOfHeaderLE = await blob.slice(0, 8).arrayBuffer();
	const lengthOfHeader = new DataView(bufLengthOfHeaderLE).getBigUint64(0, true);
	// ^little-endian
	if (lengthOfHeader <= 0) {
		throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is malformed.`);
	}
	if (lengthOfHeader > MAX_HEADER_LENGTH) {
		throw new SafetensorParseError(
			`Failed to parse file ${path}: safetensor header is too big. Maximum supported size is ${MAX_HEADER_LENGTH} bytes.`
		);
	}

	try {
		// no validation for now, we assume it's a valid FileHeader.
		const header: SafetensorsFileHeader = JSON.parse(await blob.slice(8, 8 + Number(lengthOfHeader)).text());
		return header;
	} catch (err) {
		throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is not valid JSON.`);
	}
}

async function parseShardedIndex(
	path: string,
	params: {
		repo: RepoDesignation;
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<SafetensorsIndexJson> {
	const indexBlob = await downloadFile({
		...params,
		path,
	});

	if (!indexBlob) {
		throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors index.`);
	}

	try {
		// no validation for now, we assume it's a valid IndexJson.
		const index = JSON.parse(await indexBlob.slice(0, 20_000_000).text());
		return index;
	} catch (error) {
		throw new SafetensorParseError(`Failed to parse file ${path}: not a valid JSON.`);
	}
}

async function fetchAllHeaders(
	path: string,
	index: SafetensorsIndexJson,
	params: {
		repo: RepoDesignation;
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<SafetensorsShardedHeaders> {
	const pathPrefix = path.slice(0, path.lastIndexOf("/") + 1);
	const filenames = [...new Set(Object.values(index.weight_map))];
	const shardedMap: SafetensorsShardedHeaders = Object.fromEntries(
		await promisesQueue(
			filenames.map(
				(filename) => async () =>
					[filename, await parseSingleFile(pathPrefix + filename, params)] satisfies [string, SafetensorsFileHeader]
			),
			PARALLEL_DOWNLOADS
		)
	);
	return shardedMap;
}

/**
 * Analyze model.safetensors.index.json or model.safetensors from a model hosted
 * on Hugging Face using smart range requests to extract its metadata.
 */
export async function parseSafetensorsMetadata(
	params: {
		/** Only models are supported */
		repo: RepoDesignation;
		/**
		 * Relative file path to safetensors file inside `repo`. Defaults to `SAFETENSORS_FILE` or `SAFETENSORS_INDEX_FILE` (whichever one exists).
		 */
		path?: string;
		/**
		 * Will include SafetensorsParseFromRepo["parameterCount"], an object containing the number of parameters for each DType
		 *
		 * @default false
		 */
		computeParametersCount: true;
		hubUrl?: string;
		revision?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<SetRequired<SafetensorsParseFromRepo, "parameterCount">>;
export async function parseSafetensorsMetadata(
	params: {
		/** Only models are supported */
		repo: RepoDesignation;
		path?: string;
		/**
		 * Will include SafetensorsParseFromRepo["parameterCount"], an object containing the number of parameters for each DType
		 *
		 * @default false
		 */
		computeParametersCount?: boolean;
		hubUrl?: string;
		revision?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<SafetensorsParseFromRepo>;
export async function parseSafetensorsMetadata(
	params: {
		repo: RepoDesignation;
		path?: string;
		computeParametersCount?: boolean;
		hubUrl?: string;
		revision?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<SafetensorsParseFromRepo> {
	const repoId = toRepoId(params.repo);

	if (repoId.type !== "model") {
		throw new TypeError("Only model repos should contain safetensors files.");
	}

	// Fetch model config for quantization information
	const modelConfig = params.computeParametersCount ? await fetchModelConfig(params) : null;
	const quantConfig = modelConfig?.quantization_config;

	if (
		(params.path && RE_SAFETENSORS_FILE.test(params.path)) ||
		(await fileExists({ ...params, path: SAFETENSORS_FILE }))
	) {
		const header = await parseSingleFile(params.path ?? SAFETENSORS_FILE, params);
		return {
			sharded: false,
			header,
			...(params.computeParametersCount
				? {
						parameterCount: computeNumOfParamsByDtypeSingleFile(header, quantConfig),
						parameterTotal:
							/// shortcut: get param count directly from metadata
							header.__metadata__.total_parameters
								? typeof header.__metadata__.total_parameters === "number"
									? header.__metadata__.total_parameters
									: typeof header.__metadata__.total_parameters === "string"
									  ? parseInt(header.__metadata__.total_parameters)
									  : undefined
								: undefined,
				  }
				: undefined),
		};
	} else if (
		(params.path && RE_SAFETENSORS_INDEX_FILE.test(params.path)) ||
		(await fileExists({ ...params, path: SAFETENSORS_INDEX_FILE }))
	) {
		const path = params.path ?? SAFETENSORS_INDEX_FILE;
		const index = await parseShardedIndex(path, params);
		const shardedMap = await fetchAllHeaders(path, index, params);

		return {
			sharded: true,
			index,
			headers: shardedMap,
			...(params.computeParametersCount
				? {
						parameterCount: computeNumOfParamsByDtypeSharded(shardedMap, quantConfig),
						parameterTotal:
							/// shortcut: get param count directly from metadata
							index.metadata?.total_parameters
								? typeof index.metadata.total_parameters === "number"
									? index.metadata.total_parameters
									: typeof index.metadata.total_parameters === "string"
									  ? parseInt(index.metadata.total_parameters)
									  : undefined
								: undefined,
				  }
				: undefined),
		};
	} else {
		throw new Error("model id does not seem to contain safetensors weights");
	}
}

export interface QuantizationConfig {
	quant_method?: string;
	modules_to_not_convert?: string[];
	bits?: number;
	load_in_4bit?: boolean;
	load_in_8bit?: boolean;
}

export interface ModelConfig {
	quantization_config?: QuantizationConfig;
}

/**
 * Determines if a tensor is quantized based on quantization config and tensor name
 */
function isQuantizedTensor(tensorName: string, quantConfig?: QuantizationConfig): boolean {
	if (!quantConfig) {
		return false;
	}

	if (!quantConfig.modules_to_not_convert || quantConfig.modules_to_not_convert.length === 0) {
		return true;
	}

	for (const pattern of quantConfig.modules_to_not_convert) {
		const regexPattern = pattern.replace(/\*/g, ".*");
		const regex = new RegExp(regexPattern);
		if (regex.test(tensorName)) {
			return false;
		}
	}

	return true;
}

/**
 * Gets the parameter multiplier for a quantized tensor based on quantization method
 */
function getQuantizationMultiplier(tensorName: string, dtype: Dtype, quantConfig?: QuantizationConfig): number {
	if (!quantConfig || !isQuantizedTensor(tensorName, quantConfig)) {
		return 1;
	}

	const quantMethod = quantConfig.quant_method?.toLowerCase();

	switch (quantMethod) {
		case "mxfp4":
			if (dtype === "U8" && tensorName.includes("_blocks")) {
				return 2;
			}
			return 1;

		case "gptq":
		case "awq":
			if (getTensorSuffix(tensorName) === GPTQ_QWEIGHT_SUFFIX) {
				const bits = quantConfig.bits && quantConfig.bits > 0 ? quantConfig.bits : 4;
				return Math.max(1, Math.floor(32 / bits));
			}
			if (quantConfig.bits === 4 && dtype === "U8") {
				return 2;
			}
			if (quantConfig.bits === 2 && dtype === "U8") {
				return 4;
			}
			return 1;

		case "bitsandbytes":
			if (quantConfig.load_in_4bit && dtype === "U8") {
				return 2;
			}
			if (quantConfig.load_in_8bit) {
				return 1;
			}
			return 1;

		default:
			if (quantConfig.load_in_4bit && dtype === "U8") {
				return 2;
			}
			if (quantConfig.bits === 4 && dtype === "U8") {
				return 2;
			}
			return 1;
	}
}

function computeNumOfParamsByDtypeSingleFile(
	header: SafetensorsFileHeader,
	quantConfig?: QuantizationConfig
): Partial<Record<Dtype, number>> {
	const counter: Partial<Record<Dtype, number>> = {};
	const tensors = omit(header, "__metadata__");

	for (const [tensorName, v] of typedEntries(tensors)) {
		if (shouldSkipTensor(tensorName, quantConfig)) {
			continue;
		}
		if (v.shape.length === 0) {
			continue;
		}

		const elements = v.shape.reduce((a, b) => a * b);
		const multiplier = quantConfig ? getQuantizationMultiplier(tensorName, v.dtype, quantConfig) : 1;
		if (multiplier === 0) {
			continue;
		}
		counter[v.dtype] = (counter[v.dtype] ?? 0) + elements * multiplier;
	}
	return counter;
}

function computeNumOfParamsByDtypeSharded(
	shardedMap: SafetensorsShardedHeaders,
	quantConfig?: QuantizationConfig
): Partial<Record<Dtype, number>> {
	const counter: Partial<Record<Dtype, number>> = {};
	for (const header of Object.values(shardedMap)) {
		for (const [k, v] of typedEntries(computeNumOfParamsByDtypeSingleFile(header, quantConfig))) {
			counter[k] = (counter[k] ?? 0) + (v ?? 0);
		}
	}
	return counter;
}

function getTensorSuffix(tensorName: string): string {
	const lastDotIndex = tensorName.lastIndexOf(".");
	return lastDotIndex === -1 ? tensorName : tensorName.slice(lastDotIndex + 1);
}

function shouldSkipTensor(tensorName: string, quantConfig?: QuantizationConfig): boolean {
	const GPTQ_AWQ_AUXILIARY_SUFFIXES = ["qzeros", "g_idx", "scales"];

	if (!quantConfig) {
		return false;
	}

	const quantMethod = quantConfig.quant_method?.toLowerCase();
	if (!quantMethod || (quantMethod !== "gptq" && quantMethod !== "awq")) {
		return false;
	}

	if (!isQuantizedTensor(tensorName, quantConfig)) {
		return false;
	}

	const suffix = getTensorSuffix(tensorName);
	if (suffix === GPTQ_QWEIGHT_SUFFIX) {
		return false;
	}

	return GPTQ_AWQ_AUXILIARY_SUFFIXES.includes(suffix);
}
