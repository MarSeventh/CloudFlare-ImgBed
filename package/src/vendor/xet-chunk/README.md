# Xet-Chunk

WASM utilities to chunk & hash data.

An assembly script implementation is available in `@huggingface/xetchunk-wasm`, but for performance reasons we're using WASM directly compiled from the rust source, see https://github.com/huggingface/xet-core/tree/main/hf_xet_wasm which on my local machine processes data at 480MB/s.

The `chunker_wasm_bg.js`and `chunker_wasm_bg.wasm.base64.ts` are generated with `pnpm --filter hub build:xet-wasm`.
