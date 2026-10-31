import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

let sequence = 0;

// Exercise real modules while isolating external dependencies. MIME and upload-format
// imports always use the shared utilities; serverImports.mjs also checks unmodified imports
// with the production loader, which this isolated loader cannot validate.
export async function loadFunction(path, mocks = {}, globals = {}) {
    const filename = resolve(path);
    const key = `__functionTest${sequence++}`;
    globalThis[key] = { mocks, globals };
    let source = await readFile(filename, 'utf8');
    source = source.replace(/^import\s+\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"];\r?\n/gm, (_, names, specifier) => {
        if (/\/(?:mimeTypes|uploadFormat)(?:\.js)?$/.test(specifier)) {
            const mimePath = specifier.endsWith('.js') ? specifier : `${specifier}.js`;
            return `import {${names}} from ${JSON.stringify(pathToFileURL(resolve(dirname(filename), mimePath)).href)};\n`;
        }
        return `const {${names.replace(/\s+as\s+/g, ':')}} = globalThis.${key}.mocks;\n`;
    });
    source = source.replace(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, specifier) =>
        `export {${names}} from ${JSON.stringify(pathToFileURL(resolve(dirname(filename), specifier)).href)}`);
    source = `const {${Object.keys(globals).join(',')}} = globalThis.${key}.globals;\n${source}\n//# sourceURL=${pathToFileURL(filename).href}\n`;
    try {
        return await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    } finally {
        delete globalThis[key];
    }
}

export function memoryDatabase() {
    const records = new Map();
    return {
        records,
        async get(key) { return records.get(key)?.value ?? null; },
        async getWithMetadata(key) { return structuredClone(records.get(key) ?? null); },
        async put(key, value, options = {}) { records.set(key, { value, metadata: structuredClone(options.metadata || {}) }); },
        async delete(key) { records.delete(key); },
        async list({ prefix = '' } = {}) {
            return {
                keys: [...records.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name, metadata: structuredClone(records.get(name).metadata) })),
                list_complete: true,
            };
        },
    };
}
