import "./chunk-QXAXOUZS.mjs";

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

// src/lib/check-repo-access.ts
async function checkRepoAccess(params) {
  const accessToken = params && checkCredentials(params);
  const repoId = toRepoId(params.repo);
  const response = await (params.fetch || fetch)(`${params?.hubUrl || HUB_URL}/api/${repoId.type}s/${repoId.name}`, {
    headers: {
      ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    }
  });
  if (!response.ok) {
    throw await createApiError(response);
  }
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
    let resolve2;
    let reject;
    const p = new Promise((res, rej) => {
      resolve2 = res;
      reject = rej;
    });
    promises.push({ p, resolve: resolve2, reject });
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
  const sha256Module = await import("./sha256-wrapper-RIVMC2TM.mjs");
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
      wasmModule = await import("./sha256-wrapper-RIVMC2TM.mjs");
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
    cryptoModule = await import("./sha256-node-TNZ2WHTI.mjs");
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
    const { FileBlob } = await import("./FileBlob-7MRLQ6TG.mjs");
    const { subPaths } = await import("./sub-paths-F6TP7MGR.mjs");
    const paths = await subPaths(url, opts?.maxFolderDepth);
    if (paths.length === 1 && paths[0].relativePath === ".") {
      const blob = await FileBlob.create(url);
      return [{ path: destPath, blob }];
    }
    return Promise.all(
      paths.map(async (path) => ({
        path: `${destPath}/${path.relativePath}`.replace(/\/[.]$/, "").replaceAll("//", "/").replace(/^[.]?\//, ""),
        blob: await FileBlob.create(new URL(path.path))
      }))
    );
  }
  throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
}

