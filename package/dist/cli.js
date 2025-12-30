#! /usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/vendor/hash-wasm/sha256.js
var import_meta, Module, sha256_default;
var init_sha256 = __esm({
  "src/vendor/hash-wasm/sha256.js"() {
    "use strict";
    import_meta = {};
    Module = (() => {
      var _unused = import_meta.url;
      return function(moduleArg = {}) {
        var Module2 = moduleArg;
        var readyPromiseResolve, readyPromiseReject;
        Module2["ready"] = new Promise((resolve3, reject) => {
          readyPromiseResolve = resolve3;
          readyPromiseReject = reject;
        });
        var moduleOverrides = Object.assign({}, Module2);
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = (status, toThrow) => {
          throw toThrow;
        };
        var ENVIRONMENT_IS_WEB = typeof window == "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
        var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
        var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
        var scriptDirectory = "";
        function locateFile(path2) {
          if (Module2["locateFile"]) {
            return Module2["locateFile"](path2, scriptDirectory);
          }
          return scriptDirectory + path2;
        }
        var read_, readAsync, readBinary;
        if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = self.location.href;
          } else if (typeof document != "undefined" && document.currentScript) {
            scriptDirectory = document.currentScript.src;
          }
          if (false) {
            scriptDirectory = false;
          }
          if (scriptDirectory.startsWith("blob:")) {
            scriptDirectory = "";
          } else {
            scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
          }
          {
            read_ = (url) => {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, false);
              xhr.send(null);
              return xhr.responseText;
            };
            if (ENVIRONMENT_IS_WORKER) {
              readBinary = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(
                  /** @type{!ArrayBuffer} */
                  xhr.response
                );
              };
            }
            readAsync = (url, onload, onerror) => {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, true);
              xhr.responseType = "arraybuffer";
              xhr.onload = () => {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                  onload(xhr.response);
                  return;
                }
                onerror();
              };
              xhr.onerror = onerror;
              xhr.send(null);
            };
          }
        } else {
        }
        var out = Module2["print"] || console.log.bind(console);
        var err = Module2["printErr"] || console.error.bind(console);
        Object.assign(Module2, moduleOverrides);
        moduleOverrides = null;
        if (Module2["arguments"])
          arguments_ = Module2["arguments"];
        if (Module2["thisProgram"])
          thisProgram = Module2["thisProgram"];
        if (Module2["quit"])
          quit_ = Module2["quit"];
        var wasmBinary2;
        if (Module2["wasmBinary"])
          wasmBinary2 = Module2["wasmBinary"];
        if (typeof WebAssembly != "object") {
          abort("no native wasm support detected");
        }
        function intArrayFromBase64(s) {
          var decoded = atob(s);
          var bytes = new Uint8Array(decoded.length);
          for (var i = 0; i < decoded.length; ++i) {
            bytes[i] = decoded.charCodeAt(i);
          }
          return bytes;
        }
        function tryParseAsDataURI(filename) {
          if (!isDataURI(filename)) {
            return;
          }
          return intArrayFromBase64(filename.slice(dataURIPrefix.length));
        }
        var wasmMemory;
        var ABORT = false;
        var EXITSTATUS;
        function assert(condition, text) {
          if (!condition) {
            abort(text);
          }
        }
        var HEAP, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
        function updateMemoryViews() {
          var b = wasmMemory.buffer;
          Module2["HEAP8"] = HEAP8 = new Int8Array(b);
          Module2["HEAP16"] = HEAP16 = new Int16Array(b);
          Module2["HEAPU8"] = HEAPU8 = new Uint8Array(b);
          Module2["HEAPU16"] = HEAPU16 = new Uint16Array(b);
          Module2["HEAP32"] = HEAP32 = new Int32Array(b);
          Module2["HEAPU32"] = HEAPU32 = new Uint32Array(b);
          Module2["HEAPF32"] = HEAPF32 = new Float32Array(b);
          Module2["HEAPF64"] = HEAPF64 = new Float64Array(b);
        }
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATEXIT__ = [];
        var __ATPOSTRUN__ = [];
        var runtimeInitialized = false;
        function preRun() {
          if (Module2["preRun"]) {
            if (typeof Module2["preRun"] == "function")
              Module2["preRun"] = [Module2["preRun"]];
            while (Module2["preRun"].length) {
              addOnPreRun(Module2["preRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPRERUN__);
        }
        function initRuntime() {
          runtimeInitialized = true;
          callRuntimeCallbacks(__ATINIT__);
        }
        function postRun() {
          if (Module2["postRun"]) {
            if (typeof Module2["postRun"] == "function")
              Module2["postRun"] = [Module2["postRun"]];
            while (Module2["postRun"].length) {
              addOnPostRun(Module2["postRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPOSTRUN__);
        }
        function addOnPreRun(cb) {
          __ATPRERUN__.unshift(cb);
        }
        function addOnInit(cb) {
          __ATINIT__.unshift(cb);
        }
        function addOnExit(cb) {
        }
        function addOnPostRun(cb) {
          __ATPOSTRUN__.unshift(cb);
        }
        var runDependencies = 0;
        var runDependencyWatcher = null;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
          return id;
        }
        function addRunDependency(id) {
          runDependencies++;
          Module2["monitorRunDependencies"]?.(runDependencies);
        }
        function removeRunDependency(id) {
          runDependencies--;
          Module2["monitorRunDependencies"]?.(runDependencies);
          if (runDependencies == 0) {
            if (runDependencyWatcher !== null) {
              clearInterval(runDependencyWatcher);
              runDependencyWatcher = null;
            }
            if (dependenciesFulfilled) {
              var callback = dependenciesFulfilled;
              dependenciesFulfilled = null;
              callback();
            }
          }
        }
        function abort(what) {
          Module2["onAbort"]?.(what);
          what = "Aborted(" + what + ")";
          err(what);
          ABORT = true;
          EXITSTATUS = 1;
          what += ". Build with -sASSERTIONS for more info.";
          var e = new WebAssembly.RuntimeError(what);
          readyPromiseReject(e);
          throw e;
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";
        var isDataURI = (filename) => filename.startsWith(dataURIPrefix);
        var isFileURI = (filename) => filename.startsWith("file://");
        var wasmBinaryFile;
        wasmBinaryFile = "data:application/octet-stream;base64,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";
        if (!isDataURI(wasmBinaryFile)) {
          wasmBinaryFile = locateFile(wasmBinaryFile);
        }
        function getBinarySync(file) {
          if (file == wasmBinaryFile && wasmBinary2) {
            return new Uint8Array(wasmBinary2);
          }
          var binary = tryParseAsDataURI(file);
          if (binary) {
            return binary;
          }
          if (readBinary) {
            return readBinary(file);
          }
          throw "both async and sync fetching of the wasm failed";
        }
        function getBinaryPromise(binaryFile) {
          return Promise.resolve().then(() => getBinarySync(binaryFile));
        }
        function instantiateArrayBuffer(binaryFile, imports, receiver) {
          return getBinaryPromise(binaryFile).then((binary) => {
            return WebAssembly.instantiate(binary, imports);
          }).then(receiver, (reason) => {
            err(`failed to asynchronously prepare wasm: ${reason}`);
            abort(reason);
          });
        }
        function instantiateAsync(binary, binaryFile, imports, callback) {
          return instantiateArrayBuffer(binaryFile, imports, callback);
        }
        function createWasm() {
          var info = {
            "env": wasmImports,
            "wasi_snapshot_preview1": wasmImports
          };
          function receiveInstance(instance, module2) {
            wasmExports = instance.exports;
            wasmMemory = wasmExports["memory"];
            updateMemoryViews();
            addOnInit(wasmExports["__wasm_call_ctors"]);
            removeRunDependency("wasm-instantiate");
            return wasmExports;
          }
          addRunDependency("wasm-instantiate");
          function receiveInstantiationResult(result) {
            receiveInstance(result["instance"]);
          }
          if (Module2["instantiateWasm"]) {
            try {
              return Module2["instantiateWasm"](info, receiveInstance);
            } catch (e) {
              err(`Module.instantiateWasm callback failed with error: ${e}`);
              readyPromiseReject(e);
            }
          }
          instantiateAsync(wasmBinary2, wasmBinaryFile, info, receiveInstantiationResult).catch(readyPromiseReject);
          return {};
        }
        var tempDouble;
        var tempI64;
        function ExitStatus(status) {
          this.name = "ExitStatus";
          this.message = `Program terminated with exit(${status})`;
          this.status = status;
        }
        var callRuntimeCallbacks = (callbacks) => {
          while (callbacks.length > 0) {
            callbacks.shift()(Module2);
          }
        };
        function getValue(ptr, type = "i8") {
          if (type.endsWith("*"))
            type = "*";
          switch (type) {
            case "i1":
              return HEAP8[ptr];
            case "i8":
              return HEAP8[ptr];
            case "i16":
              return HEAP16[ptr >> 1];
            case "i32":
              return HEAP32[ptr >> 2];
            case "i64":
              abort("to do getValue(i64) use WASM_BIGINT");
            case "float":
              return HEAPF32[ptr >> 2];
            case "double":
              return HEAPF64[ptr >> 3];
            case "*":
              return HEAPU32[ptr >> 2];
            default:
              abort(`invalid type for getValue: ${type}`);
          }
        }
        var noExitRuntime = Module2["noExitRuntime"] || true;
        function setValue(ptr, value, type = "i8") {
          if (type.endsWith("*"))
            type = "*";
          switch (type) {
            case "i1":
              HEAP8[ptr] = value;
              break;
            case "i8":
              HEAP8[ptr] = value;
              break;
            case "i16":
              HEAP16[ptr >> 1] = value;
              break;
            case "i32":
              HEAP32[ptr >> 2] = value;
              break;
            case "i64":
              abort("to do setValue(i64) use WASM_BIGINT");
            case "float":
              HEAPF32[ptr >> 2] = value;
              break;
            case "double":
              HEAPF64[ptr >> 3] = value;
              break;
            case "*":
              HEAPU32[ptr >> 2] = value;
              break;
            default:
              abort(`invalid type for setValue: ${type}`);
          }
        }
        var wasmImports = {};
        var wasmExports = createWasm();
        var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports["__wasm_call_ctors"])();
        var _Hash_Update = Module2["_Hash_Update"] = (a0) => (_Hash_Update = Module2["_Hash_Update"] = wasmExports["Hash_Update"])(a0);
        var _Hash_Final = Module2["_Hash_Final"] = () => (_Hash_Final = Module2["_Hash_Final"] = wasmExports["Hash_Final"])();
        var _Hash_Init = Module2["_Hash_Init"] = (a0) => (_Hash_Init = Module2["_Hash_Init"] = wasmExports["Hash_Init"])(a0);
        var _GetBufferPtr = Module2["_GetBufferPtr"] = () => (_GetBufferPtr = Module2["_GetBufferPtr"] = wasmExports["GetBufferPtr"])();
        var stackSave = () => (stackSave = wasmExports["stackSave"])();
        var stackRestore = (a0) => (stackRestore = wasmExports["stackRestore"])(a0);
        var stackAlloc = (a0) => (stackAlloc = wasmExports["stackAlloc"])(a0);
        var calledRun;
        dependenciesFulfilled = function runCaller() {
          if (!calledRun)
            run2();
          if (!calledRun)
            dependenciesFulfilled = runCaller;
        };
        function run2() {
          if (runDependencies > 0) {
            return;
          }
          preRun();
          if (runDependencies > 0) {
            return;
          }
          function doRun() {
            if (calledRun)
              return;
            calledRun = true;
            Module2["calledRun"] = true;
            if (ABORT)
              return;
            initRuntime();
            readyPromiseResolve(Module2);
            if (Module2["onRuntimeInitialized"])
              Module2["onRuntimeInitialized"]();
            postRun();
          }
          if (Module2["setStatus"]) {
            Module2["setStatus"]("Running...");
            setTimeout(function() {
              setTimeout(function() {
                Module2["setStatus"]("");
              }, 1);
              doRun();
            }, 1);
          } else {
            doRun();
          }
        }
        if (Module2["preInit"]) {
          if (typeof Module2["preInit"] == "function")
            Module2["preInit"] = [Module2["preInit"]];
          while (Module2["preInit"].length > 0) {
            Module2["preInit"].pop()();
          }
        }
        run2();
        return moduleArg.ready;
      };
    })();
    sha256_default = Module;
  }
});

// src/vendor/hash-wasm/sha256-wrapper.ts
var sha256_wrapper_exports = {};
__export(sha256_wrapper_exports, {
  createSHA256: () => createSHA256,
  createSHA256WorkerCode: () => createSHA256WorkerCode
});
async function createSHA256(isInsideWorker = false) {
  const BUFFER_MAX_SIZE = 8 * 1024 * 1024;
  const wasm2 = isInsideWorker ? (
    // @ts-expect-error WasmModule will be populated inside self object
    await self["SHA256WasmModule"]()
  ) : await sha256_default();
  const heap = wasm2.HEAPU8.subarray(wasm2._GetBufferPtr());
  return {
    init() {
      wasm2._Hash_Init(256);
    },
    update(data) {
      let byteUsed = 0;
      while (byteUsed < data.byteLength) {
        const bytesLeft = data.byteLength - byteUsed;
        const length = Math.min(bytesLeft, BUFFER_MAX_SIZE);
        heap.set(data.subarray(byteUsed, byteUsed + length));
        wasm2._Hash_Update(length);
        byteUsed += length;
      }
    },
    digest(method) {
      if (method !== "hex") {
        throw new Error("Only digest hex is supported");
      }
      wasm2._Hash_Final();
      const result = Array.from(heap.slice(0, 32));
      return result.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  };
}
function createSHA256WorkerCode() {
  return `
		self.addEventListener('message', async (event) => {
      const { file } = event.data;
      const sha256 = await self.createSHA256(true);
      sha256.init();
      const reader = file.stream().getReader();
      const total = file.size;
      let bytesDone = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        sha256.update(value);
        bytesDone += value.length;
        postMessage({ progress: bytesDone / total });
      }
      postMessage({ sha256: sha256.digest('hex') });
    });
    self.SHA256WasmModule = ${sha256_default.toString()};
    self.createSHA256 = ${createSHA256.toString()};
  `;
}
var init_sha256_wrapper = __esm({
  "src/vendor/hash-wasm/sha256-wrapper.ts"() {
    "use strict";
    init_sha256();
  }
});

// src/utils/sha256-node.ts
var sha256_node_exports = {};
__export(sha256_node_exports, {
  sha256Node: () => sha256Node
});
async function* sha256Node(buffer, opts) {
  const sha256Stream = (0, import_node_crypto.createHash)("sha256");
  const size = buffer instanceof Blob ? buffer.size : buffer.byteLength;
  let done = 0;
  const readable = buffer instanceof Blob ? import_node_stream.Readable.fromWeb(buffer.stream()) : import_node_stream.Readable.from(Buffer.from(buffer));
  for await (const buffer2 of readable) {
    sha256Stream.update(buffer2);
    done += buffer2.length;
    yield done / size;
    opts?.abortSignal?.throwIfAborted();
  }
  return sha256Stream.digest("hex");
}
var import_node_stream, import_node_crypto;
var init_sha256_node = __esm({
  "src/utils/sha256-node.ts"() {
    "use strict";
    import_node_stream = require("stream");
    import_node_crypto = require("crypto");
  }
});

// src/utils/FileBlob.ts
var FileBlob_exports = {};
__export(FileBlob_exports, {
  FileBlob: () => FileBlob
});
var import_node_fs, import_promises2, import_node_stream2, import_node_url, FileBlob;
var init_FileBlob = __esm({
  "src/utils/FileBlob.ts"() {
    "use strict";
    import_node_fs = require("fs");
    import_promises2 = require("fs/promises");
    import_node_stream2 = require("stream");
    import_node_url = require("url");
    FileBlob = class extends Blob {
      /**
       * Creates a new FileBlob on the provided file.
       *
       * @param path Path to the file to be lazy readed
       */
      static async create(path2) {
        path2 = path2 instanceof URL ? (0, import_node_url.fileURLToPath)(path2) : path2;
        const { size } = await (0, import_promises2.stat)(path2);
        const fileBlob = new FileBlob(path2, 0, size);
        return fileBlob;
      }
      path;
      start;
      end;
      constructor(path2, start, end) {
        super();
        this.path = path2;
        this.start = start;
        this.end = end;
      }
      /**
       * Returns the size of the blob.
       */
      get size() {
        return this.end - this.start;
      }
      /**
       * Returns a new instance of FileBlob that is a slice of the current one.
       *
       * The slice is inclusive of the start and exclusive of the end.
       *
       * The slice method does not supports negative start/end.
       *
       * @param start beginning of the slice
       * @param end end of the slice
       */
      slice(start = 0, end = this.size) {
        if (start < 0 || end < 0) {
          new TypeError("Unsupported negative start/end on FileBlob.slice");
        }
        const slice = new FileBlob(this.path, this.start + start, Math.min(this.start + end, this.end));
        return slice;
      }
      /**
       * Read the part of the file delimited by the FileBlob and returns it as an ArrayBuffer.
       */
      async arrayBuffer() {
        const slice = await this.execute((file) => file.read(Buffer.alloc(this.size), 0, this.size, this.start));
        return slice.buffer;
      }
      /**
       * Read the part of the file delimited by the FileBlob and returns it as a string.
       */
      async text() {
        const buffer = await this.arrayBuffer();
        return buffer.toString("utf8");
      }
      /**
       * Returns a stream around the part of the file delimited by the FileBlob.
       */
      stream() {
        if (this.start === this.end) {
          return new Blob([]).stream();
        }
        return import_node_stream2.Readable.toWeb((0, import_node_fs.createReadStream)(this.path, { start: this.start, end: this.end - 1 }));
      }
      /**
       * We are opening and closing the file for each action to prevent file descriptor leaks.
       *
       * It is an intended choice of developer experience over performances.
       */
      async execute(action) {
        const file = await (0, import_promises2.open)(this.path, "r");
        try {
          return await action(file);
        } finally {
          await file.close();
        }
      }
    };
  }
});

// src/utils/sub-paths.ts
var sub_paths_exports = {};
__export(sub_paths_exports, {
  subPaths: () => subPaths
});
async function subPaths(path2, maxDepth = 10) {
  const state = await (0, import_promises3.stat)(path2);
  if (!state.isDirectory()) {
    return [{ path: path2, relativePath: "." }];
  }
  const files = await (0, import_promises3.readdir)(path2, { withFileTypes: true });
  const ret = [];
  for (const file of files) {
    const filePath = (0, import_node_url2.pathToFileURL)((0, import_node_url2.fileURLToPath)(path2) + "/" + file.name);
    if (file.isDirectory()) {
      ret.push(
        ...(await subPaths(filePath, maxDepth - 1)).map((subPath) => ({
          ...subPath,
          relativePath: `${file.name}/${subPath.relativePath}`
        }))
      );
    } else {
      ret.push({ path: filePath, relativePath: file.name });
    }
  }
  return ret;
}
var import_promises3, import_node_url2;
var init_sub_paths = __esm({
  "src/utils/sub-paths.ts"() {
    "use strict";
    import_promises3 = require("fs/promises");
    import_node_url2 = require("url");
  }
});

// src/vendor/xet-chunk/chunker_wasm_bg.js
var chunker_wasm_bg_exports = {};
__export(chunker_wasm_bg_exports, {
  Chunker: () => Chunker,
  __wbg_String_8f0eb39a4a4c2f66: () => __wbg_String_8f0eb39a4a4c2f66,
  __wbg_buffer_609cc3eee51ed158: () => __wbg_buffer_609cc3eee51ed158,
  __wbg_call_672a4d21634d4a24: () => __wbg_call_672a4d21634d4a24,
  __wbg_done_769e5ede4b31c67b: () => __wbg_done_769e5ede4b31c67b,
  __wbg_get_67b2ba62fc30de12: () => __wbg_get_67b2ba62fc30de12,
  __wbg_get_b9b93047fe3cf45b: () => __wbg_get_b9b93047fe3cf45b,
  __wbg_getwithrefkey_1dc361bd10053bfe: () => __wbg_getwithrefkey_1dc361bd10053bfe,
  __wbg_instanceof_ArrayBuffer_e14585432e3737fc: () => __wbg_instanceof_ArrayBuffer_e14585432e3737fc,
  __wbg_instanceof_Uint8Array_17156bcf118086a9: () => __wbg_instanceof_Uint8Array_17156bcf118086a9,
  __wbg_isArray_a1eab7e0d067391b: () => __wbg_isArray_a1eab7e0d067391b,
  __wbg_isSafeInteger_343e2beeeece1bb0: () => __wbg_isSafeInteger_343e2beeeece1bb0,
  __wbg_iterator_9a24c88df860dc65: () => __wbg_iterator_9a24c88df860dc65,
  __wbg_length_a446193dc22c12f8: () => __wbg_length_a446193dc22c12f8,
  __wbg_length_e2d2a49132c1b256: () => __wbg_length_e2d2a49132c1b256,
  __wbg_new_405e22f390576ce2: () => __wbg_new_405e22f390576ce2,
  __wbg_new_78feb108b6472713: () => __wbg_new_78feb108b6472713,
  __wbg_new_a12002a7f91c75be: () => __wbg_new_a12002a7f91c75be,
  __wbg_next_25feadfc0913fea9: () => __wbg_next_25feadfc0913fea9,
  __wbg_next_6574e1a8a62d1055: () => __wbg_next_6574e1a8a62d1055,
  __wbg_set_37837023f3d740e8: () => __wbg_set_37837023f3d740e8,
  __wbg_set_3f1d0b984ed272ed: () => __wbg_set_3f1d0b984ed272ed,
  __wbg_set_65595bdd868b3009: () => __wbg_set_65595bdd868b3009,
  __wbg_set_wasm: () => __wbg_set_wasm,
  __wbg_value_cd1ffa7b1ab794f1: () => __wbg_value_cd1ffa7b1ab794f1,
  __wbindgen_as_number: () => __wbindgen_as_number,
  __wbindgen_boolean_get: () => __wbindgen_boolean_get,
  __wbindgen_debug_string: () => __wbindgen_debug_string,
  __wbindgen_error_new: () => __wbindgen_error_new,
  __wbindgen_in: () => __wbindgen_in,
  __wbindgen_init_externref_table: () => __wbindgen_init_externref_table,
  __wbindgen_is_function: () => __wbindgen_is_function,
  __wbindgen_is_object: () => __wbindgen_is_object,
  __wbindgen_is_undefined: () => __wbindgen_is_undefined,
  __wbindgen_jsval_loose_eq: () => __wbindgen_jsval_loose_eq,
  __wbindgen_memory: () => __wbindgen_memory,
  __wbindgen_number_get: () => __wbindgen_number_get,
  __wbindgen_number_new: () => __wbindgen_number_new,
  __wbindgen_string_get: () => __wbindgen_string_get,
  __wbindgen_string_new: () => __wbindgen_string_new,
  __wbindgen_throw: () => __wbindgen_throw,
  compute_file_hash: () => compute_file_hash,
  compute_hmac: () => compute_hmac,
  compute_verification_hash: () => compute_verification_hash,
  compute_xorb_hash: () => compute_xorb_hash
});
function __wbg_set_wasm(val) {
  wasm = val;
}
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function getDataViewMemory0() {
  if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}
function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_export_4.set(idx, obj);
  return idx;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable0(e);
    wasm.__wbindgen_exn_store(idx);
  }
}
function debugString(val) {
  const type = typeof val;
  if (type == "number" || type == "boolean" || val == null) {
    return `${val}`;
  }
  if (type == "string") {
    return `"${val}"`;
  }
  if (type == "symbol") {
    const description = val.description;
    if (description == null) {
      return "Symbol";
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == "function") {
    const name = val.name;
    if (typeof name == "string" && name.length > 0) {
      return `Function(${name})`;
    } else {
      return "Function";
    }
  }
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = "[";
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for (let i = 1; i < length; i++) {
      debug += ", " + debugString(val[i]);
    }
    debug += "]";
    return debug;
  }
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    return toString.call(val);
  }
  if (className == "Object") {
    try {
      return "Object(" + JSON.stringify(val) + ")";
    } catch (_) {
      return "Object";
    }
  }
  if (val instanceof Error) {
    return `${val.name}: ${val.message}
${val.stack}`;
  }
  return className;
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_export_4.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
function compute_xorb_hash(chunks_array) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ret = wasm.compute_xorb_hash(chunks_array);
    var ptr1 = ret[0];
    var len1 = ret[1];
    if (ret[3]) {
      ptr1 = 0;
      len1 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred2_0 = ptr1;
    deferred2_1 = len1;
    return getStringFromWasm0(ptr1, len1);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}
function compute_file_hash(chunks_array) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ret = wasm.compute_file_hash(chunks_array);
    var ptr1 = ret[0];
    var len1 = ret[1];
    if (ret[3]) {
      ptr1 = 0;
      len1 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred2_0 = ptr1;
    deferred2_1 = len1;
    return getStringFromWasm0(ptr1, len1);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}
