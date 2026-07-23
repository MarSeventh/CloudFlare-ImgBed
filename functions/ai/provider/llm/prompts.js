/**
 * Default prompt templates per capability for LLM providers. These instruct a
 * general vision model to return strict JSON that the provider parses into the
 * same result envelope WD Tagger produces, so the whole downstream path (tag
 * sanitize, KV-limit merge, search index) is reused unchanged.
 *
 * Operators may override any of these through provider config `prompts.<cap>`.
 */
export const DEFAULT_LLM_PROMPTS = Object.freeze({
    // Tagging: force a flat JSON array of short, lowercase, underscore-joined
    // tags. Confidence is intentionally not requested — LLM self-reported scores
    // are unreliable, so the provider defaults every tag to full confidence and
    // relies on the model returning a sensible, bounded set.
    tagging: [
        'You are an image tagging assistant. Look at the image and produce concise',
        'descriptive tags: objects, subjects, setting, style, colors, and notable',
        'attributes. Use short lowercase tags, joining words with underscores',
        '(for example: "long_hair", "city_street", "blue_sky").',
        'Respond with ONLY a JSON object of the exact form {"tags": ["tag1", "tag2"]}.',
        'Do not include commentary, markdown, code fences, or any text outside the JSON.',
        'Return at most 40 of the most relevant tags.'
    ].join(' '),

    // Description: single-sentence caption. Wired in a later milestone; the
    // provider already routes this capability so only the Processor is missing.
    description: [
        'You are an image captioning assistant. Look at the image and write one',
        'concise, factual sentence describing it.',
        'Respond with ONLY a JSON object of the exact form {"caption": "..."}.',
        'Do not include commentary, markdown, code fences, or any text outside the JSON.'
    ].join(' '),

    ocr: [
        'You are an OCR assistant. Extract any visible text from the image.',
        'Respond with ONLY a JSON object of the exact form {"text": "extracted text"}',
        'or {"text": null} if there is no visible text.',
        'Do not include commentary, markdown, code fences, or any text outside the JSON.'
    ].join(' ')
});

/**
 * Resolves the prompt for a capability, preferring an operator override in
 * config.prompts, then the built-in default. Returns '' for unknown capabilities
 * so the provider can reject them cleanly.
 */
export function resolvePrompt(capability, configPrompts = {}) {
    const override = configPrompts?.[capability];
    if (typeof override === 'string' && override.trim() !== '') return override;
    return DEFAULT_LLM_PROMPTS[capability] || '';
}

/**
 * Builds a unified prompt that requests multiple capabilities in a single JSON
 * response. Used when batchMode='unified' and multiple LLM capabilities are enabled.
 */
export function buildUnifiedPrompt(capabilities, configPrompts = {}) {
    const systemOverride = configPrompts?.system;
    if (typeof systemOverride === 'string' && systemOverride.trim()) {
        return systemOverride;
    }

    const fields = [];
    if (capabilities.includes('tagging')) {
        fields.push('"tags": an array of short, lowercase, underscore-joined descriptive keywords (max 40)');
    }
    if (capabilities.includes('description')) {
        fields.push('"description": a single concise sentence describing the image');
    }
    if (capabilities.includes('ocr')) {
        fields.push('"ocr": any visible text in the image, or null if none');
    }

    if (fields.length === 0) return '';

    return [
        'You are an image analysis assistant. Analyze the provided image and respond',
        'with ONLY a JSON object containing the following fields:',
        fields.map((f, i) => `${i + 1}. ${f}`).join(', '),
        '.',
        'Use this exact structure:',
        buildUnifiedSchema(capabilities),
        'Do not include commentary, markdown, code fences, or any text outside the JSON.'
    ].join(' ');
}

function buildUnifiedSchema(capabilities) {
    const schema = {};
    if (capabilities.includes('tagging')) schema.tags = '["tag1", "tag2", ...]';
    if (capabilities.includes('description')) schema.description = '"..."';
    if (capabilities.includes('ocr')) schema.ocr = '"..." or null';
    return JSON.stringify(schema);
}

/**
 * Parses a unified LLM response into separate capability results.
 * Returns a map: { tagging: {tags:[...]}, description: {caption:...}, ocr: {text:...} }
 */
export function parseUnifiedResponse(text, capabilities, maxTags = 40) {
    const results = {};

    // Try parse as JSON
    let parsed;
    try {
        const cleaned = stripCodeFences(text);
        parsed = JSON.parse(cleaned);
    } catch {
        // Fallback: extract first {...} block
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                parsed = JSON.parse(match[0]);
            } catch {
                parsed = {};
            }
        } else {
            parsed = {};
        }
    }

    if (capabilities.includes('tagging')) {
        const tags = parseTags(parsed.tags || [], maxTags);
        results.tagging = { tags };
    }

    if (capabilities.includes('description')) {
        const caption = typeof parsed.description === 'string'
            ? parsed.description.trim()
            : '';
        results.description = { caption };
    }

    if (capabilities.includes('ocr')) {
        const text = typeof parsed.ocr === 'string'
            ? parsed.ocr.trim()
            : (parsed.ocr === null ? null : '');
        results.ocr = { text };
    }

    return results;
}

function stripCodeFences(text) {
    const trimmed = String(text || '').trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
}

function parseTags(rawTags, maxTags) {
    if (!Array.isArray(rawTags)) return [];
    const seen = new Set();
    const tags = [];
    for (const entry of rawTags) {
        const name = typeof entry === 'string'
            ? entry.trim()
            : (entry?.name || entry?.tag || '').trim();
        if (!name || name.length > 128) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push({ name, confidence: 1 });
        if (tags.length >= maxTags) break;
    }
    return tags;
}