// src/utils/combineUint8Arrays.ts
function combineUint8Arrays(a, b) {
  const aLength = a.length;
  const combinedBytes = new Uint8Array(aLength + b.length);
  combinedBytes.set(a);
  combinedBytes.set(b, aLength);
  return combinedBytes;
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
function readU64(b, n) {
  let x = 0;
  x |= b[n++] << 0;
  x |= b[n++] << 8;
  x |= b[n++] << 16;
  x |= b[n++] << 24;
  x |= b[n++] << 32;
  x |= b[n++] << 40;
  x |= b[n++] << 48;
  x |= b[n++] << 56;
  return x;
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
var fdContentChksum = 4;
var fdContentSize = 8;
var fdBlockChksum = 16;
var fdVersion = 64;
var fdVersionMask = 192;
var bsUncompressed = 2147483648;
var bsDefault = 7;
var bsShift = 4;
var bsMask = 7;
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
function decompressBound(src) {
  let sIndex = 0;
  if (readU32(src, sIndex) !== magicNum) {
    throw new Error("invalid magic number");
  }
  sIndex += 4;
  const descriptor = src[sIndex++];
  if ((descriptor & fdVersionMask) !== fdVersion) {
    throw new Error("incompatible descriptor version " + (descriptor & fdVersionMask));
  }
  const useBlockSum = (descriptor & fdBlockChksum) !== 0;
  const useContentSize = (descriptor & fdContentSize) !== 0;
  const bsIdx = src[sIndex++] >> bsShift & bsMask;
  if (bsMap[bsIdx] === void 0) {
    throw new Error("invalid block size " + bsIdx);
  }
  const maxBlockSize = bsMap[bsIdx];
  if (useContentSize) {
    return readU64(src, sIndex);
  }
  sIndex++;
  let maxSize = 0;
  while (true) {
    let blockSize = readU32(src, sIndex);
    sIndex += 4;
    if (blockSize & bsUncompressed) {
      blockSize &= ~bsUncompressed;
      maxSize += blockSize;
    } else if (blockSize > 0) {
      maxSize += maxBlockSize;
    }
    if (blockSize === 0) {
      return maxSize;
    }
    if (useBlockSum) {
      sIndex += 4;
    }
    sIndex += blockSize;
  }
}
function decompressBlock(src, dst, sIndex, sLength, dIndex) {
  let mLength, mOffset, sEnd, n, i;
  const hasCopyWithin = dst.copyWithin !== void 0 && dst.fill !== void 0;
  sEnd = sIndex + sLength;
  while (sIndex < sEnd) {
    const token = src[sIndex++];
    let literalCount = token >> 4;
    if (literalCount > 0) {
      if (literalCount === 15) {
        while (true) {
          literalCount += src[sIndex];
          if (src[sIndex++] !== 255) {
            break;
          }
        }
      }
      for (n = sIndex + literalCount; sIndex < n; ) {
        dst[dIndex++] = src[sIndex++];
      }
    }
    if (sIndex >= sEnd) {
      break;
    }
    mLength = token & 15;
    mOffset = src[sIndex++] | src[sIndex++] << 8;
    if (mLength === 15) {
      while (true) {
        mLength += src[sIndex];
        if (src[sIndex++] !== 255) {
          break;
        }
      }
    }
    mLength += minMatch;
    if (hasCopyWithin && mOffset === 1) {
      dst.fill(dst[dIndex - 1] | 0, dIndex, dIndex + mLength);
      dIndex += mLength;
    } else if (hasCopyWithin && mOffset > mLength && mLength > 31) {
      dst.copyWithin(dIndex, dIndex - mOffset, dIndex - mOffset + mLength);
      dIndex += mLength;
    } else {
      for (i = dIndex - mOffset, n = i + mLength; i < n; ) {
        dst[dIndex++] = dst[i++] | 0;
      }
    }
  }
  return dIndex;
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
function decompressFrame(src, dst) {
  let useBlockSum, useContentSum, useContentSize, descriptor;
  let sIndex = 0;
  let dIndex = 0;
  if (readU32(src, sIndex) !== magicNum) {
    throw new Error("invalid magic number");
  }
  sIndex += 4;
  descriptor = src[sIndex++];
  if ((descriptor & fdVersionMask) !== fdVersion) {
    throw new Error("incompatible descriptor version");
  }
  useBlockSum = (descriptor & fdBlockChksum) !== 0;
  useContentSum = (descriptor & fdContentChksum) !== 0;
  useContentSize = (descriptor & fdContentSize) !== 0;
  const bsIdx = src[sIndex++] >> bsShift & bsMask;
  if (bsMap[bsIdx] === void 0) {
    throw new Error("invalid block size");
  }
  if (useContentSize) {
    sIndex += 8;
  }
  sIndex++;
  while (true) {
    var compSize;
    compSize = readU32(src, sIndex);
    sIndex += 4;
    if (compSize === 0) {
      break;
    }
    if (useBlockSum) {
      sIndex += 4;
    }
    if ((compSize & bsUncompressed) !== 0) {
      compSize &= ~bsUncompressed;
      for (let j = 0; j < compSize; j++) {
        dst[dIndex++] = src[sIndex++];
      }
    } else {
      dIndex = decompressBlock(src, dst, sIndex, compSize, dIndex);
      sIndex += compSize;
    }
  }
  if (useContentSum) {
    sIndex += 4;
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
function decompress(src, maxSize) {
  let dst, size;
  if (maxSize === void 0) {
    maxSize = decompressBound(src);
  }
  dst = makeBuffer(maxSize);
  size = decompressFrame(src, dst);
  if (size !== maxSize) {
    dst = sliceArray(dst, 0, size);
  }
  return dst;
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

// src/utils/RangeList.ts
var RangeList = class {
  ranges = [];
  /**
   * Add a range to the list. If it overlaps with existing ranges,
   * it will split them and increment reference counts accordingly.
   */
  add(start, end) {
    if (end <= start) {
      throw new TypeError("End must be greater than start");
    }
    const overlappingRanges = [];
    for (let i = 0; i < this.ranges.length; i++) {
      const range2 = this.ranges[i];
      if (start < range2.end && end > range2.start) {
        overlappingRanges.push({ index: i, range: range2 });
      }
      if (range2.data !== null) {
        throw new Error("Overlapping range already has data");
      }
    }
    if (overlappingRanges.length === 0) {
      this.ranges.push({ start, end, refCount: 1, data: null });
      this.ranges.sort((a, b) => a.start - b.start);
      return;
    }
    const newRanges = [];
    let currentPos = start;
    for (let i = 0; i < overlappingRanges.length; i++) {
      const { range: range2 } = overlappingRanges[i];
      if (currentPos < range2.start) {
        newRanges.push({
          start: currentPos,
          end: range2.start,
          refCount: 1,
          data: null
        });
      } else if (range2.start < currentPos) {
        newRanges.push({
          start: range2.start,
          end: currentPos,
          refCount: range2.refCount,
          data: null
        });
      }
      newRanges.push({
        start: Math.max(currentPos, range2.start),
        end: Math.min(end, range2.end),
        refCount: range2.refCount + 1,
        data: null
      });
      if (range2.end > end) {
        newRanges.push({
          start: end,
          end: range2.end,
          refCount: range2.refCount,
          data: null
        });
      }
      currentPos = Math.max(currentPos, range2.end);
    }
    if (currentPos < end) {
      newRanges.push({
        start: currentPos,
        end,
        refCount: 1,
        data: null
      });
    }
    const firstIndex = overlappingRanges[0].index;
    const lastIndex = overlappingRanges[overlappingRanges.length - 1].index;
    this.ranges.splice(firstIndex, lastIndex - firstIndex + 1, ...newRanges);
    this.ranges.sort((a, b) => a.start - b.start);
  }
  /**
   * Remove a range from the list. The range must start and end at existing boundaries.
   */
  remove(start, end) {
    if (end <= start) {
      throw new TypeError("End must be greater than start");
    }
    const affectedRanges = [];
    for (let i = 0; i < this.ranges.length; i++) {
      const range2 = this.ranges[i];
      if (start < range2.end && end > range2.start) {
        affectedRanges.push({ index: i, range: range2 });
      }
    }
    if (affectedRanges.length === 0) {
      throw new Error("No ranges found to remove");
    }
    if (start !== affectedRanges[0].range.start || end !== affectedRanges[affectedRanges.length - 1].range.end) {
      throw new Error("Range boundaries must match existing boundaries");
    }
    for (let i = 0; i < affectedRanges.length; i++) {
      const { range: range2 } = affectedRanges[i];
      range2.refCount--;
    }
    this.ranges = this.ranges.filter((range2) => range2.refCount > 0);
  }
  /**
   * Get all ranges within the specified boundaries.
   */
  getRanges(start, end) {
    if (end <= start) {
      throw new TypeError("End must be greater than start");
    }
    return this.ranges.filter((range2) => start < range2.end && end > range2.start);
  }
  /**
   * Get all ranges in the list
   */
  getAllRanges() {
    return [...this.ranges];
  }
};

// src/utils/XetBlob.ts
var JWT_SAFETY_PERIOD = 6e4;
var JWT_CACHE_SIZE = 1e3;
var compressionSchemeLabels = {
  [0 /* None */]: "None",
  [1 /* LZ4 */]: "LZ4",
  [2 /* ByteGroupingLZ4 */]: "ByteGroupingLZ4"
};
var XET_CHUNK_HEADER_BYTES = 8;
var XetBlob = class extends Blob {
  fetch;
  accessToken;
  refreshUrl;
  reconstructionUrl;
  hash;
  start = 0;
  end = 0;
  internalLogging = false;
  reconstructionInfo;
  listener;
  constructor(params) {
    super([]);
    this.fetch = params.fetch ?? fetch.bind(globalThis);
    this.accessToken = checkCredentials(params);
    this.refreshUrl = params.refreshUrl;
    this.end = params.size;
    this.reconstructionUrl = params.reconstructionUrl;
    this.hash = params.hash;
    this.listener = params.listener;
    this.internalLogging = params.internalLogging ?? false;
    this.refreshUrl;
  }
  get size() {
    return this.end - this.start;
  }
  #clone() {
    const blob = new XetBlob({
      fetch: this.fetch,
      hash: this.hash,
      refreshUrl: this.refreshUrl,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      reconstructionUrl: this.reconstructionUrl,
      size: this.size
    });
    blob.accessToken = this.accessToken;
    blob.start = this.start;
    blob.end = this.end;
    blob.reconstructionInfo = this.reconstructionInfo;
    blob.listener = this.listener;
    blob.internalLogging = this.internalLogging;
    return blob;
  }
  slice(start = 0, end = this.size) {
    if (start < 0 || end < 0) {
      new TypeError("Unsupported negative start/end on XetBlob.slice");
    }
    const slice = this.#clone();
    slice.start = this.start + start;
    slice.end = Math.min(this.start + end, this.end);
    if (slice.start !== this.start || slice.end !== this.end) {
      slice.reconstructionInfo = void 0;
    }
    return slice;
  }
  #reconstructionInfoPromise;
  #loadReconstructionInfo() {
    if (this.#reconstructionInfoPromise) {
      return this.#reconstructionInfoPromise;
    }
    this.#reconstructionInfoPromise = (async () => {
      const connParams = await getAccessToken(this.accessToken, this.fetch, this.refreshUrl);
      const resp = await this.fetch(this.reconstructionUrl ?? `${connParams.casUrl}/v1/reconstructions/${this.hash}`, {
        headers: {
          Authorization: `Bearer ${connParams.accessToken}`,
          Range: `bytes=${this.start}-${this.end - 1}`
        }
      });
      if (!resp.ok) {
        throw await createApiError(resp);
      }
      this.reconstructionInfo = await resp.json();
      return this.reconstructionInfo;
    })().finally(() => this.#reconstructionInfoPromise = void 0);
    return this.#reconstructionInfoPromise;
  }
  async #fetch() {
    if (!this.reconstructionInfo) {
      await this.#loadReconstructionInfo();
    }
    const rangeLists = /* @__PURE__ */ new Map();
    if (!this.reconstructionInfo) {
      throw new Error("Failed to load reconstruction info");
    }
    for (const term of this.reconstructionInfo.terms) {
      let rangeList = rangeLists.get(term.hash);
      if (!rangeList) {
        rangeList = new RangeList();
        rangeLists.set(term.hash, rangeList);
      }
      rangeList.add(term.range.start, term.range.end);
    }
    const listener = this.listener;
    const log = this.internalLogging ? (...args) => console.log(...args) : () => {
    };
    async function* readData(reconstructionInfo, customFetch, maxBytes, reloadReconstructionInfo) {
      let totalBytesRead = 0;
      let readBytesToSkip = reconstructionInfo.offset_into_first_range;
      for (const term of reconstructionInfo.terms) {
        if (totalBytesRead >= maxBytes) {
          break;
        }
        const rangeList = rangeLists.get(term.hash);
        if (!rangeList) {
          throw new Error(`Failed to find range list for term ${term.hash}`);
        }
        {
          const termRanges = rangeList.getRanges(term.range.start, term.range.end);
          if (termRanges.every((range2) => range2.data)) {
            log("all data available for term", term.hash, readBytesToSkip);
            rangeLoop:
              for (const range2 of termRanges) {
                for (let chunk2 of range2.data) {
                  if (readBytesToSkip) {
                    const skipped = Math.min(readBytesToSkip, chunk2.byteLength);
                    chunk2 = chunk2.slice(skipped);
                    readBytesToSkip -= skipped;
                    if (!chunk2.byteLength) {
                      continue;
                    }
                  }
                  if (chunk2.byteLength > maxBytes - totalBytesRead) {
                    chunk2 = chunk2.slice(0, maxBytes - totalBytesRead);
                  }
                  totalBytesRead += chunk2.byteLength;
                  yield range2.refCount > 1 ? chunk2.slice() : chunk2;
                  listener?.({ event: "progress", progress: { read: totalBytesRead, total: maxBytes } });
                  if (totalBytesRead >= maxBytes) {
                    break rangeLoop;
                  }
                }
              }
            rangeList.remove(term.range.start, term.range.end);
            continue;
          }
        }
        const fetchInfo = reconstructionInfo.fetch_info[term.hash].find(
          (info) => info.range.start <= term.range.start && info.range.end >= term.range.end
        );
        if (!fetchInfo) {
          throw new Error(
            `Failed to find fetch info for term ${term.hash} and range ${term.range.start}-${term.range.end}`
          );
        }
        log("term", term);
        log("fetchinfo", fetchInfo);
        log("readBytesToSkip", readBytesToSkip);
        let resp = await customFetch(fetchInfo.url, {
          headers: {
            Range: `bytes=${fetchInfo.url_range.start}-${fetchInfo.url_range.end}`
          }
        });
        if (resp.status === 403) {
          reconstructionInfo = await reloadReconstructionInfo();
          resp = await customFetch(fetchInfo.url, {
            headers: {
              Range: `bytes=${fetchInfo.url_range.start}-${fetchInfo.url_range.end}`
            }
          });
        }
        if (!resp.ok) {
          throw await createApiError(resp);
        }
        log(
          "expected content length",
          resp.headers.get("content-length"),
          "range",
          fetchInfo.url_range,
          resp.headers.get("content-range")
        );
        const reader = resp.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get reader from response body");
        }
        let done = false;
        let chunkIndex = fetchInfo.range.start;
        const ranges = rangeList.getRanges(fetchInfo.range.start, fetchInfo.range.end);
        let leftoverBytes = void 0;
        let totalFetchBytes = 0;
        fetchData:
          while (!done && totalBytesRead < maxBytes) {
            const result = await reader.read();
            listener?.({ event: "read" });
            done = result.done;
            log("read", result.value?.byteLength, "bytes", "total read", totalBytesRead, "toSkip", readBytesToSkip);
            if (!result.value) {
              log("no data in result, cancelled", result);
              continue;
            }
            totalFetchBytes += result.value.byteLength;
            if (leftoverBytes) {
              result.value = combineUint8Arrays(leftoverBytes, result.value);
              leftoverBytes = void 0;
            }
            while (totalBytesRead < maxBytes && result.value?.byteLength) {
              if (result.value.byteLength < 8) {
                leftoverBytes = result.value;
                continue fetchData;
              }
              const header = new DataView(result.value.buffer, result.value.byteOffset, XET_CHUNK_HEADER_BYTES);
              const chunkHeader = {
                version: header.getUint8(0),
                compressed_length: header.getUint8(1) | header.getUint8(2) << 8 | header.getUint8(3) << 16,
                compression_scheme: header.getUint8(4),
                uncompressed_length: header.getUint8(5) | header.getUint8(6) << 8 | header.getUint8(7) << 16
              };
              log("chunk header", chunkHeader, "to skip", readBytesToSkip);
              if (chunkHeader.version !== 0) {
                throw new Error(`Unsupported chunk version ${chunkHeader.version}`);
              }
              if (chunkHeader.compression_scheme !== 0 /* None */ && chunkHeader.compression_scheme !== 1 /* LZ4 */ && chunkHeader.compression_scheme !== 2 /* ByteGroupingLZ4 */) {
                throw new Error(
                  `Unsupported compression scheme ${compressionSchemeLabels[chunkHeader.compression_scheme] ?? chunkHeader.compression_scheme}`
                );
              }
              if (result.value.byteLength < chunkHeader.compressed_length + XET_CHUNK_HEADER_BYTES) {
                leftoverBytes = result.value;
                continue fetchData;
              }
              result.value = result.value.slice(XET_CHUNK_HEADER_BYTES);
              let uncompressed = chunkHeader.compression_scheme === 1 /* LZ4 */ ? decompress(result.value.slice(0, chunkHeader.compressed_length), chunkHeader.uncompressed_length) : chunkHeader.compression_scheme === 2 /* ByteGroupingLZ4 */ ? bg4_regroup_bytes(
                decompress(
                  result.value.slice(0, chunkHeader.compressed_length),
                  chunkHeader.uncompressed_length
                )
              ) : result.value.slice(0, chunkHeader.compressed_length);
              const range2 = ranges.find((range3) => chunkIndex >= range3.start && chunkIndex < range3.end);
              const shouldYield = chunkIndex >= term.range.start && chunkIndex < term.range.end;
              const minRefCountToStore = shouldYield ? 2 : 1;
              let stored = false;
              if (range2 && range2.refCount >= minRefCountToStore) {
                range2.data ??= [];
                range2.data.push(uncompressed);
                stored = true;
              }
              if (shouldYield) {
                if (readBytesToSkip) {
                  const skipped = Math.min(readBytesToSkip, uncompressed.byteLength);
                  uncompressed = uncompressed.slice(readBytesToSkip);
                  readBytesToSkip -= skipped;
                }
                if (uncompressed.byteLength > maxBytes - totalBytesRead) {
                  uncompressed = uncompressed.slice(0, maxBytes - totalBytesRead);
                }
                if (uncompressed.byteLength) {
                  log(
                    "yield",
                    uncompressed.byteLength,
                    "bytes",
                    result.value.byteLength,
                    "total read",
                    totalBytesRead,
                    stored
                  );
                  totalBytesRead += uncompressed.byteLength;
                  yield stored ? uncompressed.slice() : uncompressed;
                  listener?.({ event: "progress", progress: { read: totalBytesRead, total: maxBytes } });
                }
              }
              chunkIndex++;
              result.value = result.value.slice(chunkHeader.compressed_length);
            }
          }
        if (done && totalBytesRead < maxBytes && totalFetchBytes < fetchInfo.url_range.end - fetchInfo.url_range.start + 1) {
          log("done", done, "total read", totalBytesRead, maxBytes, totalFetchBytes);
          log("failed to fetch all data for term", term.hash);
          throw new Error(
            `Failed to fetch all data for term ${term.hash}, fetched ${totalFetchBytes} bytes out of ${fetchInfo.url_range.end - fetchInfo.url_range.start + 1}`
          );
        }
        log("done", done, "total read", totalBytesRead, maxBytes, totalFetchBytes);
        log("cancel reader");
        await reader.cancel();
      }
    }
    const iterator = readData(
      this.reconstructionInfo,
      this.fetch,
      this.end - this.start,
      this.#loadReconstructionInfo.bind(this)
    );
    return new ReadableStream(
      {
        // todo: when Safari supports it, type controller as ReadableByteStreamController
        async pull(controller) {
          const result = await iterator.next();
          if (result.value) {
            controller.enqueue(result.value);
          }
          if (result.done) {
            controller.close();
          }
        },
        type: "bytes"
        // todo: when Safari supports it, add autoAllocateChunkSize param
      },
      // todo : use ByteLengthQueuingStrategy when there's good support for it, currently in Node.js it fails due to size being a function
      {
        highWaterMark: 1e3
        // 1_000 chunks for ~1MB of RAM
      }
    );
  }
  async arrayBuffer() {
    const result = await this.#fetch();
    return new Response(result).arrayBuffer();
  }
  async text() {
    const result = await this.#fetch();
    return new Response(result).text();
  }
  async response() {
    const result = await this.#fetch();
    return new Response(result);
  }
  stream() {
    const stream = new TransformStream();
    this.#fetch().then((response) => response.pipeThrough(stream)).catch((error) => stream.writable.abort(error.message));
    return stream.readable;
  }
};
var jwtPromises = /* @__PURE__ */ new Map();
var jwts = /* @__PURE__ */ new Map();
function cacheKey(params) {
  return JSON.stringify([params.refreshUrl, params.initialAccessToken]);
}
function bg4_regroup_bytes(bytes) {
  const split = Math.floor(bytes.byteLength / 4);
  const rem = bytes.byteLength % 4;
  const g1_pos = split + (rem >= 1 ? 1 : 0);
  const g2_pos = g1_pos + split + (rem >= 2 ? 1 : 0);
  const g3_pos = g2_pos + split + (rem == 3 ? 1 : 0);
  const ret = new Uint8Array(bytes.byteLength);
  for (let i = 0, j = 0; i < bytes.byteLength; i += 4, j++) {
    ret[i] = bytes[j];
  }
  for (let i = 1, j = g1_pos; i < bytes.byteLength; i += 4, j++) {
    ret[i] = bytes[j];
  }
  for (let i = 2, j = g2_pos; i < bytes.byteLength; i += 4, j++) {
    ret[i] = bytes[j];
  }
  for (let i = 3, j = g3_pos; i < bytes.byteLength; i += 4, j++) {
    ret[i] = bytes[j];
  }
  return ret;
}
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
async function getAccessToken(initialAccessToken, customFetch, refreshUrl) {
  const key = cacheKey({ refreshUrl, initialAccessToken });
  const jwt = jwts.get(key);
  if (jwt && jwt.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD)) {
    return { accessToken: jwt.accessToken, casUrl: jwt.casUrl };
  }
  const existingPromise = jwtPromises.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = (async () => {
    const resp = await customFetch(refreshUrl, {
      headers: {
        ...initialAccessToken ? {
          Authorization: `Bearer ${initialAccessToken}`
        } : {}
      }
    });
    if (!resp.ok) {
      throw new Error(`Failed to get JWT token: ${resp.status} ${await resp.text()}`);
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
var JWT_SAFETY_PERIOD2 = 6e4;
var JWT_CACHE_SIZE2 = 1e3;
var jwtPromises2 = /* @__PURE__ */ new Map();
var jwts2 = /* @__PURE__ */ new Map();
async function xetWriteToken(params) {
  if (params.xetParams.expiresAt && params.xetParams.casUrl && params.xetParams.accessToken && params.xetParams.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD2)) {
    return { accessToken: params.xetParams.accessToken, casUrl: params.xetParams.casUrl };
  }
  const key = params.xetParams.refreshWriteTokenUrl;
  const jwt = jwts2.get(key);
  if (jwt && jwt.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD2)) {
    return { accessToken: jwt.accessToken, casUrl: jwt.casUrl };
  }
  const existingPromise = jwtPromises2.get(key);
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
    jwtPromises2.delete(key);
    for (const [key2, value] of jwts2.entries()) {
      if (value.expiresAt < new Date(Date.now() + JWT_SAFETY_PERIOD2)) {
        jwts2.delete(key2);
      } else {
        break;
      }
    }
    if (jwts2.size >= JWT_CACHE_SIZE2) {
      const keyToDelete = jwts2.keys().next().value;
      if (keyToDelete) {
        jwts2.delete(keyToDelete);
      }
    }
    jwts2.set(key, jwt2);
    return {
      accessToken: json.accessToken,
      casUrl: json.casUrl
    };
  })();
  jwtPromises2.set(key, promise);
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
  const version = shardView.getBigUint64(SHARD_MAGIC_TAG.length, true);
  if (version !== SHARD_HEADER_VERSION) {
    throw new Error(`Invalid shard version: ${version}`);
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
      files: Object.entries(this.fileProcessedBytes).map(([path, processedBytes]) => ({
        path,
        progress: processedBytes / this.fileSize[path],
        lastSentProgress: ((this.fileUploadedBytes[path] ?? 0) + (processedBytes - (this.fileUploadedBytes[path] ?? 0)) * PROCESSING_PROGRESS_RATIO) / this.fileSize[path]
      }))
    };
  }
};
async function* createXorbs(fileSources, params) {
  const alreadyDoneFileSha256s = /* @__PURE__ */ new Set();
  const chunkModule = await import("./chunker_wasm-3YGRTTMN.mjs");
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
  const sleep = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
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
async function commit(params) {
  const iterator = commitIter(params);
  let res = await iterator.next();
  while (!res.done) {
    res = await iterator.next();
  }
  return res.value;
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

// src/lib/count-commits.ts
async function countCommits(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  const url = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${params.revision ?? "main"}?limit=1`;
  const res = await (params.fetch ?? fetch)(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  return parseInt(res.headers.get("x-total-count") ?? "0", 10);
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

// src/lib/create-collection.ts
async function createCollection(params) {
  const accessToken = checkCredentials(params);
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/collections`, {
    method: "POST",
    body: JSON.stringify(params.collection),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  const output = await res.json();
  return { slug: output.slug };
}

// src/utils/pick.ts
function pick(o, props) {
  return Object.assign(
    {},
    ...props.map((prop) => {
      if (o[prop] !== void 0) {
        return { [prop]: o[prop] };
      }
    })
  );
}

// src/utils/parseLinkHeader.ts
function parseLinkHeader(header) {
  const regex = /<(https?:[/][/][^>]+)>;\s+rel="([^"]+)"/g;
  return Object.fromEntries([...header.matchAll(regex)].map(([, url, rel]) => [rel, url]));
}

// src/lib/list-datasets.ts
var DATASET_EXPAND_KEYS = [
  "private",
  "downloads",
  "gated",
  "likes",
  "lastModified"
];
var DATASET_EXPANDABLE_KEYS = [
  "author",
  "cardData",
  "citation",
  "createdAt",
  "disabled",
  "description",
  "downloads",
  "downloadsAllTime",
  "gated",
  "gitalyUid",
  "lastModified",
  "likes",
  "paperswithcode_id",
  "private",
  // "siblings",
  "sha",
  "tags"
];
async function* listDatasets(params) {
  const accessToken = params && checkCredentials(params);
  let totalToFetch = params?.limit ?? Infinity;
  const search = new URLSearchParams([
    ...Object.entries({
      limit: String(Math.min(totalToFetch, 500)),
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...DATASET_EXPAND_KEYS.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/datasets` + (search ? "?" + search : "");
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        private: item.private,
        downloads: item.downloads,
        likes: item.likes,
        gated: item.gated,
        updatedAt: new Date(item.lastModified)
      };
      totalToFetch--;
      if (totalToFetch <= 0) {
        return;
      }
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/dataset-info.ts
async function datasetInfo(params) {
  const accessToken = params && checkCredentials(params);
  const search = new URLSearchParams([
    ...DATASET_EXPAND_KEYS.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  const response = await (params.fetch || fetch)(
    `${params?.hubUrl || HUB_URL}/api/datasets/${params.name}/revision/${encodeURIComponent(
      params.revision ?? "HEAD"
    )}?${search.toString()}`,
    {
      headers: {
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      }
    }
  );
  if (!response.ok) {
    throw await createApiError(response);
  }
  const data = await response.json();
  return {
    ...params?.additionalFields && pick(data, params.additionalFields),
    id: data._id,
    name: data.id,
    private: data.private,
    downloads: data.downloads,
    likes: data.likes,
    gated: data.gated,
    updatedAt: new Date(data.lastModified)
  };
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

// src/lib/delete-file.ts
function deleteFile(params) {
  return commit({
    ...params.accessToken ? { accessToken: params.accessToken } : { credentials: params.credentials },
    repo: params.repo,
    operations: [
      {
        operation: "delete",
        path: params.path
      }
    ],
    title: params.commitTitle ?? `Delete ${params.path}`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch
  });
}

// src/lib/delete-files.ts
function deleteFiles(params) {
  return commit({
    ...params.accessToken ? { accessToken: params.accessToken } : { credentials: params.credentials },
    repo: params.repo,
    operations: params.paths.map((path) => ({
      operation: "delete",
      path
    })),
    title: params.commitTitle ?? `Deletes ${params.paths.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch
  });
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

// src/lib/delete-collection.ts
async function deleteCollection(params) {
  if (!params.slug) {
    throw new TypeError("slug is required");
  }
  const accessToken = checkCredentials(params);
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/collections/${params.slug}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
}

// src/lib/file-download-info.ts
async function fileDownloadInfo(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  const hubUrl = params.hubUrl ?? HUB_URL;
  const url = `${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/${params.raw ? "raw" : "resolve"}/${encodeURIComponent(params.revision ?? "main")}/${params.path}` + (params.noContentDisposition ? "?noContentDisposition=1" : "");
  const resp = await (params.fetch ?? fetch)(url, {
    method: "GET",
    headers: {
      ...accessToken && {
        Authorization: `Bearer ${accessToken}`
      },
      Range: "bytes=0-0",
      Accept: "application/vnd.xet-fileinfo+json, */*"
    }
  });
  if (resp.status === 404 && resp.headers.get("X-Error-Code") === "EntryNotFound") {
    return null;
  }
  if (!resp.ok) {
    throw await createApiError(resp);
  }
  let size;
  let xetInfo;
  if (resp.headers.get("Content-Type")?.includes("application/vnd.xet-fileinfo+json")) {
    size = parseInt(resp.headers.get("X-Linked-Size") ?? "invalid");
    if (isNaN(size)) {
      throw new InvalidApiResponseFormatError("Invalid file size received in X-Linked-Size header");
    }
    const hash2 = resp.headers.get("X-Xet-Hash");
    const links = parseLinkHeader(resp.headers.get("Link") ?? "");
    const reconstructionUrl = (() => {
      try {
        return new URL(links["xet-reconstruction-info"]);
      } catch {
        return null;
      }
    })();
    const refreshUrl = (() => {
      try {
        return new URL(links["xet-auth"]);
      } catch {
        return null;
      }
    })();
    if (!hash2) {
      throw new InvalidApiResponseFormatError("No hash received in X-Xet-Hash header");
    }
    if (!reconstructionUrl || !refreshUrl) {
      throw new InvalidApiResponseFormatError("No xet-reconstruction-info or xet-auth link header");
    }
    xetInfo = {
      hash: hash2,
      refreshUrl,
      reconstructionUrl
    };
  }
  if (size === void 0 || isNaN(size)) {
    const contentRangeHeader = resp.headers.get("content-range");
    if (!contentRangeHeader) {
      throw new InvalidApiResponseFormatError("Expected size information");
    }
    const [, parsedSize] = contentRangeHeader.split("/");
    size = parseInt(parsedSize);
    if (isNaN(size)) {
      throw new InvalidApiResponseFormatError("Invalid file size received");
    }
  }
  const etag = resp.headers.get("X-Linked-ETag") ?? resp.headers.get("ETag") ?? void 0;
  if (!etag) {
    throw new InvalidApiResponseFormatError("Expected ETag");
  }
  return {
    etag,
    size,
    xet: xetInfo,
    // Cannot use resp.url in case it's a S3 url and the user adds an Authorization header to it.
    url: resp.url && (new URL(resp.url).origin === new URL(hubUrl).origin || resp.headers.get("X-Cache")?.endsWith(" cloudfront")) ? resp.url : url
  };
}

// src/lib/download-file.ts
async function downloadFile(params) {
  const accessToken = checkCredentials(params);
  const info = params.downloadInfo ?? await fileDownloadInfo({
    accessToken,
    repo: params.repo,
    path: params.path,
    revision: params.revision,
    hubUrl: params.hubUrl,
    fetch: params.fetch,
    raw: params.raw
  });
  if (!info) {
    return null;
  }
  if (info.xet && params.xet) {
    return new XetBlob({
      refreshUrl: info.xet.refreshUrl.href,
      reconstructionUrl: info.xet.reconstructionUrl.href,
      fetch: params.fetch,
      accessToken,
      size: info.size
    });
  }
  return new WebBlob(new URL(info.url), 0, info.size, "", true, params.fetch ?? fetch, accessToken);
}

// src/lib/file-exists.ts
async function fileExists(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  const hubUrl = params.hubUrl ?? HUB_URL;
  const url = `${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/raw/${encodeURIComponent(
    params.revision ?? "main"
  )}/${params.path}`;
  const resp = await (params.fetch ?? fetch)(url, {
    method: "HEAD",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  if (resp.status === 404) {
    return false;
  }
  if (!resp.ok) {
    throw await createApiError(resp);
  }
  return true;
}

// src/lib/list-commits.ts
async function* listCommits(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  let url = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${params.revision ?? "main"}?limit=${params.batchSize ?? 100}`;
  while (url) {
    const res = await (params.fetch ?? fetch)(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const resJson = await res.json();
    for (const commit2 of resJson) {
      yield {
        oid: commit2.id,
        title: commit2.title,
        message: commit2.message,
        authors: commit2.authors.map((author) => ({
          username: author.user,
          avatarUrl: author.avatar
        })),
        date: new Date(commit2.date)
      };
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-files.ts
async function* listFiles(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  let url = `${params.hubUrl || HUB_URL}/api/${repoId.type}s/${repoId.name}/tree/${params.revision || "main"}${params.path ? "/" + params.path : ""}?recursive=${!!params.recursive}&expand=${!!params.expand}`;
  while (url) {
    const res = await (params.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield item;
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/utils/normalizeInferenceProviderMapping.ts
function normalizeInferenceProviderMapping(hfModelId, inferenceProviderMapping) {
  if (!inferenceProviderMapping) {
    return [];
  }
  if (Array.isArray(inferenceProviderMapping)) {
    return inferenceProviderMapping.map((entry) => ({
      ...entry,
      hfModelId
    }));
  }
  return Object.entries(inferenceProviderMapping).map(([provider, mapping]) => ({
    provider,
    hfModelId,
    providerId: mapping.providerId,
    status: mapping.status,
    task: mapping.task
  }));
}

// src/lib/list-models.ts
var MODEL_EXPAND_KEYS = [
  "pipeline_tag",
  "private",
  "gated",
  "downloads",
  "likes",
  "lastModified"
];
var MODEL_EXPANDABLE_KEYS = [
  "author",
  "cardData",
  "config",
  "createdAt",
  "disabled",
  "downloads",
  "downloadsAllTime",
  "gated",
  "gitalyUid",
  "inferenceProviderMapping",
  "lastModified",
  "library_name",
  "likes",
  "model-index",
  "pipeline_tag",
  "private",
  "safetensors",
  "sha",
  // "siblings",
  "spaces",
  "tags",
  "transformersInfo"
];
async function* listModels(params) {
  const accessToken = params && checkCredentials(params);
  let totalToFetch = params?.limit ?? Infinity;
  const search = new URLSearchParams([
    ...Object.entries({
      limit: String(Math.min(totalToFetch, 500)),
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.task ? { pipeline_tag: params.search.task } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0,
      ...params?.search?.inferenceProviders ? { inference_provider: params.search.inferenceProviders.join(",") } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...MODEL_EXPAND_KEYS.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/models?${search}`;
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      const normalizedItem = { ...item };
      if (params?.additionalFields?.includes("inferenceProviderMapping") && item.inferenceProviderMapping) {
        normalizedItem.inferenceProviderMapping = normalizeInferenceProviderMapping(
          item.id,
          item.inferenceProviderMapping
        );
      }
      yield {
        ...params?.additionalFields && pick(normalizedItem, params.additionalFields),
        id: item._id,
        name: item.id,
        private: item.private,
        task: item.pipeline_tag,
        downloads: item.downloads,
        gated: item.gated,
        likes: item.likes,
        updatedAt: new Date(item.lastModified)
      };
      totalToFetch--;
      if (totalToFetch <= 0) {
        return;
      }
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-spaces.ts
var SPACE_EXPAND_KEYS = [
  "sdk",
  "likes",
  "private",
  "lastModified"
];
var SPACE_EXPANDABLE_KEYS = [
  "author",
  "cardData",
  "datasets",
  "disabled",
  "gitalyUid",
  "lastModified",
  "createdAt",
  "likes",
  "private",
  "runtime",
  "sdk",
  // "siblings",
  "sha",
  "subdomain",
  "tags",
  "models"
];
async function* listSpaces(params) {
  const accessToken = params && checkCredentials(params);
  const search = new URLSearchParams([
    ...Object.entries({
      limit: "500",
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...[...SPACE_EXPAND_KEYS, ...params?.additionalFields ?? []].map(
      (val) => ["expand", val]
    )
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/spaces?${search}`;
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        sdk: item.sdk,
        likes: item.likes,
        private: item.private,
        updatedAt: new Date(item.lastModified)
      };
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-collections.ts
async function* listCollections(params) {
  const accessToken = params && checkCredentials(params);
  const searchParams = new URLSearchParams();
  let totalToFetch = params?.limit ?? Infinity;
  searchParams.append("limit", String(Math.min(totalToFetch, 100)));
  if (params?.sort) {
    searchParams.append("sort", params.sort);
  }
  if (params?.search?.owner) {
    for (const owner of params.search.owner) {
      searchParams.append("owner", owner);
    }
  }
  if (params?.search?.item) {
    for (const item of params.search.item) {
      searchParams.append("item", item);
    }
  }
  if (params?.search?.q) {
    searchParams.append("q", params.search.q);
  }
  let url = `${params?.hubUrl || HUB_URL}/api/collections?${searchParams}`;
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const collections = await res.json();
    for (const collection of collections) {
      yield collection;
      totalToFetch--;
      if (totalToFetch <= 0) {
        return;
      }
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/model-info.ts
async function modelInfo(params) {
  const accessToken = params && checkCredentials(params);
  const search = new URLSearchParams([
    ...MODEL_EXPAND_KEYS.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  const response = await (params.fetch || fetch)(
    `${params?.hubUrl || HUB_URL}/api/models/${params.name}/revision/${encodeURIComponent(
      params.revision ?? "HEAD"
    )}?${search.toString()}`,
    {
      headers: {
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      }
    }
  );
  if (!response.ok) {
    throw await createApiError(response);
  }
  const data = await response.json();
  const normalizedData = { ...data };
  if (params?.additionalFields?.includes("inferenceProviderMapping") && data.inferenceProviderMapping) {
    normalizedData.inferenceProviderMapping = normalizeInferenceProviderMapping(data.id, data.inferenceProviderMapping);
  }
  return {
    ...params?.additionalFields && pick(normalizedData, params.additionalFields),
    id: data._id,
    name: data.id,
    private: data.private,
    task: data.pipeline_tag,
    downloads: data.downloads,
    gated: data.gated,
    likes: data.likes,
    updatedAt: new Date(data.lastModified)
  };
}

// src/lib/oauth-handle-redirect.ts
async function oauthHandleRedirect(opts) {
  if (typeof window === "undefined" && !opts?.redirectedUrl) {
    throw new Error("oauthHandleRedirect is only available in the browser, unless you provide redirectedUrl");
  }
  if (typeof localStorage === "undefined" && (!opts?.nonce || !opts?.codeVerifier)) {
    throw new Error(
      "oauthHandleRedirect requires localStorage to be available, unless you provide nonce and codeVerifier"
    );
  }
  const redirectedUrl = opts?.redirectedUrl ?? window.location.href;
  const searchParams = (() => {
    try {
      return new URL(redirectedUrl).searchParams;
    } catch (err) {
      throw new Error("Failed to parse redirected URL: " + redirectedUrl);
    }
  })();
  const [error, errorDescription] = [searchParams.get("error"), searchParams.get("error_description")];
  if (error) {
    throw new Error(`${error}: ${errorDescription}`);
  }
  const code = searchParams.get("code");
  const nonce = opts?.nonce ?? localStorage.getItem("huggingface.co:oauth:nonce");
  if (!code) {
    throw new Error("Missing oauth code from query parameters in redirected URL: " + redirectedUrl);
  }
  if (!nonce) {
    throw new Error("Missing oauth nonce from localStorage");
  }
  const codeVerifier = opts?.codeVerifier ?? localStorage.getItem("huggingface.co:oauth:code_verifier");
  if (!codeVerifier) {
    throw new Error("Missing oauth code_verifier from localStorage");
  }
  const state = searchParams.get("state");
  if (!state) {
    throw new Error("Missing oauth state from query parameters in redirected URL");
  }
  let parsedState;
  try {
    parsedState = JSON.parse(state);
  } catch {
    throw new Error("Invalid oauth state in redirected URL, unable to parse JSON: " + state);
  }
  if (parsedState.nonce !== nonce) {
    throw new Error("Invalid oauth state in redirected URL");
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const openidConfig = await openidConfigRes.json();
  const tokenRes = await fetch(openidConfig.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: parsedState.redirectUri,
      code_verifier: codeVerifier
    }).toString()
  });
  if (!opts?.codeVerifier) {
    localStorage.removeItem("huggingface.co:oauth:code_verifier");
  }
  if (!opts?.nonce) {
    localStorage.removeItem("huggingface.co:oauth:nonce");
  }
  if (!tokenRes.ok) {
    throw await createApiError(tokenRes);
  }
  const token = await tokenRes.json();
  const accessTokenExpiresAt = new Date(Date.now() + token.expires_in * 1e3);
  const userInfoRes = await fetch(openidConfig.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });
  if (!userInfoRes.ok) {
    throw await createApiError(userInfoRes);
  }
  const userInfo = await userInfoRes.json();
  return {
    accessToken: token.access_token,
    accessTokenExpiresAt,
    userInfo,
    state: parsedState.state,
    scope: token.scope
  };
}
async function oauthHandleRedirectIfPresent(opts) {
  if (typeof window === "undefined" && !opts?.redirectedUrl) {
    throw new Error("oauthHandleRedirect is only available in the browser, unless you provide redirectedUrl");
  }
  if (typeof localStorage === "undefined" && (!opts?.nonce || !opts?.codeVerifier)) {
    throw new Error(
      "oauthHandleRedirect requires localStorage to be available, unless you provide nonce and codeVerifier"
    );
  }
  const searchParams = new URLSearchParams(opts?.redirectedUrl ?? window.location.search);
  if (searchParams.has("error")) {
    return oauthHandleRedirect(opts);
  }
  if (searchParams.has("code")) {
    if (!localStorage.getItem("huggingface.co:oauth:nonce")) {
      console.warn(
        "Missing oauth nonce from localStorage. This can happen when the user refreshes the page after logging in, without changing the URL."
      );
      return false;
    }
    return oauthHandleRedirect(opts);
  }
  return false;
}

// src/lib/oauth-login-url.ts
async function oauthLoginUrl(opts) {
  if (typeof window === "undefined" && (!opts?.redirectUrl || !opts?.clientId)) {
    throw new Error("oauthLogin is only available in the browser, unless you provide clientId and redirectUrl");
  }
  if (typeof localStorage === "undefined" && !opts?.localStorage) {
    throw new Error(
      "oauthLogin requires localStorage to be available in the context, unless you provide a localStorage empty object as argument"
    );
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const opendidConfig = await openidConfigRes.json();
  const newNonce = globalThis.crypto.randomUUID();
  const newCodeVerifier = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
  if (opts?.localStorage) {
    if (opts.localStorage.codeVerifier !== void 0 && opts.localStorage.codeVerifier !== null) {
      throw new Error(
        "localStorage.codeVerifier must be initially set to null or undefined, and will be filled by oauthLoginUrl"
      );
    }
    if (opts.localStorage.nonce !== void 0 && opts.localStorage.nonce !== null) {
      throw new Error(
        "localStorage.nonce must be initially set to null or undefined, and will be filled by oauthLoginUrl"
      );
    }
    opts.localStorage.codeVerifier = newCodeVerifier;
    opts.localStorage.nonce = newNonce;
  } else {
    localStorage.setItem("huggingface.co:oauth:nonce", newNonce);
    localStorage.setItem("huggingface.co:oauth:code_verifier", newCodeVerifier);
  }
  const redirectUri = opts?.redirectUrl || (typeof window !== "undefined" ? window.location.href : void 0);
  if (!redirectUri) {
    throw new Error("Missing redirectUrl");
  }
  const state = JSON.stringify({
    nonce: newNonce,
    redirectUri,
    state: opts?.state
  });
  const variables = (
    // @ts-expect-error window.huggingface is defined inside static Spaces.
    typeof window !== "undefined" ? window.huggingface?.variables ?? null : null
  );
  const clientId = opts?.clientId || variables?.OAUTH_CLIENT_ID;
  if (!clientId) {
    if (variables) {
      throw new Error("Missing clientId, please add hf_oauth: true to the README.md's metadata in your static Space");
    }
    throw new Error("Missing clientId");
  }
  const challenge = base64FromBytes(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(newCodeVerifier)))
  ).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=/g, "");
  return `${opendidConfig.authorization_endpoint}?${new URLSearchParams({
    client_id: clientId,
    scope: opts?.scopes || variables?.OAUTH_SCOPES || "openid profile",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString()}`;
}

// src/utils/typedInclude.ts
function typedInclude(arr, v) {
  return arr.includes(v);
}

// src/utils/omit.ts
function omit(o, props) {
  const propsArr = Array.isArray(props) ? props : [props];
  const letsKeep = Object.keys(o).filter((prop) => !typedInclude(propsArr, prop));
  return pick(o, letsKeep);
}

// src/utils/typedEntries.ts
function typedEntries(obj) {
  return Object.entries(obj);
}

// src/lib/parse-safetensors-metadata.ts
var SAFETENSORS_FILE = "model.safetensors";
var SAFETENSORS_INDEX_FILE = "model.safetensors.index.json";
var RE_SAFETENSORS_FILE = /\.safetensors$/;
var RE_SAFETENSORS_INDEX_FILE = /\.safetensors\.index\.json$/;
var RE_SAFETENSORS_SHARD_FILE = /^(?<prefix>(?<basePrefix>.*?)[_-])(?<shard>\d{5,6})-of-(?<total>\d{5,6})\.safetensors$/;
function parseSafetensorsShardFilename(filename) {
  const match = RE_SAFETENSORS_SHARD_FILE.exec(filename);
  if (match && match.groups) {
    return {
      prefix: match.groups["prefix"],
      basePrefix: match.groups["basePrefix"],
      shard: match.groups["shard"],
      total: match.groups["total"]
    };
  }
  return null;
}
var PARALLEL_DOWNLOADS = 20;
var MAX_HEADER_LENGTH = 25e6;
var GPTQ_QWEIGHT_SUFFIX = "qweight";
var SafetensorParseError = class extends Error {
};
async function fetchModelConfig(params) {
  try {
    const configBlob = await downloadFile({
      ...params,
      path: "config.json"
    });
    if (!configBlob) {
      return null;
    }
    const config = JSON.parse(await configBlob.text());
    return config;
  } catch (error) {
    return null;
  }
}
async function parseSingleFile(path, params) {
  const blob = await downloadFile({ ...params, path });
  if (!blob) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors header length.`);
  }
  const bufLengthOfHeaderLE = await blob.slice(0, 8).arrayBuffer();
  const lengthOfHeader = new DataView(bufLengthOfHeaderLE).getBigUint64(0, true);
  if (lengthOfHeader <= 0) {
    throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is malformed.`);
  }
  if (lengthOfHeader > MAX_HEADER_LENGTH) {
    throw new SafetensorParseError(
      `Failed to parse file ${path}: safetensor header is too big. Maximum supported size is ${MAX_HEADER_LENGTH} bytes.`
    );
  }
  try {
    const header = JSON.parse(await blob.slice(8, 8 + Number(lengthOfHeader)).text());
    return header;
  } catch (err) {
    throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is not valid JSON.`);
  }
}
async function parseShardedIndex(path, params) {
  const indexBlob = await downloadFile({
    ...params,
    path
  });
  if (!indexBlob) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors index.`);
  }
  try {
    const index = JSON.parse(await indexBlob.slice(0, 2e7).text());
    return index;
  } catch (error) {
    throw new SafetensorParseError(`Failed to parse file ${path}: not a valid JSON.`);
  }
}
async function fetchAllHeaders(path, index, params) {
  const pathPrefix = path.slice(0, path.lastIndexOf("/") + 1);
  const filenames = [...new Set(Object.values(index.weight_map))];
  const shardedMap = Object.fromEntries(
    await promisesQueue(
      filenames.map(
        (filename) => async () => [filename, await parseSingleFile(pathPrefix + filename, params)]
      ),
      PARALLEL_DOWNLOADS
    )
  );
  return shardedMap;
}
async function parseSafetensorsMetadata(params) {
  const repoId = toRepoId(params.repo);
  if (repoId.type !== "model") {
    throw new TypeError("Only model repos should contain safetensors files.");
  }
  const modelConfig = params.computeParametersCount ? await fetchModelConfig(params) : null;
  const quantConfig = modelConfig?.quantization_config;
  if (params.path && RE_SAFETENSORS_FILE.test(params.path) || await fileExists({ ...params, path: SAFETENSORS_FILE })) {
    const header = await parseSingleFile(params.path ?? SAFETENSORS_FILE, params);
    return {
      sharded: false,
      header,
      ...params.computeParametersCount ? {
        parameterCount: computeNumOfParamsByDtypeSingleFile(header, quantConfig),
        parameterTotal: (
          /// shortcut: get param count directly from metadata
          header.__metadata__.total_parameters ? typeof header.__metadata__.total_parameters === "number" ? header.__metadata__.total_parameters : typeof header.__metadata__.total_parameters === "string" ? parseInt(header.__metadata__.total_parameters) : void 0 : void 0
        )
      } : void 0
    };
  } else if (params.path && RE_SAFETENSORS_INDEX_FILE.test(params.path) || await fileExists({ ...params, path: SAFETENSORS_INDEX_FILE })) {
    const path = params.path ?? SAFETENSORS_INDEX_FILE;
    const index = await parseShardedIndex(path, params);
    const shardedMap = await fetchAllHeaders(path, index, params);
    return {
      sharded: true,
      index,
      headers: shardedMap,
      ...params.computeParametersCount ? {
        parameterCount: computeNumOfParamsByDtypeSharded(shardedMap, quantConfig),
        parameterTotal: (
          /// shortcut: get param count directly from metadata
          index.metadata?.total_parameters ? typeof index.metadata.total_parameters === "number" ? index.metadata.total_parameters : typeof index.metadata.total_parameters === "string" ? parseInt(index.metadata.total_parameters) : void 0 : void 0
        )
      } : void 0
    };
  } else {
    throw new Error("model id does not seem to contain safetensors weights");
  }
}
function isQuantizedTensor(tensorName, quantConfig) {
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
function getQuantizationMultiplier(tensorName, dtype, quantConfig) {
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
function computeNumOfParamsByDtypeSingleFile(header, quantConfig) {
  const counter = {};
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
function computeNumOfParamsByDtypeSharded(shardedMap, quantConfig) {
  const counter = {};
  for (const header of Object.values(shardedMap)) {
    for (const [k, v] of typedEntries(computeNumOfParamsByDtypeSingleFile(header, quantConfig))) {
      counter[k] = (counter[k] ?? 0) + (v ?? 0);
    }
  }
  return counter;
}
function getTensorSuffix(tensorName) {
  const lastDotIndex = tensorName.lastIndexOf(".");
  return lastDotIndex === -1 ? tensorName : tensorName.slice(lastDotIndex + 1);
}
function shouldSkipTensor(tensorName, quantConfig) {
  const GPTQ_AWQ_AUXILIARY_SUFFIXES = ["qzeros", "g_idx", "scales"];
  if (!quantConfig) {
    return false;
  }
  const quantMethod = quantConfig.quant_method?.toLowerCase();
  if (!quantMethod || quantMethod !== "gptq" && quantMethod !== "awq") {
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

// src/lib/paths-info.ts
async function pathsInfo(params) {
  const accessToken = checkCredentials(params);
  const repoId = toRepoId(params.repo);
  const hubUrl = params.hubUrl ?? HUB_URL;
  const url = `${hubUrl}/api/${repoId.type}s/${repoId.name}/paths-info/${encodeURIComponent(
    params.revision ?? "main"
  )}`;
  const resp = await (params.fetch ?? fetch)(url, {
    method: "POST",
    headers: {
      ...accessToken && {
        Authorization: `Bearer ${accessToken}`
      },
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      paths: params.paths,
      expand: params.expand
    })
  });
  if (!resp.ok) {
    throw await createApiError(resp);
  }
  const json = await resp.json();
  if (!Array.isArray(json))
    throw new Error("malformed response: expected array");
  return json.map((item) => ({
    path: item.path,
    lfs: item.lfs,
    type: item.type,
    oid: item.oid,
    size: item.size,
    // expand fields
    securityFileStatus: item.securityFileStatus,
    lastCommit: item.lastCommit ? {
      date: new Date(item.lastCommit.date),
      title: item.lastCommit.title,
      id: item.lastCommit.id
    } : void 0
  }));
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

// src/lib/space-info.ts
async function spaceInfo(params) {
  const accessToken = params && checkCredentials(params);
  const search = new URLSearchParams([
    ...SPACE_EXPAND_KEYS.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  const response = await (params.fetch || fetch)(
    `${params?.hubUrl || HUB_URL}/api/spaces/${params.name}/revision/${encodeURIComponent(
      params.revision ?? "HEAD"
    )}?${search.toString()}`,
    {
      headers: {
        ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      }
    }
  );
  if (!response.ok) {
    throw await createApiError(response);
  }
  const data = await response.json();
  return {
    ...params?.additionalFields && pick(data, params.additionalFields),
    id: data._id,
    name: data.id,
    sdk: data.sdk,
    likes: data.likes,
    private: data.private,
    updatedAt: new Date(data.lastModified)
  };
}

// src/lib/upload-file.ts
function uploadFile(params) {
  const path = params.file instanceof URL ? params.file.pathname.split("/").at(-1) ?? "file" : "path" in params.file ? params.file.path : params.file.name;
  return commit({
    ...params.accessToken ? { accessToken: params.accessToken } : { credentials: params.credentials },
    repo: params.repo,
    operations: [
      {
        operation: "addOrUpdate",
        path,
        content: "content" in params.file ? params.file.content : params.file
      }
    ],
    title: params.commitTitle ?? `Add ${path}`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal,
    useXet: params.useXet
  });
}

// src/lib/upload-files.ts
function uploadFiles(params) {
  return commit({
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
    fetch: params.fetch,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal,
    useXet: params.useXet
  });
}

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
    fetch: async (input, init) => {
      if (!init) {
        return fetch(input);
      }
      if (!typedInclude(["PUT", "POST"], init.method) || !("progressHint" in init) || !init.progressHint || typeof XMLHttpRequest === "undefined" || typeof input !== "string" || !(init.body instanceof ArrayBuffer) && !(init.body instanceof Blob) && !(init.body instanceof File) && typeof init.body !== "string") {
        return fetch(input, init);
      }
      const progressHint = init.progressHint;
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
      xhr.open(init.method, input, true);
      if (init.headers) {
        const headers = new Headers(init.headers);
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });
      }
      init.signal?.throwIfAborted();
      xhr.send(init.body);
      return new Promise((resolve2, reject) => {
        xhr.addEventListener("load", () => {
          resolve2(
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
        if (init.signal) {
          init.signal.addEventListener("abort", () => {
            xhr.abort();
            try {
              init.signal?.throwIfAborted();
            } catch (err) {
              reject(err);
            }
          });
        }
      });
    }
  });
}

// src/lib/who-am-i.ts
async function whoAmI(params) {
  const accessToken = checkCredentials(params);
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/whoami-v2`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  const response = await res.json();
  if (typeof response.auth.accessToken?.createdAt === "string") {
    response.auth.accessToken.createdAt = new Date(response.auth.accessToken.createdAt);
  }
  return response;
}
export {
  DATASET_EXPANDABLE_KEYS,
  DATASET_EXPAND_KEYS,
  HUB_URL,
  HubApiError,
  InvalidApiResponseFormatError,
  MODEL_EXPANDABLE_KEYS,
  MODEL_EXPAND_KEYS,
  RE_SAFETENSORS_FILE,
  RE_SAFETENSORS_INDEX_FILE,
  RE_SAFETENSORS_SHARD_FILE,
  SAFETENSORS_FILE,
  SAFETENSORS_INDEX_FILE,
  SPACE_EXPANDABLE_KEYS,
  SPACE_EXPAND_KEYS,
  XetBlob as __internal_XetBlob,
  sha256 as __internal_sha256,
  checkRepoAccess,
  commit,
  commitIter,
  countCommits,
  createBranch,
  createCollection,
  createRepo,
  datasetInfo,
  deleteBranch,
  deleteCollection,
  deleteFile,
  deleteFiles,
  deleteRepo,
  downloadFile,
  fileDownloadInfo,
  fileExists,
  listCollections,
  listCommits,
  listDatasets,
  listFiles,
  listModels,
  listSpaces,
  modelInfo,
  oauthHandleRedirect,
  oauthHandleRedirectIfPresent,
  oauthLoginUrl,
  parseSafetensorsMetadata,
  parseSafetensorsShardFilename,
  pathsInfo,
  repoExists,
  spaceInfo,
  uploadFile,
  uploadFiles,
  uploadFilesWithProgress,
  whoAmI
};
