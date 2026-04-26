/**
 * 本地 R2 存储适配器
 * 使用本地文件系统模拟 Cloudflare R2 的 API 接口
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

export class LocalR2Storage {
    constructor(basePath) {
        this.basePath = basePath;
        mkdirSync(basePath, { recursive: true });
    }

    _filePath(key) {
        return join(this.basePath, key);
    }

    /**
     * 获取文件（模拟 R2 的 get 方法）
     * 支持 Range 请求
     */
    async get(key, options) {
        const filePath = this._filePath(key);
        if (!existsSync(filePath)) return null;

        const stats = statSync(filePath);
        const size = stats.size;
        let body;
        let range;

        if (options && options.range) {
            const offset = options.range.offset || 0;
            const length = options.range.length || (size - offset);
            const end = offset + length - 1;
            const nodeStream = createReadStream(filePath, { start: offset, end: end });
            body = Readable.toWeb(nodeStream);
            range = { offset, length };
        } else {
            const nodeStream = createReadStream(filePath);
            body = Readable.toWeb(nodeStream);
        }

        return {
            body,
            size,
            range,
            httpMetadata: {},
            writeHttpMetadata(headers) {
                // 本地存储不设置额外的 HTTP 元数据
            }
        };
    }

    /**
     * 存储文件（模拟 R2 的 put 方法）
     * 支持多种输入类型
     */
    async put(key, value) {
        const filePath = this._filePath(key);
        mkdirSync(dirname(filePath), { recursive: true });

        let buffer;
        if (value instanceof Blob || (typeof File !== 'undefined' && value instanceof File)) {
            buffer = Buffer.from(await value.arrayBuffer());
        } else if (value instanceof ArrayBuffer) {
            buffer = Buffer.from(value);
        } else if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
            buffer = Buffer.from(value);
        } else if (value instanceof ReadableStream) {
            const reader = value.getReader();
            const chunks = [];
            while (true) {
                const { done, value: chunk } = await reader.read();
                if (done) break;
                chunks.push(chunk);
            }
            buffer = Buffer.concat(chunks);
        } else if (typeof value === 'string') {
            buffer = Buffer.from(value, 'utf-8');
        } else {
            buffer = Buffer.from(String(value), 'utf-8');
        }

        writeFileSync(filePath, buffer);
    }

    /**
     * 删除文件（模拟 R2 的 delete 方法）
     */
    async delete(key) {
        const filePath = this._filePath(key);
        if (existsSync(filePath)) {
            unlinkSync(filePath);
        }
    }

    /**
     * 创建分块上传（模拟 R2 的 createMultipartUpload 方法）
     */
    async createMultipartUpload(key) {
        const uploadId = randomUUID();
        const uploadDir = join(this.basePath, '_multipart', uploadId);
        mkdirSync(uploadDir, { recursive: true });

        // 保存 key 映射
        writeFileSync(join(uploadDir, '_key'), key);

        return {
            uploadId,
            key,
            ...this._createMultipartMethods(key, uploadId)
        };
    }

    /**
     * 恢复分块上传（模拟 R2 的 resumeMultipartUpload 方法）
     */
    resumeMultipartUpload(key, uploadId) {
        return {
            uploadId,
            key,
            ...this._createMultipartMethods(key, uploadId)
        };
    }

    _createMultipartMethods(key, uploadId) {
        const self = this;
        const uploadDir = join(this.basePath, '_multipart', uploadId);

        return {
            async uploadPart(partNumber, data) {
                mkdirSync(uploadDir, { recursive: true });
                const partPath = join(uploadDir, `part_${String(partNumber).padStart(6, '0')}`);
                let buffer;
                if (data instanceof ArrayBuffer) {
                    buffer = Buffer.from(data);
                } else if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
                    buffer = Buffer.from(data);
                } else if (data instanceof Blob) {
                    buffer = Buffer.from(await data.arrayBuffer());
                } else if (data instanceof ReadableStream) {
                    const reader = data.getReader();
                    const chunks = [];
                    while (true) {
                        const { done, value: chunk } = await reader.read();
                        if (done) break;
                        chunks.push(chunk);
                    }
                    buffer = Buffer.concat(chunks);
                } else {
                    buffer = Buffer.from(data);
                }
                writeFileSync(partPath, buffer);
                return { etag: `etag_${partNumber}`, partNumber };
            },

            async complete(parts) {
                // 按 partNumber 排序合并所有分块
                const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);
                const chunks = [];
                for (const part of sortedParts) {
                    const partPath = join(uploadDir, `part_${String(part.partNumber).padStart(6, '0')}`);
                    if (existsSync(partPath)) {
                        chunks.push(readFileSync(partPath));
                    }
                }
                const merged = Buffer.concat(chunks);
                await self.put(key, merged);

                // 清理分块目录
                self._cleanupDir(uploadDir);
            },

            async abort() {
                // 清理分块目录
                self._cleanupDir(uploadDir);
            }
        };
    }

    _cleanupDir(dir) {
        if (existsSync(dir)) {
            try {
                rmSync(dir, { recursive: true, force: true });
            } catch (e) {
                console.error('Cleanup error:', e.message);
            }
        }
    }
}
