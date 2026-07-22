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
