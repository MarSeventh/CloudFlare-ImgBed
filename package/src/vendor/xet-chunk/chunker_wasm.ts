// export * from "./chunker_wasm_bg.js";
import * as __glue_imports from "./chunker_wasm_bg.js";
// @ts-expect-error no types
import { __wbg_set_wasm } from "./chunker_wasm_bg.js";
// @ts-expect-error no types
import { wasmBinary } from "./chunker_wasm_bg.wasm.base64.ts";

let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
	if (initPromise) {
		return initPromise;
	}
	let resolve: (value: void) => void;
	let reject: (reason?: unknown) => void;
	initPromise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	await Promise.resolve();

	try {
		const wasmModule = await WebAssembly.compile(wasmBinary);
		const imports = Object.entries(
			WebAssembly.Module.imports(wasmModule).reduce(
				(result, item) => ({
					...result,
					// @ts-expect-error ok for any type
					[item.module]: [...(result[item.module] || []), item.name],
				}),
				{}
			)
		).map(([from, names]) => ({ from, names }));
		const wasm = await WebAssembly.instantiate(wasmModule, {
			"./hf_xet_thin_wasm_bg.js": Object.fromEntries(
				// @ts-expect-error ok for any type
				(imports[0].names as string[]).map((name) => [name, __glue_imports[name]])
			),
		});
		__wbg_set_wasm(wasm.exports);
		// console.log("exports", exports);
		// @ts-expect-error it's assigned
		wasm.exports.__wbindgen_start();

		// @ts-expect-error it's assigned
		resolve();
	} catch (error) {
		// @ts-expect-error it's assigned
		reject(error);
	}
}

init();

export { init };

export {
	compute_xorb_hash,
	compute_file_hash,
	Chunker,
	compute_verification_hash,
	compute_hmac,
} from "./chunker_wasm_bg.js";

// const exports = WebAssembly.Module.exports(wasmModule).map((item) => item.name);

// console.log("imports", imports);
