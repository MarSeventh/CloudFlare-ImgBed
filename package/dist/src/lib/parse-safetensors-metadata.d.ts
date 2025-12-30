import type { CredentialsParams, RepoDesignation } from "../types/public";
import type { SetRequired } from "../vendor/type-fest/set-required";
export declare const SAFETENSORS_FILE = "model.safetensors";
export declare const SAFETENSORS_INDEX_FILE = "model.safetensors.index.json";
export declare const RE_SAFETENSORS_FILE: RegExp;
export declare const RE_SAFETENSORS_INDEX_FILE: RegExp;
export declare const RE_SAFETENSORS_SHARD_FILE: RegExp;
export interface SafetensorsShardFileInfo {
    prefix: string;
    basePrefix: string;
    shard: string;
    total: string;
}
export declare function parseSafetensorsShardFilename(filename: string): SafetensorsShardFileInfo | null;
type FileName = string;
export type TensorName = string;
export type Dtype = "F64" | "F32" | "F16" | "F8_E4M3" | "F8_E5M2" | "E8M0" | "F6_E3M2" | "F6_E2M3" | "F4" | "FP4" | "BF16" | "I64" | "I32" | "I16" | "I8" | "U16" | "U8" | "UE8" | "BOOL";
export interface TensorInfo {
    dtype: Dtype;
    shape: number[];
    data_offsets: [number, number];
}
export type SafetensorsFileHeader = Record<TensorName, TensorInfo> & {
    __metadata__: {
        total_parameters?: string | number;
    } & Record<string, string>;
};
export interface SafetensorsIndexJson {
    dtype?: string;
    metadata?: {
        total_parameters?: string | number;
    } & Record<string, string>;
    weight_map: Record<TensorName, FileName>;
}
export type SafetensorsShardedHeaders = Record<FileName, SafetensorsFileHeader>;
export type SafetensorsParseFromRepo = {
    sharded: false;
    header: SafetensorsFileHeader;
    parameterCount?: Partial<Record<Dtype, number>>;
    parameterTotal?: number;
} | {
    sharded: true;
    index: SafetensorsIndexJson;
    headers: SafetensorsShardedHeaders;
    parameterCount?: Partial<Record<Dtype, number>>;
    parameterTotal?: number;
};
/**
 * Analyze model.safetensors.index.json or model.safetensors from a model hosted
 * on Hugging Face using smart range requests to extract its metadata.
 */
export declare function parseSafetensorsMetadata(params: {
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
} & Partial<CredentialsParams>): Promise<SetRequired<SafetensorsParseFromRepo, "parameterCount">>;
export declare function parseSafetensorsMetadata(params: {
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
} & Partial<CredentialsParams>): Promise<SafetensorsParseFromRepo>;
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
export {};
//# sourceMappingURL=parse-safetensors-metadata.d.ts.map