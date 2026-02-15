/**
 * SHA256 计算工具
 * 纯 JavaScript 实现的增量 SHA256 哈希算法，支持任意大小文件
 */

// SHA256 常量
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

const rotr = (x, n) => (x >>> n) | (x << (32 - n))

function processBlock(block, H) {
    const W = new Uint32Array(64)

    for (let i = 0; i < 16; i++) {
        W[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3]
    }

    for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = H

    for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
        const ch = (e & f) ^ (~e & g)
        const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
        const maj = (a & b) ^ (a & c) ^ (b & c)
        const temp2 = (S0 + maj) >>> 0

        h = g; g = f; f = e
        e = (d + temp1) >>> 0
        d = c; c = b; b = a
        a = (temp1 + temp2) >>> 0
    }

    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
}

/**
 * 创建增量 SHA256 哈希器
 * @returns {{ update: (data: Uint8Array) => void, digest: () => string }}
 */
export function createSha256() {
    let H = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ])

    let buffer = new Uint8Array(64)
    let bufferLength = 0
    let totalLength = 0

    return {
        update(data) {
            totalLength += data.length
            let offset = 0

            if (bufferLength > 0) {
                const needed = 64 - bufferLength
                const toCopy = Math.min(needed, data.length)
                buffer.set(data.subarray(0, toCopy), bufferLength)
                bufferLength += toCopy
                offset = toCopy

                if (bufferLength === 64) {
                    processBlock(buffer, H)
                    bufferLength = 0
                }
            }

            while (offset + 64 <= data.length) {
                processBlock(data.subarray(offset, offset + 64), H)
                offset += 64
            }

            if (offset < data.length) {
                buffer.set(data.subarray(offset), 0)
                bufferLength = data.length - offset
            }
        },
        digest() {
            const bitLength = totalLength * 8

            // Padding
            buffer[bufferLength++] = 0x80

            if (bufferLength > 56) {
                buffer.fill(0, bufferLength, 64)
                processBlock(buffer, H)
                bufferLength = 0
            }

            buffer.fill(0, bufferLength, 56)

            // Length in bits (big-endian, 64-bit)
            const view = new DataView(buffer.buffer)
            view.setUint32(56, Math.floor(bitLength / 0x100000000), false)
            view.setUint32(60, bitLength >>> 0, false)

            processBlock(buffer, H)

            // Convert to hex
            let hex = ''
            for (let i = 0; i < 8; i++) {
                hex += H[i].toString(16).padStart(8, '0')
            }
            return hex
        }
    }
}

/**
 * 计算文件的 SHA256 哈希
 * 使用增量哈希算法，支持任意大小文件
 * @param {File} file - 要计算哈希的文件
 * @returns {Promise<string>} SHA256 哈希值（十六进制字符串）
 */
export async function computeSha256(file) {
    const sha256 = createSha256()

    const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks
    let offset = 0

    while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
        const buffer = await chunk.arrayBuffer()
        sha256.update(new Uint8Array(buffer))
        offset += CHUNK_SIZE

        // 每处理 20MB 打印一次进度
        if (offset % (20 * 1024 * 1024) < CHUNK_SIZE) {
            console.log(`SHA256 progress: ${Math.min(100, Math.round(offset / file.size * 100))}%`)
        }
    }

    return sha256.digest()
}
