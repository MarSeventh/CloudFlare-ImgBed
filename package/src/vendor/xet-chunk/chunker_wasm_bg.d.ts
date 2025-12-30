/* tslint:disable */
/* eslint-disable */
export function compute_xorb_hash(chunks_array: Array<{ hash: string; length: number }>): string;
export function compute_verification_hash(chunkHashes: string[]): string;
export function compute_file_hash(chunks_array: Array<{ hash: string; length: number }>): string;
export function compute_hmac(hash: string, key: string): string;
export class Chunker {
	free(): void;
	constructor(target_chunk_size: number);
	add_data(data: Uint8Array): Array<{ hash: string; length: number; dedup: boolean }>;
	finish(): Array<{ hash: string; length: number; dedup: boolean }>;
}