function passArrayJsValueToWasm0(array, malloc) {
  const ptr = malloc(array.length * 4, 4) >>> 0;
  for (let i = 0; i < array.length; i++) {
    const add = addToExternrefTable0(array[i]);
    getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
  }
  WASM_VECTOR_LEN = array.length;
  return ptr;
}
function compute_verification_hash(chunk_hashes) {
  let deferred3_0;
  let deferred3_1;
  try {
    const ptr0 = passArrayJsValueToWasm0(chunk_hashes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compute_verification_hash(ptr0, len0);
    var ptr2 = ret[0];
    var len2 = ret[1];
    if (ret[3]) {
      ptr2 = 0;
      len2 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred3_0 = ptr2;
    deferred3_1 = len2;
    return getStringFromWasm0(ptr2, len2);
  } finally {
    wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
  }
}
function compute_hmac(hash_hex, hmac_key_hex) {
  let deferred4_0;
  let deferred4_1;
  try {
    const ptr0 = passStringToWasm0(hash_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(hmac_key_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.compute_hmac(ptr0, len0, ptr1, len1);
    var ptr3 = ret[0];
    var len3 = ret[1];
    if (ret[3]) {
      ptr3 = 0;
      len3 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred4_0 = ptr3;
    deferred4_1 = len3;
    return getStringFromWasm0(ptr3, len3);
  } finally {
    wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
  }
}
function __wbg_String_8f0eb39a4a4c2f66(arg0, arg1) {
  const ret = String(arg1);
  const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbg_buffer_609cc3eee51ed158(arg0) {
  const ret = arg0.buffer;
  return ret;
}
function __wbg_call_672a4d21634d4a24() {
  return handleError(function(arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
  }, arguments);
}
function __wbg_done_769e5ede4b31c67b(arg0) {
  const ret = arg0.done;
  return ret;
}
function __wbg_get_67b2ba62fc30de12() {
  return handleError(function(arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
  }, arguments);
}
function __wbg_get_b9b93047fe3cf45b(arg0, arg1) {
  const ret = arg0[arg1 >>> 0];
  return ret;
}
function __wbg_getwithrefkey_1dc361bd10053bfe(arg0, arg1) {
  const ret = arg0[arg1];
  return ret;
}
function __wbg_instanceof_ArrayBuffer_e14585432e3737fc(arg0) {
  let result;
  try {
    result = arg0 instanceof ArrayBuffer;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}
function __wbg_instanceof_Uint8Array_17156bcf118086a9(arg0) {
  let result;
  try {
    result = arg0 instanceof Uint8Array;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}
function __wbg_isArray_a1eab7e0d067391b(arg0) {
  const ret = Array.isArray(arg0);
  return ret;
}
function __wbg_isSafeInteger_343e2beeeece1bb0(arg0) {
  const ret = Number.isSafeInteger(arg0);
  return ret;
}
function __wbg_iterator_9a24c88df860dc65() {
  const ret = Symbol.iterator;
  return ret;
}
function __wbg_length_a446193dc22c12f8(arg0) {
  const ret = arg0.length;
  return ret;
}
function __wbg_length_e2d2a49132c1b256(arg0) {
  const ret = arg0.length;
  return ret;
}
function __wbg_new_405e22f390576ce2() {
  const ret = new Object();
  return ret;
}
function __wbg_new_78feb108b6472713() {
  const ret = new Array();
  return ret;
}
function __wbg_new_a12002a7f91c75be(arg0) {
  const ret = new Uint8Array(arg0);
  return ret;
}
function __wbg_next_25feadfc0913fea9(arg0) {
  const ret = arg0.next;
  return ret;
}
function __wbg_next_6574e1a8a62d1055() {
  return handleError(function(arg0) {
    const ret = arg0.next();
    return ret;
  }, arguments);
}
function __wbg_set_37837023f3d740e8(arg0, arg1, arg2) {
  arg0[arg1 >>> 0] = arg2;
}
function __wbg_set_3f1d0b984ed272ed(arg0, arg1, arg2) {
  arg0[arg1] = arg2;
}
function __wbg_set_65595bdd868b3009(arg0, arg1, arg2) {
  arg0.set(arg1, arg2 >>> 0);
}
function __wbg_value_cd1ffa7b1ab794f1(arg0) {
  const ret = arg0.value;
  return ret;
}
function __wbindgen_as_number(arg0) {
  const ret = +arg0;
  return ret;
}
function __wbindgen_boolean_get(arg0) {
  const v = arg0;
  const ret = typeof v === "boolean" ? v ? 1 : 0 : 2;
  return ret;
}
function __wbindgen_debug_string(arg0, arg1) {
  const ret = debugString(arg1);
  const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbindgen_error_new(arg0, arg1) {
  const ret = new Error(getStringFromWasm0(arg0, arg1));
  return ret;
}
function __wbindgen_in(arg0, arg1) {
  const ret = arg0 in arg1;
  return ret;
}
function __wbindgen_init_externref_table() {
  const table = wasm.__wbindgen_export_4;
  const offset = table.grow(4);
  table.set(0, void 0);
  table.set(offset + 0, void 0);
  table.set(offset + 1, null);
  table.set(offset + 2, true);
  table.set(offset + 3, false);
  ;
}
function __wbindgen_is_function(arg0) {
  const ret = typeof arg0 === "function";
  return ret;
}
function __wbindgen_is_object(arg0) {
  const val = arg0;
  const ret = typeof val === "object" && val !== null;
  return ret;
}
function __wbindgen_is_undefined(arg0) {
  const ret = arg0 === void 0;
  return ret;
}
function __wbindgen_jsval_loose_eq(arg0, arg1) {
  const ret = arg0 == arg1;
  return ret;
}
function __wbindgen_memory() {
  const ret = wasm.memory;
  return ret;
}
function __wbindgen_number_get(arg0, arg1) {
  const obj = arg1;
  const ret = typeof obj === "number" ? obj : void 0;
  getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
}
function __wbindgen_number_new(arg0) {
  const ret = arg0;
  return ret;
}
function __wbindgen_string_get(arg0, arg1) {
  const obj = arg1;
  const ret = typeof obj === "string" ? obj : void 0;
  var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  var len1 = WASM_VECTOR_LEN;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbindgen_string_new(arg0, arg1) {
  const ret = getStringFromWasm0(arg0, arg1);
  return ret;
}
function __wbindgen_throw(arg0, arg1) {
  throw new Error(getStringFromWasm0(arg0, arg1));
}
var wasm, WASM_VECTOR_LEN, cachedUint8ArrayMemory0, lTextEncoder, cachedTextEncoder, encodeString, cachedDataViewMemory0, lTextDecoder, cachedTextDecoder, ChunkerFinalization, Chunker;
var init_chunker_wasm_bg = __esm({
  "src/vendor/xet-chunk/chunker_wasm_bg.js"() {
    "use strict";
    WASM_VECTOR_LEN = 0;
    cachedUint8ArrayMemory0 = null;
    lTextEncoder = typeof TextEncoder === "undefined" ? (0, module.require)("util").TextEncoder : TextEncoder;
    cachedTextEncoder = new lTextEncoder("utf-8");
    encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
      return cachedTextEncoder.encodeInto(arg, view);
    } : function(arg, view) {
      const buf = cachedTextEncoder.encode(arg);
      view.set(buf);
      return {
        read: arg.length,
        written: buf.length
      };
    };
    cachedDataViewMemory0 = null;
    lTextDecoder = typeof TextDecoder === "undefined" ? (0, module.require)("util").TextDecoder : TextDecoder;
    cachedTextDecoder = new lTextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    ChunkerFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
    }, unregister: () => {
    } } : new FinalizationRegistry((ptr) => wasm.__wbg_chunker_free(ptr >>> 0, 1));
    Chunker = class {
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChunkerFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_chunker_free(ptr, 0);
      }
      /**
       * @param {number} target_chunk_size
       */
      constructor(target_chunk_size) {
        const ret = wasm.chunker_new(target_chunk_size);
        this.__wbg_ptr = ret >>> 0;
        ChunkerFinalization.register(this, this.__wbg_ptr, this);
        return this;
      }
      /**
       * @param {Uint8Array} data
       * @returns {any}
       */
      add_data(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.chunker_add_data(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
          throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
      }
      /**
       * @returns {any}
       */
      finish() {
        const ret = wasm.chunker_finish(this.__wbg_ptr);
        if (ret[2]) {
          throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
      }
    };
  }
});

// src/vendor/xet-chunk/chunker_wasm_bg.wasm.base64.ts
var wasmBase64, wasmBinary;
var init_chunker_wasm_bg_wasm_base64 = __esm({
  "src/vendor/xet-chunk/chunker_wasm_bg.wasm.base64.ts"() {
    "use strict";
    wasmBase64 = atob(
      `
AGFzbQEAAAABwAIuYAJ/fwF/YAN/f38Bf2ACf38AYAN/f38AYAR/f39/AGABfwBgAW8Bf2ABfwF/YAAEf39/f2AFf39/f38AYAFv
AW9gAABgAn9vAGAAAW9gBn9/f39/fwBgAAN/f39gAm9vAW9gBn9/f39/fwF/YAV/f39/fwF/YAR/f39/AX9gAn9/AW9gAm9vAX9g
AW8Ef39/f2ABbwF8YAF8AW9gA29vbwBgAm9/AW9gA29/bwBgA29vfwBgBX9/f35/AGAHf39/fn9/fwF/YAl/f39/f39+fn4AYAAB
f2ADfn9/AX9gB39/f39/f38Bf2AEf39/fwR/f39/YAJ/fwR/f39/YAN/f38Df39/YAF/A39/f2AFf399f38AYAR/fX9/AGAFf398
f38AYAR/fH9/AGAFf39+f38AYAR/fn9/AGACf34BfgK/ECcYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzFV9fd2JpbmRnZW5fc3Ry
aW5nX25ldwAUGC4vaGZfeGV0X3RoaW5fd2FzbV9iZy5qcxRfX3diaW5kZ2VuX2Vycm9yX25ldwAUGC4vaGZfeGV0X3RoaW5fd2Fz
bV9iZy5qcxRfX3diaW5kZ2VuX2lzX29iamVjdAAGGC4vaGZfeGV0X3RoaW5fd2FzbV9iZy5qcxdfX3diaW5kZ2VuX2lzX3VuZGVm
aW5lZAAGGC4vaGZfeGV0X3RoaW5fd2FzbV9iZy5qcw1fX3diaW5kZ2VuX2luABUYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzFV9f
d2JpbmRnZW5fc3RyaW5nX2dldAAMGC4vaGZfeGV0X3RoaW5fd2FzbV9iZy5qcxlfX3diaW5kZ2VuX2pzdmFsX2xvb3NlX2VxABUY
Li9oZl94ZXRfdGhpbl93YXNtX2JnLmpzFl9fd2JpbmRnZW5fYm9vbGVhbl9nZXQABhguL2hmX3hldF90aGluX3dhc21fYmcuanMV
X193YmluZGdlbl9udW1iZXJfZ2V0AAwYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzFF9fd2JpbmRnZW5fYXNfbnVtYmVyABcYLi9o
Zl94ZXRfdGhpbl93YXNtX2JnLmpzHV9fd2JnX1N0cmluZ184ZjBlYjM5YTRhNGMyZjY2AAwYLi9oZl94ZXRfdGhpbl93YXNtX2Jn
LmpzFV9fd2JpbmRnZW5fbnVtYmVyX25ldwAYGC4vaGZfeGV0X3RoaW5fd2FzbV9iZy5qcyRfX3diZ19nZXR3aXRocmVma2V5XzFk
YzM2MWJkMTAwNTNiZmUAEBguL2hmX3hldF90aGluX3dhc21fYmcuanMaX193Ymdfc2V0XzNmMWQwYjk4NGVkMjcyZWQAGRguL2hm
X3hldF90aGluX3dhc21fYmcuanMaX193YmdfZ2V0X2I5YjkzMDQ3ZmUzY2Y0NWIAGhguL2hmX3hldF90aGluX3dhc21fYmcuanMd
X193YmdfbGVuZ3RoX2UyZDJhNDkxMzJjMWIyNTYABhguL2hmX3hldF90aGluX3dhc21fYmcuanMaX193YmdfbmV3Xzc4ZmViMTA4
YjY0NzI3MTMADRguL2hmX3hldF90aGluX3dhc21fYmcuanMWX193YmluZGdlbl9pc19mdW5jdGlvbgAGGC4vaGZfeGV0X3RoaW5f
d2FzbV9iZy5qcxtfX3diZ19uZXh0XzI1ZmVhZGZjMDkxM2ZlYTkAChguL2hmX3hldF90aGluX3dhc21fYmcuanMbX193YmdfbmV4
dF82NTc0ZTFhOGE2MmQxMDU1AAoYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzG19fd2JnX2RvbmVfNzY5ZTVlZGU0YjMxYzY3YgAG
GC4vaGZfeGV0X3RoaW5fd2FzbV9iZy5qcxxfX3diZ192YWx1ZV9jZDFmZmE3YjFhYjc5NGYxAAoYLi9oZl94ZXRfdGhpbl93YXNt
X2JnLmpzH19fd2JnX2l0ZXJhdG9yXzlhMjRjODhkZjg2MGRjNjUADRguL2hmX3hldF90aGluX3dhc21fYmcuanMaX193YmdfZ2V0
XzY3YjJiYTYyZmMzMGRlMTIAEBguL2hmX3hldF90aGluX3dhc21fYmcuanMbX193YmdfY2FsbF82NzJhNGQyMTYzNGQ0YTI0ABAY
Li9oZl94ZXRfdGhpbl93YXNtX2JnLmpzGl9fd2JnX25ld180MDVlMjJmMzkwNTc2Y2UyAA0YLi9oZl94ZXRfdGhpbl93YXNtX2Jn
LmpzGl9fd2JnX3NldF8zNzgzNzAyM2YzZDc0MGU4ABsYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzHl9fd2JnX2lzQXJyYXlfYTFl
YWI3ZTBkMDY3MzkxYgAGGC4vaGZfeGV0X3RoaW5fd2FzbV9iZy5qcy1fX3diZ19pbnN0YW5jZW9mX0FycmF5QnVmZmVyX2UxNDU4
NTQzMmUzNzM3ZmMABhguL2hmX3hldF90aGluX3dhc21fYmcuanMkX193YmdfaXNTYWZlSW50ZWdlcl8zNDNlMmJlZWVlY2UxYmIw
AAYYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzHV9fd2JnX2J1ZmZlcl82MDljYzNlZWU1MWVkMTU4AAoYLi9oZl94ZXRfdGhpbl93
YXNtX2JnLmpzGl9fd2JnX25ld19hMTIwMDJhN2Y5MWM3NWJlAAoYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzGl9fd2JnX3NldF82
NTU5NWJkZDg2OGIzMDA5ABwYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzHV9fd2JnX2xlbmd0aF9hNDQ2MTkzZGMyMmMxMmY4AAYY
Li9oZl94ZXRfdGhpbl93YXNtX2JnLmpzLF9fd2JnX2luc3RhbmNlb2ZfVWludDhBcnJheV8xNzE1NmJjZjExODA4NmE5AAYYLi9o
Zl94ZXRfdGhpbl93YXNtX2JnLmpzF19fd2JpbmRnZW5fZGVidWdfc3RyaW5nAAwYLi9oZl94ZXRfdGhpbl93YXNtX2JnLmpzEF9f
d2JpbmRnZW5fdGhyb3cAAhguL2hmX3hldF90aGluX3dhc21fYmcuanMRX193YmluZGdlbl9tZW1vcnkADRguL2hmX3hldF90aGlu
X3dhc21fYmcuanMfX193YmluZGdlbl9pbml0X2V4dGVybnJlZl90YWJsZQALA8oByAEdBwIeAgADCQMRAQQDAwEABQEAAAABEQEA
BAICAR8BAAIgIQcOACIAAAIOAAAAAgIACQMLAgAEBAQDAwECBwUAAwICCQMCDgMFDgIABAIDAAAACQQDAQMCBwAABAQEAwAFBAsB
AQQFAgEDBAIAABIABSMkJRYWAiYTEQcAACcSCSkrBQQAAQQtAAUDBQAABxMAAwABAAkAAAQEAAAFAgICAAAAAgMHAwMDAAUAAAAA
AAAAAAAAAgsLAAIAAAIBAQIAAAIHBwcHAwQJAnABZ2dvAIABBQMBABEGCQF/AUGAgMAACwffAhEGbWVtb3J5AgASX193YmdfY2h1
bmtlcl9mcmVlAGgLY2h1bmtlcl9uZXcAShBjaHVua2VyX2FkZF9kYXRhAJoBDmNodW5rZXJfZmluaXNoAJ4BEWNvbXB1dGVfeG9y
Yl9oYXNoAJsBEWNvbXB1dGVfZmlsZV9oYXNoAJwBGWNvbXB1dGVfdmVyaWZpY2F0aW9uX2hhc2gAmQEMY29tcHV0ZV9obWFjAJgB
EV9fd2JpbmRnZW5fbWFsbG9jAJYBEl9fd2JpbmRnZW5fcmVhbGxvYwCfARRfX3diaW5kZ2VuX2V4bl9zdG9yZQDDARdfX2V4dGVy
bnJlZl90YWJsZV9hbGxvYwBIE19fd2JpbmRnZW5fZXhwb3J0XzQBARlfX2V4dGVybnJlZl90YWJsZV9kZWFsbG9jAG8PX193Ymlu
ZGdlbl9mcmVlALgBEF9fd2JpbmRnZW5fc3RhcnQAJgm5AQEAQQELZtcB2AG3AbABigFO2QHTAbsBNr0B1QGwAYoBUucB6AHWAdQB
sAGKAU+7AXKTAaUBcKYBpQGgAawBqgGmAaYBpAGnAagBrQGDAXrtAe4BggGIAV2hAWuEAYwBX27aAZEBvwHAAcwBe3fBAb0BhgGr
AdIBowFmV8IBlAFirwHbAcEBsgHQAX6wAYsBVN8BxAHFAccBjgHGAeABqQF4W2npAbABjwFT4QHiAbkBuwHIAckBOnZcCsr6BMgB
iRsBIH8gACAAKAIYIh0gASgAECIkIAAoAghqaiIbIAEoABQiFWogHSAbIAJB/wFxc0EQdyICQfLmu+MDaiIdc0EUdyIbaiIiIAJz
QRh3IgkgHWoiHCAbc0EZdyIPIAAoAhQiGyABKAAIIgIgACgCBGpqIhkgASgADCIdaiAZIANCIIinc0EQdyIeQfui4aQEayIgIBtz
QRR3IgZqIgogASgAKCIbamoiIyABKAAsIhlqIA8gIyAAKAIQIiEgASgAACIPIAAoAgBqaiIIIAEoAAQiH2ogISAIIAOnc0EQdyIh
QefMp9AGaiIIc0EUdyIHaiIOICFzQRh3Ig1zQRB3IgsgACgCHCIFIAEoABgiIyAAKAIMamoiDCABKAAcIiFqIAUgDCAEQf8BcXNB
EHciBEHGlcDVBWsiBXNBFHciDGoiESAEc0EYdyIQIAVqIgVqIhJzQRR3IhRqIhMgHWogBiAgIAogHnNBGHciIGoiBnNBGXciCiAO
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
AgAhCSAIQRhqIhEgAkEYaikCADcDACAIQRBqIhIgAkEQaikCADcDACAIQQhqIhMgAkEIaikCADcDACAIIAIpAgA3AwAgCCAJQcAA
IBQgEBAnIAggCUFAa0HAACAUIAQQJyAIIAlBgAFqQcAAIBQgBBAnIAggCUHAAWpBwAAgFCAEECcgCCAJQYACakHAACAUIAQQJyAI
IAlBwAJqQcAAIBQgBBAnIAggCUGAA2pBwAAgFCAEECcgCCAJQcADakHAACAUIAQQJyAIIAlBgARqQcAAIBQgBBAnIAggCUHABGpB
wAAgFCAEECcgCCAJQYAFakHAACAUIAQQJyAIIAlBwAVqQcAAIBQgBBAnIAggCUGABmpBwAAgFCAEECcgCCAJQcAGakHAACAUIAQQ
JyAIIAlBgAdqQcAAIBQgBBAnIAggCUHAB2pBwAAgFCAPECcgCkEYaiARKQMANwAAIApBEGogEikDADcAACAKQQhqIBMpAwA3AAAg
CiAIKQMANwAAIAxBBGohDCAKQSBqIQogFEIBfCEUIA1BAWsiDQ0ACwsgCEEgaiQAIAFB/wdxIglFDQEgB0HIAWpCADcDACAHQcAB
akIANwMAIAdBuAFqQgA3AwAgB0GwAWpCADcDACAHQagBakIANwMAIAdBoAFqQgA3AwAgB0GYAWpCADcDACAHQdgBaiIBIAJBCGop
AgA3AwAgB0HgAWoiCiACQRBqKQIANwMAIAdB6AFqIgggAkEYaikCADcDACAHQgA3A5ABIAcgBDoA+gEgB0EAOwH4ASAHIAIpAgA3
A9ABIAcgC60gA3w3A/ABIAdBkAFqIAAgDmogCRBFIQAgB0HQAGogASkDADcDACAHQdgAaiAKKQMANwMAIAdB4ABqIAgpAwA3AwAg
B0EQaiAAQQhqKQMANwMAIAdBGGogAEEQaikDADcDACAHQSBqIABBGGopAwA3AwAgB0EoaiAAQSBqKQMANwMAIAdBMGogAEEoaikD
ADcDACAHQThqIABBMGopAwA3AwAgB0FAayAAQThqKQMANwMAIAcgBykD0AE3A0ggByAAKQMANwMIIActAPoBIQAgBy0A+QEhAiAH
IActAPgBIgQ6AHAgByAHKQPwASIDNwNoIAcgACACRXJBAnIiADoAcSAHQZgCaiICIAgpAwA3AwAgB0GQAmoiCCAKKQMANwMAIAdB
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
ADcDACABQgA3A0ACQAJAAkACQCACQQNPBEADQCACQQV0IgJBwQBPDQIgASACIARBECABQUBrIg1BIBA9IgJBBXQiA0HBAE8NAyAD
QSFPDQQgASANIAMQNRogAkECSw0ACwsgBSABKQMANwAAIAVBOGogBikDADcAACAFQTBqIAcpAwA3AAAgBUEoaiAIKQMANwAAIAVB
IGogCSkDADcAACAFQRhqIAopAwA3AAAgBUEQaiALKQMANwAAIAVBCGogDCkDADcAACABQeAAaiQADAMLIAJBwABBgL7AABDOAQAL
IANBwABBkL7AABDOAQALIANBIEGgvsAAEM4BAAsgBEH4AGogBEEYaikCADcDACAEQfAAaiAEQRBqKQIANwMAIARB6ABqIARBCGop
AgA3AwAgBCAEKQIANwNgQcAAIQNBFAwBCyAEQcgBakIANwMAIARBwAFqQgA3AwAgBEG4AWpCADcDACAEQbABakIANwMAIARBqAFq
QgA3AwAgBEGYAWpCADcDACAEQRA6APoBIARBoAFqQgA3AwAgBEHYAWoiBSAEQQhqKQIANwMAIARB6AFqIgYgBEEYaikCADcDACAE
QeABaiIHIARBEGopAgA3AwAgBEIANwOQASAEIAQpAgA3A9ABIARBADsB+AEgBEIANwPwASAEQZABaiACIAMQRSEBIARB6ABqIAUp
AwA3AwAgBEHwAGogBykDADcDACAEQfgAaiAGKQMANwMAIARBKGogAUEIaikDADcDACAEQTBqIAFBEGopAwA3AwAgBEE4aiABQRhq
KQMANwMAIARBQGsgAUEgaikDADcDACAEQcgAaiABQShqKQMANwMAIARB0ABqIAFBMGopAwA3AwAgBEHYAGogAUE4aikDADcDACAE
IAQpA9ABNwNgIAQgASkDADcDICAEKQPwASEOIAQtAPgBIQMgBC0A+gEgBC0A+QFFckECcgshASAEIA43A4ABIAQgAzoAiAEgBCAB
OgCJASAEQagBaiICIARB+ABqKQMANwMAIARBoAFqIgUgBEHwAGopAwA3AwAgBEGYAWoiBiAEQegAaikDADcDACAEIAQpA2A3A5AB
IARBkAFqIARBIGogA0IAIAFBCHIQJyAAIAIpAwA3ABggACAFKQMANwAQIAAgBikDADcACCAAIAQpA5ABNwAAIARBgAJqJAALuAsB
BX8jAEEgayIEJAACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAQ4oBgEBAQEBAQEBAgQBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAQgB
AQEBBwALIAFB3ABGDQQLIAJBAXFFIAFBgAZJcg0HAn8CQEERQQAgAUGvsARPGyICIAJBCHIiAyABQQt0IgIgA0ECdEHg+8AAaigC
AEELdEkbIgMgA0EEciIDIANBAnRB4PvAAGooAgBBC3QgAksbIgMgA0ECciIDIANBAnRB4PvAAGooAgBBC3QgAksbIgMgA0EBaiID
IANBAnRB4PvAAGooAgBBC3QgAksbIgMgA0EBaiIDIANBAnRB4PvAAGooAgBBC3QgAksbIgNBAnRB4PvAAGooAgBBC3QiBSACRiAC
IAVLaiADaiIDQSFNBEAgA0ECdEHg+8AAaiIGKAIAQRV2IQJB7wUhBQJ/AkAgA0EhRg0AIAYoAgRBFXYhBSADDQBBAAwBCyAGQQRr
KAIAQf///wBxCyEDAkAgBSACQX9zakUNACABIANrIQdB7wUgAiACQe8FTRshBiAFQQFrIQNBACEFA0AgAiAGRg0DIAUgAkHo/MAA
ai0AAGoiBSAHSw0BIAMgAkEBaiICRw0ACyADIQILIAJBAXEMAgsgA0EiQdT3wAAQfQALIAZB7wVB5PfAABB9AAtFDQcgBEEAOgAK
IARBADsBCCAEIAFBFHZB/+PAAGotAAA6AAsgBCABQQR2QQ9xQf/jwABqLQAAOgAPIAQgAUEIdkEPcUH/48AAai0AADoADiAEIAFB
DHZBD3FB/+PAAGotAAA6AA0gBCABQRB2QQ9xQf/jwABqLQAAOgAMIAFBAXJnQQJ2IgIgBEEIaiIDaiIFQfsAOgAAIAVBAWtB9QA6
AAAgAyACQQJrIgJqQdwAOgAAIARBEGoiAyABQQ9xQf/jwABqLQAAOgAAIABBCjoACyAAIAI6AAogACAEKQIINwIAIARB/QA6ABEg
AEEIaiADLwEAOwEADAkLIABBgAQ7AQogAEIANwECIABB3OgBOwEADAgLIABBgAQ7AQogAEIANwECIABB3OQBOwEADAcLIABBgAQ7
AQogAEIANwECIABB3NwBOwEADAYLIABBgAQ7AQogAEIANwECIABB3LgBOwEADAULIABBgAQ7AQogAEIANwECIABB3OAAOwEADAQL
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
QQdxIgQEQANAIAMgAToAACADQQFqIQMgBEEBayIEDQALCyACQQFrQQdJDQADQCADIAE6AAAgA0EHaiABOgAAIANBBmogAToAACAD
QQVqIAE6AAAgA0EEaiABOgAAIANBA2ogAToAACADQQJqIAE6AAAgA0EBaiABOgAAIANBCGoiAyAFRw0ACwsgAAv+AgEEfwJAAkAC
QAJAAkACQAJ/AkAgByAIVgRAIAcgCH0gCFgNAwJAIAYgByAGfVQgByAGQgGGfSAIQgGGWnFFBEAgBiAIVg0BDAoLIAIgA0kNBQwI
CyAHIAYgCH0iBn0gBlYNCCACIANJDQUgASADaiEMIAEhCwJAA0AgAyAJRg0BIAlBAWohCSALQQFrIgsgA2oiCi0AAEE5Rg0ACyAK
IAotAABBAWo6AAAgAyAJa0EBaiADTw0HIApBAWpBMCAJQQFrEEMaDAcLQTEgA0UNAhogAUExOgAAIANBAUcNAUEwDAILIABBADYC
AA8LIAFBAWpBMCADQQFrEEMaQTALIQkgBEEBasEiBCAFwUwgAiADTXINAyAMIAk6AAAgA0EBaiEDDAMLIABBADYCAA8LIAMgAkGQ
4sAAEM4BAAsgAyACQfDhwAAQzgEACyACIANPDQAgAyACQYDiwAAQzgEACyAAIAQ7AQggACADNgIEIAAgATYCAA8LIABBADYCAAub
AwECfwJAAkACQAJAIAAtAGgiAwRAIANBwQBPDQMgACADaiABIAJBwAAgA2siAyACIANJGyIDEDUaIAAgAC0AaCADaiIEOgBoIAEg
A2ohASACIANrIgJFBEBBACECDAILIABBQGsgAEHAACAAKQNgIAAtAGogAC0AaUVyECcgAEIANwMAIABBADoAaCAAQQhqQgA3AwAg
AEEQakIANwMAIABBGGpCADcDACAAQSBqQgA3AwAgAEEoakIANwMAIABBMGpCADcDACAAQThqQgA3AwAgACAALQBpQQFqOgBpC0EA
IQMgAkHBAEkNASAAQUBrIQQgAC0AaSEDA0AgBCABQcAAIAApA2AgAC0AaiADQf8BcUVyECcgACAALQBpQQFqIgM6AGkgAUFAayEB
IAJBQGoiAkHAAEsNAAsgAC0AaCEECyAEQf8BcSIDQcEATw0CCyAAIANqIAEgAkHAACADayIBIAEgAksbIgEQNRogACAALQBoIAFq
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
NgIMIAFB/JrAADYCCAwKC0G8nMAAENEBAAsgAUEANgIYIAFBATYCDCABQbybwAA2AggMCAsgAygCGAVBnIPBAAsoAgAiAUUNAyAD
QZSDwQA2AhggACABbiIGQZiDwQAtAABBA0cEfyADIANBGGo2AhwgAyADQRxqNgIAIwBBIGsiASQAAkACQAJAAkACQAJAQZiDwQAt
AABBAWsOAwIEAQALQZiDwQBBAjoAACADKAIAIggoAgAhBSAIQQA2AgAgBUUNAiAFKAIAQQI2AgBBmIPBAEEDOgAACyABQSBqJAAM
AwsgAUEANgIYIAFBATYCDCABQfyawAA2AggMCgtBvJzAABDRAQALIAFBADYCGCABQQE2AgwgAUG8m8AANgIIDAgLIAMoAhgFQZSD
wQALKAIAIABsIgFPDQQgAUEASA0FQfmCwQAtAAAaQQEhByABQQEQvgEiBUUNBSAEIAE2AhwgBCAGNgIYIARB0JzAADYCCCAEQgA3
AwAgBEEANgIoIAQgBTYCJCAEIAE2AiAgBCAAQQFrIgCtIABnQSBzrYY3AxAgA0EgaiQADAcLIANBADYCACMAQRBrIgAkACAAQaiV
wAA2AgwgACADQRxqNgIIIABBCGpB/LLAACAAQQxqQfyywAAgA0GQlsAAEEsAC0GglsAAQShByJbAABCQAQALQdiWwABBN0GQl8AA
EJABAAtBoJfAABCXAQALQbCXwABBL0Hgl8AAEJABAAsgByABQfCXwAAQsQEACyABQgQ3AhAgAUEIakHAmsAAEJ0BAAsgAkE4aiIA
QQA6AAAgAkH4AGogACkDADcCACACQfAAaiACQTBqKQMANwIAIAJB6ABqIAJBKGopAwA3AgAgAkHgAGogAkEgaikDADcCACACQdgA
aiACQRhqKQMANwIAIAJB0ABqIAJBEGopAwA3AgBB+YLBAC0AABogAiACKQMINwJIQcgAQQgQvgEiAEUEQEEIQcgAEOMBAAsgAEEA
NgIIIABCgYCAgBA3AwAgACACKQJENwIMIABBFGogAkHMAGopAgA3AgAgAEEcaiACQdQAaikCADcCACAAQSRqIAJB3ABqKQIANwIA
IABBLGogAkHkAGopAgA3AgAgAEE0aiACQewAaikCADcCACAAQTxqIAJB9ABqKQIANwIAIABBxABqIAJB/ABqKAIANgIAIAJBgAFq
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
AgQOAgABAgsgAQ0BQQEhAUEAIQBBASECDAMLIAFFDQELIANBBGogABBHIAMoAgQhACADKAIIIQIgAygCDAwCCyAAKAIAIgEoAgQi
AEEASA0CIAEoAgAhASAARQRAQQEhAkEAIQAMAQtB+YLBAC0AABpBASEEIABBARC+ASICRQ0CCyACIAEgABA1GiAACyEBIAIgARC0
ASAABEAgAiAAEMoBCyADQRBqJAAPCyAEIABBlIvAABCxAQAL0AEBBX8jAEEgayIBJAAgACgCACIDQQFqIgIgA0EBdCIEIAIgBEsb
IgJB/////wBLBEBBAEEAQbiQwAAQsQEACwJAQQQgAiACQQRNGyICQQR0IgRB/P///wdNBH8gASADBH8gASADQQR0NgIcIAEgACgC
BDYCFEEEBUEACzYCGCABQQhqQQQgBCABQRRqEHMgASgCCEEBRw0BIAEoAhAhBSABKAIMBUEACyAFQbiQwAAQsQEACyABKAIMIQMg
ACACNgIAIAAgAzYCBCABQSBqJAAL8gEBAn8jAEEwayICJAACQCAAKQMAQv///////////wCDQoCAgICAgID4/wBaBEAgAkEBNgIU
IAJBvMHAADYCECACQgE3AhwgAiAArUKAgICAwAiENwMoIAIgAkEoajYCGCABKAIcIAEoAiAgAkEQahA4IQMMAQsgAkEAOgAMIAIg
ATYCCEEBIQMgAkEBNgIUIAJBvMHAADYCECACQgE3AhwgAiAArUKAgICAwAiENwMoIAIgAkEoajYCGCACQQhqQaS/wAAgAkEQahA4
DQAgAi0ADEUEQCABQcTBwABBAhC6AQ0BC0EAIQMLIAJBMGokACADC7sBAQJ/IwBBIGsiAyQAAkACf0EAIAEgASACaiICSw0AGkEA
QQggAiAAKAIAIgFBAXQiBCACIARLGyICIAJBCE0bIgRBAEgNABpBACECIAMgAQR/IAMgATYCHCADIAAoAgQ2AhRBAQUgAgs2Ahgg
A0EIakEBIAQgA0EUahBzIAMoAghBAUcNASADKAIQIQAgAygCDAsgAEHQy8AAELEBAAsgAygCDCEBIAAgBDYCACAAIAE2AgQgA0Eg
aiQAC70BAQN/IwBBEGsiAiQAAkACQAJAIAFFBEAgAEUNASAAQQhrIgEoAgBBAUcNAiAAKAIsIAAoAighAyABQQA2AgACQCABQX9G
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
AAwBCyAEIABBzJPAABCxAQALIANBMGokAAtqAgF/AX4jAEEwayIDJAAgAyABNgIEIAMgADYCACADQQI2AgwgA0GY5cAANgIIIANC
AjcCFCADQoCAgICgCSIEIAOthDcDKCADIAQgA0EEaq2ENwMgIAMgA0EgajYCECADQQhqIAIQnQEAC2cAIwBBMGsiACQAQfiCwQAt
AAAEQCAAQQI2AgwgAEGIycAANgIIIABCATcCFCAAIAE2AiwgACAAQSxqrUKAgICAoAmENwMgIAAgAEEgajYCECAAQQhqQbDJwAAQ
nQEACyAAQTBqJAALnAICA38BfiMAQRBrIgEkACABQaiDwQA2AgQgAEGwg8EALQAAQQNHBH8gASABQQRqNgIIIAEgAUEIajYCDCAB
QQxqIQIjAEEgayIAJAACQAJAAkACQAJAAkACQEGwg8EALQAAQQFrDgMCBAEAC0Gwg8EAQQI6AAAgAigCACIDKAIAIQIgA0EANgIA
IAJFDQIgAigCAEKACDcDAEGwg8EAQQM6AAALIABBIGokAAwECyAAQQA2AhggAEEBNgIMIABBqLDAADYCCAwCC0HoscAAENEBAAsg
AEEANgIYIABBATYCDCAAQeiwwAA2AggLIABCBDcCECAAQQhqQeyvwAAQnQEACyABKAIEBUGog8EACykDABCuASABQRBqJABQC14B
AX8jAEEwayICJAAgAiABNgIMIAIgADYCCCACQQI2AhQgAkHojMAANgIQIAJCATcCHCACIAJBCGqtQoCAgICwAYQ3AyggAiACQShq
NgIYIAJBEGoQZCACQTBqJAALXgEBfyMAQTBrIgIkACACIAE2AgwgAiAANgIIIAJBAjYCFCACQYyNwAA2AhAgAkIBNwIcIAIgAkEI
aq1CgICAgLABhDcDKCACIAJBKGo2AhggAkEQahBkIAJBMGokAAtbAQF/IAEoAgAiBEEBcQRAIAAgASAEIARBfnEgAiADEG0PCyAE
IAQoAggiAUEBajYCCCABQQBOBEAgACAENgIMIAAgAzYCCCAAIAI2AgQgAEG8uMAANgIADwsAC2MBAX9BACEBAkAgA0EATgRAIANF
BEBBASEEDAILQfmCwQAtAAAaQQEhASADQQEQvgEiBA0BCyABIANBpLbAABCxAQALIAQgAiADEDUhASAAIAM2AgggACABNgIEIAAg
AzYCAAtYAQF/IAEoAgAiBEEBcQRAIAAgASAEIAQgAiADEG0PCyAEIAQoAggiAUEBajYCCCABQQBOBEAgACAENgIMIAAgAzYCCCAA
IAI2AgQgAEG8uMAANgIADwsAC1gBAX8jAEEgayIDJAAgA0EYaiACQRhqKQAANwMAIANBEGogAkEQaikAADcDACADQQhqIAJBCGop
AAA3AwAgAyACKQAANwMAIAAgAyABQSAQMiADQSBqJAALTgAjAEEgayIAJAAgAEEBNgIEIABB4L7AADYCACAAQgE3AgwgAELIvsCA
wAc3AxggACAAQRhqNgIIIAEoAhwgASgCICAAEDggAEEgaiQAC00BAX8jAEEwayIBJAAgAUEBNgIMIAFBsOTAADYCCCABQgE3AhQg
ASABQS9qrUKAgICAgAyENwMgIAEgAUEgajYCECABQQhqIAAQnQEAC0MAIAEoAgAiAUEBcQRAIAFBfnEgAiADEOUBIQEgACADNgII
IAAgATYCBCAAIAIgA2ogAWs2AgAPCyAAIAEgAiADEF4LOgEBfyMAQSBrIgAkACAAQQA2AhggAEEBNgIMIABBtMrAADYCCCAAQgQ3
AhAgAEEIakHoysAAEJ0BAAtFAQF/IAIgACgCACAAKAIIIgNrSwRAIAAgAyACQQFBARBYIAAoAgghAwsgACgCBCADaiABIAIQNRog
ACACIANqNgIIQQALQQEBfyACIAAoAgAgACgCCCIDa0sEQCAAIAMgAhBgIAAoAgghAwsgACgCBCADaiABIAIQNRogACACIANqNgII
QQALQAAgASgCACIBQQFxBEAgASACIAMQ5QEhASAAIAM2AgggACABNgIEIAAgAiADaiABazYCAA8LIAAgASACIAMQXgtCAQF/IAAo
AgAiACgCMCIBBEAgACgCNCABEMoBCwJAIABBf0YNACAAIAAoAgRBAWsiATYCBCABDQAgAEHIABDKAQsLTwECf0H5gsEALQAAGiAB
KAIEIQIgASgCACEDQQhBBBC+ASIBRQRAQQRBCBDjAQALIAEgAjYCBCABIAM2AgAgAEHQycAANgIEIAAgATYCAAtBAQF/IAIgACgC
ACAAKAIIIgNrSwRAIAAgAyACEGcgACgCCCEDCyAAKAIEIANqIAEgAhA1GiAAIAIgA2o2AghBAAtCAQF/IwBBIGsiAyQAIANBADYC
ECADQQE2AgQgA0IENwIIIAMgATYCHCADIAA2AhggAyADQRhqNgIAIAMgAhCdAQALQAEBfyABKAIAIgEgASgCCCIEQQFqNgIIIARB
AEgEQAALIAAgATYCDCAAIAM2AgggACACNgIEIABBvLjAADYCAAs8ACAAIAEpAAA3AAAgAEEYaiABQRhqKQAANwAAIABBEGogAUEQ
aikAADcAACAAQQhqIAFBCGopAAA3AAALjgIBA38gACgCACECIAEoAhQiAEEQcUUEQCAAQSBxRQRAIAIgARDQAQ8LQQAhACMAQYAB
ayIEJAAgAigCACECA0AgACAEakH/AGogAkEPcSIDQTByIANBN2ogA0EKSRs6AAAgAEEBayEAIAJBD0sgAkEEdiECDQALIAFBAUHc
5sAAQQIgACAEakGAAWpBACAAaxAwIARBgAFqJAAPC0EAIQAjAEGAAWsiBCQAIAIoAgAhAgNAIAAgBGpB/wBqIAJBD3EiA0EwciAD
QdcAaiADQQpJGzoAACAAQQFrIQAgAkEPSyACQQR2IQINAAsgAUEBQdzmwABBAiAAIARqQYABakEAIABrEDAgBEGAAWokAAvgcwMj
fxp+AXwgASgCFEEBcSECIAArAwAhPwJAIAEoAghBAUYEQAJ/IAEhCCABKAIMIRNBACEAIwBB8AhrIgkkACA/vSEnAn9BAyA/mUQA
AAAAAADwf2ENABpBAiAnQoCAgICAgID4/wCDIiZCgICAgICAgPj/AFENABogJ0L/////////B4MiKUKAgICAgICACIQgJ0IBhkL+
////////D4MgJ0I0iKdB/w9xIgEbIiVCAYMhKCAmUARAQQQgKVANARogAUGzCGshAEIBISYgKFAMAQtCgICAgICAgCAgJUIBhiAl
QoCAgICAgIAIUSIAGyElQgJCASAAGyEmQct3Qcx3IAAbIAFqIQAgKFALIQEgCSAAOwHoCCAJICY3A+AIIAlCATcD2AggCSAlNwPQ
CCAJIAE6AOoIAkACfwJAAkACQAJAIAFBAmsiAwRAQQEhAUG748AAQbzjwAAgJ0IAUyIGG0G748AAQQEgBhsgAhshGSAnQj+IpyAC
ciEcQQMgAyADQQNPG0ECaw4CAgMBCyAJQQM2ApgIIAlBvePAADYClAggCUECOwGQCEEBIRlBASEBIAlBkAhqDAQLIAlBAzYCmAgg
CUHA48AANgKUCCAJQQI7AZAIIAlBkAhqDAMLQQIhASAJQQI7AZAIIBNFDQEgCSATNgKgCCAJQQA7AZwIIAlBAjYCmAggCUG548AA
NgKUCCAJQZAIagwCC0F0QQUgAMEiAEEASBsgAGwiAEHA/QBJBEAgCUGQCGohDCAJQRBqIQsgAEEEdkEVaiEHQYCAfkEAIBNrIBNB
gIACTxshAQJAAkACfwJAAkACQAJAIAlB0AhqIhEpAwAiJVBFBEAgJUKAgICAgICAgCBaDQEgB0UNAkGgfyARLwEYIgBBIGsgACAl
QoCAgIAQVCIAGyICQRBrIAIgJUIghiAlIAAbIiVCgICAgICAwABUIgAbIgJBCGsgAiAlQhCGICUgABsiJUKAgICAgICAgAFUIgAb
IgJBBGsgAiAlQgiGICUgABsiJUKAgICAgICAgBBUIgAbIgJBAmsgAiAlQgSGICUgABsiJUKAgICAgICAgMAAVCIAGyAlQgKGICUg
ABsiJUIAWWsiA2vBQdAAbEGwpwVqQc4QbSIAQdEATw0DIABBBHQiAkGA1MAAaikDACImQv////8PgyInICUgJUJ/hUI/iIYiJUIg
iCIofiIpQiCIICZCIIgiJiAofnwgJiAlQv////8PgyIlfiImQiCIfCApQv////8PgyAlICd+QiCIfCAmQv////8Pg3xCgICAgAh8
QiCIfCIlQUAgAyACQYjUwABqLwEAamsiBUE/ca0iJ4inIQAgAkGK1MAAai8BACECICVCASAnhiIoQgF9IimDIiZQBEAgB0EKSw0H
IAdBAnRBlOHAAGooAgAgAEsNBwsgAEGQzgBPBEAgAEHAhD1JDQUgAEGAwtcvTwRAQQhBCSAAQYCU69wDSSIDGyEGQYDC1y9BgJTr
3AMgAxsMBwtBBkEHIABBgK3iBEkiAxshBkHAhD1BgK3iBCADGwwGCyAAQeQATwRAQQJBAyAAQegHSSIDGyEGQeQAQegHIAMbDAYL
QQpBASAAQQlLIgYbDAULQdfPwABBHEHE4MAAEJABAAtB1ODAAEEkQfjgwAAQkAEAC0Gg4MAAQSFBiOHAABCQAQALIABB0QBBwN7A
ABB9AAtBBEEFIABBoI0GSSIDGyEGQZDOAEGgjQYgAxsLIQMCQAJAAkACQCAGIAJrQQFqwSIEIAHBIgJKBEAgBUH//wNxIQ4gBCAB
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
ai0AADoAACACQQNqIANBA2otAAA6AAAgAkEEaiADQQRqLQAAOgAAIAJBBWogA0EFai0AADoAACACQQZqIANBBmotAAA6AAAgAkEH
aiADQQdqLQAAOgAAIANBCGohAyACQQhqIgIgBEcNAAsLIAQgBSAGayIDQXxxIghqIQICQCABIAZqIgBBA3FFBEAgAiAETQ0BIAAh
AQNAIAQgASgCADYCACABQQRqIQEgBEEEaiIEIAJJDQALDAELIAIgBE0NACAAQQN0IgVBGHEhBiAAQXxxIglBBGohAUEAIAVrQRhx
IQogCSgCACEFA0AgBCAFIAZ2IAEoAgAiBSAKdHI2AgAgAUEEaiEBIARBBGoiBCACSQ0ACwsgA0EDcSEFIAAgCGohAQsgAiACIAVq
IgBPDQEgBUEHcSIDBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWohAiADQQFrIgMNAAsLIAVBAWtBB0kNAQNAIAIgAS0AADoAACAC
QQFqIAFBAWotAAA6AAAgAkECaiABQQJqLQAAOgAAIAJBA2ogAUEDai0AADoAACACQQRqIAFBBGotAAA6AAAgAkEFaiABQQVqLQAA
OgAAIAJBBmogAUEGai0AADoAACACQQdqIAFBB2otAAA6AAAgAUEIaiEBIAJBCGoiAiAARw0ACwwBCyACIAVrIgQgAk8NACAFQQNx
IgEEQANAIAJBAWsiAiAAQQFrIgAtAAA6AAAgAUEBayIBDQALCyAFQQFrQQNJDQAgAEEEayEBA0AgAkEBayABQQNqLQAAOgAAIAJB
AmsgAUECai0AADoAACACQQNrIAFBAWotAAA6AAAgAkEEayICIAEtAAA6AAAgAUEEayEBIAIgBEsNAAsLIAcLCgAgACABJQEQBQsO
ACABQcbBwABBAxC6AQsOACABQby/wABBCBC6AQsJACAAQQA2AgALCAAgACUBEAILCAAgACUBEBELCAAgACUBECELBABBAAsCAAsL
tYIBDgBBgIDAAAu1Ai9Vc2Vycy9hc3NhZnZheW5lci9oZi9odWdnaW5nZmFjZS5qcy9wYWNrYWdlcy9odWIveGV0LWNvcmUtd2Fz
bS1idWlsZC9tZXJrbGVoYXNoL3NyYy9hZ2dyZWdhdGVkX2hhc2hlcy5ycwAAAAAAEABpAAAAWQAAADgAAAAAABAAaQAAAFkAAAAP
AAAAAAAQAGkAAABWAAAAOQAAAC9Vc2Vycy9hc3NhZnZheW5lci8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0x
OTQ5Y2Y4YzZiNWI1NTdmL3dhc20tYmluZGdlbi0wLjIuMTAwL3NyYy9jb252ZXJ0L3NsaWNlcy5ycwAAnAAQAHIAAAAkAQAADgAA
AAQAAAAMAAAABAAAAAUAAAAGAAAABwBBwILAAAuRBAEAAAAIAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFu
IGVycm9yIHVuZXhwZWN0ZWRseS9Vc2Vycy9hc3NhZnZheW5lci8ucnVzdHVwL3Rvb2xjaGFpbnMvMS44Ni1hYXJjaDY0LWFwcGxl
LWRhcndpbi9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAfwEQAHAAAADfCgAADgAAAC9V
c2Vycy9hc3NhZnZheW5lci8ucnVzdHVwL3Rvb2xjaGFpbnMvMS44Ni1hYXJjaDY0LWFwcGxlLWRhcndpbi9saWIvcnVzdGxpYi9z
cmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zbGljZS5ycwAAAhAAbwAAAKIAAAAZAAAARXJyb3IAAAB/ARAAcAAAAI0FAAAbAAAA
SnNDaHVua0luaGFzaGxlbmd0aAChAhAABAAAAKUCEAAGAAAAc3RydWN0IEpzQ2h1bmtJbkpzQ2h1bmtPdXRkZWR1cGF0dGVtcHRl
ZCB0byB0YWtlIG93bmVyc2hpcCBvZiBSdXN0IHZhbHVlIHdoaWxlIGl0IHdhcyBib3Jyb3dlZHNyYy9saWIucnMaAxAACgAAAD4A
AAA4AAAAGgMQAAoAAABBAAAAIQAAABoDEAAKAAAASwAAABQAQfSGwAALVUludmFsaWQgaGFzaCBoZXg6IAAAdAMQABIAAABJbnZh
bGlkIEhNQUMga2V5IGhleDogAACQAxAAFgAAACA6IAoBAAAAAAAAALADEAADAAAAswMQAAEAQdSHwAAL8QgBAAAADAAAAGNhbGxl
ZCBgUmVzdWx0Ojp1bndyYXAoKWAgb24gYW4gYEVycmAgdmFsdWUvVXNlcnMvYXNzYWZ2YXluZXIvaGYvaHVnZ2luZ2ZhY2UuanMv
cGFja2FnZXMvaHViL3hldC1jb3JlLXdhc20tYnVpbGQvbWVya2xlaGFzaC9zcmMvYWdncmVnYXRlZF9oYXNoZXMucnMHBBAAaQAA
AD0AAAAqAAAABwQQAGkAAAA4AAAAHgAAAC9Vc2Vycy9hc3NhZnZheW5lci8ucnVzdHVwL3Rvb2xjaGFpbnMvMS44Ni1hYXJjaDY0
LWFwcGxlLWRhcndpbi9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvc3BlY19mcm9tX2l0ZXJfbmVz
dGVkLnJzAJAEEACDAAAAEwAAAAUAAAAvVXNlcnMvYXNzYWZ2YXluZXIvLnJ1c3R1cC90b29sY2hhaW5zLzEuODYtYWFyY2g2NC1h
cHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9hbGxvYy9zcmMvc2xpY2UucnMAJAUQAG8AAACiAAAAGQAA
AEVycm9yL1VzZXJzL2Fzc2FmdmF5bmVyLy5ydXN0dXAvdG9vbGNoYWlucy8xLjg2LWFhcmNoNjQtYXBwbGUtZGFyd2luL2xpYi9y
dXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwAAAKkFEABwAAAAjQUAABsAAABpbnZhbGlkIHZhbHVl
OiAsIGV4cGVjdGVkIAAALAYQAA8AAAA7BhAACwAAAG1pc3NpbmcgZmllbGQgYGBYBhAADwAAAGcGEAABAAAAZHVwbGljYXRlIGZp
ZWxkIGAAAAB4BhAAEQAAAGcGEAABAAAADQAAAAwAAAAEAAAADgAAAA8AAAAHAAAAL1VzZXJzL2Fzc2FmdmF5bmVyLy5ydXN0dXAv
dG9vbGNoYWlucy8xLjg2LWFhcmNoNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvYWxsb2Mvc3Jj
L3Jhd192ZWMucnMAAAC0BhAAcQAAACoCAAARAAAAL1VzZXJzL2Fzc2FmdmF5bmVyLy5ydXN0dXAvdG9vbGNoYWlucy8xLjg2LWFh
cmNoNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5yczgHEABwAAAA
6gEAABcAAABhIHNlcXVlbmNlL1VzZXJzL2Fzc2FmdmF5bmVyLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5
NDljZjhjNmI1YjU1N2Yvc2VyZGUtMS4wLjIxOS9zcmMvZGUvaW1wbHMucnMAwgcQAGUAAACVBAAAIgAAAMIHEABlAAAAmAQAABwA
QdCQwAALBQEAAAAQAEHgkMAACwUBAAAAEQBB8JDAAAsFAQAAABIAQYCRwAALmwQBAAAAEwAAAC9Vc2Vycy9hc3NhZnZheW5lci8u
cnVzdHVwL3Rvb2xjaGFpbnMvMS44Ni1hYXJjaDY0LWFwcGxlLWRhcndpbi9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2Fs
bG9jL3NyYy9zdHJpbmcucnOICBAAcAAAAI0FAAAbAAAAFAAAAAwAAAAEAAAAFQAAABYAAAAHAAAAY2FsbGVkIGBPcHRpb246OnVu
d3JhcF90aHJvdygpYCBvbiBhIGBOb25lYCB2YWx1ZWhhc2hsZW5ndGgvVXNlcnMvYXNzYWZ2YXluZXIvLnJ1c3R1cC90b29sY2hh
aW5zLzEuODYtYWFyY2g2NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9hbGxvYy9zcmMvc2xpY2Uu
cnMAAFsJEABvAAAAogAAABkAAABpbnZhbGlkIHR5cGU6ICwgZXhwZWN0ZWQgAAAA3AkQAA4AAADqCRAACwAAAAEAAAAAAAAAL1Vz
ZXJzL2Fzc2FmdmF5bmVyLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2Yvc2VyZGUt
d2FzbS1iaW5kZ2VuLTAuNi41L3NyYy9saWIucnMAEAoQAGsAAAA1AAAADgAAAAAAAAD//////////5AKEABBqJXAAAu1IgEAAAAv
VXNlcnMvYXNzYWZ2YXluZXIvaGYvaHVnZ2luZ2ZhY2UuanMvcGFja2FnZXMvaHViL3hldC1jb3JlLXdhc20tYnVpbGQvZGVkdXBs
aWNhdGlvbi9zcmMvY2h1bmtpbmcucnMArAoQAGMAAAAfAAAACQAAAGFzc2VydGlvbiBmYWlsZWQ6IHRhcmdldF9jaHVua19zaXpl
ID4gNjSsChAAYwAAACMAAAAJAAAAYXNzZXJ0aW9uIGZhaWxlZDogdGFyZ2V0X2NodW5rX3NpemUgPCB1MzI6Ok1BWCBhcyB1c2l6
ZQCsChAAYwAAACcAAAAJAAAArAoQAGMAAAAvAAAAHQAAAGFzc2VydGlvbiBmYWlsZWQ6IG1heGltdW1fY2h1bmsgPiBtaW5pbXVt
X2NodW5rAKwKEABjAAAAMgAAAAkAAACsChAAYwAAADwAAAAXAAAArAoQAGMAAABlAAAAQQAAAKwKEABjAAAAnwAAADIAAACsChAA
YwAAAKEAAAA6AAAArAoQAGMAAADTAAAAFQAAAKwKEABjAAAA0AAAAEAAAAAvVXNlcnMvYXNzYWZ2YXluZXIvLnJ1c3R1cC90b29s
Y2hhaW5zLzEuODYtYWFyY2g2NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9hbGxvYy9zcmMvcmF3
X3ZlYy5ycwAAAFAMEABxAAAAKgIAABEAAAAvVXNlcnMvYXNzYWZ2YXluZXIvLmNhcmdvL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0
ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9sYXp5X3N0YXRpYy0xLjUuMC9zcmMvaW5saW5lX2xhenkucnPUDBAAbAAAAB4AAAAQAAAA
T25jZSBpbnN0YW5jZSBoYXMgcHJldmlvdXNseSBiZWVuIHBvaXNvbmVkAABQDRAAKgAAAG9uZS10aW1lIGluaXRpYWxpemF0aW9u
IG1heSBub3QgYmUgcGVyZm9ybWVkIHJlY3Vyc2l2ZWx5hA0QADgAAAAvVXNlcnMvYXNzYWZ2YXluZXIvLnJ1c3R1cC90b29sY2hh
aW5zLzEuODYtYWFyY2g2NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9zdGQvc3JjL3N5bmMvcG9p
c29uL29uY2UucnPEDRAAeAAAAJsAAAAyAAAAAAAAAFn1QOip04iw1iDtOffHUlarcomJaYmyRXfHjrbViQprtzF6iz5XjzZL2Tbp
3DbGHbbVVFVOTHogy5ojKEazdKQSuaMcPqgGO/e6Ai9sjeeQipoNFfctyeGt04YQOgWVjiIHOrjx9C5arn+An5SsD6WB1tiA6wNz
Dg+tcBXcfrCZdjD9VbUvnWhopJ4RglAAACjMj6gGg7DE/Uo39opnsD42dK2Gq4ef8TbHa76/nxLy7aSYXFdJEUjFe0eVBgEAAMzq
nBqAN7ofbZukY9Zv8DtLh+OCl35omePYUKpzBqF5IPQRYp7PrORxkFeHH+cgJZuKGnj909Urc8gR3c1N3gAvOYdaHDGp6v9AvBe2
jnTbb78g9o2aV6+xwgkb2uWmhi6hIsMKwy/MZ0L3wf4qXjV7pCHA9MiZLcPPBJRKS966aX1wHXIYtfcgLPN7WLaGMgwnr4aItgAA
eZCK2+TWFaGZ4bKXnH5PSAHjE1e3e8rMYPGwK6aEJb/IvF1iE+jnrVqVhw2UcAAAb2KeEwiR5oqiON4v12p3vc/A/MIfAGv7J8R7
5rh0pMdYXesQFvH2utFw521bH8sJR0x9l+YZsrBKraduOLzMAAE/l98KnYTMcPdqAX3vo3P+vb2G09IHyDAXeWyWySp/2gTFxmuo
N9CdYKoeZnzx84fmqk2wJqasB1tKTzeZWnXerixb5n6DkIUHVv2Trehu2O1TEOHZAADX2xzSsjsGnrLSASrxd6sHRBtk5lUCVezG
FJxEqJT7ePX1wMYbDlHH48rkNgsyAAAtGossJjN8gkRB6kgLX2cU6+yNSabTeyZeA/WC+W+R8Yj7NPR/GyKG2ElvOOfOvp1Kjw/I
yvhY6thk/JKGGY0ANpq/uk9wOG1MvufRB8sy4JAIRa32IY0ipYklwL+xXGNxzqKcc6EgRlj75arj3+en6w08K5PKEAx77a+E6P4n
Jx+r4vltHN+iI/V0B6zRzU1O4jOt/3AAABZ4l8V76KyiSWAotFonkphZifHdgRGGwhk+SEKgcpm7eDBRZjfNcO9kmPyrEwUAAINA
yVgYtljA3uAll4VQ6AmUfT74O/uXkc5LthJtYh5+0Vd7f1BUDFIWJOJ0cXnhvodV6SIyrNlvPr/fmnyVIwAVvksjfn0coLuMo7hY
x6KrMCs+7M6gHw2RuWB+i6W2CzVmop9b3TNDo8EBQH07/cInEXNUJIBB+8sYDaWFYaVlT7WEh70CevZjUOZn3RFvaasUqPwiIAAA
Uti5LZG+1oxXiq7ptolRaSgM2gq1U5TuXoR4Gqle/Nhnp0oaGb+Gq+UVZMi1xgAALqIIjhcQcyYlyosHGxAt7fuoJrKE7UE7Btwo
DxIi5hMmbXD76/UVo866ATNOwxaIrv1xu5xbOelIFnIuIOksABzJsysd24NCpaax0hpGfddrhutu5Bfs4nzE+zlAvuC4BJ0p1cRg
od40NozSyIbsfpmjmJ8SrRkh74OiYWv0zKYXxlj23s5SLIPdrGkRh7Qt6cue89bwAACJlC+NydjVPYT1ASuichiK8jx7DsSkgvKW
oRvLLOwggBPjWZ7gtpNm64N8zBnOAAA7nEf2NVfLIFta11k3vy52dTlpPYL+eyDV2ZwzEsF91wN9YoRCg6eb6VFf6RPFfSEWeF78
KRp7si1muzGYzdUATHN1bYCb43EjGvsG8CpXfoUf6WovT3Oi8t0sArXGgr/eoGEHxuo7XJhpQUe7k8jNAX4YXGGFEG1dfCesMK74
d5EsKhKBa3yRZ2nRrZm2dVubBprnas8AAAQR3mD6CsTzw2eRpXoSYyBNidFpIuYdYiZHK+YdrIjRPGdLFeI2cBAdOlUoX7gAAD1v
IxhMTu/yAva5EWbe1tkckUf7VXn8ob2NKS8D/YXr4fq+sy9QJ74eZs3EUUID4zYYB1TTZBNEPpjydWyzggDwZvoWA5FFsffKR5ic
BhwCIVJLWsffECm1qFccPjVbc2zZjuksMUTOZfq9BkUulLwblFcSp4ZQ8K3OUdMVssP+AkIU4FUQrgBU5EJvhEBL9ci8vMjZfwAA
/pveF/Oevb8SToXyLzAEqNTY5aVXSc45hLo3VqTiuf+LgaCeHa25VYoXGfPLigAAOPv70Mi/4kjotUjoQZjji4uglgYWEicOKiRE
S+iWENU64ZJnF7oBEZ1oMUUPdy7CbMW7cvLviRbsUFZ/GSqpAE54ob2QWXa8rrj8kuNBFMag5DHtLDrhB02dTiOE6cuSxYp9u3L1
T4/QO5YLwHCWCwHrAxpYWpViVAIA6uWDX2SZ8ojNFuX8Qc+YetpIl9q7+kVI/rKqAABVZfWbBht2GVattkODXo+L2SFIFP0cXT6P
zbCiLB5c7H+1+6f+4Pf6G5YSutMAAACOsQGEF5A/2utfOuNtkP9w53BpwKfVJwXpE3xgc+fYIqw7PGTfcKvJ4xK+itzGpO2K5zMA
QR/v7MtyrHSywiQAtACpT5UNdAYEYz0ymyl6HdXqy5iyfMOzm3N4YcfjhsmK9UZLNuqrn1bMha/FFKJthI+jt9g+pBfr25odUezM
bvtaMxMJs8r50u4V9MVgXkq0cjZQZ2kAAIe7VBQSHaWdFsi7uRMeMoSN3S+rtm89+40KFo7tXjBg6GyU6RRLv8vDEBs4Y08AABBO
zG+Bt9UHVYFqanI2peXdf6BHNLKvV5TTyav3RvMYPdMa1lXGbWP28/c5SauLzHsY3cEGqcdjL1VzZXJzL2Fzc2FmdmF5bmVyLy5y
dXN0dXAvdG9vbGNoYWlucy8xLjg2LWFhcmNoNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvY29y
ZS9zcmMvaXRlci90cmFpdHMvaXRlcmF0b3IucnMAAABQFhAAfQAAALMHAAAJAAAAL1VzZXJzL2Fzc2FmdmF5bmVyLy5ydXN0dXAv
dG9vbGNoYWlucy8xLjg2LWFhcmNoNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvYWxsb2Mvc3Jj
L3NsaWNlLnJzAOAWEABvAAAAogAAABkAAAB/GFfWzlbtZhJ/+RPnpcPzpM0m1bXbSeZBJJh/KPuUwy9Vc2Vycy9hc3NhZnZheW5l
ci8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL2xhenlfc3RhdGljLTEuNS4wL3Ny
Yy9pbmxpbmVfbGF6eS5yc4AXEABsAAAAHgAAABAAAABPbmNlIGluc3RhbmNlIGhhcyBwcmV2aW91c2x5IGJlZW4gcG9pc29uZWQA
APwXEAAqAAAAb25lLXRpbWUgaW5pdGlhbGl6YXRpb24gbWF5IG5vdCBiZSBwZXJmb3JtZWQgcmVjdXJzaXZlbHkwGBAAOAAAAC9V
c2Vycy9hc3NhZnZheW5lci8ucnVzdHVwL3Rvb2xjaGFpbnMvMS44Ni1hYXJjaDY0LWFwcGxlLWRhcndpbi9saWIvcnVzdGxpYi9z
cmMvcnVzdC9saWJyYXJ5L3N0ZC9zcmMvc3luYy9wb2lzb24vb25jZS5yc3AYEAB4AAAAmwAAADIAAAAvVXNlcnMvYXNzYWZ2YXlu
ZXIvLnJ1c3R1cC90b29sY2hhaW5zLzEuODYtYWFyY2g2NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFy
eS9hbGxvYy9zcmMvcmF3X3ZlYy5ycwAAAPgYEABxAAAAKgIAABEAAAAAAAAABAAAAAQAAAAZAAAAL1VzZXJzL2Fzc2FmdmF5bmVy
Ly5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvanMtc3lzLTAuMy43Ny9zcmMvbGli
LnJzjBkQAGAAAAD7GAAAAQAAAC9Vc2Vycy9hc3NhZnZheW5lci8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0x
OTQ5Y2Y4YzZiNWI1NTdmL3dhc20tYmluZGdlbi0wLjIuMTAwL3NyYy9jb252ZXJ0L3NsaWNlcy5ycwAA/BkQAHIAAAAkAQAADgAA
AGNsb3N1cmUgaW52b2tlZCByZWN1cnNpdmVseSBvciBhZnRlciBiZWluZyBkcm9wcGVkL1VzZXJzL2Fzc2FmdmF5bmVyLy5ydXN0
dXAvdG9vbGNoYWlucy8xLjg2LWFhcmNoNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvYWxsb2Mv
c3JjL3NsaWNlLnJzAAAAshoQAG8AAACiAAAAGQAAAExheW91dEVycm9yACYAAAAnAAAAKAAAACkAAAAqAAAAL1VzZXJzL2Fzc2Fm
dmF5bmVyLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvYnl0ZXMtMS4xMC4xL3Ny
Yy9ieXRlcy5ycwAAACsAAAAsAAAALQAAAC4AAAAvAAAAMAAAADEAAAAyAAAALgAAADMAQei3wAALoRQBAAAANAAAAGNhbGxlZCBg
UmVzdWx0Ojp1bndyYXAoKWAgb24gYW4gYEVycmAgdmFsdWUAVBsQAGEAAABIBQAAMgAAAFQbEABhAAAAVgUAAEkAAAA1AAAANgAA
ADcAAAA4AAAAOQAAAC9Vc2Vycy9hc3NhZnZheW5lci8ucnVzdHVwL3Rvb2xjaGFpbnMvMS44Ni1hYXJjaDY0LWFwcGxlLWRhcndp
bi9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zbGljZS5ycwBQHBAAbwAAAKIAAAAZAAAAL1VzZXJzL2Fz
c2FmdmF5bmVyL2hmL2h1Z2dpbmdmYWNlLmpzL3BhY2thZ2VzL2h1Yi94ZXQtY29yZS13YXNtLWJ1aWxkL21lcmtsZWhhc2gvc3Jj
L2RhdGFfaGFzaC5ycwAAANAcEABhAAAAegAAAAkAAABJbnZhbGlkIGhleCBpbnB1dCBmb3IgRGF0YUhhc2gAAAEAAAAAAAAAAQAA
AAAAAAABAAAAAAAAAAEAAAAAAAAA0BwQAGEAAAC9AAAAKgAAANAcEABhAAAAvgAAACoAAADQHBAAYQAAAL8AAAAqAAAAZpf1d1uV
UN4xNcuspZcYHJ3kIRCb6ytYtNCwS5Ot8ikBfsXHpUcplv2UZma0igLmXd1TbzfHbdL4Y1LmSlNxPwEAAAAAAAAAbWlkID4gbGVu
AAAA/B0QAAkAAAAvVXNlcnMvYXNzYWZ2YXluZXIvLmNhcmdvL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2
YjViNTU3Zi9ibGFrZTMtMS44LjIvc3JjL2xpYi5ycwAQHhAAXwAAAAsCAAARAAAAEB4QAF8AAAC+AgAACgAAABAeEABfAAAA7AIA
ACgAAAAQHhAAXwAAAOwCAAA0AAAAEB4QAF8AAADsAgAADAAAABAeEABfAAAA3AIAABcAAAAQHhAAXwAAABgDAAAfAAAAEB4QAF8A
AAA1AwAADAAAABAeEABfAAAAPAMAABIAAAAQHhAAXwAAAGADAAAhAAAAEB4QAF8AAABiAwAAEQAAABAeEABfAAAAYgMAAEEAAABp
bnN1ZmZpY2llbnQgY2FwYWNpdHkAAAAwHxAAFQAAAENhcGFjaXR5RXJyb3I6IABQHxAADwAAAGNhbGxlZCBgUmVzdWx0Ojp1bndy
YXAoKWAgb24gYW4gYEVycmAgdmFsdWUAAAAAAAQAAAAEAAAAPQAAAAAAAAAIAAAABAAAAEUAAABGAAAARwAAAGEgc3RyaW5nYnl0
ZSBhcnJheWJvb2xlYW4gYGDOHxAACQAAANcfEAABAAAAaW50ZWdlciBgAAAA6B8QAAkAAADXHxAAAQAAAGZsb2F0aW5nIHBvaW50
IGAEIBAAEAAAANcfEAABAAAAY2hhcmFjdGVyIGAAJCAQAAsAAADXHxAAAQAAAHN0cmluZyAAQCAQAAcAAAB1bml0IHZhbHVlT3B0
aW9uIHZhbHVlbmV3dHlwZSBzdHJ1Y3RzZXF1ZW5jZW1hcGVudW11bml0IHZhcmlhbnRuZXd0eXBlIHZhcmlhbnR0dXBsZSB2YXJp
YW50c3RydWN0IHZhcmlhbnQAAAABAAAAAAAAAC4wdTMyL1VzZXJzL2Fzc2FmdmF5bmVyLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5k
ZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2Yvd2FzbS1iaW5kZ2VuLTAuMi4xMDAvc3JjL2NvbnZlcnQvaW1wbHMucnMAAMkg
EABxAAAAYQIAABYAAADJIBAAcQAAAHECAAAMAAAAySAQAHEAAABtAgAAEAAAAGFycmF5IGNvbnRhaW5zIGEgdmFsdWUgb2YgdGhl
IHdyb25nIHR5cGVKc1ZhbHVlKCkAAACUIRAACAAAAJwhEAABAAAATGF6eSBpbnN0YW5jZSBoYXMgcHJldmlvdXNseSBiZWVuIHBv
aXNvbmVkAACwIRAAKgAAAC9Vc2Vycy9hc3NhZnZheW5lci8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5
Y2Y4YzZiNWI1NTdmL29uY2VfY2VsbC0xLjIxLjMvc3JjL2xpYi5ycwDkIRAAYwAAAAgDAAAZAAAAcmVlbnRyYW50IGluaXQAAFgi
EAAOAAAA5CEQAGMAAAB6AgAADQAAAG51bGwgcG9pbnRlciBwYXNzZWQgdG8gcnVzdHJlY3Vyc2l2ZSB1c2Ugb2YgYW4gb2JqZWN0
IGRldGVjdGVkIHdoaWNoIHdvdWxkIGxlYWQgdG8gdW5zYWZlIGFsaWFzaW5nIGluIHJ1c3QvcnVzdGMvMDVmOTg0NmY4OTNiMDlh
MWJlMWZjODU2MGUzM2ZjM2M4MTVjZmVjYi9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAAADqIhAASwAAAI0FAAAbAAAAL3J1
c3RjLzA1Zjk4NDZmODkzYjA5YTFiZTFmYzg1NjBlMzNmYzNjODE1Y2ZlY2IvbGlicmFyeS9hbGxvYy9zcmMvcmF3X3ZlYy5yc0gj
EABMAAAAKgIAABEAAABMAAAADAAAAAQAAABNAAAATgAAAE8AAAAvcnVzdC9kZXBzL2RsbWFsbG9jLTAuMi43L3NyYy9kbG1hbGxv
Yy5yc2Fzc2VydGlvbiBmYWlsZWQ6IHBzaXplID49IHNpemUgKyBtaW5fb3ZlcmhlYWQAvCMQACkAAACoBAAACQAAAGFzc2VydGlv
biBmYWlsZWQ6IHBzaXplIDw9IHNpemUgKyBtYXhfb3ZlcmhlYWQAALwjEAApAAAArgQAAA0AAABtZW1vcnkgYWxsb2NhdGlvbiBv
ZiAgYnl0ZXMgZmFpbGVkAABkJBAAFQAAAHkkEAANAAAAbGlicmFyeS9zdGQvc3JjL2FsbG9jLnJzmCQQABgAAABjAQAACQAAAEwA
AAAMAAAABAAAAFAAAAAAAAAACAAAAAQAAABRAAAAAAAAAAgAAAAEAAAAUgAAAFMAAABUAAAAVQAAAFYAAAAQAAAABAAAAFcAAABY
AAAAWQAAAFoAAABIYXNoIHRhYmxlIGNhcGFjaXR5IG92ZXJmbG93GCUQABwAAAAvcnVzdC9kZXBzL2hhc2hicm93bi0wLjE1LjIv
c3JjL3Jhdy9tb2QucnMAADwlEAAqAAAAIwAAACgAAABFcnJvcgAAAFsAAAAMAAAABAAAAFwAAABdAAAAXgAAAGNhcGFjaXR5IG92
ZXJmbG93AAAAmCUQABEAAABsaWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjLnJztCUQABwAAAAqAgAAEQAAAGxpYnJhcnkvYWxsb2Mv
c3JjL3N0cmluZy5ycwDgJRAAGwAAAOoBAAAXAEGUzMAAC9gMAQAAAF8AAABhIGZvcm1hdHRpbmcgdHJhaXQgaW1wbGVtZW50YXRp
b24gcmV0dXJuZWQgYW4gZXJyb3Igd2hlbiB0aGUgdW5kZXJseWluZyBzdHJlYW0gZGlkIG5vdGxpYnJhcnkvYWxsb2Mvc3JjL2Zt
dC5ycwAAciYQABgAAACKAgAADgAAAOAlEAAbAAAAjQUAABsAAABhc3NlcnRpb24gZmFpbGVkOiBlZGVsdGEgPj0gMGxpYnJhcnkv
Y29yZS9zcmMvbnVtL2RpeV9mbG9hdC5ycwAAySYQACEAAABMAAAACQAAAMkmEAAhAAAATgAAAAkAAADBb/KGIwAAAIHvrIVbQW0t
7gQAAAEfar9k7Thu7Zen2vT5P+kDTxgAAT6VLgmZ3wP9OBUPL+R0I+z1z9MI3ATE2rDNvBl/M6YDJh/pTgIAAAF8Lphbh9O+cp/Z
2IcvFRLGUN5rcG5Kzw/YldVucbImsGbGrSQ2FR1a00I8DlT/Y8BzVcwX7/ll8ii8VffH3IDc7W70zu/cX/dTBQBsaWJyYXJ5L2Nv
cmUvc3JjL251bS9mbHQyZGVjL3N0cmF0ZWd5L2RyYWdvbi5yc2Fzc2VydGlvbiBmYWlsZWQ6IGQubWFudCA+IDAAqCcQAC8AAAB2
AAAABQAAAGFzc2VydGlvbiBmYWlsZWQ6IGQubWludXMgPiAwAAAAqCcQAC8AAAB3AAAABQAAAGFzc2VydGlvbiBmYWlsZWQ6IGQu
cGx1cyA+IDCoJxAALwAAAHgAAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogYnVmLmxlbigpID49IE1BWF9TSUdfRElHSVRTAAAAqCcQ
AC8AAAB7AAAABQAAAKgnEAAvAAAAwgAAAAkAAACoJxAALwAAAPsAAAANAAAAqCcQAC8AAAACAQAAEgAAAGFzc2VydGlvbiBmYWls
ZWQ6IGQubWFudC5jaGVja2VkX3N1YihkLm1pbnVzKS5pc19zb21lKCkAqCcQAC8AAAB6AAAABQAAAGFzc2VydGlvbiBmYWlsZWQ6
IGQubWFudC5jaGVja2VkX2FkZChkLnBsdXMpLmlzX3NvbWUoKQAAqCcQAC8AAAB5AAAABQAAAKgnEAAvAAAACwEAAAUAAACoJxAA
LwAAAAwBAAAFAAAAqCcQAC8AAAANAQAABQAAAKgnEAAvAAAAcgEAACQAAACoJxAALwAAAHcBAAAvAAAAqCcQAC8AAACEAQAAEgAA
AKgnEAAvAAAAZgEAAA0AAACoJxAALwAAAEwBAAAiAAAAqCcQAC8AAAAPAQAABQAAAKgnEAAvAAAADgEAAAUAAADfRRo9A88a5sH7
zP4AAAAAysaaxxf+cKvc+9T+AAAAAE/cvL78sXf/9vvc/gAAAAAM1mtB75FWvhH85P4AAAAAPPx/kK0f0I0s/Oz+AAAAAIOaVTEo
XFHTRvz0/gAAAAC1yaatj6xxnWH8/P4AAAAAy4vuI3cinOp7/AT/AAAAAG1TeECRScyulvwM/wAAAABXzrZdeRI8grH8FP8AAAAA
N1b7TTaUEMLL/Bz/AAAAAE+YSDhv6paQ5vwk/wAAAADHOoIly4V01wD9LP8AAAAA9Je/l83PhqAb/TT/AAAAAOWsKheYCjTvNf08
/wAAAACOsjUq+2c4slD9RP8AAAAAOz/G0t/UyIRr/Uz/AAAAALrN0xonRN3Fhf1U/wAAAACWySW7zp9rk6D9XP8AAAAAhKVifSRs
rNu6/WT/AAAAAPbaXw1YZquj1f1s/wAAAAAm8cPek/ji8+/9dP8AAAAAuID/qqittbUK/nz/AAAAAItKfGwFX2KHJf6E/wAAAABT
MME0YP+8yT/+jP8AAAAAVSa6kYyFTpZa/pT/AAAAAL1+KXAkd/nfdP6c/wAAAACPuOW4n73fpo/+pP8AAAAAlH10iM9fqfip/qz/
AAAAAM+bqI+TcES5xP60/wAAAABrFQ+/+PAIit/+vP8AAAAAtjExZVUlsM35/sT/AAAAAKx/e9DG4j+ZFP/M/wAAAAAGOysqxBBc
5C7/1P8AAAAA05JzaZkkJKpJ/9z/AAAAAA7KAIPytYf9Y//k/wAAAADrGhGSZAjlvH7/7P8AAAAAzIhQbwnMvIyZ//T/AAAAACxl
GeJYF7fRs//8/wBB9tjAAAsFQJzO/wQAQYTZwAAL0ikQpdTo6P8MAAAAAAAAAGKsxet4rQMAFAAAAAAAhAmU+Hg5P4EeABwAAAAA
ALMVB8l7zpfAOAAkAAAAAABwXOp7zjJ+j1MALAAAAAAAaIDpq6Q40tVtADQAAAAAAEUimhcmJ0+fiAA8AAAAAAAn+8TUMaJj7aIA
RAAAAAAAqK3IjDhl3rC9AEwAAAAAANtlqxqOCMeD2ABUAAAAAACaHXFC+R1dxPIAXAAAAAAAWOcbpixpTZINAWQAAAAAAOqNcBpk
7gHaJwFsAAAAAABKd++amaNtokIBdAAAAAAAhWt9tHt4CfJcAXwAAAAAAHcY3Xmh5FS0dwGEAAAAAADCxZtbkoZbhpIBjAAAAAAA
PV2WyMVTNcisAZQAAAAAALOgl/pctCqVxwGcAAAAAADjX6CZvZ9G3uEBpAAAAAAAJYw52zTCm6X8AawAAAAAAFyfmKNymsb2FgK0
AAAAAADOvulUU7/ctzECvAAAAAAA4kEi8hfz/IhMAsQAAAAAAKV4XNObziDMZgLMAAAAAADfUyF781oWmIEC1AAAAAAAOjAfl9y1
oOKbAtwAAAAAAJaz41xT0dmotgLkAAAAAAA8RKek2Xyb+9AC7AAAAAAAEESkp0xMdrvrAvQAAAAAABqcQLbvjquLBgP8AAAAAAAs
hFemEO8f0CADBAEAAAAAKTGR6eWkEJs7AwwBAAAAAJ0MnKH7mxDnVQMUAQAAAAAp9Dti2SAorHADHAEAAAAAhc+nel5LRICLAyQB
AAAAAC3drANA5CG/pQMsAQAAAACP/0ReL5xnjsADNAEAAAAAQbiMnJ0XM9TaAzwBAAAAAKkb47SS2xme9QNEAQAAAADZd9+6br+W
6w8ETAEAAAAAbGlicmFyeS9jb3JlL3NyYy9udW0vZmx0MmRlYy9zdHJhdGVneS9ncmlzdS5ycwAAEC8QAC4AAAB9AAAAFQAAABAv
EAAuAAAAqQAAAAUAAAAQLxAALgAAAKoAAAAFAAAAEC8QAC4AAACrAAAABQAAABAvEAAuAAAArgAAAAUAAABhc3NlcnRpb24gZmFp
bGVkOiBkLm1hbnQgKyBkLnBsdXMgPCAoMSA8PCA2MSkAAAAQLxAALgAAAK8AAAAFAAAAEC8QAC4AAAAKAQAAEQAAABAvEAAuAAAA
DQEAAAkAAAAQLxAALgAAAEABAAAJAAAAEC8QAC4AAACtAAAABQAAABAvEAAuAAAArAAAAAUAAABhc3NlcnRpb24gZmFpbGVkOiAh
YnVmLmlzX2VtcHR5KCkAAAAQLxAALgAAANwBAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogZC5tYW50IDwgKDEgPDwgNjEpEC8QAC4A
AADdAQAABQAAABAvEAAuAAAA3gEAAAUAAAABAAAACgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QUAypo7EC8QAC4AAAAz
AgAAEQAAABAvEAAuAAAANgIAAAkAAAAQLxAALgAAAGwCAAAJAAAAEC8QAC4AAADjAgAAJgAAABAvEAAuAAAA7wIAACYAAAAQLxAA
LgAAAMwCAAAmAAAAbGlicmFyeS9jb3JlL3NyYy9udW0vZmx0MmRlYy9tb2QucnMAIDEQACMAAAC7AAAABQAAAGFzc2VydGlvbiBm
YWlsZWQ6IGJ1ZlswXSA+IGInMCcAIDEQACMAAAC8AAAABQAAAGFzc2VydGlvbiBmYWlsZWQ6IHBhcnRzLmxlbigpID49IDQAACAx
EAAjAAAAvQAAAAUAAAAuMC4tK05hTmluZjBhc3NlcnRpb24gZmFpbGVkOiBidWYubGVuKCkgPj0gbWF4bGVuAAAAIDEQACMAAAB+
AgAADQAAACkuLjAxMjM0NTY3ODlhYmNkZWZCb3Jyb3dNdXRFcnJvcmFscmVhZHkgYm9ycm93ZWQ6IAAdMhAAEgAAAGNhbGxlZCBg
T3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVpbmRleCBvdXQgb2YgYm91bmRzOiB0aGUgbGVuIGlzICBidXQgdGhl
IGluZGV4IGlzIAAAAGMyEAAgAAAAgzIQABIAAAAAAAAABAAAAAQAAABmAAAAPT0hPW1hdGNoZXNhc3NlcnRpb24gYGxlZnQgIHJp
Z2h0YCBmYWlsZWQKICBsZWZ0OiAKIHJpZ2h0OiAAwzIQABAAAADTMhAAFwAAAOoyEAAJAAAAIHJpZ2h0YCBmYWlsZWQ6IAogIGxl
ZnQ6IAAAAMMyEAAQAAAADDMQABAAAAAcMxAACQAAAOoyEAAJAAAAOiAAAAEAAAAAAAAASDMQAAIAAAAweDAwMDEwMjAzMDQwNTA2
MDcwODA5MTAxMTEyMTMxNDE1MTYxNzE4MTkyMDIxMjIyMzI0MjUyNjI3MjgyOTMwMzEzMjMzMzQzNTM2MzczODM5NDA0MTQyNDM0
NDQ1NDY0NzQ4NDk1MDUxNTI1MzU0NTU1NjU3NTg1OTYwNjE2MjYzNjQ2NTY2Njc2ODY5NzA3MTcyNzM3NDc1NzY3Nzc4Nzk4MDgx
ODI4Mzg0ODU4Njg3ODg4OTkwOTE5MjkzOTQ5NTk2OTc5ODk5bGlicmFyeS9jb3JlL3NyYy9mbXQvbW9kLnJzMDAwMDAwMDAwMDAw
MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMGZhbHNldHJ1ZQAAJjQQABsAAACpCgAA
JgAAACY0EAAbAAAAsgoAABoAAABsaWJyYXJ5L2NvcmUvc3JjL3N0ci9tb2QucnNbLi4uXWJlZ2luIDw9IGVuZCAoIDw9ICkgd2hl
biBzbGljaW5nIGBgAMw0EAAOAAAA2jQQAAQAAADeNBAAEAAAAO40EAABAAAAYnl0ZSBpbmRleCAgaXMgbm90IGEgY2hhciBib3Vu
ZGFyeTsgaXQgaXMgaW5zaWRlICAoYnl0ZXMgKSBvZiBgABA1EAALAAAAGzUQACYAAABBNRAACAAAAEk1EAAGAAAA7jQQAAEAAAAg
aXMgb3V0IG9mIGJvdW5kcyBvZiBgAAAQNRAACwAAAHg1EAAWAAAA7jQQAAEAAACsNBAAGwAAAKQBAAAsAAAAbGlicmFyeS9jb3Jl
L3NyYy91bmljb2RlL3ByaW50YWJsZS5ycwAAALg1EAAlAAAAGgAAADYAAAC4NRAAJQAAAAoAAAArAAAAAAYBAQMBBAIFBwcCCAgJ
AgoFCwIOBBABEQISBRMcFAEVAhcCGQ0cBR0IHwEkAWoEawKvA7ECvALPAtEC1AzVCdYC1wLaAeAF4QLnBOgC7iDwBPgC+gT7AQwn
Oz5OT4+enp97i5OWorK6hrEGBwk2PT5W89DRBBQYNjdWV3+qrq+9NeASh4mOngQNDhESKTE0OkVGSUpOT2RlioyNj7bBw8TGy9Zc
trcbHAcICgsUFzY5Oqip2NkJN5CRqAcKOz5maY+SEW9fv+7vWmL0/P9TVJqbLi8nKFWdoKGjpKeorbq8xAYLDBUdOj9FUaanzM2g
BxkaIiU+P+fs7//FxgQgIyUmKDM4OkhKTFBTVVZYWlxeYGNlZmtzeH1/iqSqr7DA0K6vbm/d3pNeInsFAwQtA2YDAS8ugIIdAzEP
HAQkCR4FKwVEBA4qgKoGJAQkBCgINAtOAzQMgTcJFgoIGDtFOQNjCAkwFgUhAxsFAUA4BEsFLwQKBwkHQCAnBAwJNgM6BRoHBAwH
UEk3Mw0zBy4ICgYmAx0IAoDQUhADNywIKhYaJhwUFwlOBCQJRA0ZBwoGSAgnCXULQj4qBjsFCgZRBgEFEAMFC1kIAh1iHkgICoCm
XiJFCwoGDRM6BgoGFBwsBBeAuTxkUwxICQpGRRtICFMNSQcKgLYiDgoGRgodA0dJNwMOCAoGOQcKgTYZBzsDHVUBDzINg5tmdQuA
xIpMYw2EMBAWCo+bBYJHmrk6hsaCOQcqBFwGJgpGCigFE4GwOoDGW2VLBDkHEUAFCwIOl/gIhNYpCqLngTMPAR0GDgQIgYyJBGsF
DQMJBxCPYID6BoG0TEcJdDyA9gpzCHAVRnoUDBQMVwkZgIeBRwOFQg8VhFAfBgaA1SsFPiEBcC0DGgQCgUAfEToFAYHQKoDWKwQB
geCA9ylMBAoEAoMRREw9gMI8BgEEVQUbNAKBDiwEZAxWCoCuOB0NLAQJBwIOBoCag9gEEQMNA3cEXwYMBAEPDAQ4CAoGKAgsBAI+
gVQMHQMKBTgHHAYJB4D6hAYAAQMFBQYGAgcGCAcJEQocCxkMGg0QDgwPBBADEhITCRYBFwQYARkDGgcbARwCHxYgAysDLQsuATAE
MQIyAacEqQKqBKsI+gL7Bf0C/gP/Ca14eYuNojBXWIuMkBzdDg9LTPv8Li8/XF1f4oSNjpGSqbG6u8XGycre5OX/AAQREikxNDc6
Oz1JSl2EjpKpsbS6u8bKzs/k5QAEDQ4REikxNDo7RUZJSl5kZYSRm53Jzs8NESk6O0VJV1tcXl9kZY2RqbS6u8XJ3+Tl8A0RRUlk
ZYCEsry+v9XX8PGDhYukpr6/xcfP2ttImL3Nxs7PSU5PV1leX4mOj7G2t7/BxsfXERYXW1z29/7/gG1x3t8OH25vHB1ffX6ur027
vBYXHh9GR05PWFpcXn5/tcXU1dzw8fVyc490dZYmLi+nr7e/x8/X35oAQJeYMI8fzs/S1M7/Tk9aWwcIDxAnL+7vbm83PT9CRZCR
U2d1yMnQ0djZ5/7/ACBfIoLfBIJECBsEBhGBrA6AqwUfCIEcAxkIAQQvBDQEBwMBBwYHEQpQDxIHVQcDBBwKCQMIAwcDAgMDAwwE
BQMLBgEOFQVOBxsHVwcCBhcMUARDAy0DAQQRBg8MOgQdJV8gbQRqJYDIBYKwAxoGgv0DWQcWCRgJFAwUDGoGCgYaBlkHKwVGCiwE
DAQBAzELLAQaBgsDgKwGCgYvMYD0CDwDDwM+BTgIKwWC/xEYCC8RLQMhDyEPgIwEgpoWCxWIlAUvBTsHAg4YCYC+InQMgNYagRAF
gOEJ8p4DNwmBXBSAuAiA3RU7AwoGOAhGCAwGdAseA1oEWQmAgxgcChYJTASAigarpAwXBDGhBIHaJgcMBQWAphCB9QcBICoGTASA
jQSAvgMbAw8NbGlicmFyeS9jb3JlL3NyYy91bmljb2RlL3VuaWNvZGVfZGF0YS5ycwAAAKk7EAAoAAAATQAAACgAAACpOxAAKAAA
AFkAAAAWAAAAbGlicmFyeS9jb3JlL3NyYy9udW0vYmlnbnVtLnJzAAD0OxAAHgAAAKoBAAABAAAAYXNzZXJ0aW9uIGZhaWxlZDog
bm9ib3Jyb3dhc3NlcnRpb24gZmFpbGVkOiBkaWdpdHMgPCA0MGFzc2VydGlvbiBmYWlsZWQ6IG90aGVyID4gMGF0dGVtcHQgdG8g
ZGl2aWRlIGJ5IHplcm8AdjwQABkAAABhdHRlbXB0IHRvIGNhbGN1bGF0ZSB0aGUgcmVtYWluZGVyIHdpdGggYSBkaXZpc29yIG9m
IHplcm8AAACYPBAAOQAAAHJhbmdlIHN0YXJ0IGluZGV4ICBvdXQgb2YgcmFuZ2UgZm9yIHNsaWNlIG9mIGxlbmd0aCDcPBAAEgAA
AO48EAAiAAAAcmFuZ2UgZW5kIGluZGV4ICA9EAAQAAAA7jwQACIAAABzbGljZSBpbmRleCBzdGFydHMgYXQgIGJ1dCBlbmRzIGF0
IABAPRAAFgAAAFY9EAANAAAAY29weV9mcm9tX3NsaWNlOiBzb3VyY2Ugc2xpY2UgbGVuZ3RoICgpIGRvZXMgbm90IG1hdGNoIGRl
c3RpbmF0aW9uIHNsaWNlIGxlbmd0aCAoAAAAdD0QACYAAACaPRAAKwAAAPwxEAABAAAAAAMAAIMEIACRBWAAXROgABIXIB8MIGAf
7ywgKyowoCtvpmAsAqjgLB774C0A/iA2nv9gNv0B4TYBCiE3JA3hN6sOYTkvGOE5MBzhSvMe4U5ANKFSHmHhU/BqYVRPb+FUnbxh
VQDPYVZl0aFWANohVwDgoViu4iFa7OThW9DoYVwgAO5c8AF/XQBwAAcALQEBAQIBAgEBSAswFRABZQcCBgICAQQjAR4bWws6CQkB
GAQBCQEDAQUrAzsJKhgBIDcBAQEECAQBAwcKAh0BOgEBAQIECAEJAQoCGgECAjkBBAIEAgIDAwEeAgMBCwI5AQQFAQIEARQCFgYB
AToBAQIBBAgBBwMKAh4BOwEBAQwBCQEoAQMBNwEBAwUDAQQHAgsCHQE6AQICAQEDAwEEBwILAhwCOQIBAQIECAEJAQoCHQFIAQQB
AgMBAQgBUQECBwwIYgECCQsHSQIbAQEBAQE3DgEFAQIFCwEkCQFmBAEGAQICAhkCBAMQBA0BAgIGAQ8BAAMABBwDHQIeAkACAQcI
AQILCQEtAwEBdQIiAXYDBAIJAQYD2wICAToBAQcBAQEBAggGCgIBMB8xBDAKBAMmCQwCIAQCBjgBAQIDAQEFOAgCApgDAQ0BBwQB
BgEDAsZAAAHDIQADjQFgIAAGaQIABAEKIAJQAgABAwEEARkCBQGXAhoSDQEmCBkLAQEsAzABAgQCAgIBJAFDBgICAgIMAQgBLwEz
AQEDAgIFAgEBKgIIAe4BAgEEAQABABAQEAACAAHiAZUFAAMBAgUEKAMEAaUCAARBBQACTwRGCzEEewE2DykBAgIKAzEEAgIHAT0D
JAUBCD4BDAI0CQEBCAQCAV8DAgQGAQIBnQEDCBUCOQIBAQEBDAEJAQ4HAwVDAQIGAQECAQEDBAMBAQ4CVQgCAwEBFwFRAQIGAQEC
AQECAQLrAQIEBgIBAhsCVQgCAQECagEBAQIIZQEBAQIEAQUACQEC9QEKBAQBkAQCAgQBIAooBgIECAEJBgIDLg0BAgAHAQYBAVIW
AgcBAgECegYDAQECAQcBAUgCAwEBAQACCwI0BQUDFwEAAQYPAAwDAwAFOwcAAT8EUQELAgACAC4CFwAFAwYICAIHHgSUAwA3BDII
AQ4BFgUBDwAHARECBwECAQVkAaAHAAE9BAAE/gIAB20HAGCA8ABB8ILBAAsBSQBwCXByb2R1Y2VycwIIbGFuZ3VhZ2UBBFJ1c3QA
DHByb2Nlc3NlZC1ieQMFcnVzdGMdMS44Ni4wICgwNWY5ODQ2ZjggMjAyNS0wMy0zMSkGd2FscnVzBjAuMjMuMwx3YXNtLWJpbmRn
ZW4HMC4yLjEwMABJD3RhcmdldF9mZWF0dXJlcwQrD211dGFibGUtZ2xvYmFscysIc2lnbi1leHQrD3JlZmVyZW5jZS10eXBlcysK
bXVsdGl2YWx1ZQ==
`.trim().replaceAll("\n", "")
    );
    wasmBinary = new Uint8Array(wasmBase64.length);
    for (let i = 0; i < wasmBase64.length; i++) {
      wasmBinary[i] = wasmBase64.charCodeAt(i);
    }
  }
});

// src/vendor/xet-chunk/chunker_wasm.ts
var chunker_wasm_exports = {};
__export(chunker_wasm_exports, {
  Chunker: () => Chunker,
  compute_file_hash: () => compute_file_hash,
  compute_hmac: () => compute_hmac,
  compute_verification_hash: () => compute_verification_hash,
  compute_xorb_hash: () => compute_xorb_hash,
  init: () => init
});
async function init() {
  if (initPromise) {
    return initPromise;
  }
  let resolve3;
  let reject;
  initPromise = new Promise((_resolve, _reject) => {
    resolve3 = _resolve;
    reject = _reject;
  });
  await Promise.resolve();
  try {
    const wasmModule2 = await WebAssembly.compile(wasmBinary);
    const imports = Object.entries(
      WebAssembly.Module.imports(wasmModule2).reduce(
        (result, item) => ({
          ...result,
          // @ts-expect-error ok for any type
          [item.module]: [...result[item.module] || [], item.name]
        }),
        {}
      )
    ).map(([from, names]) => ({ from, names }));
    const wasm2 = await WebAssembly.instantiate(wasmModule2, {
      "./hf_xet_thin_wasm_bg.js": Object.fromEntries(
        // @ts-expect-error ok for any type
        imports[0].names.map((name) => [name, chunker_wasm_bg_exports[name]])
      )
    });
    __wbg_set_wasm(wasm2.exports);
    wasm2.exports.__wbindgen_start();
    resolve3();
  } catch (error) {
    reject(error);
  }
}
var initPromise;
var init_chunker_wasm = __esm({
  "src/vendor/xet-chunk/chunker_wasm.ts"() {
    "use strict";
    init_chunker_wasm_bg();
    init_chunker_wasm_bg();
    init_chunker_wasm_bg_wasm_base64();
    init_chunker_wasm_bg();
    initPromise = null;
    init();
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/eta.js
var require_eta = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/eta.js"(exports, module2) {
    var ETA = class {
      constructor(length, initTime, initValue) {
        this.etaBufferLength = length || 100;
        this.valueBuffer = [initValue];
        this.timeBuffer = [initTime];
        this.eta = "0";
      }
      // add new values to calculation buffer
      update(time, value, total) {
        this.valueBuffer.push(value);
        this.timeBuffer.push(time);
        this.calculate(total - value);
      }
      // fetch estimated time
      getTime() {
        return this.eta;
      }
      // eta calculation - request number of remaining events
      calculate(remaining) {
        const currentBufferSize = this.valueBuffer.length;
        const buffer = Math.min(this.etaBufferLength, currentBufferSize);
        const v_diff = this.valueBuffer[currentBufferSize - 1] - this.valueBuffer[currentBufferSize - buffer];
        const t_diff = this.timeBuffer[currentBufferSize - 1] - this.timeBuffer[currentBufferSize - buffer];
        const vt_rate = v_diff / t_diff;
        this.valueBuffer = this.valueBuffer.slice(-this.etaBufferLength);
        this.timeBuffer = this.timeBuffer.slice(-this.etaBufferLength);
        const eta = Math.ceil(remaining / vt_rate / 1e3);
        if (isNaN(eta)) {
          this.eta = "NULL";
        } else if (!isFinite(eta)) {
          this.eta = "INF";
        } else if (eta > 1e7) {
          this.eta = "INF";
        } else if (eta < 0) {
          this.eta = 0;
        } else {
          this.eta = eta;
        }
      }
    };
    module2.exports = ETA;
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/terminal.js
var require_terminal = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/terminal.js"(exports, module2) {
    var _readline = require("readline");
    var Terminal = class {
      constructor(outputStream) {
        this.stream = outputStream;
        this.linewrap = true;
        this.dy = 0;
      }
      // save cursor position + settings
      cursorSave() {
        if (!this.stream.isTTY) {
          return;
        }
        this.stream.write("\x1B7");
      }
      // restore last cursor position + settings
      cursorRestore() {
        if (!this.stream.isTTY) {
          return;
        }
        this.stream.write("\x1B8");
      }
      // show/hide cursor
      cursor(enabled) {
        if (!this.stream.isTTY) {
          return;
        }
        if (enabled) {
          this.stream.write("\x1B[?25h");
        } else {
          this.stream.write("\x1B[?25l");
        }
      }
      // change cursor positionn
      cursorTo(x = null, y = null) {
        if (!this.stream.isTTY) {
          return;
        }
        _readline.cursorTo(this.stream, x, y);
      }
      // change relative cursor position
      cursorRelative(dx = null, dy = null) {
        if (!this.stream.isTTY) {
          return;
        }
        this.dy = this.dy + dy;
        _readline.moveCursor(this.stream, dx, dy);
      }
      // relative reset
      cursorRelativeReset() {
        if (!this.stream.isTTY) {
          return;
        }
        _readline.moveCursor(this.stream, 0, -this.dy);
        _readline.cursorTo(this.stream, 0, null);
        this.dy = 0;
      }
      // clear to the right from cursor
      clearRight() {
        if (!this.stream.isTTY) {
          return;
        }
        _readline.clearLine(this.stream, 1);
      }
      // clear the full line
      clearLine() {
        if (!this.stream.isTTY) {
          return;
        }
        _readline.clearLine(this.stream, 0);
      }
      // clear everyting beyond the current line
      clearBottom() {
        if (!this.stream.isTTY) {
          return;
        }
        _readline.clearScreenDown(this.stream);
      }
      // add new line; increment counter
      newline() {
        this.stream.write("\n");
        this.dy++;
      }
      // write content to output stream
      // @TODO use string-width to strip length
      write(s, rawWrite = false) {
        if (this.linewrap === true && rawWrite === false) {
          this.stream.write(s.substr(0, this.getWidth()));
        } else {
          this.stream.write(s);
        }
      }
      // control line wrapping
      lineWrapping(enabled) {
        if (!this.stream.isTTY) {
          return;
        }
        this.linewrap = enabled;
        if (enabled) {
          this.stream.write("\x1B[?7h");
        } else {
          this.stream.write("\x1B[?7l");
        }
      }
      // tty environment ?
      isTTY() {
        return this.stream.isTTY === true;
      }
      // get terminal width
      getWidth() {
        return this.stream.columns || (this.stream.isTTY ? 80 : 200);
      }
    };
    module2.exports = Terminal;
  }
});

// node_modules/.pnpm/ansi-regex@5.0.1/node_modules/ansi-regex/index.js
var require_ansi_regex = __commonJS({
  "node_modules/.pnpm/ansi-regex@5.0.1/node_modules/ansi-regex/index.js"(exports, module2) {
    "use strict";
    module2.exports = ({ onlyFirst = false } = {}) => {
      const pattern = [
        "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
        "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
      ].join("|");
      return new RegExp(pattern, onlyFirst ? void 0 : "g");
    };
  }
});

// node_modules/.pnpm/strip-ansi@6.0.1/node_modules/strip-ansi/index.js
var require_strip_ansi = __commonJS({
  "node_modules/.pnpm/strip-ansi@6.0.1/node_modules/strip-ansi/index.js"(exports, module2) {
    "use strict";
    var ansiRegex = require_ansi_regex();
    module2.exports = (string) => typeof string === "string" ? string.replace(ansiRegex(), "") : string;
  }
});

// node_modules/.pnpm/is-fullwidth-code-point@3.0.0/node_modules/is-fullwidth-code-point/index.js
var require_is_fullwidth_code_point = __commonJS({
  "node_modules/.pnpm/is-fullwidth-code-point@3.0.0/node_modules/is-fullwidth-code-point/index.js"(exports, module2) {
    "use strict";
    var isFullwidthCodePoint = (codePoint) => {
      if (Number.isNaN(codePoint)) {
        return false;
      }
      if (codePoint >= 4352 && (codePoint <= 4447 || // Hangul Jamo
      codePoint === 9001 || // LEFT-POINTING ANGLE BRACKET
      codePoint === 9002 || // RIGHT-POINTING ANGLE BRACKET
      // CJK Radicals Supplement .. Enclosed CJK Letters and Months
      11904 <= codePoint && codePoint <= 12871 && codePoint !== 12351 || // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
      12880 <= codePoint && codePoint <= 19903 || // CJK Unified Ideographs .. Yi Radicals
      19968 <= codePoint && codePoint <= 42182 || // Hangul Jamo Extended-A
      43360 <= codePoint && codePoint <= 43388 || // Hangul Syllables
      44032 <= codePoint && codePoint <= 55203 || // CJK Compatibility Ideographs
      63744 <= codePoint && codePoint <= 64255 || // Vertical Forms
      65040 <= codePoint && codePoint <= 65049 || // CJK Compatibility Forms .. Small Form Variants
      65072 <= codePoint && codePoint <= 65131 || // Halfwidth and Fullwidth Forms
      65281 <= codePoint && codePoint <= 65376 || 65504 <= codePoint && codePoint <= 65510 || // Kana Supplement
      110592 <= codePoint && codePoint <= 110593 || // Enclosed Ideographic Supplement
      127488 <= codePoint && codePoint <= 127569 || // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
      131072 <= codePoint && codePoint <= 262141)) {
        return true;
      }
      return false;
    };
    module2.exports = isFullwidthCodePoint;
    module2.exports.default = isFullwidthCodePoint;
  }
});

// node_modules/.pnpm/emoji-regex@8.0.0/node_modules/emoji-regex/index.js
var require_emoji_regex = __commonJS({
  "node_modules/.pnpm/emoji-regex@8.0.0/node_modules/emoji-regex/index.js"(exports, module2) {
    "use strict";
    module2.exports = function() {
      return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
    };
  }
});

// node_modules/.pnpm/string-width@4.2.3/node_modules/string-width/index.js
var require_string_width = __commonJS({
  "node_modules/.pnpm/string-width@4.2.3/node_modules/string-width/index.js"(exports, module2) {
    "use strict";
    var stripAnsi = require_strip_ansi();
    var isFullwidthCodePoint = require_is_fullwidth_code_point();
    var emojiRegex = require_emoji_regex();
    var stringWidth = (string) => {
      if (typeof string !== "string" || string.length === 0) {
        return 0;
      }
      string = stripAnsi(string);
      if (string.length === 0) {
        return 0;
      }
      string = string.replace(emojiRegex(), "  ");
      let width = 0;
      for (let i = 0; i < string.length; i++) {
        const code = string.codePointAt(i);
        if (code <= 31 || code >= 127 && code <= 159) {
          continue;
        }
        if (code >= 768 && code <= 879) {
          continue;
        }
        if (code > 65535) {
          i++;
        }
        width += isFullwidthCodePoint(code) ? 2 : 1;
      }
      return width;
    };
    module2.exports = stringWidth;
    module2.exports.default = stringWidth;
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/format-value.js
var require_format_value = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/format-value.js"(exports, module2) {
    module2.exports = function formatValue(v, options, type) {
      if (options.autopadding !== true) {
        return v;
      }
      function autopadding(value, length) {
        return (options.autopaddingChar + value).slice(-length);
      }
      switch (type) {
        case "percentage":
          return autopadding(v, 3);
        default:
          return v;
      }
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/format-bar.js
var require_format_bar = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/format-bar.js"(exports, module2) {
    module2.exports = function formatBar(progress, options) {
      const completeSize = Math.round(progress * options.barsize);
      const incompleteSize = options.barsize - completeSize;
      return options.barCompleteString.substr(0, completeSize) + options.barGlue + options.barIncompleteString.substr(0, incompleteSize);
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/format-time.js
var require_format_time = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/format-time.js"(exports, module2) {
    module2.exports = function formatTime(t, options, roundToMultipleOf) {
      function round(input) {
        if (roundToMultipleOf) {
          return roundToMultipleOf * Math.round(input / roundToMultipleOf);
        } else {
          return input;
        }
      }
      function autopadding(v) {
        return (options.autopaddingChar + v).slice(-2);
      }
      if (t > 3600) {
        return autopadding(Math.floor(t / 3600)) + "h" + autopadding(round(t % 3600 / 60)) + "m";
      } else if (t > 60) {
        return autopadding(Math.floor(t / 60)) + "m" + autopadding(round(t % 60)) + "s";
      } else if (t > 10) {
        return autopadding(round(t)) + "s";
      } else {
        return autopadding(t) + "s";
      }
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/formatter.js
var require_formatter = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/formatter.js"(exports, module2) {
    var _stringWidth = require_string_width();
    var _defaultFormatValue = require_format_value();
    var _defaultFormatBar = require_format_bar();
    var _defaultFormatTime = require_format_time();
    module2.exports = function defaultFormatter(options, params, payload) {
      let s = options.format;
      const formatTime = options.formatTime || _defaultFormatTime;
      const formatValue = options.formatValue || _defaultFormatValue;
      const formatBar = options.formatBar || _defaultFormatBar;
      const percentage = Math.floor(params.progress * 100) + "";
      const stopTime = params.stopTime || Date.now();
      const elapsedTime = Math.round((stopTime - params.startTime) / 1e3);
      const context = Object.assign({}, payload, {
        bar: formatBar(params.progress, options),
        percentage: formatValue(percentage, options, "percentage"),
        total: formatValue(params.total, options, "total"),
        value: formatValue(params.value, options, "value"),
        eta: formatValue(params.eta, options, "eta"),
        eta_formatted: formatTime(params.eta, options, 5),
        duration: formatValue(elapsedTime, options, "duration"),
        duration_formatted: formatTime(elapsedTime, options, 1)
      });
      s = s.replace(/\{(\w+)\}/g, function(match, key) {
        if (typeof context[key] !== "undefined") {
          return context[key];
        }
        return match;
      });
      const fullMargin = Math.max(0, params.maxWidth - _stringWidth(s) - 2);
      const halfMargin = Math.floor(fullMargin / 2);
      switch (options.align) {
        case "right":
          s = fullMargin > 0 ? " ".repeat(fullMargin) + s : s;
          break;
        case "center":
          s = halfMargin > 0 ? " ".repeat(halfMargin) + s : s;
          break;
        case "left":
        default:
          break;
      }
      return s;
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/options.js
var require_options = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/options.js"(exports, module2) {
    function mergeOption(v, defaultValue) {
      if (typeof v === "undefined" || v === null) {
        return defaultValue;
      } else {
        return v;
      }
    }
    module2.exports = {
      // set global options
      parse: function parse(rawOptions, preset) {
        const options = {};
        const opt = Object.assign({}, preset, rawOptions);
        options.throttleTime = 1e3 / mergeOption(opt.fps, 10);
        options.stream = mergeOption(opt.stream, process.stderr);
        options.terminal = mergeOption(opt.terminal, null);
        options.clearOnComplete = mergeOption(opt.clearOnComplete, false);
        options.stopOnComplete = mergeOption(opt.stopOnComplete, false);
        options.barsize = mergeOption(opt.barsize, 40);
        options.align = mergeOption(opt.align, "left");
        options.hideCursor = mergeOption(opt.hideCursor, false);
        options.linewrap = mergeOption(opt.linewrap, false);
        options.barGlue = mergeOption(opt.barGlue, "");
        options.barCompleteChar = mergeOption(opt.barCompleteChar, "=");
        options.barIncompleteChar = mergeOption(opt.barIncompleteChar, "-");
        options.format = mergeOption(opt.format, "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}");
        options.formatTime = mergeOption(opt.formatTime, null);
        options.formatValue = mergeOption(opt.formatValue, null);
        options.formatBar = mergeOption(opt.formatBar, null);
        options.etaBufferLength = mergeOption(opt.etaBuffer, 10);
        options.etaAsynchronousUpdate = mergeOption(opt.etaAsynchronousUpdate, false);
        options.progressCalculationRelative = mergeOption(opt.progressCalculationRelative, false);
        options.synchronousUpdate = mergeOption(opt.synchronousUpdate, true);
        options.noTTYOutput = mergeOption(opt.noTTYOutput, false);
        options.notTTYSchedule = mergeOption(opt.notTTYSchedule, 2e3);
        options.emptyOnZero = mergeOption(opt.emptyOnZero, false);
        options.forceRedraw = mergeOption(opt.forceRedraw, false);
        options.autopadding = mergeOption(opt.autopadding, false);
        options.gracefulExit = mergeOption(opt.gracefulExit, false);
        return options;
      },
      // derived options: instance specific, has to be created for every bar element
      assignDerivedOptions: function assignDerivedOptions(options) {
        options.barCompleteString = options.barCompleteChar.repeat(options.barsize + 1);
        options.barIncompleteString = options.barIncompleteChar.repeat(options.barsize + 1);
        options.autopaddingChar = options.autopadding ? mergeOption(options.autopaddingChar, "   ") : "";
        return options;
      }
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/generic-bar.js
var require_generic_bar = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/generic-bar.js"(exports, module2) {
    var _ETA = require_eta();
    var _Terminal = require_terminal();
    var _formatter = require_formatter();
    var _options = require_options();
    var _EventEmitter = require("events");
    module2.exports = class GenericBar extends _EventEmitter {
      constructor(options) {
        super();
        this.options = _options.assignDerivedOptions(options);
        this.terminal = this.options.terminal ? this.options.terminal : new _Terminal(this.options.stream);
        this.value = 0;
        this.startValue = 0;
        this.total = 100;
        this.lastDrawnString = null;
        this.startTime = null;
        this.stopTime = null;
        this.lastRedraw = Date.now();
        this.eta = new _ETA(this.options.etaBufferLength, 0, 0);
        this.payload = {};
        this.isActive = false;
        this.formatter = typeof this.options.format === "function" ? this.options.format : _formatter;
      }
      // internal render function
      render(forceRendering = false) {
        const params = {
          progress: this.getProgress(),
          eta: this.eta.getTime(),
          startTime: this.startTime,
          stopTime: this.stopTime,
          total: this.total,
          value: this.value,
          maxWidth: this.terminal.getWidth()
        };
        if (this.options.etaAsynchronousUpdate) {
          this.updateETA();
        }
        const s = this.formatter(this.options, params, this.payload);
        const forceRedraw = forceRendering || this.options.forceRedraw || this.options.noTTYOutput && !this.terminal.isTTY();
        if (forceRedraw || this.lastDrawnString != s) {
          this.emit("redraw-pre");
          this.terminal.cursorTo(0, null);
          this.terminal.write(s);
          this.terminal.clearRight();
          this.lastDrawnString = s;
          this.lastRedraw = Date.now();
          this.emit("redraw-post");
        }
      }
      // start the progress bar
      start(total, startValue, payload) {
        this.value = startValue || 0;
        this.total = typeof total !== "undefined" && total >= 0 ? total : 100;
        this.startValue = startValue || 0;
        this.payload = payload || {};
        this.startTime = Date.now();
        this.stopTime = null;
        this.lastDrawnString = "";
        this.eta = new _ETA(this.options.etaBufferLength, this.startTime, this.value);
        this.isActive = true;
        this.emit("start", total, startValue);
      }
      // stop the bar
      stop() {
        this.isActive = false;
        this.stopTime = Date.now();
        this.emit("stop", this.total, this.value);
      }
      // update the bar value
      // update(value, payload)
      // update(payload)
      update(arg0, arg1 = {}) {
        if (typeof arg0 === "number") {
          this.value = arg0;
          this.eta.update(Date.now(), arg0, this.total);
        }
        const payloadData = (typeof arg0 === "object" ? arg0 : arg1) || {};
        this.emit("update", this.total, this.value);
        for (const key in payloadData) {
          this.payload[key] = payloadData[key];
        }
        if (this.value >= this.getTotal() && this.options.stopOnComplete) {
          this.stop();
        }
      }
      // calculate the actual progress value
      getProgress() {
        let progress = this.value / this.total;
        if (this.options.progressCalculationRelative) {
          progress = (this.value - this.startValue) / (this.total - this.startValue);
        }
        if (isNaN(progress)) {
          progress = this.options && this.options.emptyOnZero ? 0 : 1;
        }
        progress = Math.min(Math.max(progress, 0), 1);
        return progress;
      }
      // update the bar value
      // increment(delta, payload)
      // increment(payload)
      increment(arg0 = 1, arg1 = {}) {
        if (typeof arg0 === "object") {
          this.update(this.value + 1, arg0);
        } else {
          this.update(this.value + arg0, arg1);
        }
      }
      // get the total (limit) value
      getTotal() {
        return this.total;
      }
      // set the total (limit) value
      setTotal(total) {
        if (typeof total !== "undefined" && total >= 0) {
          this.total = total;
        }
      }
      // force eta calculation update (long running processes)
      updateETA() {
        this.eta.update(Date.now(), this.value, this.total);
      }
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/single-bar.js
var require_single_bar = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/single-bar.js"(exports, module2) {
    var _GenericBar = require_generic_bar();
    var _options = require_options();
    module2.exports = class SingleBar extends _GenericBar {
      constructor(options, preset) {
        super(_options.parse(options, preset));
        this.timer = null;
        if (this.options.noTTYOutput && this.terminal.isTTY() === false) {
          this.options.synchronousUpdate = false;
        }
        this.schedulingRate = this.terminal.isTTY() ? this.options.throttleTime : this.options.notTTYSchedule;
        this.sigintCallback = null;
      }
      // internal render function
      render() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        super.render();
        if (this.options.noTTYOutput && this.terminal.isTTY() === false) {
          this.terminal.newline();
        }
        this.timer = setTimeout(this.render.bind(this), this.schedulingRate);
      }
      update(current, payload) {
        if (!this.timer) {
          return;
        }
        super.update(current, payload);
        if (this.options.synchronousUpdate && this.lastRedraw + this.options.throttleTime * 2 < Date.now()) {
          this.render();
        }
      }
      // start the progress bar
      start(total, startValue, payload) {
        if (this.options.noTTYOutput === false && this.terminal.isTTY() === false) {
          return;
        }
        if (this.sigintCallback === null && this.options.gracefulExit) {
          this.sigintCallback = this.stop.bind(this);
          process.once("SIGINT", this.sigintCallback);
          process.once("SIGTERM", this.sigintCallback);
        }
        this.terminal.cursorSave();
        if (this.options.hideCursor === true) {
          this.terminal.cursor(false);
        }
        if (this.options.linewrap === false) {
          this.terminal.lineWrapping(false);
        }
        super.start(total, startValue, payload);
        this.render();
      }
      // stop the bar
      stop() {
        if (!this.timer) {
          return;
        }
        if (this.sigintCallback) {
          process.removeListener("SIGINT", this.sigintCallback);
          process.removeListener("SIGTERM", this.sigintCallback);
          this.sigintCallback = null;
        }
        this.render();
        super.stop();
        clearTimeout(this.timer);
        this.timer = null;
        if (this.options.hideCursor === true) {
          this.terminal.cursor(true);
        }
        if (this.options.linewrap === false) {
          this.terminal.lineWrapping(true);
        }
        this.terminal.cursorRestore();
        if (this.options.clearOnComplete) {
          this.terminal.cursorTo(0, null);
          this.terminal.clearLine();
        } else {
          this.terminal.newline();
        }
      }
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/multi-bar.js
var require_multi_bar = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/lib/multi-bar.js"(exports, module2) {
    var _Terminal = require_terminal();
    var _BarElement = require_generic_bar();
    var _options = require_options();
    var _EventEmitter = require("events");
    module2.exports = class MultiBar extends _EventEmitter {
      constructor(options, preset) {
        super();
        this.bars = [];
        this.options = _options.parse(options, preset);
        this.options.synchronousUpdate = false;
        this.terminal = this.options.terminal ? this.options.terminal : new _Terminal(this.options.stream);
        this.timer = null;
        this.isActive = false;
        this.schedulingRate = this.terminal.isTTY() ? this.options.throttleTime : this.options.notTTYSchedule;
        this.loggingBuffer = [];
        this.sigintCallback = null;
      }
      // add a new bar to the stack
      create(total, startValue, payload, barOptions = {}) {
        const bar = new _BarElement(Object.assign(
          {},
          // global options
          this.options,
          // terminal instance
          {
            terminal: this.terminal
          },
          // overrides
          barOptions
        ));
        this.bars.push(bar);
        if (this.options.noTTYOutput === false && this.terminal.isTTY() === false) {
          return bar;
        }
        if (this.sigintCallback === null && this.options.gracefulExit) {
          this.sigintCallback = this.stop.bind(this);
          process.once("SIGINT", this.sigintCallback);
          process.once("SIGTERM", this.sigintCallback);
        }
        if (!this.isActive) {
          if (this.options.hideCursor === true) {
            this.terminal.cursor(false);
          }
          if (this.options.linewrap === false) {
            this.terminal.lineWrapping(false);
          }
          this.timer = setTimeout(this.update.bind(this), this.schedulingRate);
        }
        this.isActive = true;
        bar.start(total, startValue, payload);
        this.emit("start");
        return bar;
      }
      // remove a bar from the stack
      remove(bar) {
        const index = this.bars.indexOf(bar);
        if (index < 0) {
          return false;
        }
        this.bars.splice(index, 1);
        this.update();
        this.terminal.newline();
        this.terminal.clearBottom();
        return true;
      }
      // internal update routine
      update() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        this.emit("update-pre");
        this.terminal.cursorRelativeReset();
        this.emit("redraw-pre");
        if (this.loggingBuffer.length > 0) {
          this.terminal.clearLine();
          while (this.loggingBuffer.length > 0) {
            this.terminal.write(this.loggingBuffer.shift(), true);
          }
        }
        for (let i = 0; i < this.bars.length; i++) {
          if (i > 0) {
            this.terminal.newline();
          }
          this.bars[i].render();
        }
        this.emit("redraw-post");
        if (this.options.noTTYOutput && this.terminal.isTTY() === false) {
          this.terminal.newline();
          this.terminal.newline();
        }
        this.timer = setTimeout(this.update.bind(this), this.schedulingRate);
        this.emit("update-post");
        if (this.options.stopOnComplete && !this.bars.find((bar) => bar.isActive)) {
          this.stop();
        }
      }
      stop() {
        clearTimeout(this.timer);
        this.timer = null;
        if (this.sigintCallback) {
          process.removeListener("SIGINT", this.sigintCallback);
          process.removeListener("SIGTERM", this.sigintCallback);
          this.sigintCallback = null;
        }
        this.isActive = false;
        if (this.options.hideCursor === true) {
          this.terminal.cursor(true);
        }
        if (this.options.linewrap === false) {
          this.terminal.lineWrapping(true);
        }
        this.terminal.cursorRelativeReset();
        this.emit("stop-pre-clear");
        if (this.options.clearOnComplete) {
          this.terminal.clearBottom();
        } else {
          for (let i = 0; i < this.bars.length; i++) {
            if (i > 0) {
              this.terminal.newline();
            }
            this.bars[i].render();
            this.bars[i].stop();
          }
          this.terminal.newline();
        }
        this.emit("stop");
      }
      log(s) {
        this.loggingBuffer.push(s);
      }
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/legacy.js
var require_legacy = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/legacy.js"(exports, module2) {
    module2.exports = {
      format: "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}",
      barCompleteChar: "=",
      barIncompleteChar: "-"
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/shades-classic.js
var require_shades_classic = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/shades-classic.js"(exports, module2) {
    module2.exports = {
      format: " {bar} {percentage}% | ETA: {eta}s | {value}/{total}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591"
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/shades-grey.js
var require_shades_grey = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/shades-grey.js"(exports, module2) {
    module2.exports = {
      format: " \x1B[90m{bar}\x1B[0m {percentage}% | ETA: {eta}s | {value}/{total}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591"
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/rect.js
var require_rect = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/rect.js"(exports, module2) {
    module2.exports = {
      format: " {bar}\u25A0 {percentage}% | ETA: {eta}s | {value}/{total}",
      barCompleteChar: "\u25A0",
      barIncompleteChar: " "
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/index.js
var require_presets = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/presets/index.js"(exports, module2) {
    var _legacy = require_legacy();
    var _shades_classic = require_shades_classic();
    var _shades_grey = require_shades_grey();
    var _rect = require_rect();
    module2.exports = {
      legacy: _legacy,
      shades_classic: _shades_classic,
      shades_grey: _shades_grey,
      rect: _rect
    };
  }
});

// node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/cli-progress.js
var require_cli_progress = __commonJS({
  "node_modules/.pnpm/cli-progress@3.12.0/node_modules/cli-progress/cli-progress.js"(exports, module2) {
    var _SingleBar = require_single_bar();
    var _MultiBar = require_multi_bar();
    var _Presets = require_presets();
    var _Formatter = require_formatter();
    var _defaultFormatValue = require_format_value();
    var _defaultFormatBar = require_format_bar();
    var _defaultFormatTime = require_format_time();
    module2.exports = {
      Bar: _SingleBar,
      SingleBar: _SingleBar,
      MultiBar: _MultiBar,
      Presets: _Presets,
      Format: {
        Formatter: _Formatter,
        BarFormat: _defaultFormatBar,
        ValueFormat: _defaultFormatValue,
        TimeFormat: _defaultFormatTime
      }
    };
  }
});

// cli.ts
var import_node_util = require("util");

// src/utils/typedEntries.ts
function typedEntries(obj) {
  return Object.entries(obj);
}

// src/lib/cache-management.ts
var import_node_os = require("os");
var import_node_path = require("path");
var import_promises = require("fs/promises");

// src/consts.ts
var HUB_URL = "https://huggingface.co";

// src/error.ts
async function createApiError(response, opts) {
  const error = new HubApiError(response.url, response.status, response.headers.get("X-Request-Id") ?? opts?.requestId);
  error.message = `Api error with status ${error.statusCode}${opts?.message ? `. ${opts.message}` : ""}`;
  const trailer = [`URL: ${error.url}`, error.requestId ? `Request ID: ${error.requestId}` : void 0].filter(Boolean).join(". ");
  if (response.headers.get("Content-Type")?.startsWith("application/json")) {
    const json = await response.json();
    error.message = json.error || json.message || error.message;
    if (json.error_description) {
      error.message = error.message ? error.message + `: ${json.error_description}` : json.error_description;
    }
    error.data = json;
  } else {
    error.data = { message: await response.text() };
  }
  error.message += `. ${trailer}`;
  throw error;
}
var HubApiError = class extends Error {
  statusCode;
  url;
  requestId;
  data;
  constructor(url, statusCode, requestId, message) {
    super(message);
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.url = url;
  }
};
var InvalidApiResponseFormatError = class extends Error {
};

// src/utils/checkCredentials.ts
function checkAccessToken(accessToken) {
  if (!accessToken.startsWith("hf_")) {
    throw new TypeError("Your access token must start with 'hf_'");
  }
}
function checkCredentials(params) {
  if (params.accessToken) {
    checkAccessToken(params.accessToken);
    return params.accessToken;
  }
  if (params.credentials?.accessToken) {
    checkAccessToken(params.credentials.accessToken);
    return params.credentials.accessToken;
  }
}

// src/utils/toRepoId.ts
function toRepoId(repo) {
  if (typeof repo !== "string") {
    return repo;
  }
  if (repo.startsWith("model/") || repo.startsWith("models/")) {
    throw new TypeError(
      "A repo designation for a model should not start with 'models/', directly specify the model namespace / name"
    );
  }
  if (repo.startsWith("space/")) {
    throw new TypeError("Spaces should start with 'spaces/', plural, not 'space/'");
  }
  if (repo.startsWith("dataset/")) {
    throw new TypeError("Datasets should start with 'dataset/', plural, not 'dataset/'");
  }
  const slashes = repo.split("/").length - 1;
  if (repo.startsWith("spaces/")) {
    if (slashes !== 2) {
      throw new TypeError("Space Id must include namespace and name of the space");
    }
    return {
      type: "space",
      name: repo.slice("spaces/".length)
    };
  }
  if (repo.startsWith("datasets/")) {
    if (slashes > 2) {
      throw new TypeError("Too many slashes in repo designation: " + repo);
    }
    return {
      type: "dataset",
      name: repo.slice("datasets/".length)
    };
  }
  if (slashes > 1) {
    throw new TypeError("Too many slashes in repo designation: " + repo);
  }
  return {
    type: "model",
    name: repo
  };
}

// src/utils/range.ts
function range(n, b) {
  return b ? Array(b - n).fill(0).map((_, i) => n + i) : Array(n).fill(0).map((_, i) => i);
}

// src/utils/chunk.ts
function chunk(arr, chunkSize) {
  if (isNaN(chunkSize) || chunkSize < 1) {
    throw new RangeError("Invalid chunk size: " + chunkSize);
  }
  if (!arr.length) {
    return [];
  }
  if (arr.length <= chunkSize) {
    return [arr];
  }
  return range(Math.ceil(arr.length / chunkSize)).map((i) => {
    return arr.slice(i * chunkSize, (i + 1) * chunkSize);
  });
}

// src/utils/promisesQueue.ts
async function promisesQueue(factories, concurrency) {
  const results = [];
  const executing = /* @__PURE__ */ new Set();
  let index = 0;
  for (const factory of factories) {
    const closureIndex = index++;
    const e = factory().then((r) => {
      results[closureIndex] = r;
      executing.delete(e);
    });
    executing.add(e);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

// src/utils/promisesQueueStreaming.ts
async function promisesQueueStreaming(factories, concurrency) {
  const executing = [];
  for await (const factory of factories) {
    const e = factory().then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// src/utils/eventToGenerator.ts
async function* eventToGenerator(cb) {
  const promises = [];
  function addPromise() {
    let resolve3;
    let reject;
    const p = new Promise((res, rej) => {
      resolve3 = res;
      reject = rej;
    });
    promises.push({ p, resolve: resolve3, reject });
  }
  addPromise();
  const callbackRes = Promise.resolve().then(
    () => cb(
      (y) => {
        addPromise();
        promises.at(-2)?.resolve({ done: false, value: y });
      },
      (r) => {
        addPromise();
        promises.at(-2)?.resolve({ done: true, value: r });
      },
      (err) => promises.shift()?.reject(err)
    )
  ).catch((err) => promises.shift()?.reject(err));
  while (1) {
    const p = promises[0];
    if (!p) {
      throw new Error("Logic error in eventGenerator, promises should never be empty");
    }
    const result = await p.p;
    promises.shift();
    if (result.done) {
      await callbackRes;
      return result.value;
    }
    yield result.value;
  }
  throw new Error("Unreachable");
}

// src/utils/hexFromBytes.ts
function hexFromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("hex");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(byte.toString(16).padStart(2, "0"));
    });
    return bin.join("");
  }
}

// src/utils/isBackend.ts
var isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
var isWebWorker = typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
var isBackend = !isBrowser && !isWebWorker;

// src/utils/isFrontend.ts
var isFrontend = !isBackend;

// src/utils/sha256.ts
async function getWebWorkerCode() {
  const sha256Module = await Promise.resolve().then(() => (init_sha256_wrapper(), sha256_wrapper_exports));
  return URL.createObjectURL(new Blob([sha256Module.createSHA256WorkerCode()]));
}
var pendingWorkers = [];
var runningWorkers = /* @__PURE__ */ new Set();
var resolve;
var waitPromise = new Promise((r) => {
  resolve = r;
});
async function getWorker(poolSize) {
  {
    const worker2 = pendingWorkers.pop();
    if (worker2) {
      runningWorkers.add(worker2);
      return worker2;
    }
  }
  if (!poolSize) {
    const worker2 = new Worker(await getWebWorkerCode());
    runningWorkers.add(worker2);
    return worker2;
  }
  if (poolSize <= 0) {
    throw new TypeError("Invalid webworker pool size: " + poolSize);
  }
  while (runningWorkers.size >= poolSize) {
    await waitPromise;
  }
  const worker = new Worker(await getWebWorkerCode());
  runningWorkers.add(worker);
  return worker;
}
async function freeWorker(worker, poolSize) {
  if (!poolSize) {
    return destroyWorker(worker);
  }
  runningWorkers.delete(worker);
  pendingWorkers.push(worker);
  const r = resolve;
  waitPromise = new Promise((r2) => {
    resolve = r2;
  });
  r();
}
function destroyWorker(worker) {
  runningWorkers.delete(worker);
  worker.terminate();
  const r = resolve;
  waitPromise = new Promise((r2) => {
    resolve = r2;
  });
  r();
}
async function* sha256(buffer, opts) {
  yield 0;
  const maxCryptoSize = typeof opts?.useWebWorker === "object" && opts?.useWebWorker.minSize !== void 0 ? opts.useWebWorker.minSize : 1e7;
  if (buffer.size < maxCryptoSize && globalThis.crypto?.subtle) {
    const res = hexFromBytes(
      new Uint8Array(
        await globalThis.crypto.subtle.digest("SHA-256", buffer instanceof Blob ? await buffer.arrayBuffer() : buffer)
      )
    );
    yield 1;
    return res;
  }
  if (isFrontend) {
    if (opts?.useWebWorker) {
      try {
        const poolSize = typeof opts?.useWebWorker === "object" ? opts.useWebWorker.poolSize : void 0;
        const worker = await getWorker(poolSize);
        let messageHandler;
        let errorHandler;
        const cleanup = () => {
          worker.removeEventListener("message", messageHandler);
          worker.removeEventListener("error", errorHandler);
        };
        return yield* eventToGenerator((yieldCallback, returnCallback, rejectCallback) => {
          messageHandler = (event) => {
            if (event.data.sha256) {
              cleanup();
              freeWorker(worker, poolSize);
              returnCallback(event.data.sha256);
            } else if (event.data.progress) {
              yieldCallback(event.data.progress);
              try {
                opts.abortSignal?.throwIfAborted();
              } catch (err) {
                cleanup();
                destroyWorker(worker);
                rejectCallback(err);
              }
            } else {
              cleanup();
              destroyWorker(worker);
              rejectCallback(event);
            }
          };
          errorHandler = (event) => {
            cleanup();
            destroyWorker(worker);
            rejectCallback(event.error);
          };
          if (opts?.abortSignal) {
            try {
              opts.abortSignal?.throwIfAborted();
            } catch (err) {
              cleanup();
              destroyWorker(worker);
              rejectCallback(opts.abortSignal.reason ?? new DOMException("Aborted", "AbortError"));
              return;
            }
            const abortListener = () => {
              cleanup();
              destroyWorker(worker);
              rejectCallback(opts.abortSignal?.reason ?? new DOMException("Aborted", "AbortError"));
              opts.abortSignal?.removeEventListener("abort", abortListener);
            };
            opts.abortSignal.addEventListener("abort", abortListener);
          }
          worker.addEventListener("message", messageHandler);
          worker.addEventListener("error", errorHandler);
          worker.postMessage({ file: buffer });
        });
      } catch (err) {
        console.warn("Failed to use web worker for sha256", err);
      }
    }
    if (!wasmModule) {
      wasmModule = await Promise.resolve().then(() => (init_sha256_wrapper(), sha256_wrapper_exports));
    }
    const sha2562 = await wasmModule.createSHA256();
    sha2562.init();
    const reader = buffer.stream().getReader();
    const total = buffer.size;
    let bytesDone = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      sha2562.update(value);
      bytesDone += value.length;
      yield bytesDone / total;
      opts?.abortSignal?.throwIfAborted();
    }
    return sha2562.digest("hex");
  }
  if (!cryptoModule) {
    cryptoModule = await Promise.resolve().then(() => (init_sha256_node(), sha256_node_exports));
  }
  return yield* cryptoModule.sha256Node(buffer, { abortSignal: opts?.abortSignal });
}
var cryptoModule;
var wasmModule;

// src/utils/WebBlob.ts
var WebBlob = class extends Blob {
  static async create(url, opts) {
    const customFetch = opts?.fetch ?? fetch;
    const response = await customFetch(url, {
      method: "HEAD",
      ...opts?.accessToken && {
        headers: {
          Authorization: `Bearer ${opts.accessToken}`
        }
      }
    });
    const size = Number(response.headers.get("content-length"));
    const contentType = response.headers.get("content-type") || "";
    const supportRange = response.headers.get("accept-ranges") === "bytes";
    if (!supportRange || size < (opts?.cacheBelow ?? 1e6)) {
      return await (await customFetch(url)).blob();
    }
    return new WebBlob(url, 0, size, contentType, true, customFetch, opts?.accessToken);
  }
  url;
  start;
  end;
  contentType;
  full;
  fetch;
  accessToken;
  constructor(url, start, end, contentType, full, customFetch, accessToken) {
    super([]);
    this.url = url;
    this.start = start;
    this.end = end;
    this.contentType = contentType;
    this.full = full;
    this.fetch = customFetch;
    this.accessToken = accessToken;
  }
  get size() {
    return this.end - this.start;
  }
  get type() {
    return this.contentType;
  }
  slice(start = 0, end = this.size) {
    if (start < 0 || end < 0) {
      new TypeError("Unsupported negative start/end on WebBlob.slice");
    }
    const slice = new WebBlob(
      this.url,
      this.start + start,
      Math.min(this.start + end, this.end),
      this.contentType,
      start === 0 && end === this.size ? this.full : false,
      this.fetch,
      this.accessToken
    );
    return slice;
  }
  async arrayBuffer() {
    const result = await this.fetchRange();
    return result.arrayBuffer();
  }
  async text() {
    const result = await this.fetchRange();
    return result.text();
  }
  stream() {
    const stream = new TransformStream();
    this.fetchRange().then((response) => response.body?.pipeThrough(stream)).catch((error) => stream.writable.abort(error.message));
    return stream.readable;
  }
  fetchRange() {
    const fetch2 = this.fetch;
    if (this.full) {
      return fetch2(this.url, {
        ...this.accessToken && {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        }
      }).then((resp) => resp.ok ? resp : createApiError(resp));
    }
    return fetch2(this.url, {
      headers: {
        Range: `bytes=${this.start}-${this.end - 1}`,
        ...this.accessToken && { Authorization: `Bearer ${this.accessToken}` }
      }
    }).then((resp) => resp.ok ? resp : createApiError(resp));
  }
};

// src/utils/base64FromBytes.ts
function base64FromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

// src/utils/createBlobs.ts
async function createBlobs(url, destPath, opts) {
  if (url.protocol === "http:" || url.protocol === "https:") {
    const blob = await WebBlob.create(url, { fetch: opts?.fetch, accessToken: opts?.accessToken });
    return [{ path: destPath, blob }];
  }
  if (isFrontend) {
    throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
  }
  if (url.protocol === "file:") {
    const { FileBlob: FileBlob2 } = await Promise.resolve().then(() => (init_FileBlob(), FileBlob_exports));
    const { subPaths: subPaths2 } = await Promise.resolve().then(() => (init_sub_paths(), sub_paths_exports));
    const paths = await subPaths2(url, opts?.maxFolderDepth);
    if (paths.length === 1 && paths[0].relativePath === ".") {
      const blob = await FileBlob2.create(url);
      return [{ path: destPath, blob }];
    }
    return Promise.all(
      paths.map(async (path2) => ({
        path: `${destPath}/${path2.relativePath}`.replace(/\/[.]$/, "").replaceAll("//", "/").replace(/^[.]?\//, ""),
        blob: await FileBlob2.create(new URL(path2.path))
      }))
    );
  }
  throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
}

// src/vendor/lz4js/util.ts
function hashU32(a) {
  a = a | 0;
  a = a + 2127912214 + (a << 12) | 0;
  a = a ^ -949894596 ^ a >>> 19;
  a = a + 374761393 + (a << 5) | 0;
  a = a + -744332180 ^ a << 9;
  a = a + -42973499 + (a << 3) | 0;
  return a ^ -1252372727 ^ a >>> 16 | 0;
}
function readU32(b, n) {
  let x = 0;
  x |= b[n++] << 0;
  x |= b[n++] << 8;
  x |= b[n++] << 16;
  x |= b[n++] << 24;
  return x;
}
function writeU32(b, n, x) {
  b[n++] = x >> 0 & 255;
  b[n++] = x >> 8 & 255;
  b[n++] = x >> 16 & 255;
  b[n++] = x >> 24 & 255;
}
function imul(a, b) {
  const ah = a >>> 16;
  const al = a & 65535;
  const bh = b >>> 16;
  const bl = b & 65535;
  return al * bl + (ah * bl + al * bh << 16) | 0;
}

// src/vendor/lz4js/xxh32.ts
var prime1 = 2654435761;
var prime2 = 2246822519;
var prime3 = 3266489917;
var prime4 = 668265263;
var prime5 = 374761393;
function rotl32(x, r) {
  x = x | 0;
  r = r | 0;
  return x >>> (32 - r | 0) | x << r | 0;
}
function rotmul32(h, r, m) {
  h = h | 0;
  r = r | 0;
  m = m | 0;
  return imul(h >>> (32 - r | 0) | h << r, m) | 0;
}
function shiftxor32(h, s) {
  h = h | 0;
  s = s | 0;
  return h >>> s ^ h | 0;
}
function xxhapply(h, src, m0, s, m1) {
  return rotmul32(imul(src, m0) + h, s, m1);
}
function xxh1(h, src, index) {
  return rotmul32(h + imul(src[index], prime5), 11, prime1);
}
function xxh4(h, src, index) {
  return xxhapply(h, readU32(src, index), prime3, 17, prime4);
}
function xxh16(h, src, index) {
  return [
    xxhapply(h[0], readU32(src, index + 0), prime2, 13, prime1),
    xxhapply(h[1], readU32(src, index + 4), prime2, 13, prime1),
    xxhapply(h[2], readU32(src, index + 8), prime2, 13, prime1),
    xxhapply(h[3], readU32(src, index + 12), prime2, 13, prime1)
  ];
}
function xxh32(seed, src, index, len) {
  let h;
  const l = len;
  if (len >= 16) {
    h = [seed + prime1 + prime2, seed + prime2, seed, seed - prime1];
    while (len >= 16) {
      h = xxh16(h, src, index);
      index += 16;
      len -= 16;
    }
    h = rotl32(h[0], 1) + rotl32(h[1], 7) + rotl32(h[2], 12) + rotl32(h[3], 18) + l;
  } else {
    h = seed + prime5 + len >>> 0;
  }
  while (len >= 4) {
    h = xxh4(h, src, index);
    index += 4;
    len -= 4;
  }
  while (len > 0) {
    h = xxh1(h, src, index);
    index++;
    len--;
  }
  h = shiftxor32(imul(shiftxor32(imul(shiftxor32(h, 15), prime2), 13), prime3), 16);
  return h >>> 0;
}
var hash = xxh32;

// src/vendor/lz4js/index.ts
var minMatch = 4;
var matchSearchLimit = 12;
var minTrailingLitterals = 5;
var skipTrigger = 6;
var hashSize = 1 << 16;
var mlBits = 4;
var mlMask = (1 << mlBits) - 1;
var runBits = 4;
var runMask = (1 << runBits) - 1;
var blockBuf = makeBuffer(5 << 20);
var hashTable = makeHashTable();
var magicNum = 407708164;
var fdVersion = 64;
var bsDefault = 7;
var bsShift = 4;
var bsMap = {
  4: 65536,
  5: 262144,
  6: 1048576,
  7: 4194304
};
function makeHashTable() {
  try {
    return new Uint32Array(hashSize);
  } catch (error) {
    const hashTable2 = new Array(hashSize);
    for (let i = 0; i < hashSize; i++) {
      hashTable2[i] = 0;
    }
    return hashTable2;
  }
}
function clearHashTable(table) {
  for (let i = 0; i < hashSize; i++) {
    table[i] = 0;
  }
}
function makeBuffer(size) {
  return new Uint8Array(size);
}
function sliceArray(array, start, end) {
  return array.slice(start, end);
}
function compressBound(n) {
  return n + n / 255 + 16 | 0;
}
function compressBlock(src, dst, sIndex, sLength, hashTable2) {
  let mIndex, mAnchor, mLength, mOffset, mStep;
  let literalCount, dIndex, sEnd, n;
  dIndex = 0;
  sEnd = sLength + sIndex;
  mAnchor = sIndex;
  let searchMatchCount = (1 << skipTrigger) + 3;
  while (sIndex <= sEnd - matchSearchLimit) {
    const seq = readU32(src, sIndex);
    let hash2 = hashU32(seq) >>> 0;
    hash2 = (hash2 >> 16 ^ hash2) >>> 0 & 65535;
    mIndex = hashTable2[hash2] - 1;
    hashTable2[hash2] = sIndex + 1;
    if (mIndex < 0 || sIndex - mIndex >>> 16 > 0 || readU32(src, mIndex) !== seq) {
      mStep = searchMatchCount++ >> skipTrigger;
      sIndex += mStep;
      continue;
    }
    searchMatchCount = (1 << skipTrigger) + 3;
    literalCount = sIndex - mAnchor;
    mOffset = sIndex - mIndex;
    sIndex += minMatch;
    mIndex += minMatch;
    mLength = sIndex;
    while (sIndex < sEnd - minTrailingLitterals && src[sIndex] === src[mIndex]) {
      sIndex++;
      mIndex++;
    }
    mLength = sIndex - mLength;
    const token = mLength < mlMask ? mLength : mlMask;
    if (literalCount >= runMask) {
      dst[dIndex++] = (runMask << mlBits) + token;
      for (n = literalCount - runMask; n >= 255; n -= 255) {
        dst[dIndex++] = 255;
      }
      dst[dIndex++] = n;
    } else {
      dst[dIndex++] = (literalCount << mlBits) + token;
    }
    for (let i = 0; i < literalCount; i++) {
      dst[dIndex++] = src[mAnchor + i];
    }
    dst[dIndex++] = mOffset;
    dst[dIndex++] = mOffset >> 8;
    if (mLength >= mlMask) {
      for (n = mLength - mlMask; n >= 255; n -= 255) {
        dst[dIndex++] = 255;
      }
      dst[dIndex++] = n;
    }
    mAnchor = sIndex;
  }
  if (mAnchor === 0) {
    return 0;
  }
  literalCount = sEnd - mAnchor;
  if (literalCount >= runMask) {
    dst[dIndex++] = runMask << mlBits;
    for (n = literalCount - runMask; n >= 255; n -= 255) {
      dst[dIndex++] = 255;
    }
    dst[dIndex++] = n;
  } else {
    dst[dIndex++] = literalCount << mlBits;
  }
  sIndex = mAnchor;
  while (sIndex < sEnd) {
    dst[dIndex++] = src[sIndex++];
  }
  return dIndex;
}
function compressFrame(src, dst) {
  let dIndex = 0;
  writeU32(dst, dIndex, magicNum);
  dIndex += 4;
  dst[dIndex++] = fdVersion;
  dst[dIndex++] = bsDefault << bsShift;
  dst[dIndex] = hash(0, dst, 4, dIndex - 4) >> 8;
  dIndex++;
  const maxBlockSize = bsMap[bsDefault];
  let remaining = src.length;
  let sIndex = 0;
  clearHashTable(hashTable);
  while (remaining > 0) {
    let compSize = 0;
    const blockSize = remaining > maxBlockSize ? maxBlockSize : remaining;
    compSize = compressBlock(src, blockBuf, sIndex, blockSize, hashTable);
    if (compSize > blockSize || compSize === 0) {
      writeU32(dst, dIndex, 2147483648 | blockSize);
      dIndex += 4;
      for (let z = sIndex + blockSize; sIndex < z; ) {
        dst[dIndex++] = src[sIndex++];
      }
      remaining -= blockSize;
    } else {
      writeU32(dst, dIndex, compSize);
      dIndex += 4;
      for (let j = 0; j < compSize; ) {
        dst[dIndex++] = blockBuf[j++];
      }
      sIndex += blockSize;
      remaining -= blockSize;
    }
  }
  writeU32(dst, dIndex, 0);
  dIndex += 4;
  return dIndex;
}
function compress(src, maxSize) {
  let dst, size;
  if (maxSize === void 0) {
    maxSize = compressBound(src.length);
  }
  dst = makeBuffer(maxSize);
  size = compressFrame(src, dst);
  if (size !== maxSize) {
    dst = sliceArray(dst, 0, size);
  }
  return dst;
}

// src/utils/XetBlob.ts
var XET_CHUNK_HEADER_BYTES = 8;
function bg4_split_bytes(bytes) {
  const ret = new Uint8Array(bytes.byteLength);
  const split = Math.floor(bytes.byteLength / 4);
  const rem = bytes.byteLength % 4;
  const g1_pos = split + (rem >= 1 ? 1 : 0);
  const g2_pos = g1_pos + split + (rem >= 2 ? 1 : 0);
  const g3_pos = g2_pos + split + (rem == 3 ? 1 : 0);
  for (let i = 0, j = 0; i < bytes.byteLength; i += 4, j++) {
    ret[j] = bytes[i];
  }
  for (let i = 1, j = g1_pos; i < bytes.byteLength; i += 4, j++) {
    ret[j] = bytes[i];
  }
  for (let i = 2, j = g2_pos; i < bytes.byteLength; i += 4, j++) {
    ret[j] = bytes[i];
  }
  for (let i = 3, j = g3_pos; i < bytes.byteLength; i += 4, j++) {
    ret[j] = bytes[i];
  }
  return ret;
}

// src/utils/ChunkCache.ts
var CHUNK_CACHE_INITIAL_SIZE = 1e4;
var CHUNK_CACHE_GROW_FACTOR = 1.5;
var CHUNK_CACHE_MAX_SIZE = 1e6;
var ChunkCache = class {
  index = 0;
  // Index >= 0 means local xorb, < 0 means remote xorb
  xorbIndices;
  // Max 8K chunks per xorb, less than 64K uint16_t
  chunkIndices;
  map = /* @__PURE__ */ new Map();
  // hash -> chunkCacheIndex. Less overhead that way, empty object is 60+B and empty array is 40+B
  hmacs = /* @__PURE__ */ new Set();
  // todo : remove old hmacs
  maxSize;
  constructor(maxSize = CHUNK_CACHE_MAX_SIZE) {
    if (maxSize < 1) {
      throw new Error("maxSize must be at least 1");
    }
    this.maxSize = maxSize;
    this.xorbIndices = new Int32Array(Math.min(CHUNK_CACHE_INITIAL_SIZE, maxSize));
    this.chunkIndices = new Uint16Array(Math.min(CHUNK_CACHE_INITIAL_SIZE, maxSize));
  }
  addChunkToCache(hash2, xorbIndex, chunkIndex, hmac) {
    if (this.map.has(hash2)) {
      return;
    }
    if (this.map.values().next().value === this.index) {
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(hash2, this.index);
    if (hmac !== null) {
      this.hmacs.add(hmac);
    }
    if (this.index >= this.xorbIndices.length) {
      const oldXorbIndices = this.xorbIndices;
      const oldChunkIndices = this.chunkIndices;
      this.xorbIndices = new Int32Array(Math.min(this.xorbIndices.length * CHUNK_CACHE_GROW_FACTOR, this.maxSize));
      this.chunkIndices = new Uint16Array(Math.min(this.chunkIndices.length * CHUNK_CACHE_GROW_FACTOR, this.maxSize));
      this.xorbIndices.set(oldXorbIndices);
      this.chunkIndices.set(oldChunkIndices);
    }
    this.xorbIndices[this.index] = xorbIndex;
    this.chunkIndices[this.index] = chunkIndex;
    this.index = (this.index + 1) % this.maxSize;
  }
  getChunk(hash2, hmacFunction) {
    let index = this.map.get(hash2);
    if (index === void 0 && hmacFunction !== null) {
      for (const hmac of this.hmacs) {
        index = this.map.get(hmacFunction(hash2, hmac));
        if (index !== void 0) {
          break;
        }
      }
    }
    if (index === void 0) {
      return void 0;
    }
    return {
      xorbIndex: this.xorbIndices[index],
      chunkIndex: this.chunkIndices[index]
    };
  }
  updateChunkIndex(hash2, chunkIndex) {
    const index = this.map.get(hash2);
    if (index === void 0) {
      throw new Error(`Chunk not found in cache: ${hash2}`);
    }
    this.chunkIndices[index] = chunkIndex;
  }
  removeChunkFromCache(hash2) {
    this.map.delete(hash2);
  }
};

// src/utils/xetWriteToken.ts
var JWT_SAFETY_PERIOD = 6e4;
var JWT_CACHE_SIZE = 1e3;
var jwtPromises = /* @__PURE__ */ new Map();
var jwts = /* @__PURE__ */ new Map();
async function xetWriteToken(params) {
  if (params.xetParams.expiresAt && params.xetParams.casUrl && params.xetParams.accessToken && params.xetParams.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD)) {
    return { accessToken: params.xetParams.accessToken, casUrl: params.xetParams.casUrl };
  }
  const key = params.xetParams.refreshWriteTokenUrl;
  const jwt = jwts.get(key);
  if (jwt && jwt.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD)) {
    return { accessToken: jwt.accessToken, casUrl: jwt.casUrl };
  }
  const existingPromise = jwtPromises.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = (async () => {
    const resp = await (params.fetch ?? fetch)(params.xetParams.refreshWriteTokenUrl, {
      headers: {
        ...params.accessToken ? {
          Authorization: `Bearer ${params.accessToken}`
        } : {},
        ...params.xetParams.sessionId ? { "X-Xet-Session-Id": params.xetParams.sessionId } : {}
      }
    });
    if (!resp.ok) {
      throw await createApiError(resp);
    }
    const json = await resp.json();
    const jwt2 = {
      accessToken: json.accessToken,
      expiresAt: new Date(json.exp * 1e3),
      casUrl: json.casUrl
    };
    jwtPromises.delete(key);
    for (const [key2, value] of jwts.entries()) {
      if (value.expiresAt < new Date(Date.now() + JWT_SAFETY_PERIOD)) {
        jwts.delete(key2);
      } else {
        break;
      }
    }
    if (jwts.size >= JWT_CACHE_SIZE) {
      const keyToDelete = jwts.keys().next().value;
      if (keyToDelete) {
        jwts.delete(keyToDelete);
      }
    }
    jwts.set(key, jwt2);
    return {
      accessToken: json.accessToken,
      casUrl: json.casUrl
    };
  })();
  jwtPromises.set(key, promise);
  return promise;
}

// src/utils/shardParser.ts
var HASH_LENGTH = 32;
var XORB_HASH_BOOKEND = "ff".repeat(HASH_LENGTH);
function readHashFromArray(array, offset) {
  let hash2 = "";
  for (let i = 0; i < HASH_LENGTH; i += 8) {
    hash2 += `${array[offset + i + 7].toString(16).padStart(2, "0")}${array[offset + i + 6].toString(16).padStart(2, "0")}${array[offset + i + 5].toString(16).padStart(2, "0")}${array[offset + i + 4].toString(16).padStart(2, "0")}${array[offset + i + 3].toString(16).padStart(2, "0")}${array[offset + i + 2].toString(16).padStart(2, "0")}${array[offset + i + 1].toString(16).padStart(2, "0")}${array[offset + i].toString(16).padStart(2, "0")}`;
  }
  return hash2;
}
async function parseShardData(shardBlob) {
  const shard = new Uint8Array(await shardBlob.arrayBuffer());
  const shardView = new DataView(shard.buffer);
  const magicTag = shard.slice(0, SHARD_MAGIC_TAG.length);
  if (!magicTag.every((byte, i) => byte === SHARD_MAGIC_TAG[i])) {
    throw new Error("Invalid shard magic tag");
  }
  const version2 = shardView.getBigUint64(SHARD_MAGIC_TAG.length, true);
  if (version2 !== SHARD_HEADER_VERSION) {
    throw new Error(`Invalid shard version: ${version2}`);
  }
  const footerSize = Number(shardView.getBigUint64(SHARD_MAGIC_TAG.length + 8, true));
  const footerStart = shard.length - footerSize;
  const footerVersion = shardView.getBigUint64(footerStart, true);
  if (footerVersion !== SHARD_FOOTER_VERSION) {
    throw new Error(`Invalid shard footer version: ${footerVersion}`);
  }
  const xorbInfoStart = Number(shardView.getBigUint64(footerStart + 16, true));
  const fileLookupStart = Number(shardView.getBigUint64(footerStart + 24, true));
  const hmacKey = readHashFromArray(shard, footerStart + 72);
  const xorbs = [];
  let offset = xorbInfoStart;
  while (offset < fileLookupStart) {
    const xorbHash = readHashFromArray(shard, offset);
    offset += HASH_LENGTH;
    if (xorbHash === XORB_HASH_BOOKEND) {
      break;
    }
    offset += 4;
    const chunkCount = shardView.getUint32(offset, true);
    offset += 4;
    offset += 4;
    offset += 4;
    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkHash = readHashFromArray(shard, offset);
      offset += HASH_LENGTH;
      const startOffset = shardView.getUint32(offset, true);
      offset += 4;
      const length = shardView.getUint32(offset, true);
      offset += 4;
      offset += 8;
      chunks.push({
        hash: chunkHash,
        startOffset,
        unpackedLength: length
      });
    }
    xorbs.push({
      hash: xorbHash,
      chunks
    });
  }
  return {
    hmacKey,
    xorbs
  };
}

// src/utils/sum.ts
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// src/utils/SplicedBlob.ts
var SplicedBlob = class extends Blob {
  originalBlob;
  spliceOperations;
  constructor(originalBlob, spliceOperations) {
    super();
    this.originalBlob = originalBlob;
    this.spliceOperations = spliceOperations;
  }
  static create(originalBlob, operations) {
    for (const op of operations) {
      if (op.start < 0 || op.end < 0) {
        throw new Error("Invalid start/end positions for SplicedBlob");
      }
      if (op.start > originalBlob.size || op.end > originalBlob.size) {
        throw new Error("Invalid start/end positions for SplicedBlob");
      }
      if (op.start > op.end) {
        throw new Error("Invalid start/end positions for SplicedBlob");
      }
    }
    const sortedOps = [...operations].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sortedOps.length - 1; i++) {
      if (sortedOps[i].end > sortedOps[i + 1].start) {
        throw new Error("Overlapping splice operations are not supported");
      }
    }
    return new SplicedBlob(originalBlob, sortedOps);
  }
  /**
   * Returns the size of the spliced blob.
   * Size = original size - total replaced size + total insert size
   */
  get size() {
    let totalReplacedSize = 0;
    let totalInsertSize = 0;
    for (const op of this.spliceOperations) {
      totalReplacedSize += op.end - op.start;
      totalInsertSize += op.insert.size;
    }
    return this.originalBlob.size - totalReplacedSize + totalInsertSize;
  }
  /**
   * Returns the MIME type of the original blob.
   */
  get type() {
    return this.originalBlob.type;
  }
  /**
   * Returns a new instance of SplicedBlob that is a slice of the current one.
   *
   * The slice is inclusive of the start and exclusive of the end.
   * The slice method does not support negative start/end.
   *
   * @param start beginning of the slice
   * @param end end of the slice
   */
  slice(start = 0, end = this.size) {
    if (start < 0 || end < 0) {
      throw new TypeError("Unsupported negative start/end on SplicedBlob.slice");
    }
    start = Math.min(start, this.size);
    end = Math.min(end, this.size);
    if (start >= end) {
      return new Blob([]);
    }
    const segments = this.segments;
    const segmentBoundaries = [0];
    let cumulativeSize = 0;
    for (const segment of segments) {
      cumulativeSize += segment.size;
      segmentBoundaries.push(cumulativeSize);
    }
    const resultSegments = [];
    for (let i = 0; i < segments.length; i++) {
      const segmentStart = segmentBoundaries[i];
      const segmentEnd = segmentBoundaries[i + 1];
      if (segmentEnd <= start) {
        continue;
      }
      if (segmentStart >= end) {
        break;
      }
      const sliceStart = Math.max(0, start - segmentStart);
      const sliceEnd = Math.min(segments[i].size, end - segmentStart);
      if (sliceStart < sliceEnd) {
        resultSegments.push(segments[i].slice(sliceStart, sliceEnd));
      }
    }
    return new Blob(resultSegments);
  }
  get firstSpliceIndex() {
    return this.spliceOperations[0]?.start ?? Infinity;
  }
  /**
   * Read the spliced blob content and returns it as an ArrayBuffer.
   */
  async arrayBuffer() {
    const segments = this.segments;
    const buffers = await Promise.all(segments.map((segment) => segment.arrayBuffer()));
    const totalSize = sum(buffers.map((buffer) => buffer.byteLength));
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    return result.buffer;
  }
  /**
   * Read the spliced blob content and returns it as a string.
   */
  async text() {
    const buffer = await this.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  /**
   * Returns a stream around the spliced blob content.
   */
  stream() {
    const readable = new ReadableStream({
      start: async (controller) => {
        try {
          const segments = this.segments;
          for (const segment of segments) {
            const reader = segment.stream().getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  break;
                }
                controller.enqueue(value);
              }
            } finally {
              reader.releaseLock();
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
    return readable;
  }
  /**
   * Get all segments that make up the spliced blob.
   * This includes original blob segments between splice operations and insert blobs.
   */
  get segments() {
    const segments = [];
    let currentPosition = 0;
    const sortedOps = [...this.spliceOperations].sort((a, b) => a.start - b.start);
    for (const op of sortedOps) {
      if (currentPosition < op.start) {
        segments.push(this.originalBlob.slice(currentPosition, op.start));
      }
      if (op.insert.size > 0) {
        segments.push(op.insert);
      }
      currentPosition = op.end;
    }
    if (currentPosition < this.originalBlob.size) {
      segments.push(this.originalBlob.slice(currentPosition));
    }
    return segments;
  }
};

// src/utils/createXorbs.ts
var TARGET_CHUNK_SIZE = 64 * 1024;
var MAX_CHUNK_SIZE = 2 * TARGET_CHUNK_SIZE;
var XORB_SIZE = 64 * 1024 * 1024;
var MAX_XORB_CHUNKS = 8 * 1024;
var INTERVAL_BETWEEN_REMOTE_DEDUP = 4e6;
var PROCESSING_PROGRESS_RATIO = 0.1;
var UPLOADING_PROGRESS_RATIO = 1 - PROCESSING_PROGRESS_RATIO;
var CurrentXorbInfo = class {
  id;
  offset;
  chunks;
  fileProcessedBytes;
  fileUploadedBytes;
  fileSize;
  data;
  immutableData;
  constructor() {
    this.id = 0;
    this.offset = 0;
    this.chunks = [];
    this.fileProcessedBytes = {};
    this.fileUploadedBytes = {};
    this.fileSize = {};
    this.data = new Uint8Array(XORB_SIZE);
    this.immutableData = null;
  }
  event(computeXorbHash) {
    const xorbChunksCleaned = this.chunks.map((chunk2) => ({
      hash: chunk2.hash,
      length: chunk2.length
    }));
    return {
      event: "xorb",
      xorb: this.data.subarray(0, this.offset),
      hash: computeXorbHash(xorbChunksCleaned),
      chunks: xorbChunksCleaned,
      id: this.id,
      files: Object.entries(this.fileProcessedBytes).map(([path2, processedBytes]) => ({
        path: path2,
        progress: processedBytes / this.fileSize[path2],
        lastSentProgress: ((this.fileUploadedBytes[path2] ?? 0) + (processedBytes - (this.fileUploadedBytes[path2] ?? 0)) * PROCESSING_PROGRESS_RATIO) / this.fileSize[path2]
      }))
    };
  }
};
async function* createXorbs(fileSources, params) {
  const alreadyDoneFileSha256s = /* @__PURE__ */ new Set();
  const chunkModule = await Promise.resolve().then(() => (init_chunker_wasm(), chunker_wasm_exports));
  let xorbId = 0;
  await chunkModule.init();
  const chunkCache = new ChunkCache();
  let xorb = new CurrentXorbInfo();
  const nextXorb = (currentFile) => {
    const event = xorb.event(chunkModule.compute_xorb_hash.bind(chunkModule));
    xorbId++;
    xorb = new CurrentXorbInfo();
    xorb.id = xorbId;
    xorb.fileUploadedBytes = {
      [currentFile.path]: currentFile.uploadedBytes
    };
    xorb.fileSize[currentFile.path] = currentFile.size;
    return event;
  };
  const pendingFileEvents = [];
  const remoteXorbHashes = [""];
  for await (const fileSource of fileSources) {
    params.yieldCallback?.({
      event: "fileProgress",
      path: fileSource.path,
      progress: 0
    });
    if (alreadyDoneFileSha256s.has(fileSource.sha256)) {
      params.yieldCallback?.({
        event: "fileProgress",
        path: fileSource.path,
        progress: 1
      });
      continue;
    }
    alreadyDoneFileSha256s.add(fileSource.sha256);
    const chunker = new chunkModule.Chunker(TARGET_CHUNK_SIZE);
    try {
      xorb.fileSize[fileSource.path] = fileSource.content.size;
      if (fileSource.content instanceof SplicedBlob && fileSource.content.firstSpliceIndex < MAX_CHUNK_SIZE) {
        await loadDedupInfoToCache(
          fileSource.content.originalBlob.slice(0, MAX_CHUNK_SIZE),
          remoteXorbHashes,
          params,
          chunkCache,
          chunkModule,
          {
            maxChunks: 1,
            isAtBeginning: true
          }
        );
      }
      let bytesSinceRemoteDedup = Infinity;
      let bytesSinceLastProgressEvent = 0;
      let isFirstFileChunk = true;
      const sourceChunks = [];
      const reader = fileSource.content.stream().getReader();
      let processedBytes = 0;
      let dedupedBytes = 0;
      const fileChunks = [];
      const chunkMetadata = [];
      const addChunks = async function* (chunks) {
        for (const chunk2 of chunks) {
          if (isFirstFileChunk) {
            chunk2.dedup = true;
            isFirstFileChunk = false;
          }
          let chunkIndex = xorb.chunks.length;
          let chunkXorbId = xorbId;
          const chunkToCopy = removeChunkFromSourceData(sourceChunks, chunk2.length);
          let cacheData = chunkCache.getChunk(chunk2.hash, chunkModule.compute_hmac);
          if (cacheData === void 0 && chunk2.dedup && bytesSinceRemoteDedup >= INTERVAL_BETWEEN_REMOTE_DEDUP) {
            const token = await xetWriteToken(params);
            bytesSinceRemoteDedup = 0;
            const shardResp = await (params.fetch ?? fetch)(token.casUrl + "/v1/chunks/default/" + chunk2.hash, {
              headers: {
                Authorization: `Bearer ${token.accessToken}`
              }
            });
            if (shardResp.ok) {
              const shard = await shardResp.blob();
              const shardData = await parseShardData(shard);
              for (const xorb2 of shardData.xorbs) {
                const remoteXorbId = -remoteXorbHashes.length;
                remoteXorbHashes.push(xorb2.hash);
                let i = 0;
                for (const chunk3 of xorb2.chunks) {
                  chunkCache.addChunkToCache(chunk3.hash, remoteXorbId, i++, shardData.hmacKey);
                }
              }
              cacheData = chunkCache.getChunk(chunk2.hash, chunkModule.compute_hmac);
              const oldDedupedBytes = dedupedBytes;
              dedupedBytes = backtrackDedup(
                xorb,
                chunkModule.compute_hmac.bind(chunkModule),
                shardData,
                chunkCache,
                chunkMetadata,
                dedupedBytes
              );
              if (dedupedBytes > oldDedupedBytes) {
                xorb.fileUploadedBytes[fileSource.path] ??= 0;
                xorb.fileUploadedBytes[fileSource.path] += dedupedBytes - oldDedupedBytes;
              }
            }
          }
          if (cacheData === void 0) {
            if (!writeChunk(xorb, chunkToCopy, chunk2.hash)) {
              yield nextXorb({ path: fileSource.path, uploadedBytes: processedBytes, size: fileSource.content.size });
              chunkIndex = 0;
              chunkXorbId = xorbId;
              for (const event of pendingFileEvents) {
                event.representation = event.representation.map((rep) => ({
                  ...rep,
                  xorbId: rep.xorbId >= 0 ? rep.xorbId : remoteXorbHashes[-rep.xorbId]
                }));
                yield event;
              }
              pendingFileEvents.length = 0;
              if (!writeChunk(xorb, chunkToCopy, chunk2.hash)) {
                throw new Error("Failed to write chunk into xorb");
              }
            }
            chunkCache.addChunkToCache(chunk2.hash, xorbId, chunkIndex, null);
          } else {
            chunkXorbId = cacheData.xorbIndex;
            chunkIndex = cacheData.chunkIndex;
            dedupedBytes += chunk2.length;
            xorb.fileUploadedBytes[fileSource.path] ??= 0;
            xorb.fileUploadedBytes[fileSource.path] += chunk2.length;
          }
          bytesSinceRemoteDedup += chunk2.length;
          bytesSinceLastProgressEvent += chunk2.length;
          fileChunks.push({ hash: chunk2.hash, length: chunk2.length });
          chunkMetadata.push({
            xorbId: chunkXorbId,
            chunkIndex,
            length: chunk2.length
          });
          xorb.fileProcessedBytes[fileSource.path] = processedBytes;
          if (bytesSinceLastProgressEvent >= 1e6) {
            bytesSinceLastProgressEvent = 0;
            params.yieldCallback?.({
              event: "fileProgress",
              path: fileSource.path,
              progress: ((xorb.fileUploadedBytes[fileSource.path] ?? 0) + (xorb.fileProcessedBytes[fileSource.path] - (xorb.fileUploadedBytes[fileSource.path] ?? 0)) * PROCESSING_PROGRESS_RATIO) / fileSource.content.size
            });
          }
          if (xorb.chunks.length >= MAX_XORB_CHUNKS) {
            yield nextXorb({ path: fileSource.path, uploadedBytes: processedBytes, size: fileSource.content.size });
            for (const event of pendingFileEvents) {
              event.representation = event.representation.map((rep) => ({
                ...rep,
                xorbId: rep.xorbId >= 0 ? rep.xorbId : remoteXorbHashes[-rep.xorbId]
              }));
              yield event;
            }
            pendingFileEvents.length = 0;
          }
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          yield* addChunks(chunker.finish());
          break;
        }
        processedBytes += value.length;
        sourceChunks.push(value);
        yield* addChunks(chunker.add_data(value));
      }
      const fileRepresentation = buildFileRepresentation(
        chunkMetadata,
        fileChunks,
        chunkModule.compute_verification_hash.bind(chunkModule)
      );
      xorb.immutableData = {
        chunkIndex: xorb.chunks.length,
        offset: xorb.offset
      };
      const dedupRatio = fileSource.content.size > 0 ? dedupedBytes / fileSource.content.size : 0;
      pendingFileEvents.push({
        event: "file",
        path: fileSource.path,
        hash: chunkModule.compute_file_hash(fileChunks),
        sha256: fileSource.sha256,
        dedupRatio,
        representation: fileRepresentation
      });
    } finally {
      chunker.free();
    }
  }
  if (xorb.offset > 0) {
    yield xorb.event(chunkModule.compute_xorb_hash.bind(chunkModule));
  }
  for (const event of pendingFileEvents) {
    event.representation = event.representation.map((rep) => ({
      ...rep,
      xorbId: rep.xorbId >= 0 ? rep.xorbId : remoteXorbHashes[-rep.xorbId]
    }));
    yield event;
  }
}
function backtrackDedup(xorb, computeHmac, shardData, chunkCache, chunkMetadata, dedupedBytes) {
  const chunkIndexesToBacktrackFor = /* @__PURE__ */ new Map();
  for (let chunkToRecheckIndex = xorb.immutableData?.chunkIndex ?? 0; chunkToRecheckIndex < xorb.chunks.length; chunkToRecheckIndex++) {
    const chunk2 = xorb.chunks[chunkToRecheckIndex];
    const hmacHash = computeHmac(chunk2.hash, shardData.hmacKey);
    const cacheData = chunkCache.getChunk(hmacHash, null);
    if (cacheData !== void 0) {
      chunkIndexesToBacktrackFor.set(chunkToRecheckIndex, {
        xorbId: cacheData.xorbIndex,
        chunkIndex: cacheData.chunkIndex
      });
      chunkCache.removeChunkFromCache(chunk2.hash);
    }
  }
  for (const metadata of chunkMetadata) {
    if (metadata.xorbId === xorb.id && chunkIndexesToBacktrackFor.has(metadata.chunkIndex)) {
      const backtrackData = chunkIndexesToBacktrackFor.get(metadata.chunkIndex);
      if (backtrackData !== void 0) {
        metadata.xorbId = backtrackData.xorbId;
        metadata.chunkIndex = backtrackData.chunkIndex;
        dedupedBytes += metadata.length;
      }
    }
  }
  const xorbRangesToErase = [];
  for (let i = 0; i < xorb.chunks.length; i++) {
    const chunk2 = xorb.chunks[i];
    if (chunkIndexesToBacktrackFor.has(i)) {
      xorbRangesToErase.push({
        start: chunk2.offset,
        end: i < xorb.chunks.length - 1 ? xorb.chunks[i + 1].offset : xorb.offset
      });
    }
  }
  const xorbRangesToKeep = [];
  let currentStart = 0;
  for (let i = 0; i < xorbRangesToErase.length; i++) {
    const range2 = xorbRangesToErase[i];
    if (currentStart !== range2.start) {
      xorbRangesToKeep.push({ start: currentStart, end: range2.start });
    }
    currentStart = range2.end;
  }
  if (currentStart !== xorb.offset) {
    xorbRangesToKeep.push({ start: currentStart, end: xorb.offset });
  }
  let currentOffset = 0;
  for (const range2 of xorbRangesToKeep) {
    if (range2.start !== currentOffset) {
      xorb.data.set(xorb.data.subarray(range2.start, range2.end), currentOffset);
    }
    currentOffset += range2.end - range2.start;
  }
  const newXorbChunks = [];
  const oldIndexToNewIndex = /* @__PURE__ */ new Map();
  let erasedOffset = 0;
  for (let i = 0; i < xorb.chunks.length; i++) {
    const chunk2 = xorb.chunks[i];
    if (chunkIndexesToBacktrackFor.has(i)) {
      if (i < xorb.chunks.length - 1) {
        erasedOffset += xorb.chunks[i + 1].offset - chunk2.offset;
      }
    } else {
      newXorbChunks.push({
        hash: chunk2.hash,
        length: chunk2.length,
        offset: chunk2.offset - erasedOffset
      });
      if (erasedOffset > 0) {
        oldIndexToNewIndex.set(i, newXorbChunks.length - 1);
      }
    }
  }
  xorb.chunks = newXorbChunks;
  xorb.offset = currentOffset;
  for (const chunk2 of chunkMetadata) {
    if (chunk2.xorbId === xorb.id) {
      const newIndex = oldIndexToNewIndex.get(chunk2.chunkIndex);
      if (newIndex !== void 0) {
        const cached = chunkCache.getChunk(xorb.chunks[newIndex].hash, null);
        if (cached !== void 0 && cached.xorbIndex === chunk2.xorbId && cached.chunkIndex === chunk2.chunkIndex) {
          chunkCache.updateChunkIndex(xorb.chunks[newIndex].hash, newIndex);
        }
        chunk2.chunkIndex = newIndex;
      }
    }
  }
  return dedupedBytes;
}
function removeChunkFromSourceData(sourceChunks, chunkLength) {
  if (chunkLength === sourceChunks[0].length) {
    const chunkToCopy = sourceChunks[0];
    sourceChunks.shift();
    return chunkToCopy;
  } else if (chunkLength < sourceChunks[0].length) {
    const chunkToCopy = sourceChunks[0].subarray(0, chunkLength);
    sourceChunks[0] = sourceChunks[0].subarray(chunkLength);
    return chunkToCopy;
  } else {
    const chunkToCopy = new Uint8Array(chunkLength);
    let copyOffset = 0;
    let index = 0;
    let toSlice = -1;
    while (copyOffset < chunkLength) {
      const nToCopy = Math.min(sourceChunks[index].length, chunkLength - copyOffset);
      chunkToCopy.set(sourceChunks[index].subarray(0, nToCopy), copyOffset);
      copyOffset += nToCopy;
      if (nToCopy === sourceChunks[index].length) {
        index++;
      } else {
        toSlice = nToCopy;
      }
    }
    sourceChunks.splice(0, index);
    if (toSlice !== -1) {
      sourceChunks[0] = sourceChunks[0].subarray(toSlice);
    }
    return chunkToCopy;
  }
}
function writeChunk(xorb, chunk2, hash2) {
  const regularCompressedChunk = compress(chunk2);
  const bgCompressedChunk = compress(bg4_split_bytes(chunk2));
  const compressedChunk = bgCompressedChunk.length < regularCompressedChunk.length ? bgCompressedChunk : regularCompressedChunk;
  const chunkToWrite = compressedChunk.length < chunk2.length ? compressedChunk : chunk2;
  if (xorb.offset + XET_CHUNK_HEADER_BYTES + chunkToWrite.length > XORB_SIZE) {
    return false;
  }
  xorb.data[xorb.offset] = 0;
  xorb.data[xorb.offset + 1] = chunkToWrite.length & 255;
  xorb.data[xorb.offset + 2] = chunkToWrite.length >> 8 & 255;
  xorb.data[xorb.offset + 3] = chunkToWrite.length >> 16 & 255;
  xorb.data[xorb.offset + 4] = chunkToWrite.length < chunk2.length ? bgCompressedChunk.length < regularCompressedChunk.length ? 2 /* ByteGroupingLZ4 */ : 1 /* LZ4 */ : 0 /* None */;
  xorb.data[xorb.offset + 5] = chunk2.length & 255;
  xorb.data[xorb.offset + 6] = chunk2.length >> 8 & 255;
  xorb.data[xorb.offset + 7] = chunk2.length >> 16 & 255;
  xorb.data.set(chunkToWrite, xorb.offset + XET_CHUNK_HEADER_BYTES);
  xorb.chunks.push({ hash: hash2, length: chunk2.length, offset: xorb.offset });
  xorb.offset += XET_CHUNK_HEADER_BYTES + chunkToWrite.length;
  return true;
}
var buildFileRepresentation = (metadata, chunks, computeVerificationHash) => {
  if (metadata.length === 0) {
    return [];
  }
  const representation = [];
  let currentRange = {
    xorbId: metadata[0].xorbId,
    indexStart: metadata[0].chunkIndex,
    indexEnd: metadata[0].chunkIndex + 1,
    length: metadata[0].length,
    chunkHashStart: 0
  };
  for (let i = 1; i < metadata.length; i++) {
    const chunk2 = metadata[i];
    if (currentRange.xorbId === chunk2.xorbId && currentRange.indexEnd === chunk2.chunkIndex) {
      currentRange.indexEnd = chunk2.chunkIndex + 1;
      currentRange.length += chunk2.length;
    } else {
      const rangeHash2 = computeVerificationHash(chunks.slice(currentRange.chunkHashStart, i).map((x) => x.hash));
      representation.push({
        xorbId: currentRange.xorbId,
        indexStart: currentRange.indexStart,
        indexEnd: currentRange.indexEnd,
        length: currentRange.length,
        rangeHash: rangeHash2
      });
      currentRange = {
        xorbId: chunk2.xorbId,
        indexStart: chunk2.chunkIndex,
        indexEnd: chunk2.chunkIndex + 1,
        length: chunk2.length,
        chunkHashStart: i
      };
    }
  }
  const rangeHash = computeVerificationHash(chunks.slice(currentRange.chunkHashStart).map((x) => x.hash));
  representation.push({
    xorbId: currentRange.xorbId,
    indexStart: currentRange.indexStart,
    indexEnd: currentRange.indexEnd,
    length: currentRange.length,
    rangeHash
  });
  return representation;
};
async function loadDedupInfoToCache(content, remoteXorbHashes, params, chunkCache, chunkModule, opts) {
  const chunker = new chunkModule.Chunker(TARGET_CHUNK_SIZE);
  const cache = chunkCache;
  let dedupedBytes = 0;
  let chunksProcessed = 0;
  let totalBytes = 0;
  let bytesSinceRemoteDedup = Infinity;
  const sourceChunks = [];
  try {
    const reader = content.stream().getReader();
    const processChunks = async (chunkData) => {
      for (const chunk2 of chunkData) {
        chunksProcessed++;
        if (opts?.isAtBeginning && chunksProcessed === 1) {
          chunk2.dedup = true;
        }
        totalBytes += chunk2.length;
        removeChunkFromSourceData(sourceChunks, chunk2.length);
        let cacheData = cache.getChunk(chunk2.hash, chunkModule.compute_hmac);
        if (cacheData !== void 0) {
          dedupedBytes += chunk2.length;
          bytesSinceRemoteDedup += chunk2.length;
          continue;
        }
        if (chunk2.dedup && bytesSinceRemoteDedup >= INTERVAL_BETWEEN_REMOTE_DEDUP) {
          const token = await xetWriteToken(params);
          bytesSinceRemoteDedup = 0;
          const shardResp = await (params.fetch ?? fetch)(token.casUrl + "/v1/chunks/default/" + chunk2.hash, {
            headers: {
              Authorization: `Bearer ${token.accessToken}`
            }
          });
          if (shardResp.ok) {
            const shard = await shardResp.blob();
            const shardData = await parseShardData(shard);
            for (const xorb of shardData.xorbs) {
              const remoteXorbId = -remoteXorbHashes.length;
              remoteXorbHashes.push(xorb.hash);
              let i = 0;
              for (const xorbChunk of xorb.chunks) {
                cache.addChunkToCache(xorbChunk.hash, remoteXorbId, i++, shardData.hmacKey);
              }
            }
            cacheData = cache.getChunk(chunk2.hash, chunkModule.compute_hmac);
          }
        }
        if (cacheData !== void 0) {
          dedupedBytes += chunk2.length;
        }
        bytesSinceRemoteDedup += chunk2.length;
      }
    };
    while (true) {
      if (opts?.end !== void 0 && totalBytes >= opts.end) {
        break;
      }
      if (opts?.maxChunks !== void 0 && chunksProcessed >= opts.maxChunks) {
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        await processChunks(chunker.finish());
        break;
      }
      sourceChunks.push(value);
      await processChunks(chunker.add_data(value));
    }
  } finally {
    chunker.free();
  }
}

// src/utils/uploadShards.ts
var SHARD_MAX_SIZE = 64 * 1024 * 1024;
var SHARD_HEADER_SIZE = 48;
var SHARD_FOOTER_SIZE = 200;
var HASH_LENGTH2 = 32;
var XORB_FOOTER_LENGTH = 48;
var FILE_FOOTER_LENGTH = 48;
var SHARD_HEADER_VERSION = 2n;
var SHARD_FOOTER_VERSION = 1n;
var MDB_FILE_FLAG_WITH_VERIFICATION = 2147483648;
var MDB_FILE_FLAG_WITH_METADATA_EXT = 1073741824;
var SHARD_MAGIC_TAG = new Uint8Array([
  "H".charCodeAt(0),
  "F".charCodeAt(0),
  "R".charCodeAt(0),
  "e".charCodeAt(0),
  "p".charCodeAt(0),
  "o".charCodeAt(0),
  "M".charCodeAt(0),
  "e".charCodeAt(0),
  "t".charCodeAt(0),
  "a".charCodeAt(0),
  "D".charCodeAt(0),
  "a".charCodeAt(0),
  "t".charCodeAt(0),
  "a".charCodeAt(0),
  0,
  85,
  105,
  103,
  69,
  106,
  123,
  129,
  87,
  131,
  165,
  189,
  217,
  92,
  205,
  209,
  74,
  169
]);
async function* uploadShards(source, params) {
  const xorbHashes = [];
  const fileInfoSection = new Uint8Array(Math.floor(SHARD_MAX_SIZE - SHARD_HEADER_SIZE - SHARD_FOOTER_SIZE) * 0.25);
  const xorbInfoSection = new Uint8Array(Math.floor(SHARD_MAX_SIZE - SHARD_HEADER_SIZE - SHARD_FOOTER_SIZE) * 0.75);
  const xorbView = new DataView(xorbInfoSection.buffer);
  let xorbViewOffset = 0;
  const fileInfoView = new DataView(fileInfoSection.buffer);
  let fileViewOffset = 0;
  let xorbTotalSize = 0n;
  let fileTotalSize = 0n;
  let xorbTotalUnpackedSize = 0n;
  for await (const output of createXorbs(source, params)) {
    switch (output.event) {
      case "xorb": {
        xorbHashes.push(output.hash);
        const xorbEntrySize = HASH_LENGTH2 + 4 + 4 + 4 + 4;
        const chunksSize = output.chunks.length * (HASH_LENGTH2 + 4 + 4 + 8);
        const totalXorbSize = xorbEntrySize + chunksSize;
        if (xorbViewOffset + totalXorbSize > xorbInfoSection.length) {
          if (xorbViewOffset > 0 || fileViewOffset > 0) {
            await uploadShard(createShard(), params);
          }
        }
        writeHashToArray(output.hash, xorbInfoSection, xorbViewOffset);
        xorbViewOffset += HASH_LENGTH2;
        xorbView.setUint32(xorbViewOffset, 0, true);
        xorbViewOffset += 4;
        xorbView.setUint32(xorbViewOffset, output.chunks.length, true);
        xorbViewOffset += 4;
        const xorbUnpackedSize = sum(output.chunks.map((x) => x.length));
        xorbView.setUint32(xorbViewOffset, xorbUnpackedSize, true);
        xorbTotalUnpackedSize += BigInt(xorbUnpackedSize);
        xorbTotalSize += BigInt(output.xorb.byteLength);
        xorbViewOffset += 4;
        xorbView.setUint32(xorbViewOffset, output.xorb.byteLength, true);
        xorbViewOffset += 4;
        let chunkBytes = 0;
        for (const chunk2 of output.chunks) {
          writeHashToArray(chunk2.hash, xorbInfoSection, xorbViewOffset);
          xorbViewOffset += HASH_LENGTH2;
          xorbView.setUint32(xorbViewOffset, chunkBytes, true);
          xorbViewOffset += 4;
          xorbView.setUint32(xorbViewOffset, chunk2.length, true);
          xorbViewOffset += 4;
          xorbView.setBigUint64(xorbViewOffset, 0n, true);
          xorbViewOffset += 8;
          chunkBytes += chunk2.length;
        }
        for (const file of output.files) {
          yield {
            event: "fileProgress",
            path: file.path,
            progress: file.lastSentProgress
          };
        }
        await uploadXorb(output, params);
        for (const file of output.files) {
          yield { event: "fileProgress", path: file.path, progress: file.progress };
        }
        break;
      }
      case "file": {
        yield { event: "file", path: output.path, sha256: output.sha256, dedupRatio: output.dedupRatio };
        const fileHeaderSize = HASH_LENGTH2 + 4 + 4 + 8;
        const representationSize = output.representation.length * (HASH_LENGTH2 + 4 + 4 + 4 + 4);
        const verificationSize = output.representation.length * (HASH_LENGTH2 + 16);
        const metadataSize = HASH_LENGTH2 + 16;
        const totalFileSize = fileHeaderSize + representationSize + verificationSize + metadataSize;
        if (fileViewOffset + totalFileSize > fileInfoSection.length) {
          if (xorbViewOffset > 0 || fileViewOffset > 0) {
            await uploadShard(createShard(), params);
          }
        }
        writeHashToArray(output.hash, fileInfoSection, fileViewOffset);
        fileViewOffset += HASH_LENGTH2;
        fileInfoView.setUint32(fileViewOffset, MDB_FILE_FLAG_WITH_METADATA_EXT + MDB_FILE_FLAG_WITH_VERIFICATION, true);
        fileViewOffset += 4;
        fileInfoView.setUint32(fileViewOffset, output.representation.length, true);
        fileViewOffset += 4;
        fileInfoView.setBigUint64(fileViewOffset, 0n, true);
        fileViewOffset += 8;
        for (const repItem of output.representation) {
          writeHashToArray(
            typeof repItem.xorbId === "number" ? xorbHashes[repItem.xorbId] : repItem.xorbId,
            fileInfoSection,
            fileViewOffset
          );
          fileViewOffset += HASH_LENGTH2;
          fileInfoView.setUint32(fileViewOffset, 0, true);
          fileViewOffset += 4;
          fileInfoView.setUint32(fileViewOffset, repItem.length, true);
          fileViewOffset += 4;
          fileInfoView.setUint32(fileViewOffset, repItem.indexStart, true);
          fileViewOffset += 4;
          fileInfoView.setUint32(fileViewOffset, repItem.indexEnd, true);
          fileViewOffset += 4;
        }
        for (const repItem of output.representation) {
          writeHashToArray(repItem.rangeHash, fileInfoSection, fileViewOffset);
          fileViewOffset += HASH_LENGTH2;
          for (let i = 0; i < 16; i++) {
            fileInfoSection[fileViewOffset + i] = 0;
          }
          fileViewOffset += 16;
        }
        writeHashToArray(output.sha256, fileInfoSection, fileViewOffset);
        fileViewOffset += HASH_LENGTH2;
        for (let i = 0; i < 16; i++) {
          fileInfoSection[fileViewOffset + i] = 0;
        }
        fileViewOffset += 16;
        break;
      }
    }
  }
  function createShard() {
    const shard = new Uint8Array(
      SHARD_HEADER_SIZE + SHARD_FOOTER_SIZE + xorbViewOffset + XORB_FOOTER_LENGTH + fileViewOffset + FILE_FOOTER_LENGTH
    );
    const shardView = new DataView(shard.buffer);
    let shardOffset = 0;
    shard.set(SHARD_MAGIC_TAG, shardOffset);
    shardOffset += SHARD_MAGIC_TAG.length;
    shardView.setBigUint64(shardOffset, SHARD_HEADER_VERSION, true);
    shardOffset += 8;
    shardView.setBigUint64(shardOffset, BigInt(SHARD_FOOTER_SIZE), true);
    shardOffset += 8;
    shard.set(fileInfoSection.slice(0, fileViewOffset), shardOffset);
    shardOffset += fileViewOffset;
    for (let i = 0; i < 32; i++) {
      shard[shardOffset + i] = 255;
    }
    shardOffset += 32;
    for (let i = 0; i < 16; i++) {
      shard[shardOffset + i] = 0;
    }
    shardOffset += 16;
    const xorbInfoOffset = shardOffset;
    shard.set(xorbInfoSection.slice(0, xorbViewOffset), shardOffset);
    shardOffset += xorbViewOffset;
    for (let i = 0; i < 32; i++) {
      shard[shardOffset + i] = 255;
    }
    shardOffset += 32;
    for (let i = 0; i < 16; i++) {
      shard[shardOffset + i] = 0;
    }
    shardOffset += 16;
    const footerOffset = shardOffset;
    shardView.setBigUint64(shardOffset, SHARD_FOOTER_VERSION, true);
    shardOffset += 8;
    shardView.setBigUint64(shardOffset, BigInt(SHARD_HEADER_SIZE), true);
    shardOffset += 8;
    shardView.setBigUint64(shardOffset, BigInt(xorbInfoOffset), true);
    shardOffset += 8;
    for (let i = 0; i < 48; i++) {
      shardView.setUint8(shardOffset + i, 0);
    }
    shardOffset += 48;
    for (let i = 0; i < 32; i++) {
      shardView.setUint8(shardOffset + i, 0);
    }
    shardOffset += 32;
    shardView.setBigUint64(shardOffset, BigInt(Math.floor(Date.now() / 1e3)), true);
    shardOffset += 8;
    shardView.setBigUint64(shardOffset, 0n, true);
    shardOffset += 8;
    for (let i = 0; i < 48; i++) {
      shardView.setUint8(shardOffset + i, 0);
    }
    shardOffset += 48;
    shardView.setBigUint64(shardOffset, xorbTotalSize, true);
    shardOffset += 8;
    shardView.setBigUint64(shardOffset, fileTotalSize, true);
    shardOffset += 8;
    shardView.setBigUint64(shardOffset, xorbTotalUnpackedSize, true);
    shardOffset += 8;
    shardView.setBigUint64(shardOffset, BigInt(footerOffset), true);
    xorbViewOffset = 0;
    fileViewOffset = 0;
    xorbTotalSize = 0n;
    xorbTotalUnpackedSize = 0n;
    fileTotalSize = 0n;
    return shard;
  }
  if (xorbViewOffset || fileViewOffset) {
    await uploadShard(createShard(), params);
  }
}
function writeHashToArray(hash2, array, offset) {
  for (let i = 0; i < hash2.length; i += 16) {
    array[offset + i / 2] = parseInt(hash2.substring(i + 2 * 7, i + 2 * 8), 16);
    array[offset + i / 2 + 1] = parseInt(hash2.substring(i + 2 * 6, i + 2 * 7), 16);
    array[offset + i / 2 + 2] = parseInt(hash2.substring(i + 2 * 5, i + 2 * 6), 16);
    array[offset + i / 2 + 3] = parseInt(hash2.substring(i + 2 * 4, i + 2 * 5), 16);
    array[offset + i / 2 + 4] = parseInt(hash2.substring(i + 2 * 3, i + 2 * 4), 16);
    array[offset + i / 2 + 5] = parseInt(hash2.substring(i + 2 * 2, i + 2 * 3), 16);
    array[offset + i / 2 + 6] = parseInt(hash2.substring(i + 2 * 1, i + 2 * 2), 16);
    array[offset + i / 2 + 7] = parseInt(hash2.substring(i + 2 * 0, i + 2 * 1), 16);
  }
}
async function uploadXorb(xorb, params) {
  const token = await xetWriteToken(params);
  const resp = await (params.fetch ?? fetch)(`${token.casUrl}/v1/xorbs/default/${xorb.hash}`, {
    method: "POST",
    body: xorb.xorb,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...params.xetParams.sessionId ? { "X-Xet-Session-Id": params.xetParams.sessionId } : {}
    },
    ...{
      progressHint: {
        progressCallback: (progress) => {
          for (const file of xorb.files) {
            params.yieldCallback?.({
              event: "fileProgress",
              path: file.path,
              progress: file.lastSentProgress + (file.progress - file.lastSentProgress) * progress
            });
          }
        }
      }
    }
  });
  if (!resp.ok) {
    throw await createApiError(resp);
  }
}
async function uploadShard(shard, params) {
  const token = await xetWriteToken(params);
  const resp = await (params.fetch ?? fetch)(`${token.casUrl}/v1/shards`, {
    method: "POST",
    body: shard,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...params.xetParams.sessionId ? { "X-Xet-Session-Id": params.xetParams.sessionId } : {}
    }
  });
  if (!resp.ok) {
    throw await createApiError(resp);
  }
}

// src/utils/splitAsyncGenerator.ts
function splitAsyncGenerator(source, n) {
  if (n <= 0) {
    return [];
  }
  const sleep = (ms) => new Promise((resolve3) => setTimeout(resolve3, ms));
  let takenIndex = null;
  const generators = [];
  let remaining = n;
  for (let i = 0; i < n; i++) {
    generators.push({
      next: async () => {
        while (takenIndex !== null) {
          await sleep(1);
        }
        takenIndex = i;
        return source.next().then((r) => {
          takenIndex = null;
          return r;
        });
      },
      return: async () => {
        remaining--;
        if (remaining === 0) {
          return source.return(void 0);
        }
        return {
          done: true,
          value: void 0
        };
      },
      throw: async (error) => {
        return source.throw(error);
      },
      [Symbol.asyncIterator]: () => generators[i]
    });
  }
  return generators;
}

// src/lib/commit.ts
var CONCURRENT_SHAS = 5;
var CONCURRENT_LFS_UPLOADS = 5;
var MULTIPART_PARALLEL_UPLOAD = 5;
function isFileOperation(op) {
  const ret = op.operation === "addOrUpdate";
  if (ret && !(op.content instanceof Blob)) {
    throw new TypeError("Precondition failed: op.content should be a Blob");
  }
  return ret;
}
async function* commitIter(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  yield { event: "phase", phase: "preuploading" };
  let useXet = params.useXet ?? true;
  const lfsShas = /* @__PURE__ */ new Map();
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  if (!abortSignal.throwIfAborted) {
    abortSignal.throwIfAborted = () => {
      if (abortSignal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
    };
  }
  if (params.abortSignal) {
    params.abortSignal.addEventListener("abort", () => abortController.abort());
  }
  try {
    const allOperations = (await Promise.all(
      params.operations.map(async (operation) => {
        if (operation.operation === "edit") {
          const splicedBlob = SplicedBlob.create(
            operation.originalContent,
            operation.edits.map((splice) => ({ insert: splice.content, start: splice.start, end: splice.end }))
          );
          return {
            operation: "addOrUpdate",
            path: operation.path,
            content: splicedBlob
          };
        }
        if (operation.operation !== "addOrUpdate") {
          return operation;
        }
        if (!(operation.content instanceof URL)) {
          return { ...operation, content: operation.content };
        }
        const lazyBlobs = await createBlobs(operation.content, operation.path, {
          fetch: params.fetch,
          maxFolderDepth: params.maxFolderDepth
        });
        abortSignal?.throwIfAborted();
        return lazyBlobs.map((blob) => ({
          ...operation,
          content: blob.blob,
          path: blob.path
        }));
      })
    )).flat(1);
    const gitAttributes = allOperations.filter(isFileOperation).find((op) => op.path === ".gitattributes")?.content;
    for (const operations of chunk(allOperations.filter(isFileOperation), 100)) {
      const payload = {
        gitAttributes: gitAttributes && await gitAttributes.text(),
        files: await Promise.all(
          operations.map(async (operation) => ({
            path: operation.path,
            size: operation.content.size,
            sample: base64FromBytes(new Uint8Array(await operation.content.slice(0, 512).arrayBuffer()))
          }))
        )
      };
      abortSignal?.throwIfAborted();
      const res = await (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/preupload/${encodeURIComponent(
          params.branch ?? "main"
        )}` + (params.isPullRequest ? "?create_pr=1" : ""),
        {
          method: "POST",
          headers: {
            ...accessToken && { Authorization: `Bearer ${accessToken}` },
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: abortSignal
        }
      );
      if (!res.ok) {
        throw await createApiError(res);
      }
      const json = await res.json();
      for (const file of json.files) {
        if (file.uploadMode === "lfs") {
          lfsShas.set(file.path, null);
        }
      }
    }
    yield { event: "phase", phase: "uploadingLargeFiles" };
    for (const operations of chunk(
      allOperations.filter(isFileOperation).filter((op) => lfsShas.has(op.path)),
      100
    )) {
      const shas = yield* eventToGenerator((yieldCallback, returnCallback, rejectCallack) => {
        return promisesQueue(
          operations.map((op) => async () => {
            const iterator = sha256(op.content, { useWebWorker: params.useWebWorkers, abortSignal });
            let res2;
            do {
              res2 = await iterator.next();
              if (!res2.done) {
                yieldCallback({ event: "fileProgress", path: op.path, progress: res2.value, state: "hashing" });
              }
            } while (!res2.done);
            const sha = res2.value;
            lfsShas.set(op.path, res2.value);
            return sha;
          }),
          CONCURRENT_SHAS
        ).then(returnCallback, rejectCallack);
      });
      abortSignal?.throwIfAborted();
      const payload = {
        operation: "upload",
        // multipart is a custom protocol for HF
        transfers: ["basic", "multipart", ...useXet ? ["xet"] : []],
        hash_algo: "sha_256",
        ...!params.isPullRequest && {
          ref: {
            name: params.branch ?? "main"
          }
        },
        objects: operations.map((op, i) => ({
          oid: shas[i],
          size: op.content.size
        }))
      };
      const res = await (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/${repoId.type === "model" ? "" : repoId.type + "s/"}${repoId.name}.git/info/lfs/objects/batch`,
        {
          method: "POST",
          headers: {
            ...accessToken && { Authorization: `Bearer ${accessToken}` },
            Accept: "application/vnd.git-lfs+json",
            "Content-Type": "application/vnd.git-lfs+json"
          },
          body: JSON.stringify(payload),
          signal: abortSignal
        }
      );
      if (!res.ok) {
        throw await createApiError(res);
      }
      const json = await res.json();
      const batchRequestId = res.headers.get("X-Request-Id") || void 0;
      const shaToOperation = new Map(operations.map((op, i) => [shas[i], op]));
      if (useXet && json.transfer !== "xet") {
        useXet = false;
      }
      let xetParams = null;
      if (useXet) {
        for (const obj of json.objects) {
          const op = shaToOperation.get(obj.oid);
          if (!op) {
            throw new InvalidApiResponseFormatError("Unrequested object ID in response");
          }
          if (obj.error) {
            const errorMessage = `Error while doing LFS batch call for ${operations[shas.indexOf(obj.oid)].path}: ${obj.error.message}${batchRequestId ? ` - Request ID: ${batchRequestId}` : ""}`;
            throw new HubApiError(res.url, obj.error.code, batchRequestId, errorMessage);
          }
          if (!obj.actions?.upload) {
            yield {
              event: "fileProgress",
              path: op.path,
              progress: 1,
              state: "uploading"
            };
          } else {
            const headers = new Headers(obj.actions.upload.header);
            xetParams = {
              sessionId: headers.get("X-Xet-Session-Id") ?? void 0,
              casUrl: headers.get("X-Xet-Cas-Url") ?? void 0,
              accessToken: headers.get("X-Xet-Access-Token") ?? void 0,
              expiresAt: headers.get("X-Xet-Token-Expiration") ? new Date(parseInt(headers.get("X-Xet-Token-Expiration") ?? "0") * 1e3) : void 0,
              refreshWriteTokenUrl: obj.actions.upload.href
            };
          }
        }
        const source = async function* () {
          for (const obj of json.objects) {
            const op = shaToOperation.get(obj.oid);
            if (!op || !obj.actions?.upload) {
              continue;
            }
            abortSignal?.throwIfAborted();
            yield { content: op.content, path: op.path, sha256: obj.oid };
          }
        }();
        if (xetParams) {
          const fixedXetParams = xetParams;
          const sources = splitAsyncGenerator(source, 5);
          yield* eventToGenerator(
            (yieldCallback, returnCallback, rejectCallback) => Promise.all(
              sources.map(async function(source2) {
                for await (const event of uploadShards(source2, {
                  fetch: params.fetch,
                  accessToken,
                  hubUrl: params.hubUrl ?? HUB_URL,
                  repo: repoId,
                  xetParams: fixedXetParams,
                  // todo: maybe leave empty if PR?
                  rev: params.branch ?? "main",
                  isPullRequest: params.isPullRequest,
                  yieldCallback: (event2) => yieldCallback({ ...event2, state: "uploading" })
                })) {
                  if (event.event === "file") {
                    yieldCallback({
                      event: "fileProgress",
                      path: event.path,
                      progress: 1,
                      state: "uploading"
                    });
                  } else if (event.event === "fileProgress") {
                    yieldCallback({
                      event: "fileProgress",
                      path: event.path,
                      progress: event.progress,
                      state: "uploading"
                    });
                  }
                }
              })
            ).then(() => returnCallback(void 0), rejectCallback)
          );
        } else {
        }
      } else {
        yield* eventToGenerator((yieldCallback, returnCallback, rejectCallback) => {
          return promisesQueueStreaming(
            json.objects.map((obj) => async () => {
              const op = shaToOperation.get(obj.oid);
              if (!op) {
                throw new InvalidApiResponseFormatError("Unrequested object ID in response");
              }
              abortSignal?.throwIfAborted();
              if (obj.error) {
                const errorMessage = `Error while doing LFS batch call for ${operations[shas.indexOf(obj.oid)].path}: ${obj.error.message}${batchRequestId ? ` - Request ID: ${batchRequestId}` : ""}`;
                throw new HubApiError(res.url, obj.error.code, batchRequestId, errorMessage);
              }
              if (!obj.actions?.upload) {
                yieldCallback({
                  event: "fileProgress",
                  path: op.path,
                  progress: 1,
                  state: "uploading"
                });
                return;
              }
              yieldCallback({
                event: "fileProgress",
                path: op.path,
                progress: 0,
                state: "uploading"
              });
              const content = op.content;
              const header = obj.actions.upload.header;
              if (header?.chunk_size) {
                const chunkSize = parseInt(header.chunk_size);
                const completionUrl = obj.actions.upload.href;
                const parts = Object.keys(header).filter((key) => /^[0-9]+$/.test(key));
                if (parts.length !== Math.ceil(content.size / chunkSize)) {
                  throw new Error("Invalid server response to upload large LFS file, wrong number of parts");
                }
                const completeReq = {
                  oid: obj.oid,
                  parts: parts.map((part) => ({
                    partNumber: +part,
                    etag: ""
                  }))
                };
                const progressCallback = (progress) => yieldCallback({ event: "fileProgress", path: op.path, progress, state: "uploading" });
                await promisesQueueStreaming(
                  parts.map((part) => async () => {
                    abortSignal?.throwIfAborted();
                    const index = parseInt(part) - 1;
                    const slice = content.slice(index * chunkSize, (index + 1) * chunkSize);
                    const res3 = await (params.fetch ?? fetch)(header[part], {
                      method: "PUT",
                      /** Unfortunately, browsers don't support our inherited version of Blob in fetch calls */
                      body: slice instanceof WebBlob && isFrontend ? await slice.arrayBuffer() : slice,
                      signal: abortSignal,
                      ...{
                        progressHint: {
                          path: op.path,
                          part: index,
                          numParts: parts.length,
                          progressCallback
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      }
                    });
                    if (!res3.ok) {
                      throw await createApiError(res3, {
                        requestId: batchRequestId,
                        message: `Error while uploading part ${part} of ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                      });
                    }
                    const eTag = res3.headers.get("ETag");
                    if (!eTag) {
                      throw new Error("Cannot get ETag of part during multipart upload");
                    }
                    completeReq.parts[Number(part) - 1].etag = eTag;
                  }),
                  MULTIPART_PARALLEL_UPLOAD
                );
                abortSignal?.throwIfAborted();
                const res2 = await (params.fetch ?? fetch)(completionUrl, {
                  method: "POST",
                  body: JSON.stringify(completeReq),
                  headers: {
                    Accept: "application/vnd.git-lfs+json",
                    "Content-Type": "application/vnd.git-lfs+json"
                  },
                  signal: abortSignal
                });
                if (!res2.ok) {
                  throw await createApiError(res2, {
                    requestId: batchRequestId,
                    message: `Error completing multipart upload of ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                  });
                }
                yieldCallback({
                  event: "fileProgress",
                  path: op.path,
                  progress: 1,
                  state: "uploading"
                });
              } else {
                const res2 = await (params.fetch ?? fetch)(obj.actions.upload.href, {
                  method: "PUT",
                  headers: {
                    ...batchRequestId ? { "X-Request-Id": batchRequestId } : void 0
                  },
                  /** Unfortunately, browsers don't support our inherited version of Blob in fetch calls */
                  body: content instanceof WebBlob && isFrontend ? await content.arrayBuffer() : content,
                  signal: abortSignal,
                  ...{
                    progressHint: {
                      path: op.path,
                      progressCallback: (progress) => yieldCallback({
                        event: "fileProgress",
                        path: op.path,
                        progress,
                        state: "uploading"
                      })
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  }
                });
                if (!res2.ok) {
                  throw await createApiError(res2, {
                    requestId: batchRequestId,
                    message: `Error while uploading ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                  });
                }
                yieldCallback({
                  event: "fileProgress",
                  path: op.path,
                  progress: 1,
                  state: "uploading"
                });
              }
            }),
            CONCURRENT_LFS_UPLOADS
          ).then(returnCallback, rejectCallback);
        });
      }
    }
    abortSignal?.throwIfAborted();
    yield { event: "phase", phase: "committing" };
    return yield* eventToGenerator(
      async (yieldCallback, returnCallback, rejectCallback) => (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commit/${encodeURIComponent(
          params.branch ?? "main"
        )}` + (params.isPullRequest ? "?create_pr=1" : ""),
        {
          method: "POST",
          headers: {
            ...accessToken && { Authorization: `Bearer ${accessToken}` },
            "Content-Type": "application/x-ndjson"
          },
          body: [
            {
              key: "header",
              value: {
                summary: params.title,
                description: params.description,
                parentCommit: params.parentCommit
              }
            },
            ...await Promise.all(
              allOperations.map((operation) => {
                if (isFileOperation(operation)) {
                  const sha = lfsShas.get(operation.path);
                  if (sha) {
                    return {
                      key: "lfsFile",
                      value: {
                        path: operation.path,
                        algo: "sha256",
                        size: operation.content.size,
                        oid: sha
                      }
                    };
                  }
                }
                return convertOperationToNdJson(operation);
              })
            )
          ].map((x) => JSON.stringify(x)).join("\n"),
          signal: abortSignal,
          ...{
            progressHint: {
              progressCallback: (progress) => {
                for (const op of allOperations) {
                  if (isFileOperation(op) && !lfsShas.has(op.path)) {
                    yieldCallback({
                      event: "fileProgress",
                      path: op.path,
                      progress,
                      state: "uploading"
                    });
                  }
                }
              }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }
        }
      ).then(async (res) => {
        if (!res.ok) {
          throw await createApiError(res);
        }
        const json = await res.json();
        returnCallback({
          pullRequestUrl: json.pullRequestUrl,
          commit: {
            oid: json.commitOid,
            url: json.commitUrl
          },
          hookOutput: json.hookOutput
        });
      }).catch(rejectCallback)
    );
  } catch (err) {
    abortController.abort();
    throw err;
  }
}
async function convertOperationToNdJson(operation) {
  switch (operation.operation) {
    case "addOrUpdate": {
      return {
        key: "file",
        value: {
          content: base64FromBytes(new Uint8Array(await operation.content.arrayBuffer())),
          path: operation.path,
          encoding: "base64"
        }
      };
    }
    case "delete": {
      return {
        key: "deletedFile",
        value: {
          path: operation.path
        }
      };
    }
    case "edit": {
      throw new Error(
        "Edit operations should be converted to addOrUpdate operations before reaching convertOperationToNdJson"
      );
    }
    default:
      throw new TypeError("Unknown operation: " + operation.operation);
  }
}

// src/lib/create-repo.ts
async function createRepo(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  const [namespace, repoName] = repoId.name.split("/");
  if (!namespace || !repoName) {
    throw new TypeError(
      `"${repoId.name}" is not a fully qualified repo name. It should be of the form "{namespace}/{repoName}".`
    );
  }
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/repos/create`, {
    method: "POST",
    body: JSON.stringify({
      name: repoName,
      private: params.private,
      organization: namespace,
      license: params.license,
      ...repoId.type === "space" ? {
        type: "space",
        sdk: params.sdk ?? "static"
      } : {
        type: repoId.type
      },
      files: params.files ? await Promise.all(
        params.files.map(async (file) => ({
          encoding: "base64",
          path: file.path,
          content: base64FromBytes(
            new Uint8Array(file.content instanceof Blob ? await file.content.arrayBuffer() : file.content)
          )
        }))
      ) : void 0
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  const output = await res.json();
  return { repoUrl: output.url };
}

// src/lib/create-branch.ts
async function createBranch(params) {
  const repoId = toRepoId(params.repo);
  const res = await (params.fetch ?? fetch)(
    `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/branch/${encodeURIComponent(params.branch)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...params.accessToken && {
          Authorization: `Bearer ${params.accessToken}`
        }
      },
      body: JSON.stringify({
        startingPoint: params.revision,
        ...params.empty && { emptyBranch: true },
        overwrite: params.overwrite
      })
    }
  );
  if (!res.ok) {
    throw await createApiError(res);
  }
}

// src/lib/delete-branch.ts
async function deleteBranch(params) {
  const repoId = toRepoId(params.repo);
  const res = await (params.fetch ?? fetch)(
    `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/branch/${encodeURIComponent(params.branch)}`,
    {
      method: "DELETE",
      headers: {
        ...params.accessToken && {
          Authorization: `Bearer ${params.accessToken}`
        }
      }
    }
  );
  if (!res.ok) {
    throw await createApiError(res);
  }
}

// src/lib/delete-repo.ts
async function deleteRepo(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  const [namespace, repoName] = repoId.name.split("/");
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/repos/delete`, {
    method: "DELETE",
    body: JSON.stringify({
      name: repoName,
      organization: namespace,
      type: repoId.type
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
}

// src/lib/download-file-to-cache-dir.ts
var import_node_path2 = require("path");
var import_promises4 = require("fs/promises");

// src/utils/symlink.ts
var fs = __toESM(require("fs/promises"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));

// src/lib/download-file-to-cache-dir.ts
var import_node_stream3 = require("stream");
var import_promises5 = require("stream/promises");
var import_node_fs2 = require("fs");
var REGEX_COMMIT_HASH = new RegExp("^[0-9a-f]{40}$");

// src/utils/typedInclude.ts
function typedInclude(arr, v) {
  return arr.includes(v);
}

// src/lib/repo-exists.ts
async function repoExists(params) {
  const repoId = toRepoId(params.repo);
  const res = await (params.fetch ?? fetch)(
    `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}?expand[]=likes`,
    {
      method: "GET",
      headers: {
        ...params.accessToken && {
          Authorization: `Bearer ${params.accessToken}`
        }
      }
    }
  );
  if (res.status === 404 || res.status === 401) {
    return false;
  }
  if (!res.ok) {
    throw await createApiError(res);
  }
  return true;
}

// src/lib/snapshot-download.ts
var import_node_path3 = require("path");
var import_promises6 = require("fs/promises");

// src/lib/upload-files-with-progress.ts
var multipartUploadTracking = /* @__PURE__ */ new WeakMap();
async function* uploadFilesWithProgress(params) {
  return yield* commitIter({
    ...params.accessToken ? { accessToken: params.accessToken } : { credentials: params.credentials },
    repo: params.repo,
    operations: params.files.map((file) => ({
      operation: "addOrUpdate",
      path: file instanceof URL ? file.pathname.split("/").at(-1) ?? "file" : "path" in file ? file.path : file.name,
      content: "content" in file ? file.content : file
    })),
    title: params.commitTitle ?? `Add ${params.files.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal,
    useXet: params.useXet,
    fetch: async (input, init2) => {
      if (!init2) {
        return fetch(input);
      }
      if (!typedInclude(["PUT", "POST"], init2.method) || !("progressHint" in init2) || !init2.progressHint || typeof XMLHttpRequest === "undefined" || typeof input !== "string" || !(init2.body instanceof ArrayBuffer) && !(init2.body instanceof Blob) && !(init2.body instanceof File) && typeof init2.body !== "string") {
        return fetch(input, init2);
      }
      const progressHint = init2.progressHint;
      const progressCallback = progressHint.progressCallback;
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          if (progressHint.part !== void 0) {
            let tracking = multipartUploadTracking.get(progressCallback);
            if (!tracking) {
              tracking = { numParts: progressHint.numParts, partsProgress: {} };
              multipartUploadTracking.set(progressCallback, tracking);
            }
            tracking.partsProgress[progressHint.part] = event.loaded / event.total;
            let totalProgress = 0;
            for (const partProgress of Object.values(tracking.partsProgress)) {
              totalProgress += partProgress;
            }
            if (totalProgress === tracking.numParts) {
              progressCallback(0.9999999999);
            } else {
              progressCallback(totalProgress / tracking.numParts);
            }
          } else {
            if (event.loaded === event.total) {
              progressCallback(0.9999999999);
            } else {
              progressCallback(event.loaded / event.total);
            }
          }
        }
      });
      xhr.open(init2.method, input, true);
      if (init2.headers) {
        const headers = new Headers(init2.headers);
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });
      }
      init2.signal?.throwIfAborted();
      xhr.send(init2.body);
      return new Promise((resolve3, reject) => {
        xhr.addEventListener("load", () => {
          resolve3(
            new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: Object.fromEntries(
                xhr.getAllResponseHeaders().trim().split("\n").map((header) => [header.slice(0, header.indexOf(":")), header.slice(header.indexOf(":") + 1).trim()])
              )
            })
          );
        });
        xhr.addEventListener("error", () => {
          reject(new Error(xhr.statusText));
        });
        if (init2.signal) {
          init2.signal.addEventListener("abort", () => {
            xhr.abort();
            try {
              init2.signal?.throwIfAborted();
            } catch (err) {
              reject(err);
            }
          });
        }
      });
    }
  });
}

// cli.ts
var import_node_url3 = require("url");
var import_promises7 = require("fs/promises");
var import_node_path4 = require("path");

// package.json
var version = "2.7.1";

// cli.ts
var UploadProgressManager = class {
  multibar = null;
  fileBars = /* @__PURE__ */ new Map();
  isQuiet;
  cliProgressAvailable = false;
  constructor(isQuiet = false) {
    this.isQuiet = isQuiet;
  }
  async initialize() {
    if (this.isQuiet)
      return;
    try {
      const cliProgress = await Promise.resolve().then(() => __toESM(require_cli_progress()));
      this.cliProgressAvailable = true;
      this.multibar = new cliProgress.MultiBar(
        {
          clearOnComplete: false,
          hideCursor: true,
          format: " {bar} | {filename} | {percentage}% | {state}",
          barCompleteChar: "\u2588",
          barIncompleteChar: "\u2591"
        },
        cliProgress.Presets.shades_grey
      );
    } catch (error) {
      this.cliProgressAvailable = false;
    }
  }
  handleEvent(event) {
    if (this.isQuiet)
      return;
    if (event.event === "phase") {
      this.logPhase(event.phase);
    } else if (event.event === "fileProgress") {
      this.updateFileProgress(event.path, event.progress, event.state);
    }
  }
  logPhase(phase) {
    if (this.isQuiet)
      return;
    const phaseMessages = {
      preuploading: "\u{1F4CB} Preparing files for upload...",
      uploadingLargeFiles: "\u2B06\uFE0F  Uploading files...",
      committing: "\u2728 Finalizing commit..."
    };
    console.log(`
${phaseMessages[phase] || phase}`);
  }
  updateFileProgress(path2, progress, state) {
    if (this.isQuiet)
      return;
    if (this.cliProgressAvailable && this.multibar) {
      let bar = this.fileBars.get(path2);
      if (!bar) {
        bar = this.multibar.create(100, 0, {
          filename: this.truncateFilename(path2, 100),
          state
        });
        this.fileBars.set(path2, bar);
      }
      if (progress >= 1) {
        bar.update(100, { state: state === "hashing" ? "\u2713 hashed" : "\u2713 uploaded" });
      } else {
        const percentage = Math.round(progress * 100);
        bar.update(percentage, { state });
      }
    } else {
      const percentage = Math.round(progress * 100);
      const truncatedPath = this.truncateFilename(path2, 100);
      if (progress >= 1) {
        const statusIcon = state === "hashing" ? "\u2713 hashed" : "\u2713 uploaded";
        console.log(`${statusIcon}: ${truncatedPath}`);
      } else if (percentage % 25 === 0) {
        console.log(`${state}: ${truncatedPath} (${percentage}%)`);
      }
    }
  }
  truncateFilename(filename, maxLength) {
    if (filename.length <= maxLength)
      return filename;
    return "..." + filename.slice(-(maxLength - 3));
  }
  stop() {
    if (!this.isQuiet && this.cliProgressAvailable && this.multibar) {
      this.multibar.stop();
    }
  }
};
var commands = {
  upload: {
    description: "Upload a folder to a repo on the Hub",
    args: [
      {
        name: "repo-name",
        description: "The name of the repo to upload to",
        positional: true,
        required: true
      },
      {
        name: "local-folder",
        description: "The local folder to upload. Defaults to the current working directory",
        positional: true,
        default: () => process.cwd()
      },
      {
        name: "path-in-repo",
        description: "The path in the repo to upload the folder to. Defaults to the root of the repo",
        positional: true,
        default: "."
      },
      {
        name: "quiet",
        short: "q",
        description: "Suppress all output",
        boolean: true
      },
      {
        name: "repo-type",
        enum: ["dataset", "model", "space"],
        description: "The type of repo to upload to. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
      },
      {
        name: "revision",
        description: "The revision to upload to. Defaults to the main branch",
        default: "main"
      },
      {
        name: "commit-message",
        description: "The commit message to use. Defaults to 'Upload files using @huggingface/hub'",
        default: "Upload files using @huggingface/hub"
      },
      {
        name: "private",
        description: "If creating a new repo, make it private",
        boolean: true
      },
      {
        name: "token",
        description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
        default: process.env.HF_TOKEN
      }
    ]
  },
  branch: {
    description: "Manage repository branches",
    subcommands: {
      create: {
        description: "Create a new branch in a repo, or update an existing one",
        args: [
          {
            name: "repo-name",
            description: "The name of the repo to create the branch in",
            positional: true,
            required: true
          },
          {
            name: "branch",
            description: "The name of the branch to create",
            positional: true,
            required: true
          },
          {
            name: "repo-type",
            enum: ["dataset", "model", "space"],
            description: "The type of the repo to create the branch into. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
          },
          {
            name: "revision",
            description: "The revision to create the branch from. Defaults to the main branch, or existing branch if it exists."
          },
          {
            name: "empty",
            boolean: true,
            description: "Create an empty branch. This will erase all previous commits on the branch if it exists."
          },
          {
            name: "force",
            short: "f",
            boolean: true,
            description: "Overwrite the branch if it already exists. Otherwise, throws an error if the branch already exists. No-ops if no revision is provided and the branch exists."
          },
          {
            name: "token",
            description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
            default: process.env.HF_TOKEN
          }
        ]
      },
      delete: {
        description: "Delete a branch in a repo",
        args: [
          {
            name: "repo-name",
            description: "The name of the repo to delete the branch from",
            positional: true,
            required: true
          },
          {
            name: "branch",
            description: "The name of the branch to delete",
            positional: true,
            required: true
          },
          {
            name: "repo-type",
            enum: ["dataset", "model", "space"],
            description: "The type of repo to delete the branch from. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
          },
          {
            name: "token",
            description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
            default: process.env.HF_TOKEN
          }
        ]
      }
    }
  },
  repo: {
    description: "Manage repositories on the Hub",
    subcommands: {
      delete: {
        description: "Delete a repository from the Hub",
        args: [
          {
            name: "repo-name",
            description: "The name of the repo to delete. You can also prefix the repo name with the type, e.g. datasets/username/repo-name",
            positional: true,
            required: true
          },
          {
            name: "repo-type",
            enum: ["dataset", "model", "space"],
            description: "The type of the repo to delete. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
          },
          {
            name: "token",
            description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
            default: process.env.HF_TOKEN
          }
        ]
      }
    }
  },
  version: {
    description: "Print the version of the CLI",
    args: []
  }
};
var mainCommandName = process.argv[2];
var subCommandName;
var cliArgs;
if (mainCommandName && mainCommandName in commands && commands[mainCommandName] && "subcommands" in commands[mainCommandName]) {
  subCommandName = process.argv[3];
  cliArgs = process.argv.slice(4);
} else {
  cliArgs = process.argv.slice(3);
}
async function run() {
  switch (mainCommandName) {
    case void 0:
    case "--help":
    case "help": {
      const helpArgs = mainCommandName === "help" ? process.argv.slice(3) : [];
      if (helpArgs.length > 0) {
        const cmdName = helpArgs[0];
        if (cmdName && commands[cmdName]) {
          const cmdDef = commands[cmdName];
          if ("subcommands" in cmdDef) {
            if (helpArgs.length > 1) {
              const subCmdName = helpArgs[1];
              if (subCmdName in cmdDef.subcommands && cmdDef.subcommands[subCmdName]) {
                console.log(detailedUsageForSubcommand(cmdName, subCmdName));
                break;
              } else {
                console.error(`Error: Unknown subcommand '${subCmdName}' for command '${cmdName}'.`);
                console.log(listSubcommands(cmdName, cmdDef));
                process.exitCode = 1;
                break;
              }
            } else {
              console.log(listSubcommands(cmdName, cmdDef));
              break;
            }
          } else {
            console.log(detailedUsageForCommand(cmdName));
            break;
          }
        } else {
          console.error(`Error: Unknown command '${cmdName}' for help.`);
          process.exitCode = 1;
        }
      } else {
        console.log(
          `Hugging Face CLI Tools (hfjs)

Available commands:

` + typedEntries(commands).map(([name, def]) => `  ${usage(name)}: ${def.description}`).join("\n")
        );
        console.log("\nTo get help on a specific command, run `hfjs help <command>` or `hfjs <command> --help`");
        console.log(
          "For commands with subcommands (like 'branch'), run `hfjs help <command> <subcommand>` or `hfjs <command> <subcommand> --help`"
        );
        if (mainCommandName === void 0) {
          process.exitCode = 1;
        }
      }
      break;
    }
    case "upload": {
      const cmdDef = commands.upload;
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        console.log(detailedUsageForCommand("upload"));
        break;
      }
      const parsedArgs = advParseArgs(cliArgs, cmdDef.args, "upload");
      const {
        repoName,
        localFolder,
        repoType,
        revision,
        token,
        quiet,
        commitMessage,
        pathInRepo,
        private: isPrivate
      } = parsedArgs;
      const repoId = repoType ? { type: repoType, name: repoName } : repoName;
      if (!await repoExists({ repo: repoId, revision, accessToken: token, hubUrl: process.env.HF_ENDPOINT ?? HUB_URL })) {
        if (!quiet) {
          console.log(`Repo ${repoName} does not exist. Creating it...`);
        }
        await createRepo({
          repo: repoId,
          accessToken: token,
          private: !!isPrivate,
          hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
        });
      }
      const isFile = (await (0, import_promises7.stat)(localFolder)).isFile();
      const files = isFile ? [
        {
          content: (0, import_node_url3.pathToFileURL)(localFolder),
          path: (0, import_node_path4.join)(pathInRepo, `${(0, import_node_path4.basename)(localFolder)}`).replace(/^[.]?\//, "")
        }
      ] : [{ content: (0, import_node_url3.pathToFileURL)(localFolder), path: pathInRepo.replace(/^[.]?\//, "") }];
      const progressManager = new UploadProgressManager(!!quiet);
      await progressManager.initialize();
      try {
        for await (const event of uploadFilesWithProgress({
          repo: repoId,
          files,
          branch: revision,
          accessToken: token,
          commitTitle: commitMessage?.trim().split("\n")[0],
          commitDescription: commitMessage?.trim().split("\n").slice(1).join("\n").trim(),
          hubUrl: process.env.HF_ENDPOINT ?? HUB_URL,
          useXet: true
        })) {
          progressManager.handleEvent(event);
        }
        if (!quiet) {
          console.log("\n\u2705 Upload completed successfully!");
        }
      } catch (error) {
        progressManager.stop();
        throw error;
      } finally {
        progressManager.stop();
      }
      break;
    }
    case "branch": {
      const branchCommandGroup = commands.branch;
      const currentSubCommandName = subCommandName;
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        if (currentSubCommandName && branchCommandGroup.subcommands[currentSubCommandName]) {
          console.log(detailedUsageForSubcommand("branch", currentSubCommandName));
        } else {
          console.log(listSubcommands("branch", branchCommandGroup));
        }
        break;
      }
      if (!currentSubCommandName || !branchCommandGroup.subcommands[currentSubCommandName]) {
        console.error(`Error: Missing or invalid subcommand for 'branch'.`);
        console.log(listSubcommands("branch", branchCommandGroup));
        process.exitCode = 1;
        break;
      }
      const subCmdDef = branchCommandGroup.subcommands[currentSubCommandName];
      switch (currentSubCommandName) {
        case "create": {
          const parsedArgs = advParseArgs(cliArgs, subCmdDef.args, "branch create");
          const { repoName, branch, revision, empty, repoType, token, force } = parsedArgs;
          await createBranch({
            repo: repoType ? { type: repoType, name: repoName } : repoName,
            branch,
            accessToken: token,
            revision,
            empty: empty ?? void 0,
            overwrite: force ?? void 0,
            hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
          });
          console.log(`Branch '${branch}' created successfully in repo '${repoName}'.`);
          break;
        }
        case "delete": {
          const parsedArgs = advParseArgs(cliArgs, subCmdDef.args, "branch delete");
          const { repoName, branch, repoType, token } = parsedArgs;
          await deleteBranch({
            repo: repoType ? { type: repoType, name: repoName } : repoName,
            branch,
            accessToken: token,
            hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
          });
          console.log(`Branch '${branch}' deleted successfully from repo '${repoName}'.`);
          break;
        }
        default:
          console.error(`Error: Unknown subcommand '${currentSubCommandName}' for 'branch'.`);
          console.log(listSubcommands("branch", branchCommandGroup));
          process.exitCode = 1;
          break;
      }
      break;
    }
    case "repo": {
      const repoCommandGroup = commands.repo;
      const currentSubCommandName = subCommandName;
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        if (currentSubCommandName && repoCommandGroup.subcommands[currentSubCommandName]) {
          console.log(detailedUsageForSubcommand("repo", currentSubCommandName));
        } else {
          console.log(listSubcommands("repo", repoCommandGroup));
        }
        break;
      }
      if (!currentSubCommandName || !repoCommandGroup.subcommands[currentSubCommandName]) {
        console.error(`Error: Missing or invalid subcommand for 'repo'.`);
        console.log(listSubcommands("repo", repoCommandGroup));
        process.exitCode = 1;
        break;
      }
      const subCmdDef = repoCommandGroup.subcommands[currentSubCommandName];
      switch (currentSubCommandName) {
        case "delete": {
          const parsedArgs = advParseArgs(cliArgs, subCmdDef.args, `repo ${currentSubCommandName}`);
          const { repoName, repoType, token } = parsedArgs;
          const repoDesignation = repoType ? { type: repoType, name: repoName } : repoName;
          await deleteRepo({
            repo: repoDesignation,
            accessToken: token,
            hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
          });
          console.log(`Repository '${repoName}' deleted successfully.`);
          break;
        }
        default:
          console.error(`Error: Unknown subcommand '${currentSubCommandName}' for 'repo'.`);
          console.log(listSubcommands("repo", repoCommandGroup));
          process.exitCode = 1;
          break;
      }
      break;
    }
    case "version": {
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        console.log(detailedUsageForCommand("version"));
        break;
      }
      console.log(`hfjs version: ${version}`);
      break;
    }
    default:
      console.error("Command not found: " + mainCommandName);
      console.log(
        `
Available commands:

` + typedEntries(commands).map(([name, def]) => `  ${usage(name)}: ${def.description}`).join("\n")
      );
      console.log("\nTo get help on a specific command, run `hfjs help <command>` or `hfjs <command> --help`");
      process.exitCode = 1;
      break;
  }
}
run().catch((err) => {
  console.error("\x1B[31mError:\x1B[0m", err.message);
  console.error(err);
  process.exitCode = 1;
});
function usage(commandName, subCommandName2) {
  const commandEntry = commands[commandName];
  let cmdArgs;
  let fullCommandName = commandName;
  if ("subcommands" in commandEntry) {
    if (subCommandName2 && subCommandName2 in commandEntry.subcommands) {
      cmdArgs = commandEntry.subcommands[subCommandName2].args;
      fullCommandName = `${commandName} ${subCommandName2}`;
    } else {
      return `${commandName} <subcommand>`;
    }
  } else {
    cmdArgs = commandEntry.args;
  }
  return `${fullCommandName} ${(cmdArgs || []).map((arg) => {
    if (arg.positional) {
      return arg.required ? `<${arg.name}>` : `[${arg.name}]`;
    }
    return `[--${arg.name}${arg.short ? `|-${arg.short}` : ""}${arg.enum ? ` {${arg.enum.join("|")}}` : arg.boolean ? "" : ` <${arg.name.toUpperCase().replace(/-/g, "_")}>`}]`;
  }).join(" ")}`.trim();
}
function _detailedUsage(args, usageLine, commandDescription) {
  let ret = `usage: hfjs ${usageLine}
`;
  if (commandDescription) {
    ret += `
${commandDescription}
`;
  }
  const positionals = args.filter((p) => p.positional);
  const options = args.filter((p) => !p.positional);
  if (positionals.length > 0) {
    ret += `
Positional arguments:
`;
    for (const arg of positionals) {
      ret += `  ${arg.name}	${arg.description}${arg.default ? ` (default: ${typeof arg.default === "function" ? arg.default() : arg.default})` : ""}
`;
    }
  }
  if (options.length > 0) {
    ret += `
Options:
`;
    for (const arg of options) {
      const nameAndAlias = `--${arg.name}${arg.short ? `, -${arg.short}` : ""}`;
      const valueHint = arg.enum ? `{${arg.enum.join("|")}}` : arg.boolean ? "" : `<${arg.name.toUpperCase().replace(/-/g, "_")}>`;
      ret += `  ${nameAndAlias}${valueHint ? " " + valueHint : ""}	${arg.description}${arg.default !== void 0 ? ` (default: ${typeof arg.default === "function" ? arg.default() : arg.default})` : ""}
`;
    }
  }
  ret += `
`;
  return ret;
}
function detailedUsageForCommand(commandName) {
  const commandDef = commands[commandName];
  if ("subcommands" in commandDef) {
    return listSubcommands(commandName, commandDef);
  }
  return _detailedUsage(commandDef.args, usage(commandName), commandDef.description);
}
function detailedUsageForSubcommand(commandName, subCommandName2) {
  const commandGroup = commands[commandName];
  if (!("subcommands" in commandGroup) || !(subCommandName2 in commandGroup.subcommands)) {
    throw new Error(`Subcommand ${subCommandName2} not found for ${commandName}`);
  }
  const subCommandDef = commandGroup.subcommands[subCommandName2];
  return _detailedUsage(subCommandDef.args, usage(commandName, subCommandName2), subCommandDef.description);
}
function listSubcommands(commandName, commandGroup) {
  let ret = `usage: hfjs ${commandName} <subcommand> [options]

`;
  ret += `${commandGroup.description}

`;
  ret += `Available subcommands for '${commandName}':
`;
  ret += typedEntries(commandGroup.subcommands).map(([subName, subDef]) => `  ${subName}	${subDef.description}`).join("\n");
  ret += `

Run \`hfjs help ${commandName} <subcommand>\` for more information on a specific subcommand.`;
  return ret;
}
function advParseArgs(args, argDefs, commandNameForError) {
  const { tokens } = (0, import_node_util.parseArgs)({
    options: Object.fromEntries(
      argDefs.filter((arg) => !arg.positional).map((arg) => {
        const optionConfig = {
          type: arg.boolean ? "boolean" : "string",
          ...arg.short && { short: arg.short },
          ...arg.default !== void 0 && {
            default: typeof arg.default === "function" ? arg.default() : arg.default
          }
        };
        return [arg.name, optionConfig];
      })
    ),
    args,
    allowPositionals: true,
    strict: false,
    // We do custom validation based on tokens and argDefs
    tokens: true
  });
  const expectedPositionals = argDefs.filter((arg) => arg.positional);
  const providedPositionalTokens = tokens.filter((token) => token.kind === "positional");
  if (providedPositionalTokens.length < expectedPositionals.filter((arg) => arg.required).length) {
    throw new Error(
      `Command '${commandNameForError}': Missing required positional arguments. Usage: hfjs ${usage(
        commandNameForError.split(" ")[0],
        commandNameForError.split(" ")[1]
      )}`
    );
  }
  if (providedPositionalTokens.length > expectedPositionals.length) {
    throw new Error(
      `Command '${commandNameForError}': Too many positional arguments. Usage: hfjs ${usage(
        commandNameForError.split(" ")[0],
        commandNameForError.split(" ")[1]
      )}`
    );
  }
  const result = {};
  for (const argDef of argDefs) {
    if (argDef.default !== void 0) {
      result[argDef.name] = typeof argDef.default === "function" ? argDef.default() : argDef.default;
    } else if (argDef.boolean) {
      result[argDef.name] = false;
    }
  }
  providedPositionalTokens.forEach((token, i) => {
    if (expectedPositionals[i]) {
      result[expectedPositionals[i].name] = token.value;
    }
  });
  tokens.filter((token) => token.kind === "option").forEach((token) => {
    const argDef = argDefs.find((def) => def.name === token.name || def.short === token.name);
    if (!argDef) {
      throw new Error(`Command '${commandNameForError}': Unknown option: ${token.rawName}`);
    }
    if (argDef.boolean) {
      result[argDef.name] = true;
    } else {
      if (token.value === void 0) {
        throw new Error(`Command '${commandNameForError}': Missing value for option: ${token.rawName}`);
      }
      if (argDef.enum && !argDef.enum.includes(token.value)) {
        throw new Error(
          `Command '${commandNameForError}': Invalid value '${token.value}' for option ${token.rawName}. Expected one of: ${argDef.enum.join(", ")}`
        );
      }
      result[argDef.name] = token.value;
    }
  });
  for (const argDef of argDefs) {
    if (argDef.required && result[argDef.name] === void 0) {
      throw new Error(`Command '${commandNameForError}': Missing required argument: ${argDef.name}`);
    }
  }
  return Object.fromEntries(
    Object.entries(result).map(([name, val]) => [kebabToCamelCase(name), val])
  );
}
function kebabToCamelCase(str) {
  return str.replace(/-./g, (match) => match[1].toUpperCase());
}
